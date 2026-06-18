from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import (
    ExhibitorApplication, ApplicationMaterial, AuditLog, User,
    ApplicationStatusEnum, AuditActionEnum, RoleEnum, MaterialTypeEnum
)
from app.schemas import ApplicationCreate, ApplicationUpdate


def generate_application_no(db: Session) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"ZS{today}"
    last_app = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.application_no.like(f"{prefix}%")
    ).order_by(ExhibitorApplication.id.desc()).first()
    if last_app:
        seq = int(last_app.application_no[-4:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def create_application(db: Session, app_data: ApplicationCreate, user_id: int) -> ExhibitorApplication:
    application = ExhibitorApplication(
        application_no=generate_application_no(db),
        company_name=app_data.company_name,
        contact_person=app_data.contact_person,
        contact_phone=app_data.contact_phone,
        contact_email=app_data.contact_email,
        booth_type=app_data.booth_type,
        booth_size=app_data.booth_size,
        expected_area=app_data.expected_area,
        industry=app_data.industry,
        product_description=app_data.product_description,
        status=ApplicationStatusEnum.DRAFT,
        registrar_id=user_id,
    )
    db.add(application)
    db.flush()

    if app_data.materials:
        for mat in app_data.materials:
            material = ApplicationMaterial(
                application_id=application.id,
                material_type=mat.material_type,
                material_name=mat.material_name,
                file_path=mat.file_path,
            )
            db.add(material)

    add_audit_log(db, application.id, user_id, AuditActionEnum.CREATE, "创建申请",
                  None, ApplicationStatusEnum.DRAFT, "登记员创建展商申请草稿")

    db.commit()
    db.refresh(application)
    return application


def update_application(db: Session, app_id: int, app_data: ApplicationUpdate, user_id: int) -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.DRAFT:
        return None

    application.company_name = app_data.company_name
    application.contact_person = app_data.contact_person
    application.contact_phone = app_data.contact_phone
    application.contact_email = app_data.contact_email
    application.booth_type = app_data.booth_type
    application.booth_size = app_data.booth_size
    application.expected_area = app_data.expected_area
    application.industry = app_data.industry
    application.product_description = app_data.product_description
    application.version += 1

    if app_data.materials is not None:
        db.query(ApplicationMaterial).filter(ApplicationMaterial.application_id == app_id).delete()
        for mat in app_data.materials:
            material = ApplicationMaterial(
                application_id=application.id,
                material_type=mat.material_type,
                material_name=mat.material_name,
                file_path=mat.file_path,
            )
            db.add(material)

    add_audit_log(db, application.id, user_id, AuditActionEnum.UPDATE, "更新申请",
                  ApplicationStatusEnum.DRAFT, ApplicationStatusEnum.DRAFT, "登记员更新申请草稿")

    db.commit()
    db.refresh(application)
    return application


def submit_application(db: Session, app_id: int, user_id: int) -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status not in [ApplicationStatusEnum.DRAFT, ApplicationStatusEnum.CORRECTION_REQUESTED]:
        return None

    if application.status == ApplicationStatusEnum.DRAFT:
        from_status = ApplicationStatusEnum.DRAFT
        to_status = ApplicationStatusEnum.SUBMITTED
        action = AuditActionEnum.SUBMIT
        action_name = "提交申请"
        remark = "登记员提交展商申请，进入审核队列"
    else:
        from_status = ApplicationStatusEnum.CORRECTION_REQUESTED
        to_status = ApplicationStatusEnum.CORRECTED
        action = AuditActionEnum.CORRECT
        action_name = "补正提交"
        remark = "登记员补正后重新提交申请"

    old_status = application.status
    application.status = to_status
    application.status_changed_at = datetime.utcnow()
    application.calculate_deadline()
    application.is_overdue = False
    application.overdue_reason = None
    application.version += 1

    add_audit_log(db, application.id, user_id, action, action_name,
                  old_status, to_status, remark)

    db.commit()
    db.refresh(application)
    return application


def start_audit(db: Session, app_id: int, user_id: int, remark: str = "") -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status not in [ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTED]:
        return None

    old_status = application.status
    application.status = ApplicationStatusEnum.UNDER_REVIEW
    application.audit_supervisor_id = user_id
    application.status_changed_at = datetime.utcnow()
    application.calculate_deadline()
    application.is_overdue = False
    application.overdue_reason = None
    application.version += 1

    log_remark = "审核主管开始办理审核"
    if remark:
        log_remark = f"{log_remark}（{remark}）"

    add_audit_log(db, application.id, user_id, AuditActionEnum.START_AUDIT, "开始审核",
                  old_status, ApplicationStatusEnum.UNDER_REVIEW, log_remark)

    db.commit()
    db.refresh(application)
    return application


def request_correction(db: Session, app_id: int, user_id: int, correction_request: str,
                       material_reviews: dict = None) -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.UNDER_REVIEW:
        return None

    application.correction_request = correction_request
    old_status = application.status
    application.status = ApplicationStatusEnum.CORRECTION_REQUESTED
    application.status_changed_at = datetime.utcnow()
    application.calculate_deadline()
    application.is_overdue = False
    application.overdue_reason = None
    application.version += 1

    if material_reviews:
        for mat_id_str, review in material_reviews.items():
            mat_id = int(mat_id_str)
            material = db.query(ApplicationMaterial).filter(ApplicationMaterial.id == mat_id).first()
            if material and material.application_id == application.id:
                material.is_approved = review.get("is_approved")
                material.review_comment = review.get("comment")

    add_audit_log(db, application.id, user_id, AuditActionEnum.REQUEST_CORRECTION, "要求补正",
                  old_status, ApplicationStatusEnum.CORRECTION_REQUESTED,
                  f"审核主管要求补正：{correction_request}")

    db.commit()
    db.refresh(application)
    return application


def audit_pass(db: Session, app_id: int, user_id: int, opinion: str = "",
               material_reviews: dict = None) -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.UNDER_REVIEW:
        return None

    application.audit_opinion = opinion
    old_status = application.status
    application.status = ApplicationStatusEnum.AUDIT_PASSED
    application.status_changed_at = datetime.utcnow()
    application.calculate_deadline()
    application.is_overdue = False
    application.overdue_reason = None
    application.version += 1

    if material_reviews:
        for mat_id_str, review in material_reviews.items():
            mat_id = int(mat_id_str)
            material = db.query(ApplicationMaterial).filter(ApplicationMaterial.id == mat_id).first()
            if material and material.application_id == application.id:
                material.is_approved = review.get("is_approved")
                material.review_comment = review.get("comment")

    add_audit_log(db, application.id, user_id, AuditActionEnum.AUDIT_PASS, "审核通过",
                  old_status, ApplicationStatusEnum.AUDIT_PASSED,
                  f"审核主管通过：{opinion}")

    db.commit()
    db.refresh(application)
    return application


def audit_reject(db: Session, app_id: int, user_id: int, opinion: str = "") -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.UNDER_REVIEW:
        return None

    application.audit_opinion = opinion
    old_status = application.status
    application.status = ApplicationStatusEnum.REJECTED
    application.status_changed_at = datetime.utcnow()
    application.is_overdue = False
    application.overdue_reason = None
    application.deadline_at = None
    application.version += 1

    add_audit_log(db, application.id, user_id, AuditActionEnum.REJECT, "审核拒绝",
                  old_status, ApplicationStatusEnum.REJECTED,
                  f"审核主管拒绝：{opinion}")

    db.commit()
    db.refresh(application)
    return application


def review_pass(db: Session, app_id: int, user_id: int, opinion: str = "") -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.AUDIT_PASSED:
        return None

    application.review_opinion = opinion
    old_status = application.status
    application.status = ApplicationStatusEnum.REVIEW_PASSED
    application.review_leader_id = user_id
    application.status_changed_at = datetime.utcnow()
    application.calculate_deadline()
    application.is_overdue = False
    application.overdue_reason = None
    application.version += 1

    add_audit_log(db, application.id, user_id, AuditActionEnum.REVIEW_PASS, "复核通过",
                  old_status, ApplicationStatusEnum.REVIEW_PASSED,
                  f"复核负责人通过：{opinion}")

    db.commit()
    db.refresh(application)
    return application


def review_reject(db: Session, app_id: int, user_id: int, opinion: str = "") -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.AUDIT_PASSED:
        return None

    application.review_opinion = opinion
    old_status = application.status
    application.status = ApplicationStatusEnum.REJECTED
    application.review_leader_id = user_id
    application.status_changed_at = datetime.utcnow()
    application.is_overdue = False
    application.overdue_reason = None
    application.deadline_at = None
    application.version += 1

    add_audit_log(db, application.id, user_id, AuditActionEnum.REJECT, "复核拒绝",
                  old_status, ApplicationStatusEnum.REJECTED,
                  f"复核负责人拒绝：{opinion}")

    db.commit()
    db.refresh(application)
    return application


def archive_application(db: Session, app_id: int, user_id: int, remark: str = "") -> Optional[ExhibitorApplication]:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        return None
    if application.status != ApplicationStatusEnum.REVIEW_PASSED:
        return None

    old_status = application.status
    application.status = ApplicationStatusEnum.ARCHIVED
    application.status_changed_at = datetime.utcnow()
    application.is_overdue = False
    application.overdue_reason = None
    application.deadline_at = None
    application.version += 1

    add_audit_log(db, application.id, user_id, AuditActionEnum.ARCHIVE, "归档",
                  old_status, ApplicationStatusEnum.ARCHIVED,
                  f"复核负责人归档：{remark}")

    db.commit()
    db.refresh(application)
    return application


def add_audit_log(db: Session, application_id: int, operator_id: int,
                  action: AuditActionEnum, action_name: str,
                  from_status: Optional[ApplicationStatusEnum],
                  to_status: Optional[ApplicationStatusEnum],
                  remark: str = "", ip_address: str = ""):
    log = AuditLog(
        application_id=application_id,
        operator_id=operator_id,
        action=action,
        action_name=action_name,
        from_status=from_status,
        to_status=to_status,
        remark=remark,
        ip_address=ip_address,
    )
    db.add(log)


def get_application_by_id(db: Session, app_id: int) -> Optional[ExhibitorApplication]:
    return db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()


def list_applications(db: Session, status: str = None, is_overdue: bool = None,
                      role: str = None, search: str = None,
                      page: int = 1, page_size: int = 20) -> tuple:
    query = db.query(ExhibitorApplication)

    if status:
        query = query.filter(ExhibitorApplication.status == status)
    if is_overdue is not None:
        query = query.filter(ExhibitorApplication.is_overdue == is_overdue)
    if search:
        query = query.filter(
            (ExhibitorApplication.company_name.like(f"%{search}%")) |
            (ExhibitorApplication.application_no.like(f"%{search}%")) |
            (ExhibitorApplication.contact_person.like(f"%{search}%"))
        )

    if role == RoleEnum.REGISTRAR.value:
        pass
    elif role == RoleEnum.AUDIT_SUPERVISOR.value:
        query = query.filter(ExhibitorApplication.status.in_([
            ApplicationStatusEnum.SUBMITTED,
            ApplicationStatusEnum.UNDER_REVIEW,
            ApplicationStatusEnum.CORRECTED,
        ]))
    elif role == RoleEnum.REVIEW_LEADER.value:
        query = query.filter(ExhibitorApplication.status.in_([
            ApplicationStatusEnum.AUDIT_PASSED,
            ApplicationStatusEnum.REVIEW_PASSED,
        ]))

    total = query.count()
    items = query.order_by(ExhibitorApplication.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def check_all_overdue(db: Session) -> int:
    applications = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status.in_(list(ApplicationStatusEnum))
    ).all()
    count = 0
    for app in applications:
        was_overdue = app.is_overdue
        is_overdue = app.check_overdue()
        if is_overdue and not was_overdue:
            count += 1
            add_audit_log(
                db, app.id, 0, AuditActionEnum.OVERDUE, "逾期预警",
                app.status, app.status,
                f"申请已超过{app.status.value}状态的处理时限，系统自动标记逾期"
            )
    db.commit()
    return count


def batch_action(db: Session, ids: List[int], action: str, user_id: int, role: str, remark: str = "") -> dict:
    results = {"success": [], "failed": []}

    for app_id in ids:
        try:
            app = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
            if not app:
                results["failed"].append({"id": app_id, "reason": "申请不存在"})
                continue

            app.check_overdue()

            success = False
            error = ""

            needs_remark_actions = ["start_audit", "audit_pass", "review_pass", "archive"]
            if app.is_overdue and action in needs_remark_actions and not remark:
                results["failed"].append({
                    "id": app_id,
                    "reason": f"该申请已逾期（{app.overdue_reason or '原因未知'}），批量处理必须填写逾期处理说明"
                })
                continue

            if action == "start_audit" and role == RoleEnum.AUDIT_SUPERVISOR.value:
                if app.status in [ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTED]:
                    start_audit(db, app_id, user_id, remark)
                    success = True
                else:
                    error = f"当前状态{app.status.value}不支持该操作"

            elif action == "audit_pass" and role == RoleEnum.AUDIT_SUPERVISOR.value:
                if app.status == ApplicationStatusEnum.UNDER_REVIEW:
                    audit_pass(db, app_id, user_id, remark or "批量审核通过")
                    success = True
                else:
                    error = f"当前状态{app.status.value}不支持该操作"

            elif action == "review_pass" and role == RoleEnum.REVIEW_LEADER.value:
                if app.status == ApplicationStatusEnum.AUDIT_PASSED:
                    review_pass(db, app_id, user_id, remark or "批量复核通过")
                    success = True
                else:
                    error = f"当前状态{app.status.value}不支持该操作"

            elif action == "archive" and role == RoleEnum.REVIEW_LEADER.value:
                if app.status == ApplicationStatusEnum.REVIEW_PASSED:
                    archive_application(db, app_id, user_id, remark or "批量归档")
                    success = True
                else:
                    error = f"当前状态{app.status.value}不支持该操作"

            else:
                error = "不支持的批量操作或权限不足"

            if success:
                results["success"].append(app_id)
            else:
                results["failed"].append({"id": app_id, "reason": error})

        except Exception as e:
            results["failed"].append({"id": app_id, "reason": str(e)})

    db.commit()
    return results


def get_statistics(db: Session) -> dict:
    check_all_overdue(db)

    total = db.query(ExhibitorApplication).count()
    draft = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.DRAFT
    ).count()
    submitted = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.SUBMITTED
    ).count()
    under_review = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.UNDER_REVIEW
    ).count()
    correction_requested = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.CORRECTION_REQUESTED
    ).count()
    corrected = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.CORRECTED
    ).count()
    audit_passed = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.AUDIT_PASSED
    ).count()
    rejected = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.REJECTED
    ).count()
    review_passed = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.REVIEW_PASSED
    ).count()
    archived = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.ARCHIVED
    ).count()
    overdue = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.is_overdue == True
    ).count()
    correction_overdue = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status == ApplicationStatusEnum.CORRECTION_REQUESTED,
        ExhibitorApplication.is_overdue == True
    ).count()
    review_overdue = db.query(ExhibitorApplication).filter(
        ExhibitorApplication.status.in_([
            ApplicationStatusEnum.AUDIT_PASSED,
            ApplicationStatusEnum.REVIEW_PASSED
        ]),
        ExhibitorApplication.is_overdue == True
    ).count()

    pending_audit = submitted + corrected
    pending_correction = correction_requested
    pending_review = audit_passed
    passed = review_passed + archived

    return {
        "total": total,
        "draft": draft,
        "submitted": submitted,
        "corrected": corrected,
        "audit_passed": audit_passed,
        "review_passed": review_passed,
        "pending_audit": pending_audit,
        "under_review": under_review,
        "pending_correction": pending_correction,
        "pending_review": pending_review,
        "passed": passed,
        "rejected": rejected,
        "archived": archived,
        "overdue": overdue,
        "correction_overdue": correction_overdue,
        "review_overdue": review_overdue,
    }
