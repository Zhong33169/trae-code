from datetime import timedelta, timezone, datetime
from django.db import transaction
from django.utils import timezone as dj_timezone
import uuid

from .models import Application, ApplicationMaterial, ScanRecord, AuditLog, BatchFailRecord
from apps.auth.models import User

STATUS_FLOW = {
    "submit": {"from": "draft", "to": "pending_verify", "role": "community_worker"},
    "verify": {"from": "pending_verify", "to": "pending_approve", "role": "clerk"},
    "approve": {"from": "pending_approve", "to": "approved", "role": "leader"},
    "reject_verify": {"from": "pending_verify", "to": "rejected", "role": "clerk"},
    "reject_approve": {"from": "pending_approve", "to": "rejected", "role": "leader"},
}

ROLE_NAMES = {"community_worker": "社区专干", "clerk": "街道科员", "leader": "分管领导"}


class ApplicationService:
    @staticmethod
    def create(user: User, data: dict) -> Application:
        now_year = dj_timezone.now().year
        last_app = Application.objects.filter(
            application_no__startswith=f"BF{now_year}"
        ).order_by("-application_no").first()
        if last_app:
            seq = int(last_app.application_no[-4:]) + 1
        else:
            seq = 1
        application_no = f"BF{now_year}{seq:04d}"

        app = Application.objects.create(
            application_no=application_no,
            creator=user,
            applicant_name=data["applicant_name"],
            applicant_id_card=data["applicant_id_card"],
            difficulty_type=data["difficulty_type"],
            difficulty_description=data["difficulty_description"],
            assistance_amount=data["assistance_amount"],
            status="draft",
            deadline=dj_timezone.now() + timedelta(days=7),
        )
        AuditLog.objects.create(
            application=app,
            operator=user,
            action="create",
            from_status="",
            to_status="draft",
            opinion="创建帮扶申请",
        )
        return app

    @staticmethod
    def _resolve_flow(user: User, action: str):
        if action == "reject":
            if user.role == "clerk":
                return STATUS_FLOW["reject_verify"]
            elif user.role == "leader":
                return STATUS_FLOW["reject_approve"]
            return None
        return STATUS_FLOW.get(action)

    @staticmethod
    def get_available_actions(user: User, application: Application) -> list:
        actions = []
        status = application.status
        role = user.role

        if status == "draft":
            if role == "community_worker" and application.creator_id == user.id:
                actions.append("submit")
        elif status == "pending_verify":
            if role == "clerk":
                actions.append("verify")
                actions.append("reject")
        elif status == "pending_approve":
            if role == "leader":
                actions.append("approve")
                actions.append("reject")
        return actions

    @staticmethod
    def can_view(user: User, application: Application) -> bool:
        if user.role == "leader":
            return True
        if user.role == "clerk":
            return application.status in ["pending_verify", "pending_approve", "approved", "rejected"]
        if user.role == "community_worker":
            return application.creator_id == user.id
        return False

    @staticmethod
    def validate_role_for_status(user: User, action: str) -> dict:
        flow = ApplicationService._resolve_flow(user, action)
        if not flow:
            return {"valid": False, "error": "无权限执行此操作", "suggestion": "操作不被允许"}

        if user.role != flow["role"]:
            return {
                "valid": False,
                "error": f"角色不匹配: 当前角色为{ROLE_NAMES.get(user.role, user.role)}, 需要{ROLE_NAMES.get(flow['role'], flow['role'])}",
                "suggestion": f"请由{ROLE_NAMES.get(flow['role'], flow['role'])}执行此操作",
            }
        return {"valid": True, "flow": flow}

    @staticmethod
    def validate_materials(application: Application, action: str, pending_materials: list = None) -> dict:
        stage_map = {
            "submit": "application",
            "verify": "verification",
            "approve": "approval",
        }
        stage = stage_map.get(action)
        if not stage:
            return {"valid": True}

        existing = ApplicationMaterial.objects.filter(
            application=application, stage=stage
        ).exists()

        pending_count = 0
        if pending_materials:
            pending_count = sum(1 for m in pending_materials if m.get("stage") == stage)

        if not existing and pending_count == 0:
            stage_display = {"application": "申请", "verification": "核实", "approval": "审批"}.get(stage, stage)
            return {
                "valid": False,
                "error": f"缺少{stage_display}阶段材料",
                "suggestion": f"请先上传{stage_display}阶段的相关材料后再推进",
            }
        return {"valid": True}

    @staticmethod
    def check_optimistic_lock(application: Application, version: int) -> dict:
        if application.version != version:
            return {
                "valid": False,
                "error": "数据已被其他人修改，请刷新后重试",
                "suggestion": "当前版本已过期，请重新获取最新数据",
            }
        return {"valid": True}

    @staticmethod
    def validate_deadline(application: Application, overdue_reason: str = "") -> dict:
        if not application.deadline:
            return {"valid": True, "is_overdue": False, "check": "no_deadline"}
        now = dj_timezone.now()
        is_overdue = now > application.deadline
        if is_overdue:
            days = (now - application.deadline).days
            if not overdue_reason or not overdue_reason.strip():
                return {
                    "valid": False,
                    "is_overdue": True,
                    "check": "overdue_missing_reason",
                    "error": f"申请已逾期{days}天，必须填写逾期说明",
                    "suggestion": f"请在「逾期说明」栏填写原因（已逾期{days}天，原截止日期：{application.deadline.strftime('%Y-%m-%d')}）",
                }
        return {"valid": True, "is_overdue": is_overdue, "check": "overdue_with_reason" if is_overdue else "on_time"}

    @staticmethod
    def validate_opinion(action: str, opinion: str) -> dict:
        require_opinion = {"submit", "verify", "approve", "reject"}
        if action in require_opinion and (not opinion or not opinion.strip()):
            stage_display = {
                "submit": "困难帮扶提交",
                "verify": "入户核实",
                "approve": "救助确认",
                "reject": "驳回",
            }.get(action, action)
            return {
                "valid": False,
                "error": f"{stage_display}必须填写处理意见",
                "suggestion": f"请在「处理意见」栏填写{stage_display}意见后再提交",
            }
        return {"valid": True}

    @staticmethod
    @transaction.atomic
    def advance(user: User, application_id: int, action: str, opinion: str = "",
                materials: list = None, version: int = 1, overdue_reason: str = "") -> dict:
        try:
            application = Application.objects.select_for_update().get(id=application_id)
        except Application.DoesNotExist:
            return {"success": False, "error": "申请不存在", "suggestion": "请检查申请ID是否正确"}

        from_status = application.status

        lock_check = ApplicationService.check_optimistic_lock(application, version)
        if not lock_check["valid"]:
            AuditLog.objects.create(
                application=application,
                operator=user,
                action=action,
                from_status=from_status,
                to_status="",
                opinion=opinion,
                operator_role=user.role,
                client_version=version,
                deadline_check="",
                failure_reason=lock_check["error"],
                extra_data={"version": application.version, "failure": "optimistic_lock"},
            )
            return {"success": False, "error": lock_check["error"], "suggestion": lock_check["suggestion"]}

        role_check = ApplicationService.validate_role_for_status(user, action)
        if not role_check["valid"]:
            AuditLog.objects.create(
                application=application,
                operator=user,
                action=action,
                from_status=from_status,
                to_status="",
                opinion=opinion,
                operator_role=user.role,
                client_version=version,
                deadline_check="",
                failure_reason=role_check["error"],
                extra_data={"failure": "role_mismatch"},
            )
            return {"success": False, "error": role_check["error"], "suggestion": role_check["suggestion"]}

        flow = role_check["flow"]

        if application.status != flow["from"]:
            err = f"流程顺序错误: 当前状态为{application.get_status_display()}, 无法执行此操作"
            AuditLog.objects.create(
                application=application,
                operator=user,
                action=action,
                from_status=from_status,
                to_status="",
                opinion=opinion,
                operator_role=user.role,
                client_version=version,
                deadline_check="",
                failure_reason=err,
                extra_data={"failure": "wrong_order"},
            )
            return {"success": False, "error": err, "suggestion": "请按流程顺序操作"}

        opinion_check = ApplicationService.validate_opinion(action, opinion)
        if not opinion_check["valid"]:
            AuditLog.objects.create(
                application=application,
                operator=user,
                action=action,
                from_status=from_status,
                to_status="",
                opinion=opinion,
                operator_role=user.role,
                client_version=version,
                deadline_check="",
                failure_reason=opinion_check["error"],
                extra_data={"failure": "missing_opinion"},
            )
            return {"success": False, "error": opinion_check["error"], "suggestion": opinion_check["suggestion"]}

        if action != "reject":
            mat_check = ApplicationService.validate_materials(application, action, materials)
            if not mat_check["valid"]:
                AuditLog.objects.create(
                    application=application,
                    operator=user,
                    action=action,
                    from_status=from_status,
                    to_status="",
                    opinion=opinion,
                    operator_role=user.role,
                    client_version=version,
                    deadline_check="",
                    failure_reason=mat_check["error"],
                    extra_data={"failure": "missing_materials"},
                )
                return {"success": False, "error": mat_check["error"], "suggestion": mat_check["suggestion"]}

        deadline_check = ApplicationService.validate_deadline(application, overdue_reason)
        if not deadline_check["valid"]:
            AuditLog.objects.create(
                application=application,
                operator=user,
                action=action,
                from_status=from_status,
                to_status="",
                opinion=opinion,
                operator_role=user.role,
                client_version=version,
                deadline_check=deadline_check.get("check", ""),
                failure_reason=deadline_check["error"],
                extra_data={"failure": "overdue_missing_reason", "deadline": str(application.deadline)},
            )
            return {"success": False, "error": deadline_check["error"], "suggestion": deadline_check["suggestion"]}

        if materials:
            for m in materials:
                ApplicationMaterial.objects.create(
                    application=application,
                    stage=m.get("stage", ""),
                    file_name=m.get("file_name", ""),
                    file_path=m.get("file_path", ""),
                    material_type=m.get("material_type", ""),
                )

        to_status = flow["to"]
        application.status = to_status
        application.version += 1
        application.opinion_text = opinion
        if deadline_check.get("is_overdue"):
            application.overdue_reason = overdue_reason

        now = dj_timezone.now()
        if action == "submit":
            application.submitted_at = now
        elif action == "verify":
            application.verified_at = now
        elif action == "approve":
            application.approved_at = now

        application.save()

        AuditLog.objects.create(
            application=application,
            operator=user,
            action=action if action != "reject" else "reject",
            from_status=from_status,
            to_status=to_status,
            opinion=opinion,
            operator_role=user.role,
            client_version=version,
            deadline_check=deadline_check.get("check", ""),
            failure_reason="",
            extra_data={"version": application.version, "is_overdue": deadline_check.get("is_overdue", False)},
        )

        return {"success": True, "application": application}


