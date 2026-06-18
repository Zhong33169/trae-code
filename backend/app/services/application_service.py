from datetime import datetime
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import (
    ExhibitorApplication, ApplicationMaterial, AuditLog, User,
    ApplicationStatusEnum, AuditActionEnum, RoleEnum, MaterialTypeEnum
)
from app.schemas import ApplicationCreate, ApplicationUpdate
from app.services.validation_service import (
    ActionError, check_version, check_status_allowed,
    check_overdue_remark, atomic_status_update, safe_commit_with_audit,
)


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


def submit_application(db: Session, app_id: int, user_id: int, expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.DRAFT, ApplicationStatusEnum.CORRECTION_REQUESTED])

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

    atomic_status_update(db, application, expected_version, to_status)
    safe_commit_with_audit(db, application, user_id, action, action_name, from_status, to_status, remark)
    return application


def start_audit(db: Session, app_id: int, user_id: int, remark: str, expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.CORRECTED])
    check_overdue_remark(application, remark, needs_remark=True)

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.UNDER_REVIEW,
        extra_fields={"audit_supervisor_id": user_id},
    )

    log_remark = "审核主管开始办理审核"
    if remark:
        log_remark = f"{log_remark}（{remark}）"

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.START_AUDIT, "开始审核",
        old_status, ApplicationStatusEnum.UNDER_REVIEW, log_remark,
    )
    return application


def _apply_material_reviews(db: Session, application: ExhibitorApplication, material_reviews: dict):
    if not material_reviews:
        return
    for mat_id_str, review in material_reviews.items():
        mat_id = int(mat_id_str)
        material = db.query(ApplicationMaterial).filter(ApplicationMaterial.id == mat_id).first()
        if material and material.application_id == application.id:
            material.is_approved = review.get("is_approved")
            material.review_comment = review.get("comment")


def request_correction(db: Session, app_id: int, user_id: int, correction_request: str,
                       expected_version: int, material_reviews: dict = None) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.UNDER_REVIEW])

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.CORRECTION_REQUESTED,
        extra_fields={"correction_request": correction_request},
    )
    _apply_material_reviews(db, application, material_reviews)

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.REQUEST_CORRECTION, "要求补正",
        old_status, ApplicationStatusEnum.CORRECTION_REQUESTED,
        f"审核主管要求补正：{correction_request}",
    )
    return application


def audit_pass(db: Session, app_id: int, user_id: int, opinion: str,
               expected_version: int, material_reviews: dict = None) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.UNDER_REVIEW])
    check_overdue_remark(application, opinion, needs_remark=True)

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.AUDIT_PASSED,
        extra_fields={"audit_opinion": opinion},
    )
    _apply_material_reviews(db, application, material_reviews)

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.AUDIT_PASS, "审核通过",
        old_status, ApplicationStatusEnum.AUDIT_PASSED,
        f"审核主管通过：{opinion}",
    )
    return application


def audit_reject(db: Session, app_id: int, user_id: int, opinion: str,
                 expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.UNDER_REVIEW])

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.REJECTED,
        extra_fields={"audit_opinion": opinion},
    )

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.REJECT, "审核拒绝",
        old_status, ApplicationStatusEnum.REJECTED,
        f"审核主管拒绝：{opinion}",
    )
    return application


def review_pass(db: Session, app_id: int, user_id: int, opinion: str,
                expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.AUDIT_PASSED])
    check_overdue_remark(application, opinion, needs_remark=True)

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.REVIEW_PASSED,
        extra_fields={"review_opinion": opinion, "review_leader_id": user_id},
    )

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.REVIEW_PASS, "复核通过",
        old_status, ApplicationStatusEnum.REVIEW_PASSED,
        f"复核负责人通过：{opinion}",
    )
    return application


def review_reject(db: Session, app_id: int, user_id: int, opinion: str,
                  expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.AUDIT_PASSED])

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.REJECTED,
        extra_fields={"review_opinion": opinion, "review_leader_id": user_id},
    )

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.REJECT, "复核拒绝",
        old_status, ApplicationStatusEnum.REJECTED,
        f"复核负责人拒绝：{opinion}",
    )
    return application


def archive_application(db: Session, app_id: int, user_id: int, remark: str,
                        expected_version: int) -> ExhibitorApplication:
    application = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
    if not application:
        raise ActionError("申请不存在", error_code="NOT_FOUND")

    check_version(application, expected_version)
    check_status_allowed(application, [ApplicationStatusEnum.REVIEW_PASSED])
    check_overdue_remark(application, remark, needs_remark=True)

    old_status = application.status
    atomic_status_update(
        db, application, expected_version, ApplicationStatusEnum.ARCHIVED,
    )

    safe_commit_with_audit(
        db, application, user_id, AuditActionEnum.ARCHIVE, "归档",
        old_status, ApplicationStatusEnum.ARCHIVED,
        f"复核负责人归档：{remark}",
    )
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


def batch_action(db: Session, items: List[dict], action: str, user_id: int, role: str, remark: str = "") -> dict:
    results = {"success": [], "failed": []}

    for item in items:
        app_id = item["id"]
        expected_version = item["version"]
        try:
            app = db.query(ExhibitorApplication).filter(ExhibitorApplication.id == app_id).first()
            if not app:
                results["failed"].append({
                    "id": app_id,
                    "code": "NOT_FOUND",
                    "reason": "申请不存在",
                })
                continue

            if action == "start_audit" and role == RoleEnum.AUDIT_SUPERVISOR.value:
                start_audit(db, app_id, user_id, remark, expected_version)
            elif action == "audit_pass" and role == RoleEnum.AUDIT_SUPERVISOR.value:
                audit_pass(db, app_id, user_id, remark or "批量审核通过", expected_version)
            elif action == "review_pass" and role == RoleEnum.REVIEW_LEADER.value:
                review_pass(db, app_id, user_id, remark or "批量复核通过", expected_version)
            elif action == "archive" and role == RoleEnum.REVIEW_LEADER.value:
                archive_application(db, app_id, user_id, remark or "批量归档", expected_version)
            else:
                results["failed"].append({
                    "id": app_id,
                    "code": "FORBIDDEN",
                    "reason": "不支持的批量操作或权限不足",
                })
                continue

            results["success"].append(app_id)

        except ActionError as e:
            db.rollback()
            results["failed"].append({
                "id": app_id,
                "code": e.error_code,
                "reason": e.message,
                "data": e.data,
            })
        except Exception as e:
            db.rollback()
            results["failed"].append({
                "id": app_id,
                "code": "BAD_REQUEST",
                "reason": str(e),
            })

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
