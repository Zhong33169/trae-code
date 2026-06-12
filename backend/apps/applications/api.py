from datetime import datetime
from ninja import Router
from django.http import HttpResponse
from django.utils import timezone

from apps.auth.api import get_user_from_token
from .models import Application, ApplicationMaterial, ScanRecord, AuditLog, BatchFailRecord
from .schemas import (
    ApplicationCreate, ApplicationOut, ApplicationDetailOut,
    MaterialOut, ScanRecordOut, AuditLogOut, BatchFailRecordOut,
    AdvanceRequest, AdvanceResponse,
    BatchAdvanceRequest, BatchAdvanceResponse,
    ScanVerifyRequest, ScanVerifyResponse,
    StatsSummary,
)
from .services import ApplicationService, ScanService, BatchService, AuditService

router = Router()


def _require_auth(request):
    user = get_user_from_token(request)
    if not user:
        return None, HttpResponse("未授权", status=401)
    return user, None


def _app_to_out(app, user=None):
    actions = []
    if user:
        actions = ApplicationService.get_available_actions(user, app)
    return ApplicationOut(
        id=app.id,
        application_no=app.application_no,
        creator_id=app.creator_id,
        creator_name=app.creator.display_name,
        applicant_name=app.applicant_name,
        applicant_id_card=app.applicant_id_card,
        difficulty_type=app.difficulty_type,
        difficulty_description=app.difficulty_description,
        assistance_amount=app.assistance_amount,
        status=app.status,
        version=app.version,
        created_at=app.created_at,
        deadline=app.deadline,
        submitted_at=app.submitted_at,
        verified_at=app.verified_at,
        approved_at=app.approved_at,
        opinion_text=app.opinion_text,
        available_actions=actions,
    )


def _app_to_detail(app, user=None):
    materials = [
        MaterialOut(
            id=m.id, application_id=m.application_id, stage=m.stage,
            file_name=m.file_name, file_path=m.file_path,
            material_type=m.material_type, uploaded_at=m.uploaded_at,
        ) for m in app.materials.all()
    ]
    scan_records = [
        ScanRecordOut(
            id=s.id, application_id=s.application_id, scanner_id=s.scanner_id,
            scanner_name=s.scanner.display_name,
            code=s.code, credential_no=s.credential_no,
            result=s.result, scan_time=s.scan_time,
        ) for s in app.scan_records.all()
    ]
    audit_logs = [
        AuditLogOut(
            id=a.id, application_id=a.application_id,
            operator_id=a.operator_id, operator_name=a.operator.display_name,
            action=a.action, from_status=a.from_status, to_status=a.to_status,
            opinion=a.opinion, extra_data=a.extra_data, created_at=a.created_at,
        ) for a in app.audit_logs.all()
    ]
    base = _app_to_out(app, user)
    return ApplicationDetailOut(
        **base.model_dump(),
        materials=materials,
        scan_records=scan_records,
        audit_logs=audit_logs,
    )


@router.get("/applications", response=list[ApplicationOut])
def list_applications(request, status: str = None):
    user, err = _require_auth(request)
    if err:
        return err

    qs = Application.objects.all()

    if user.role == "community_worker":
        qs = qs.filter(creator=user)
        if status:
            qs = qs.filter(status=status)
    elif user.role == "clerk":
        allowed = {"pending_verify", "pending_approve", "approved", "rejected"}
        if status:
            if status not in allowed:
                return []
            qs = qs.filter(status=status)
        else:
            qs = qs.filter(status__in=allowed)
    elif user.role == "leader":
        allowed = {"pending_approve", "approved", "rejected", "pending_verify"}
        if status:
            if status not in allowed:
                return []
            qs = qs.filter(status=status)
        else:
            qs = qs.filter(status__in=allowed)

    qs = qs.order_by("-created_at")
    return [_app_to_out(app, user) for app in qs]


@router.post("/applications", response=ApplicationOut)
def create_application(request, payload: ApplicationCreate):
    user, err = _require_auth(request)
    if err:
        return err

    if user.role != "community_worker":
        return HttpResponse("只有社区专干可以创建申请", status=403)

    app = ApplicationService.create(user, payload.model_dump())
    return _app_to_out(app, user)


@router.get("/applications/{application_id}", response=ApplicationDetailOut)
def get_application(request, application_id: int):
    user, err = _require_auth(request)
    if err:
        return err

    try:
        app = Application.objects.prefetch_related(
            "materials", "scan_records", "audit_logs"
        ).get(id=application_id)
    except Application.DoesNotExist:
        return HttpResponse("申请不存在", status=404)

    if not ApplicationService.can_view(user, app):
        return HttpResponse("无权查看此申请", status=403)

    return _app_to_detail(app, user)


