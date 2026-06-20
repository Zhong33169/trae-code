import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional

from database import get_db
from models import (
    LoginRequest, CreateApplicationRequest, ActionRequest, BatchActionRequest,
    ApplicationResponse, ApplicationListItem, MaterialItem,
    QueueStats, CorrectionRecordResponse, ProcessRecordResponse,
    AuditLogResponse, DashboardStats,
)
from workflow import (
    validate_action, get_target_status, get_current_role_for_status,
    calculate_deadline, check_overdue, validate_materials_for_submit,
    validate_opinion_required, get_overdue_action_text,
)
from config import (
    QUEUE_MAP, ACTIONS, STATUS_COMPLETED, STATUS_OVERDUE,
    STATUS_DRAFT, STATUS_PENDING_REVIEW, STATUS_PENDING_CORRECTION,
    STATUS_UNDER_REVIEW, STATUS_REJECTED, STATUS_PENDING_ARCHIVAL,
    STATUS_UNDER_ARCHIVAL, REQUIRED_MATERIALS,
)

router = APIRouter()


async def get_current_user(request: Request):
    username = request.headers.get("X-User")
    if not username:
        raise HTTPException(status_code=401, detail="未登录，请先选择岗位")
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = await cursor.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="用户不存在")
        return dict(user)
    finally:
        await db.close()


