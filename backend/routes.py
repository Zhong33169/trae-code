from flask import Blueprint, request, jsonify
from models import db, User, ImmunizationPlan, VaccinationRecord, Attachment, AbnormalRecheck, AuditLog, RoleEnum, RecordStatus, AttachmentType, RecheckStatus
from datetime import datetime, timedelta
from functools import wraps

api = Blueprint("api", __name__, url_prefix="/api")


def get_current_user():
    user_id = request.headers.get("X-User-Id", "1")
    return User.query.get(int(user_id))


def require_role(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            user = get_current_user()
            if not user or user.role.value not in [r.value for r in roles]:
                return jsonify({"error": f"角色 {user.role.value if user else 'unknown'} 无权执行此操作，需要角色: {', '.join([r.value for r in roles])}"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def log_audit(record_id=None, recheck_id=None, action="", actor=None, detail="", failure_reason=None, next_step_suggestion=None):
    log = AuditLog(
        record_id=record_id,
        recheck_id=recheck_id,
        action=action,
        actor_id=actor.id if actor else None,
        actor_role=actor.role if actor else None,
        detail=detail,
        failure_reason=failure_reason,
        next_step_suggestion=next_step_suggestion,
    )
    db.session.add(log)
    db.session.commit()
    return log


@api.route("/users", methods=["GET"])
def list_users():
    users = User.query.all()
    return jsonify([u.to_dict() for u in users])


@api.route("/users/<int:user_id>", methods=["GET"])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    return jsonify(user.to_dict())


@api.route("/immunization-plans", methods=["GET"])
def list_plans():
    query = ImmunizationPlan.query
    status = request.args.get("status")
    if status:
        query = query.filter(ImmunizationPlan.status == RecordStatus(status))
    plans = query.order_by(ImmunizationPlan.created_at.desc()).all()
    return jsonify([p.to_dict() for p in plans])


@api.route("/immunization-plans", methods=["POST"])
@require_role(RoleEnum.breeder)
def create_plan():
    user = get_current_user()
    data = request.json
    plan = ImmunizationPlan(
        plan_code=data["plan_code"],
        plan_name=data["plan_name"],
        vaccine_type=data["vaccine_type"],
        target_species=data["target_species"],
        target_count=data["target_count"],
        start_date=datetime.strptime(data["start_date"], "%Y-%m-%d").date(),
        end_date=datetime.strptime(data["end_date"], "%Y-%m-%d").date(),
        description=data.get("description", ""),
        created_by=user.id,
        status=RecordStatus.draft,
    )
    db.session.add(plan)
    db.session.commit()
    log_audit(action="create_plan", actor=user, detail=f"创建免疫计划 {plan.plan_code}")
    return jsonify(plan.to_dict()), 201


@api.route("/immunization-plans/<int:plan_id>", methods=["GET"])
def get_plan(plan_id):
    plan = ImmunizationPlan.query.get_or_404(plan_id)
    result = plan.to_dict()
    result["records"] = [r.to_dict(include_attachments=False) for r in plan.records]
    return jsonify(result)


@api.route("/immunization-plans/<int:plan_id>/submit", methods=["POST"])
@require_role(RoleEnum.breeder)
def submit_plan(plan_id):
    user = get_current_user()
    plan = ImmunizationPlan.query.get_or_404(plan_id)
    if plan.status != RecordStatus.draft:
        log_audit(record_id=None, action="submit_plan_failed", actor=user, detail=f"免疫计划 {plan.plan_code} 提交失败", failure_reason=f"当前状态为 {plan.status.value}，只有草稿状态可以提交", next_step_suggestion="请先将计划设为草稿状态")
        return jsonify({"error": f"当前状态为 {plan.status.value}，只有草稿状态可以提交"}), 400
    plan.status = RecordStatus.submitted
    db.session.commit()
    log_audit(action="submit_plan", actor=user, detail=f"提交免疫计划 {plan.plan_code}")
    return jsonify(plan.to_dict())


@api.route("/vaccination-records", methods=["GET"])
def list_records():
    query = VaccinationRecord.query
    status = request.args.get("status")
    if status:
        query = query.filter(VaccinationRecord.status == RecordStatus(status))
    plan_id = request.args.get("plan_id")
    if plan_id:
        query = query.filter(VaccinationRecord.plan_id == int(plan_id))
    is_abnormal = request.args.get("is_abnormal")
    if is_abnormal == "true":
        query = query.filter(VaccinationRecord.result.in_(["adverse_reaction", "ineffective", "incomplete"]))
    is_overdue = request.args.get("is_overdue")
    if is_overdue == "true":
        query = query.filter(VaccinationRecord.deadline_at < datetime.utcnow(), VaccinationRecord.status != RecordStatus.approved)
    records = query.order_by(VaccinationRecord.created_at.desc()).all()
    result = []
    for r in records:
        d = r.to_dict()
        latest_fail = AuditLog.query.filter_by(record_id=r.id).filter(AuditLog.failure_reason.isnot(None)).order_by(AuditLog.created_at.desc()).first()
        d["latest_failure"] = {
            "reason": latest_fail.failure_reason,
            "suggestion": latest_fail.next_step_suggestion,
            "actor_name": latest_fail.actor.display_name if latest_fail and latest_fail.actor else None,
            "created_at": latest_fail.created_at.isoformat() if latest_fail else None,
        } if latest_fail else None
        result.append(d)
    return jsonify(result)


@api.route("/vaccination-records/<int:record_id>", methods=["GET"])
def get_record(record_id):
    record = VaccinationRecord.query.get_or_404(record_id)
    result = record.to_dict()
    result["rechecks"] = [r.to_dict() for r in record.rechecks]
    result["audit_logs"] = [l.to_dict() for l in AuditLog.query.filter_by(record_id=record_id).order_by(AuditLog.created_at.desc()).all()]
    return jsonify(result)


@api.route("/vaccination-records", methods=["POST"])
@require_role(RoleEnum.breeder)
def create_record():
    user = get_current_user()
    data = request.json
    plan = ImmunizationPlan.query.get_or_404(data["plan_id"])
    deadline = datetime.utcnow() + timedelta(days=7)
    if data.get("deadline_at"):
        deadline = datetime.strptime(data["deadline_at"], "%Y-%m-%dT%H:%M:%S")
    record = VaccinationRecord(
        record_code=data["record_code"],
        plan_id=data["plan_id"],
        animal_id=data["animal_id"],
        animal_tag=data.get("animal_tag", ""),
        species=data.get("species", plan.target_species),
        status=RecordStatus.draft,
        created_by=user.id,
        deadline_at=deadline,
    )
    db.session.add(record)
    db.session.commit()
    required_labels = data.get("required_attachment_labels", ["接种证明", "疫苗标签照片"])
    for label in required_labels:
        att = Attachment(
            record_id=record.id,
            attachment_type=AttachmentType.required,
            label=label,
        )
        db.session.add(att)
    db.session.commit()
    log_audit(record_id=record.id, action="create_record", actor=user, detail=f"饲养员 {user.display_name} 创建免疫记录 {record.record_code}")
    return jsonify(record.to_dict()), 201


@api.route("/vaccination-records/<int:record_id>/submit", methods=["POST"])
@require_role(RoleEnum.breeder)
def submit_record(record_id):
    user = get_current_user()
    record = VaccinationRecord.query.get_or_404(record_id)
    if record.status not in [RecordStatus.draft, RecordStatus.returned]:
        log_audit(record_id=record_id, action="submit_record_failed", actor=user, detail=f"提交免疫记录 {record.record_code} 失败", failure_reason=f"当前状态为 {record.status.value}，只有草稿或退回状态可以提交", next_step_suggestion="请先将记录设为草稿或退回状态")
        return jsonify({"error": f"当前状态为 {record.status.value}，只有草稿或退回状态可以提交"}), 400
    missing = [a.label for a in record.attachments if a.attachment_type == AttachmentType.required and not a.file_path]
    if missing:
        log_audit(record_id=record_id, action="submit_record_failed", actor=user, detail=f"提交免疫记录 {record.record_code} 失败，缺少必传附件", failure_reason=f"缺少必传附件: {', '.join(missing)}", next_step_suggestion="请上传所有必传附件后重新提交")
        return jsonify({"error": f"缺少必传附件: {', '.join(missing)}", "missing_attachments": missing}), 400
    record.status = RecordStatus.submitted
    record.return_reason = None
    db.session.commit()
    log_audit(record_id=record_id, action="submit_record", actor=user, detail=f"饲养员 {user.display_name} 提交免疫记录 {record.record_code}")
    return jsonify(record.to_dict())


@api.route("/vaccination-records/<int:record_id>/review", methods=["POST"])
@require_role(RoleEnum.vet_supervisor)
def review_record(record_id):
    user = get_current_user()
    record = VaccinationRecord.query.get_or_404(record_id)
    if record.status != RecordStatus.submitted:
        log_audit(record_id=record_id, action="review_record_failed", actor=user, detail=f"审核免疫记录 {record.record_code} 失败", failure_reason=f"当前状态为 {record.status.value}，只有已提交状态可以审核", next_step_suggestion="请确认记录已由饲养员提交")
        return jsonify({"error": f"当前状态为 {record.status.value}，只有已提交状态可以审核"}), 400
    data = request.json or {}
    record.status = RecordStatus.under_review
    record.reviewed_by = user.id
    record.reviewed_at = datetime.utcnow()
    record.result = data.get("result", "")
    record.audit_note = data.get("audit_note", "")
    if record.result in ["adverse_reaction", "ineffective", "incomplete"]:
        recheck = AbnormalRecheck(
            record_id=record.id,
            abnormal_type=record.result,
            description=f"兽医主管 {user.display_name} 在审核时标记异常: {record.result}",
            created_by=user.id,
            deadline_at=datetime.utcnow() + timedelta(days=3),
        )
        db.session.add(recheck)
    db.session.commit()
    log_audit(record_id=record_id, action="review_record", actor=user, detail=f"兽医主管 {user.display_name} 审核免疫记录 {record.record_code}，结果: {record.result or '待定'}")
    return jsonify(record.to_dict())


@api.route("/vaccination-records/<int:record_id>/approve", methods=["POST"])
@require_role(RoleEnum.farm_manager)
def approve_record(record_id):
    user = get_current_user()
    record = VaccinationRecord.query.get_or_404(record_id)
    if record.status != RecordStatus.under_review:
        log_audit(record_id=record_id, action="approve_record_failed", actor=user, detail=f"批准免疫记录 {record.record_code} 失败", failure_reason=f"当前状态为 {record.status.value}，只有审核中状态可以批准", next_step_suggestion="请确认记录已由兽医主管审核")
        return jsonify({"error": f"当前状态为 {record.status.value}，只有审核中状态可以批准"}), 400
    data = request.json or {}
    record.status = RecordStatus.approved
    record.approved_by = user.id
    record.approved_at = datetime.utcnow()
    record.audit_note = data.get("audit_note", record.audit_note)
    db.session.commit()
    log_audit(record_id=record_id, action="approve_record", actor=user, detail=f"场长 {user.display_name} 批准免疫记录 {record.record_code}")
    return jsonify(record.to_dict())


@api.route("/vaccination-records/<int:record_id>/return", methods=["POST"])
@require_role(RoleEnum.vet_supervisor, RoleEnum.farm_manager)
def return_record(record_id):
    user = get_current_user()
    record = VaccinationRecord.query.get_or_404(record_id)
    if user.role == RoleEnum.vet_supervisor and record.status != RecordStatus.submitted:
        log_audit(record_id=record_id, action="return_record_failed", actor=user, detail=f"退回免疫记录 {record.record_code} 失败", failure_reason=f"兽医主管只能退回已提交状态，当前状态为 {record.status.value}", next_step_suggestion="请确认记录已由饲养员提交")
        return jsonify({"error": f"兽医主管只能退回已提交状态，当前状态为 {record.status.value}"}), 400
    if user.role == RoleEnum.farm_manager and record.status != RecordStatus.under_review:
        log_audit(record_id=record_id, action="return_record_failed", actor=user, detail=f"退回免疫记录 {record.record_code} 失败", failure_reason=f"场长只能退回审核中状态，当前状态为 {record.status.value}", next_step_suggestion="请确认记录已由兽医主管审核")
        return jsonify({"error": f"场长只能退回审核中状态，当前状态为 {record.status.value}"}), 400
    data = request.json or {}
    record.status = RecordStatus.returned
    record.return_reason = data.get("return_reason", "")
    record.audit_note = data.get("audit_note", record.audit_note)
    if data.get("reject_attachment_ids"):
        for att_id in data["reject_attachment_ids"]:
            att = Attachment.query.get(att_id)
            if att and att.record_id == record.id:
                att.attachment_type = AttachmentType.rejected
                att.rejection_reason = data.get("rejection_reason", "")
                att.rejected_at = datetime.utcnow()
    db.session.commit()
    log_audit(record_id=record_id, action="return_record", actor=user, detail=f"{user.role.value} {user.display_name} 退回免疫记录 {record.record_code}，原因: {record.return_reason}")
    return jsonify(record.to_dict())


@api.route("/vaccination-records/<int:record_id>/attachments", methods=["POST"])
def upload_attachment(record_id):
    user = get_current_user()
    if not user or user.role != RoleEnum.breeder:
        log_audit(record_id=record_id, action="upload_attachment_failed", actor=user, detail=f"上传附件失败，权限不足", failure_reason=f"只有饲养员可以上传附件，当前角色: {user.role.value if user else 'unknown'}", next_step_suggestion="请切换为饲养员角色")
        return jsonify({"error": f"只有饲养员可以上传附件，当前角色: {user.role.value if user else 'unknown'}"}), 403
    record = VaccinationRecord.query.get_or_404(record_id)
    if record.status not in [RecordStatus.draft, RecordStatus.returned]:
        log_audit(record_id=record_id, action="upload_attachment_failed", actor=user, detail=f"上传附件到免疫记录 {record.record_code} 失败", failure_reason=f"当前状态为 {record.status.value}，只有草稿或退回状态可以上传附件", next_step_suggestion="请在草稿或退回状态下上传附件")
        return jsonify({"error": f"当前状态为 {record.status.value}，只有草稿或退回状态可以上传附件"}), 400
    data = request.json
    att_type = AttachmentType(data.get("attachment_type", "supplementary"))
    att = Attachment(
        record_id=record.id,
        file_name=data.get("file_name", "uploaded_file"),
        file_path=data.get("file_path", f"/uploads/{record_id}/{data.get('file_name', 'file')}"),
        attachment_type=att_type,
        label=data.get("label", ""),
        uploaded_by=user.id,
        uploaded_at=datetime.utcnow(),
    )
    db.session.add(att)
    db.session.commit()
    log_audit(record_id=record_id, action="upload_attachment", actor=user, detail=f"上传附件 {att.file_name}（{att.attachment_type.value}）到免疫记录 {record.record_code}")
    return jsonify(att.to_dict()), 201


@api.route("/vaccination-records/<int:record_id>/attachments/<int:att_id>", methods=["PATCH"])
def update_attachment(record_id, att_id):
    user = get_current_user()
    att = Attachment.query.get_or_404(att_id)
    if att.record_id != record_id:
        return jsonify({"error": "附件不属于该记录"}), 400
    record = VaccinationRecord.query.get_or_404(record_id)
    data = request.json
    if "file_path" in data:
        if not user or user.role != RoleEnum.breeder:
            log_audit(record_id=record_id, action="update_attachment_failed", actor=user, detail=f"补传附件失败", failure_reason=f"只有饲养员可以补传附件，当前角色: {user.role.value if user else 'unknown'}", next_step_suggestion="请切换为饲养员角色")
            return jsonify({"error": f"只有饲养员可以补传附件，当前角色: {user.role.value if user else 'unknown'}"}), 403
        if record.status not in [RecordStatus.draft, RecordStatus.returned]:
            log_audit(record_id=record_id, action="update_attachment_failed", actor=user, detail=f"补传附件到免疫记录 {record.record_code} 失败", failure_reason=f"当前状态为 {record.status.value}，只有草稿或退回状态可以补传", next_step_suggestion="请在草稿或退回状态下补传附件")
            return jsonify({"error": f"当前状态为 {record.status.value}，只有草稿或退回状态可以补传附件"}), 400
        att.file_path = data["file_path"]
        att.uploaded_by = user.id
        att.uploaded_at = datetime.utcnow()
        if att.attachment_type == AttachmentType.rejected:
            att.attachment_type = AttachmentType.supplementary
            att.rejection_reason = None
            att.rejected_at = None
    if "attachment_type" in data and data["attachment_type"] == "rejected":
        if not user or user.role not in [RoleEnum.vet_supervisor, RoleEnum.farm_manager]:
            log_audit(record_id=record_id, action="reject_attachment_failed", actor=user, detail=f"驳回附件失败", failure_reason=f"只有兽医主管或场长可以驳回附件，当前角色: {user.role.value if user else 'unknown'}", next_step_suggestion="请切换为兽医主管或场长角色")
            return jsonify({"error": f"只有兽医主管或场长可以驳回附件，当前角色: {user.role.value if user else 'unknown'}"}), 403
        att.attachment_type = AttachmentType.rejected
    if "rejection_reason" in data:
        if not user or user.role not in [RoleEnum.vet_supervisor, RoleEnum.farm_manager]:
            return jsonify({"error": f"只有兽医主管或场长可以设置驳回原因"}), 403
        att.rejection_reason = data["rejection_reason"]
        att.rejected_at = datetime.utcnow()
    db.session.commit()
    log_audit(record_id=record_id, action="update_attachment", actor=user, detail=f"更新附件 {att.file_name}（{att.attachment_type.value}）")
    return jsonify(att.to_dict())


@api.route("/abnormal-rechecks", methods=["GET"])
def list_rechecks():
    query = AbnormalRecheck.query
    status = request.args.get("status")
    if status:
        query = query.filter(AbnormalRecheck.status == RecheckStatus(status))
    is_overdue = request.args.get("is_overdue")
    if is_overdue == "true":
        query = query.filter(AbnormalRecheck.deadline_at < datetime.utcnow(), AbnormalRecheck.status != RecheckStatus.resolved)
    rechecks = query.order_by(AbnormalRecheck.created_at.desc()).all()
    return jsonify([r.to_dict() for r in rechecks])


@api.route("/abnormal-rechecks/<int:recheck_id>", methods=["GET"])
def get_recheck(recheck_id):
    recheck = AbnormalRecheck.query.get_or_404(recheck_id)
    result = recheck.to_dict()
    result["record"] = recheck.record.to_dict() if recheck.record else None
    result["audit_logs"] = [l.to_dict() for l in AuditLog.query.filter_by(recheck_id=recheck_id).order_by(AuditLog.created_at.desc()).all()]
    return jsonify(result)


@api.route("/abnormal-rechecks/<int:recheck_id>/recheck", methods=["POST"])
@require_role(RoleEnum.vet_supervisor)
def process_recheck(recheck_id):
    user = get_current_user()
    recheck = AbnormalRecheck.query.get_or_404(recheck_id)
    if recheck.status != RecheckStatus.pending:
        log_audit(recheck_id=recheck_id, action="recheck_failed", actor=user, detail=f"复查 {recheck.id} 处理失败", failure_reason=f"当前状态为 {recheck.status.value}，只有待复查可以处理", next_step_suggestion="请确认复查状态正确")
        return jsonify({"error": f"当前状态为 {recheck.status.value}，只有待复查可以处理"}), 400
    data = request.json or {}
    recheck.status = RecheckStatus.rechecked
    recheck.rechecked_by = user.id
    recheck.rechecked_at = datetime.utcnow()
    recheck.recheck_result = data.get("recheck_result", "")
    db.session.commit()
    log_audit(recheck_id=recheck_id, record_id=recheck.record_id, action="process_recheck", actor=user, detail=f"兽医主管 {user.display_name} 完成复查")
    return jsonify(recheck.to_dict())


@api.route("/abnormal-rechecks/<int:recheck_id>/resolve", methods=["POST"])
@require_role(RoleEnum.farm_manager)
def resolve_recheck(recheck_id):
    user = get_current_user()
    recheck = AbnormalRecheck.query.get_or_404(recheck_id)
    if recheck.status != RecheckStatus.rechecked:
        log_audit(recheck_id=recheck_id, action="resolve_recheck_failed", actor=user, detail=f"解决复查 {recheck.id} 失败", failure_reason=f"当前状态为 {recheck.status.value}，只有已复查可以解决", next_step_suggestion="请确认复查已由兽医主管处理")
        return jsonify({"error": f"当前状态为 {recheck.status.value}，只有已复查可以解决"}), 400
    data = request.json or {}
    recheck.status = RecheckStatus.resolved
    recheck.resolution = data.get("resolution", "")
    db.session.commit()
    log_audit(recheck_id=recheck_id, record_id=recheck.record_id, action="resolve_recheck", actor=user, detail=f"场长 {user.display_name} 解决异常复查")
    return jsonify(recheck.to_dict())


BATCH_ROLE_MAP = {
    "submit": [RoleEnum.breeder],
    "review": [RoleEnum.vet_supervisor],
    "approve": [RoleEnum.farm_manager],
    "return": [RoleEnum.vet_supervisor, RoleEnum.farm_manager],
}


@api.route("/batch/process", methods=["POST"])
def batch_process():
    user = get_current_user()
    data = request.json
    action = data.get("action")
    record_ids = data.get("record_ids", [])
    extra = data.get("extra", {})

    if action not in BATCH_ROLE_MAP:
        return jsonify({"error": f"不支持的操作: {action}"}), 400

    allowed_roles = BATCH_ROLE_MAP[action]
    if not user or user.role not in allowed_roles:
        role_names = "、".join([r.value for r in allowed_roles])
        log_audit(action=f"batch_{action}_role_denied", actor=user, detail=f"批量{action}被拒绝", failure_reason=f"角色 {user.role.value if user else 'unknown'} 无权执行批量{action}，需要: {role_names}", next_step_suggestion=f"请切换为{role_names}角色")
        return jsonify({"error": f"角色 {user.role.value if user else 'unknown'} 无权执行批量{action}，需要: {role_names}"}), 403

    results = []
    for rid in record_ids:
        record = VaccinationRecord.query.get(rid)
        if not record:
            results.append({
                "record_id": rid,
                "record_code": None,
                "success": False,
                "reason": f"免疫记录 ID {rid} 不存在",
                "next_step": "请检查记录ID是否正确",
            })
            log_audit(record_id=rid, action=f"batch_{action}_failed", actor=user, detail=f"批量{action}失败", failure_reason=f"免疫记录 ID {rid} 不存在", next_step_suggestion="请检查记录ID是否正确")
            continue

        success = False
        reason = ""
        next_step = ""

        try:
            if action == "submit":
                if record.status not in [RecordStatus.draft, RecordStatus.returned]:
                    reason = f"当前状态为 {record.status.value}，只有草稿或退回状态可以提交"
                    next_step = "请确认记录状态为草稿或退回"
                else:
                    missing = [a.label for a in record.attachments if a.attachment_type == AttachmentType.required and not a.file_path]
                    if missing:
                        reason = f"缺少必传附件: {', '.join(missing)}"
                        next_step = "请上传所有必传附件后重新提交"
                    else:
                        record.status = RecordStatus.submitted
                        record.return_reason = None
                        success = True
            elif action == "review":
                if record.status != RecordStatus.submitted:
                    reason = f"当前状态为 {record.status.value}，只有已提交状态可以审核"
                    next_step = "请确认记录已由饲养员提交"
                else:
                    record.status = RecordStatus.under_review
                    record.reviewed_by = user.id
                    record.reviewed_at = datetime.utcnow()
                    record.result = extra.get("result", "")
                    record.audit_note = extra.get("audit_note", "")
                    success = True
            elif action == "approve":
                if record.status != RecordStatus.under_review:
                    reason = f"当前状态为 {record.status.value}，只有审核中状态可以批准"
                    next_step = "请确认记录已由兽医主管审核"
                else:
                    record.status = RecordStatus.approved
                    record.approved_by = user.id
                    record.approved_at = datetime.utcnow()
                    record.audit_note = extra.get("audit_note", record.audit_note)
                    success = True
            elif action == "return":
                if user.role == RoleEnum.vet_supervisor and record.status != RecordStatus.submitted:
                    reason = f"兽医主管只能退回已提交状态，当前状态为 {record.status.value}"
                    next_step = "请确认记录已由饲养员提交"
                elif user.role == RoleEnum.farm_manager and record.status != RecordStatus.under_review:
                    reason = f"场长只能退回审核中状态，当前状态为 {record.status.value}"
                    next_step = "请确认记录已由兽医主管审核"
                else:
                    record.status = RecordStatus.returned
                    record.return_reason = extra.get("return_reason", "")
                    success = True
        except Exception as e:
            reason = str(e)
            next_step = "请联系管理员"

        if success:
            db.session.commit()
            log_audit(record_id=rid, action=f"batch_{action}", actor=user, detail=f"批量{action}免疫记录 {record.record_code} 成功")
        else:
            log_audit(record_id=rid, action=f"batch_{action}_failed", actor=user, detail=f"批量{action}免疫记录 {record.record_code} 失败", failure_reason=reason, next_step_suggestion=next_step)

        results.append({
            "record_id": rid,
            "record_code": record.record_code,
            "success": success,
            "reason": reason if not success else None,
            "next_step": next_step if not success else None,
        })

    db.session.commit()
    success_count = sum(1 for r in results if r["success"])
    fail_count = len(results) - success_count
    return jsonify({
        "total": len(results),
        "success_count": success_count,
        "fail_count": fail_count,
        "results": results,
    })


@api.route("/audit-logs", methods=["GET"])
def list_audit_logs():
    query = AuditLog.query
    record_id = request.args.get("record_id")
    if record_id:
        query = query.filter(AuditLog.record_id == int(record_id))
    recheck_id = request.args.get("recheck_id")
    if recheck_id:
        query = query.filter(AuditLog.recheck_id == int(recheck_id))
    has_failure = request.args.get("has_failure")
    if has_failure == "true":
        query = query.filter(AuditLog.failure_reason.isnot(None))
    action = request.args.get("action")
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.created_at.desc()).limit(200).all()
    return jsonify([l.to_dict() for l in logs])


@api.route("/dashboard/stats", methods=["GET"])
def dashboard_stats():
    total_records = VaccinationRecord.query.count()
    by_status = {}
    for s in RecordStatus:
        by_status[s.value] = VaccinationRecord.query.filter(VaccinationRecord.status == s).count()
    overdue_count = VaccinationRecord.query.filter(
        VaccinationRecord.deadline_at < datetime.utcnow(),
        VaccinationRecord.status != RecordStatus.approved,
    ).count()
    abnormal_count = VaccinationRecord.query.filter(
        VaccinationRecord.result.in_(["adverse_reaction", "ineffective", "incomplete"])
    ).count()
    pending_rechecks = AbnormalRecheck.query.filter(AbnormalRecheck.status == RecheckStatus.pending).count()
    missing_attachments = 0
    for record in VaccinationRecord.query.all():
        missing_attachments += sum(1 for a in record.attachments if a.attachment_type == AttachmentType.required and not a.file_path)
    return jsonify({
        "total_records": total_records,
        "by_status": by_status,
        "overdue_count": overdue_count,
        "abnormal_count": abnormal_count,
        "pending_rechecks": pending_rechecks,
        "missing_attachments": missing_attachments,
    })
