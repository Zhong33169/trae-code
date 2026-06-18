from ninja import NinjaAPI, Router, Query
from ninja.security import HttpBearer
from django.http import HttpRequest

from apps.loan.services import (
    auth_service,
    application_service,
    scan_service,
    batch_service,
    audit_service,
)
from apps.loan import schemas


api = NinjaAPI(title='小贷公司展期申请系统 API', version='1.0.0')


class TokenAuth(HttpBearer):
    def authenticate(self, request, token):
        user = auth_service.get_user_by_token(token)
        if user:
            request.user = user
            return user
        return None


auth = TokenAuth()
router = Router()


@api.get('/health', tags=['系统'])
def health_check(request):
    return {'status': 'ok', 'message': 'Service is running'}


@api.post('/auth/login', tags=['认证'], response=schemas.LoginResponseSchema)
def login(request, payload: schemas.LoginSchema):
    try:
        result = auth_service.login(payload.username)
        return result
    except ValueError as e:
        return api.create_response(request, {'code': 'LOGIN_FAILED', 'message': str(e)}, status=401)


@api.get('/auth/user', tags=['认证'], response=schemas.UserInfoSchema, auth=auth)
def get_current_user(request):
    return auth_service.get_user_profile(request.user)


@api.get('/dashboard/stats', tags=['工作台'], response=schemas.DashboardStatsSchema, auth=auth)
def get_dashboard_stats(request):
    return application_service.get_dashboard_stats(request.user)


@api.get('/applications', tags=['展期申请'], response=schemas.ApplicationListResponseSchema, auth=auth)
def get_application_list(request, filters: schemas.ApplicationListQuerySchema = Query(...)):
    return application_service.get_application_list(
        request.user,
        status=filters.status,
        keyword=filters.keyword,
        is_urgent=filters.is_urgent,
        page=filters.page,
        page_size=filters.page_size,
    )


@api.get('/applications/{application_id}', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def get_application_detail(request, application_id: int):
    try:
        return application_service.get_application_detail(request.user, application_id)
    except ValueError as e:
        return api.create_response(request, {'code': 'NOT_FOUND', 'message': str(e)}, status=404)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.post('/applications', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def create_application(request, payload: schemas.ApplicationCreateSchema):
    try:
        return application_service.create_application(request.user, payload.dict())
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.put('/applications/{application_id}/submit', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def submit_application(request, application_id: int, version: int = None):
    try:
        return application_service.submit_application(request.user, application_id, version=version)
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.post('/applications/{application_id}/review', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def review_application(request, application_id: int, payload: schemas.ReviewSchema):
    try:
        return application_service.review_application(
            request.user,
            application_id,
            approved=payload.approved,
            opinion=payload.opinion,
            new_interest_rate=payload.new_interest_rate,
            version=payload.version if hasattr(payload, 'version') else None,
        )
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.put('/applications/{application_id}/correct', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def correct_application(request, application_id: int, payload: schemas.ApplicationUpdateSchema):
    try:
        return application_service.correct_application(
            request.user,
            application_id,
            payload.dict(exclude_unset=True),
            version=payload.version if hasattr(payload, 'version') else None,
        )
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.post('/applications/{application_id}/final-review', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def final_review_application(request, application_id: int, payload: schemas.FinalReviewSchema):
    try:
        return application_service.final_review_application(
            request.user,
            application_id,
            approved=payload.approved,
            opinion=payload.opinion,
            version=payload.version if hasattr(payload, 'version') else None,
        )
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.put('/applications/{application_id}/archive', tags=['展期申请'], response=schemas.ApplicationDetailSchema, auth=auth)
def archive_application(request, application_id: int, version: int = None):
    try:
        return application_service.archive_application(request.user, application_id, version=version)
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.put('/applications/{application_id}/materials/verify', tags=['展期申请'], response=schemas.MaterialSchema, auth=auth)
def verify_material(request, application_id: int, payload: schemas.MaterialVerifySchema):
    try:
        return application_service.verify_material(
            request.user,
            payload.material_id,
            payload.verified,
        )
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.post('/scan', tags=['扫码核验'], response=schemas.QrCodeScanResultSchema, auth=auth)
def scan_qr_code(request, payload: schemas.QrCodeScanSchema):
    return scan_service.scan_qr_code(request.user, payload.qr_code, payload.location)


@api.get('/scan/history', tags=['扫码核验'], auth=auth)
def get_scan_history(request, page: int = 1, page_size: int = 20):
    return scan_service.get_scan_history(request.user, page=page, page_size=page_size)


@api.post('/batch', tags=['批量处理'], response=schemas.BatchTaskSchema, auth=auth)
def batch_process(request, payload: schemas.BatchProcessSchema):
    try:
        return batch_service.batch_process(
            request.user,
            payload.application_ids,
            payload.action,
            payload.remark,
        )
    except ValueError as e:
        return api.create_response(request, {'code': 'INVALID_OPERATION', 'message': str(e)}, status=400)
    except PermissionError as e:
        return api.create_response(request, {'code': 'PERMISSION_DENIED', 'message': str(e)}, status=403)


@api.get('/batch/tasks', tags=['批量处理'], response=schemas.BatchTaskListResponseSchema, auth=auth)
def get_batch_task_list(request, page: int = 1, page_size: int = 20):
    return batch_service.get_batch_task_list(request.user, page=page, page_size=page_size)


@api.get('/batch/tasks/{task_id}', tags=['批量处理'], response=schemas.BatchTaskSchema, auth=auth)
def get_batch_task_detail(request, task_id: int):
    try:
        return batch_service.get_batch_task_detail(task_id)
    except ValueError as e:
        return api.create_response(request, {'code': 'NOT_FOUND', 'message': str(e)}, status=404)


@api.get('/audit-logs', tags=['审计日志'], response=schemas.AuditLogListResponseSchema, auth=auth)
def get_audit_logs(request, filters: schemas.AuditLogQuerySchema = Query(...)):
    return audit_service.get_audit_logs(
        application_no=filters.application_no,
        action=filters.action,
        operator_id=filters.operator_id,
        start_date=filters.start_date,
        end_date=filters.end_date,
        page=filters.page,
        page_size=filters.page_size,
    )


api.add_router('', router)