async def log_audit(db, application_id: int | None, action: str, user: dict, detail: str = None, ip: str = None):
    await db.execute(
        """INSERT INTO audit_logs (application_id, action, actor_id, actor_name, actor_role, detail, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (application_id, action, user["id"], user["display_name"], user["role"], detail, ip),
    )


@router.post("/auth/login")
async def login(req: LoginRequest):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (req.username,))
        user = await cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        return dict(user)
    finally:
        await db.close()


@router.get("/users")
async def list_users():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM users ORDER BY id")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT status, current_role, deadline_at, overdue_reason FROM transfer_applications")
        rows = await cursor.fetchall()

        by_status = {}
        by_role = {}
        overdue_count = 0

        for r in rows:
            status = r["status"]
            role = r["current_role"]
            by_status[status] = by_status.get(status, 0) + 1
            by_role[role] = by_role.get(role, 0) + 1

            if r["overdue_reason"] or r["status"] == STATUS_OVERDUE:
                overdue_count += 1
            elif r["deadline_at"]:
                try:
                    deadline = datetime.strptime(r["deadline_at"], "%Y-%m-%d %H:%M:%S")
                    if datetime.now() > deadline and status not in (STATUS_COMPLETED, STATUS_DRAFT):
                        overdue_count += 1
                except (ValueError, TypeError):
                    pass

        return DashboardStats(
            total=len(rows),
            by_status=by_status,
            by_role=by_role,
            overdue_count=overdue_count,
        )
    finally:
        await db.close()


@router.get("/applications", response_model=list[ApplicationListItem])
async def list_applications(
    role: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
):
    db = await get_db()
    try:
        conditions = []
        params = []

        if role:
            statuses = QUEUE_MAP.get(role, [])
            if statuses:
                placeholders = ",".join(["?"] * len(statuses))
                conditions.append(f"status IN ({placeholders})")
                params.extend(statuses)

        if status:
            conditions.append("status = ?")
            params.append(status)

        if keyword:
            conditions.append("(application_no LIKE ? OR seller_name LIKE ? OR buyer_name LIKE ? OR vehicle_plate LIKE ?)")
            kw = f"%{keyword}%"
            params.extend([kw, kw, kw, kw])

        where = " WHERE " + " AND ".join(conditions) if conditions else ""

        cursor = await db.execute(f"""
            SELECT a.*, u.display_name as assignee_name,
                   pr.action as last_action, pr.opinion as last_action_result
            FROM transfer_applications a
            LEFT JOIN users u ON a.assignee_id = u.id
            LEFT JOIN (
                SELECT application_id, action, opinion,
                       ROW_NUMBER() OVER (PARTITION BY application_id ORDER BY created_at DESC) as rn
                FROM process_records
            ) pr ON a.id = pr.application_id AND pr.rn = 1
            {where}
            ORDER BY a.updated_at DESC
        """, params)
        rows = await cursor.fetchall()

        result = []
        for r in rows:
            item = dict(r)
            is_overdue = False
            if item["deadline_at"] and item["status"] not in (STATUS_COMPLETED, STATUS_DRAFT):
                try:
                    deadline = datetime.strptime(item["deadline_at"], "%Y-%m-%d %H:%M:%S")
                    if datetime.now() > deadline:
                        is_overdue = True
                        if not item["overdue_reason"]:
                            item["overdue_reason"] = "超过处理时限"
                        if not item["overdue_action"]:
                            item["overdue_action"] = get_overdue_action_text(item["status"])
                except (ValueError, TypeError):
                    pass

            item["is_overdue"] = is_overdue or item["status"] == STATUS_OVERDUE
            result.append(ApplicationListItem(**item))

        return result
    finally:
        await db.close()


@router.get("/applications/{app_id}", response_model=ApplicationResponse)
async def get_application(app_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT a.*, u.display_name as assignee_name
            FROM transfer_applications a
            LEFT JOIN users u ON a.assignee_id = u.id
            WHERE a.id = ?
        """, (app_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="过户申请不存在")

        app = dict(row)

        cursor = await db.execute("SELECT * FROM materials WHERE application_id = ?", (app_id,))
        mats = await cursor.fetchall()
        app["materials"] = [dict(m) for m in mats]

        cursor = await db.execute(
            "SELECT action, opinion FROM process_records WHERE application_id = ? ORDER BY created_at DESC LIMIT 1",
            (app_id,),
        )
        last = await cursor.fetchone()
        app["last_action"] = last["action"] if last else None
        app["last_action_result"] = last["opinion"] if last else None

        is_overdue, overdue_reason, overdue_action = check_overdue(app)
        if is_overdue and app["status"] != STATUS_OVERDUE:
            app["is_overdue_flag"] = True
            if not app["overdue_reason"]:
                app["overdue_reason"] = overdue_reason
            if not app["overdue_action"]:
                app["overdue_action"] = overdue_action

        return ApplicationResponse(**app)
    finally:
        await db.close()


@router.post("/applications", response_model=ApplicationResponse)
async def create_application(req: CreateApplicationRequest, user: dict = Depends(get_current_user)):
    if user["role"] != "登记员":
        raise HTTPException(status_code=403, detail="只有登记员可以发起过户申请")

    db = await get_db()
    try:
        cursor = await db.execute("SELECT COUNT(*) FROM transfer_applications")
        count = (await cursor.fetchone())[0]
        app_no = f"TF-2026-{count + 1:04d}"

        cursor = await db.execute(
            """INSERT INTO transfer_applications
            (application_no, seller_name, seller_id_no, buyer_name, buyer_id_no,
             vehicle_plate, vehicle_vin, vehicle_brand, status, current_role, assignee_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (app_no, req.seller_name, req.seller_id_no, req.buyer_name, req.buyer_id_no,
             req.vehicle_plate, req.vehicle_vin, req.vehicle_brand,
             STATUS_DRAFT, "登记员", user["id"]),
        )
        app_id = cursor.lastrowid

        for mat_name in REQUIRED_MATERIALS:
            await db.execute(
                """INSERT INTO materials (application_id, name, is_required, is_submitted, category)
                VALUES (?, ?, 1, 0, 'transfer')""",
                (app_id, mat_name),
            )

        await log_audit(db, app_id, "发起申请", user, f"创建过户申请 {app_no}")
        await db.commit()

        return await get_application(app_id, user)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()


@router.post("/applications/{app_id}/action")
async def execute_action(
    app_id: int,
    req: ActionRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = await get_db()
    try:
        await db.execute("BEGIN IMMEDIATE")

        cursor = await db.execute("SELECT * FROM transfer_applications WHERE id = ?", (app_id,))
        app = await cursor.fetchone()
        if not app:
            raise HTTPException(status_code=404, detail="过户申请不存在")
        app = dict(app)

        if app["version"] != req.version:
            await db.rollback()
            msg = f"数据版本冲突：当前版本为 {app['version']}，您提交的版本为 {req.version}，请刷新后重试"
            await db.execute("BEGIN IMMEDIATE")
            await log_audit(db, app_id, f"{req.action}(失败)", user,
                           f"并发冲突: {msg}",
                           request.client.host if request.client else None)
            await db.execute(
                """INSERT INTO process_records
                (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (app_id, f"{req.action}(失败)", app["status"], None,
                 user["id"], user["display_name"], user["role"], msg),
            )
            await db.commit()
            raise HTTPException(
                status_code=409,
                detail=msg
            )

        valid, msg = validate_action(user["role"], req.action, app["status"])
        if not valid:
            await log_audit(db, app_id, f"越权尝试: {req.action}", user,
                           f"角色 {user['role']} 尝试在状态 {app['status']} 执行 {req.action}: {msg}",
                           request.client.host if request.client else None)
            await db.commit()
            raise HTTPException(status_code=403, detail=msg)

        cursor = await db.execute("SELECT * FROM materials WHERE application_id = ?", (app_id,))
        materials = [dict(m) for m in await cursor.fetchall()]

        if req.materials:
            for m in req.materials:
                if m.id:
                    await db.execute(
                        "UPDATE materials SET is_submitted = ?, submitted_at = ?, remarks = ? WHERE id = ? AND application_id = ?",
                        (int(m.is_submitted),
                         datetime.now().strftime("%Y-%m-%d %H:%M:%S") if m.is_submitted else None,
                         m.remarks, m.id, app_id),
                    )

        if req.correction_materials:
            for m in req.correction_materials:
                if m.id:
                    await db.execute(
                        "UPDATE materials SET is_submitted = ?, submitted_at = ?, remarks = ? WHERE id = ? AND application_id = ?",
                        (int(m.is_submitted),
                         datetime.now().strftime("%Y-%m-%d %H:%M:%S") if m.is_submitted else None,
                         m.remarks, m.id, app_id),
                    )

        await db.execute("COMMIT")
        await db.execute("BEGIN IMMEDIATE")

        cursor = await db.execute("SELECT * FROM materials WHERE application_id = ?", (app_id,))
        materials = [dict(m) for m in await cursor.fetchall()]

        valid, msg = validate_materials_for_submit(app["status"], materials, req.action)
        if not valid:
            await db.rollback()
            raise HTTPException(status_code=400, detail=msg)

        valid, msg = validate_opinion_required(req.action, req.opinion)
        if not valid:
            await db.rollback()
            raise HTTPException(status_code=400, detail=msg)

        target_status = get_target_status(user["role"], req.action)
        new_role = get_current_role_for_status(target_status)
        new_deadline = calculate_deadline(target_status)
        new_assignee = None

        cursor = await db.execute("SELECT id FROM users WHERE role = ? LIMIT 1", (new_role,))
        new_assignee_row = await cursor.fetchone()
        if new_assignee_row:
            new_assignee = new_assignee_row["id"]

        overdue_reason = None
        overdue_action = None

        if app["status"] == STATUS_OVERDUE and req.action in ("提交审核", "补正提交"):
            overdue_reason = "逾期后重新提交"
            overdue_action = None

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await db.execute(
            """UPDATE transfer_applications
            SET status = ?, current_role = ?, assignee_id = ?, deadline_at = ?,
                overdue_reason = ?, overdue_action = ?, updated_at = ?, version = version + 1
            WHERE id = ? AND version = ?""",
            (target_status, new_role, new_assignee, new_deadline,
             overdue_reason, overdue_action, now_str, app_id, app["version"]),
        )
        updated = await db.execute("SELECT changes()")
        changed = (await updated.fetchone())[0]
        if changed == 0:
            await db.rollback()
            raise HTTPException(status_code=409, detail="并发冲突：数据已被其他操作修改，请刷新后重试")

        await db.execute(
            """INSERT INTO process_records
            (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion, materials_snapshot)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (app_id, req.action, app["status"], target_status,
             user["id"], user["display_name"], user["role"], req.opinion,
             json.dumps([{k: v for k, v in m.items() if k in ("name", "is_submitted", "category")} for m in materials])),
        )

        if req.action == "要求补正":
            correction_no = f"BC-{app['application_no']}"
            required_mat_names = [m["name"] for m in materials if not m["is_submitted"] and m["is_required"]]
            correction_deadline = (datetime.now() + timedelta(hours=72)).strftime("%Y-%m-%d %H:%M:%S")
            await db.execute(
                """INSERT INTO correction_records
                (application_id, correction_no, reason, required_materials, deadline_at, status, review_opinion)
                VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (app_id, correction_no, req.opinion or "审核发现材料问题",
                 json.dumps(required_mat_names), correction_deadline, "待补正", req.opinion),
            )

            for mat_name in ["补正说明", "补正材料"]:
                await db.execute(
                    """INSERT INTO materials (application_id, name, is_required, is_submitted, category)
                    VALUES (?, ?, 1, 0, 'correction')""",
                    (app_id, mat_name),
                )

        await log_audit(
            db, app_id, req.action, user,
            f"从 {app['status']} -> {target_status}，意见: {req.opinion or '无'}",
            request.client.host if request.client else None,
        )

        await db.commit()

        return {"success": True, "message": f"操作 {req.action} 执行成功", "new_status": target_status}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()


@router.post("/applications/batch-action")
async def batch_action(
    req: BatchActionRequest,
    request: Request,
    user: dict = Depends(get_current_user),
):
    if req.action not in ACTIONS.get(user["role"], []):
        raise HTTPException(status_code=403, detail=f"角色 {user['role']} 无权执行动作 {req.action}")

    db = await get_db()
    try:
        results = []
        ip = request.client.host if request.client else None

        for app_id in req.application_ids:
            try:
                await db.execute("BEGIN IMMEDIATE")

                cursor = await db.execute("SELECT * FROM transfer_applications WHERE id = ?", (app_id,))
                app = await cursor.fetchone()
                if not app:
                    await db.rollback()
                    results.append({"id": app_id, "success": False, "error": "申请不存在"})
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, "原因: 申请不存在", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", None, None,
                         user["id"], user["display_name"], user["role"], "申请不存在"),
                    )
                    await db.commit()
                    continue

                app = dict(app)

                valid, msg = validate_action(user["role"], req.action, app["status"])
                if not valid:
                    await db.rollback()
                    results.append({"id": app_id, "success": False, "error": msg})
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"越权/顺序错误: {msg}", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", app["status"], None,
                         user["id"], user["display_name"], user["role"], msg),
                    )
                    await db.commit()
                    continue

                cursor = await db.execute("SELECT * FROM materials WHERE application_id = ?", (app_id,))
                materials = [dict(m) for m in await cursor.fetchall()]

                valid, msg = validate_materials_for_submit(app["status"], materials, req.action)
                if not valid:
                    await db.rollback()
                    results.append({"id": app_id, "success": False, "error": msg})
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"材料缺失: {msg}", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", app["status"], None,
                         user["id"], user["display_name"], user["role"], msg),
                    )
                    await db.commit()
                    continue

                valid, msg = validate_opinion_required(req.action, req.opinion)
                if not valid:
                    await db.rollback()
                    results.append({"id": app_id, "success": False, "error": msg})
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"意见缺失: {msg}", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", app["status"], None,
                         user["id"], user["display_name"], user["role"], msg),
                    )
                    await db.commit()
                    continue

                is_overdue, overdue_reason, overdue_action = check_overdue(app)
                if is_overdue and app["status"] != STATUS_OVERDUE:
                    if req.action in ("开始审核", "审核通过", "复核归档", "开始复核"):
                        await db.rollback()
                        msg = f"申请已逾期，{overdue_reason}，需先处理逾期: {overdue_action}"
                        results.append({"id": app_id, "success": False, "error": msg})
                        await db.execute("BEGIN IMMEDIATE")
                        await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"逾期拦截: {msg}", ip)
                        await db.execute(
                            """INSERT INTO process_records
                            (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                            (app_id, f"批量{req.action}(失败)", app["status"], None,
                             user["id"], user["display_name"], user["role"], msg),
                        )
                        await db.commit()
                        continue

                target_status = get_target_status(user["role"], req.action)
                new_role = get_current_role_for_status(target_status)
                new_deadline = calculate_deadline(target_status)

                cursor = await db.execute("SELECT id FROM users WHERE role = ? LIMIT 1", (new_role,))
                new_assignee_row = await cursor.fetchone()
                new_assignee = new_assignee_row["id"] if new_assignee_row else None

                new_overdue_reason = None
                new_overdue_action = None
                if app["status"] == STATUS_OVERDUE and req.action in ("提交审核", "补正提交"):
                    new_overdue_reason = "逾期后重新提交"

                now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                await db.execute(
                    """UPDATE transfer_applications
                    SET status = ?, current_role = ?, assignee_id = ?, deadline_at = ?,
                        overdue_reason = ?, overdue_action = ?, updated_at = ?, version = version + 1
                    WHERE id = ? AND version = ?""",
                    (target_status, new_role, new_assignee, new_deadline,
                     new_overdue_reason, new_overdue_action, now_str, app_id, app["version"]),
                )
                changed = (await (await db.execute("SELECT changes()")).fetchone())[0]
                if changed == 0:
                    await db.rollback()
                    msg = "并发冲突：数据已被其他操作修改，请刷新后重试"
                    results.append({"id": app_id, "success": False, "error": msg})
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"并发冲突: {msg}", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", app["status"], None,
                         user["id"], user["display_name"], user["role"], msg),
                    )
                    await db.commit()
                    continue

                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion, materials_snapshot)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, f"批量{req.action}", app["status"], target_status,
                     user["id"], user["display_name"], user["role"], req.opinion,
                     json.dumps([{k: v for k, v in m.items() if k in ("name", "is_submitted", "category")} for m in materials])),
                )

                await log_audit(db, app_id, f"批量{req.action}", user,
                               f"从 {app['status']} -> {target_status}，意见: {req.opinion or '无'}", ip)

                await db.commit()
                results.append({"id": app_id, "success": True, "new_status": target_status})

            except Exception as inner_e:
                await db.rollback()
                msg = f"系统错误: {str(inner_e)}"
                results.append({"id": app_id, "success": False, "error": msg})
                try:
                    await db.execute("BEGIN IMMEDIATE")
                    await log_audit(db, app_id, f"批量{req.action}(失败)", user, f"系统错误: {msg}", ip)
                    await db.execute(
                        """INSERT INTO process_records
                        (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                        (app_id, f"批量{req.action}(失败)", None, None,
                         user["id"], user["display_name"], user["role"], msg),
                    )
                    await db.commit()
                except Exception:
                    pass

        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()


@router.get("/applications/{app_id}/corrections", response_model=list[CorrectionRecordResponse])
async def get_corrections(app_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM correction_records WHERE application_id = ? ORDER BY created_at DESC", (app_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/applications/{app_id}/process-records", response_model=list[ProcessRecordResponse])
async def get_process_records(app_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM process_records WHERE application_id = ? ORDER BY created_at DESC", (app_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/applications/{app_id}/audit-logs", response_model=list[AuditLogResponse])
async def get_audit_logs(app_id: int, user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM audit_logs WHERE application_id = ? ORDER BY created_at DESC", (app_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


@router.get("/queue/{role}", response_model=QueueStats)
async def get_queue(role: str, user: dict = Depends(get_current_user)):
    if role not in QUEUE_MAP:
        raise HTTPException(status_code=400, detail=f"角色 {role} 不存在")

    db = await get_db()
    try:
        statuses = QUEUE_MAP[role]
        placeholders = ",".join(["?"] * len(statuses))
        cursor = await db.execute(
            f"SELECT status, COUNT(*) as cnt FROM transfer_applications WHERE status IN ({placeholders}) GROUP BY status",
            statuses,
        )
        rows = await cursor.fetchall()

        status_counts = {s: 0 for s in statuses}
        total = 0
        for r in rows:
            status_counts[r["status"]] = r["cnt"]
            total += r["cnt"]

        return QueueStats(role=role, total=total, statuses=status_counts)
    finally:
        await db.close()


@router.get("/roles")
async def get_roles():
    return [
        {"role": "登记员", "actions": ACTIONS["登记员"], "statuses": QUEUE_MAP["登记员"]},
        {"role": "审核主管", "actions": ACTIONS["审核主管"], "statuses": QUEUE_MAP["审核主管"]},
        {"role": "复核负责人", "actions": ACTIONS["复核负责人"], "statuses": QUEUE_MAP["复核负责人"]},
    ]


@router.post("/overdue-check")
async def trigger_overdue_check(user: dict = Depends(get_current_user)):
    db = await get_db()
    try:
        cursor = await db.execute(
            f"""SELECT id, status, deadline_at, overdue_reason FROM transfer_applications
            WHERE status NOT IN (?, ?, ?) AND deadline_at IS NOT NULL""",
            (STATUS_COMPLETED, STATUS_DRAFT, STATUS_OVERDUE),
        )
        rows = await cursor.fetchall()

        updated = 0
        for r in rows:
            app = dict(r)
            is_overdue, reason, action = check_overdue(app)
            if is_overdue and app["status"] != STATUS_OVERDUE:
                await db.execute(
                    """UPDATE transfer_applications
                    SET overdue_reason = ?, overdue_action = ?, updated_at = ?
                    WHERE id = ?""",
                    (reason, action, datetime.now().strftime("%Y-%m-%d %H:%M:%S"), app["id"]),
                )
                await log_audit(db, app["id"], "逾期检测", user, f"检测到逾期: {reason}")
                updated += 1

        await db.commit()
        return {"checked": len(rows), "updated": updated}
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        await db.close()