class ScanService:
    @staticmethod
    def verify_code(user: User, code: str, credential_no: str = "") -> dict:
        try:
            application = Application.objects.get(application_no=code)
        except Application.DoesNotExist:
            ScanRecord.objects.create(
                application=None,
                scanner=user,
                code=code,
                credential_no=credential_no or "",
                result="invalid_code",
            )
            return {"result": "invalid_code", "message": "无效编码，未找到对应申请", "application": None}

        today = dj_timezone.now().date()
        duplicate = ScanRecord.objects.filter(
            application=application, code=code, scan_time__date=today
        ).exists()
        if duplicate:
            ScanRecord.objects.create(
                application=application,
                scanner=user,
                code=code,
                credential_no=credential_no or "",
                result="duplicate_scan",
            )
            return {"result": "duplicate_scan", "message": "今日已扫码，请勿重复核验", "application": None}

        role_match = ScanService.check_role_match(application, user)
        if not role_match["match"]:
            ScanRecord.objects.create(
                application=application,
                scanner=user,
                code=code,
                credential_no=credential_no or "",
                result="role_mismatch",
            )
            return {"result": "role_mismatch", "message": role_match["message"], "application": None}

        if not credential_no:
            credential_no = f"SCAN-{application.application_no}-{dj_timezone.now().strftime('%Y%m%d%H%M%S')}"

        ScanRecord.objects.create(
            application=application,
            scanner=user,
            code=code,
            credential_no=credential_no,
            result="pass",
        )
        return {
            "result": "pass",
            "message": "核验通过",
            "application": application,
            "credential_no": credential_no,
            "scan_time": dj_timezone.now().isoformat(),
        }

    @staticmethod
    def check_role_match(application: Application, user: User) -> dict:
        status_role_map = {
            "pending_verify": "clerk",
            "pending_approve": "leader",
        }
        required_role = status_role_map.get(application.status)
        if not required_role:
            return {"match": False, "message": f"当前申请状态无需扫码核验"}
        if user.role != required_role:
            return {"match": False, "message": f"角色不匹配，需要{ROLE_NAMES.get(required_role, required_role)}扫码"}
        return {"match": True}

    @staticmethod
    def check_duplicate(application: Application, code: str) -> bool:
        today = dj_timezone.now().date()
        return ScanRecord.objects.filter(
            application=application, code=code, scan_time__date=today
        ).exists()