@router.post("/applications/{application_id}/advance", response=AdvanceResponse)
def advance_application(request, application_id: int, payload: AdvanceRequest):
    user, err = _require_auth(request)
    if err:
        return err

    try:
        app = Application.objects.get(id=application_id)
    except Application.DoesNotExist:
        return HttpResponse("申请不存在", status=404)

    result = ApplicationService.advance(
        user=user,
        application_id=application_id,
        action=payload.action,
        opinion=payload.opinion,
        materials=[m.model_dump() for m in payload.materials],
        version=payload.version,
    )

    if not result["success"]:
        status_code = 403
        if "已被其他人修改" in result.get("error", ""):
            status_code = 409
        elif "缺少" in result.get("error", "") or "顺序" in result.get("error", ""):
            status_code = 422
        return HttpResponse(result["error"], status=status_code)

    return AdvanceResponse(
        success=True,
        message="操作成功",
        application=_app_to_out(Application.objects.get(id=application_id), user),
    )


@router.post("/scan/verify", response=ScanVerifyResponse)
def scan_verify(request, payload: ScanVerifyRequest):
    user, err = _require_auth(request)
    if err:
        return err

    result = ScanService.verify_code(user, payload.code, payload.credential_no)
    app_out = None
    if result.get("application"):
        app_out = _app_to_out(result["application"], user)

    return ScanVerifyResponse(
        result=result["result"],
        message=result["message"],
        application=app_out,
        credential_no=result.get("credential_no", ""),
        scan_time=result.get("scan_time", ""),
    )


@router.post("/batch/advance", response=BatchAdvanceResponse)
def batch_advance(request, payload: BatchAdvanceRequest):
    user, err = _require_auth(request)
    if err:
        return err

    items = [item.model_dump() for item in payload.items]
    batch_result = BatchService.batch_advance(user, items)

    return BatchAdvanceResponse(
        results=batch_result["results"],
        batch_id=batch_result["batch_id"],
    )


@router.get("/batch/failures", response=list[BatchFailRecordOut])
def list_batch_failures(request, batch_id: str = None):
    user, err = _require_auth(request)
    if err:
        return err

    if user.role == "community_worker":
        return HttpResponse("无权查看批量失败记录", status=403)

    qs = BatchFailRecord.objects.all()
    if user.role == "clerk":
        qs = qs.filter(operator=user)
    if batch_id:
        qs = qs.filter(batch_id=batch_id)

    return [
        BatchFailRecordOut(
            id=b.id, batch_id=b.batch_id,
            application_id=b.application_id, application_no=b.application_no,
            operator_name=b.operator.display_name,
            action=b.action, from_status=b.from_status,
            error=b.error, suggestion=b.suggestion,
            created_at=b.created_at,
        ) for b in qs[:100]
    ]


@router.get("/audit/logs", response=list[AuditLogOut])
def list_audit_logs(request, application_id: int = None,
                    operator_id: int = None, action: str = None):
    user, err = _require_auth(request)
    if err:
        return err

    logs = AuditService.get_logs(
        user=user,
        application_id=application_id,
        operator_id=operator_id,
        action=action,
    )

    return [
        AuditLogOut(
            id=a.id, application_id=a.application_id,
            operator_id=a.operator_id, operator_name=a.operator.display_name,
            action=a.action, from_status=a.from_status, to_status=a.to_status,
            opinion=a.opinion, extra_data=a.extra_data, created_at=a.created_at,
        ) for a in logs
    ]


@router.get("/stats/summary", response=StatsSummary)
def stats_summary(request):
    user, err = _require_auth(request)
    if err:
        return err

    qs = Application.objects.all()
    if user.role == "community_worker":
        qs = qs.filter(creator=user)
    elif user.role == "clerk":
        pass

    pending_statuses = []
    if user.role == "community_worker":
        pending_statuses = ["draft"]
    elif user.role == "clerk":
        pending_statuses = ["pending_verify"]
    elif user.role == "leader":
        pending_statuses = ["pending_approve"]

    pending_count = qs.filter(status__in=pending_statuses).count() if pending_statuses else 0
    done_count = qs.filter(status="approved").count()
    overdue_count = qs.filter(
        deadline__lt=timezone.now(),
        status__in=["draft", "pending_verify", "pending_approve"],
    ).count()

    scan_qs = ScanRecord.objects.all()
    if user.role != "leader":
        scan_qs = scan_qs.filter(scanner=user)
    today_scan_count = scan_qs.filter(
        scan_time__date=timezone.now().date()
    ).count()

    return StatsSummary(
        pending_count=pending_count,
        done_count=done_count,
        overdue_count=overdue_count,
        today_scan_count=today_scan_count,
    )