class BatchService:
    @staticmethod
    def batch_advance(user: User, items: list) -> dict:
        batch_id = f"BATCH-{dj_timezone.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
        results = []
        for item in items:
            app_no = ""
            from_status = ""
            try:
                app = Application.objects.get(id=item["application_id"])
                app_no = app.application_no
                from_status = app.status
            except Application.DoesNotExist:
                pass

            result = ApplicationService.advance(
                user=user,
                application_id=item["application_id"],
                action=item["action"],
                opinion=item.get("opinion", ""),
                materials=item.get("materials", []),
                version=item.get("version", 1),
                overdue_reason=item.get("overdue_reason", ""),
            )

            r = {
                "application_id": item["application_id"],
                "application_no": app_no,
                "success": result["success"],
                "from_status": from_status,
                "error": result.get("error", ""),
                "suggestion": result.get("suggestion", ""),
            }
            results.append(r)

            if not result["success"]:
                BatchFailRecord.objects.create(
                    batch_id=batch_id,
                    application_id=item["application_id"],
                    application_no=app_no,
                    operator=user,
                    action=item["action"],
                    from_status=from_status,
                    error=result.get("error", ""),
                    suggestion=result.get("suggestion", ""),
                )

        return {"batch_id": batch_id, "results": results}


class AuditService:
    @staticmethod
    def log_action(application: Application, user: User, action: str,
                   from_status: str, to_status: str, opinion: str = "",
                   extra_data: dict = None) -> AuditLog:
        return AuditLog.objects.create(
            application=application,
            operator=user,
            action=action,
            from_status=from_status,
            to_status=to_status,
            opinion=opinion,
            extra_data=extra_data or {},
        )

    @staticmethod
    def get_logs(user: User, application_id: int = None, operator_id: int = None,
                 action: str = None, limit: int = 50) -> list:
        qs = AuditLog.objects.all()

        if user.role == "community_worker":
            qs = qs.filter(application__creator=user)

        if application_id:
            qs = qs.filter(application_id=application_id)
        if operator_id:
            qs = qs.filter(operator_id=operator_id)
        if action:
            qs = qs.filter(action=action)
        return qs[:limit]
