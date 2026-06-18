from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Router

from app.database import get_db
from app.models import RoleEnum
from app.services.application_service import (
    create_application, update_application, get_application_by_id,
    list_applications, submit_application, start_audit, request_correction,
    audit_pass, audit_reject, review_pass, review_reject, archive_application,
    batch_action, check_all_overdue,
)
from app.services.validation_service import ActionError, check_role_permission
from app.services.user_service import get_user_by_id
from app.schemas import (
    ApplicationCreate, ApplicationUpdate, ApplicationResponse,
    ApplicationDetailResponse, CorrectionRequest, StartAuditRequest,
    AuditRequest, BatchActionRequest, AuditLogResponse, SubmitRequest,
)
from app.models import AuditActionEnum
from app.utils.response import error_response

router = Router()


async def get_applications(request: Request):
    db = next(get_db())
    try:
        query_params = request.query_params
        page = int(query_params.get("page", 1))
        page_size = int(query_params.get("page_size", 20))
        status = query_params.get("status")
        is_overdue = query_params.get("is_overdue")
        search = query_params.get("search")
        role = request.state.user_role

        if is_overdue is not None:
            is_overdue = is_overdue.lower() == "true"

        items, total = list_applications(
            db, status=status, is_overdue=is_overdue,
            role=role, search=search,
            page=page, page_size=page_size
        )

        result_items = []
        for app in items:
            app.check_overdue()
            result_items.append(ApplicationResponse.model_validate(app))
        db.commit()

        return JSONResponse({
            "items": [item.model_dump(mode="json") for item in result_items],
            "total": total,
            "page": page,
            "page_size": page_size,
        })
    finally:
        db.close()


async def get_application(request: Request):
    app_id = request.path_params["app_id"]
    db = next(get_db())
    try:
        application = get_application_by_id(db, app_id)
        if not application:
            return error_response("申请不存在", error_code="NOT_FOUND")

        application.check_overdue()
        db.commit()

        app_data = ApplicationDetailResponse.model_validate(application)
        result = app_data.model_dump(mode="json")

        audit_logs = []
        for log in application.audit_logs:
            operator = get_user_by_id(db, log.operator_id)
            operator_name = operator.full_name if operator else "系统"
            log_dict = AuditLogResponse.model_validate(log).model_dump(mode="json")
            log_dict["operator_name"] = operator_name
            audit_logs.append(log_dict)
        result["audit_logs"] = audit_logs

        return JSONResponse(result)
    finally:
        db.close()


def _handle_action_error(e: ActionError) -> JSONResponse:
    return error_response(e.message, error_code=e.error_code, data=e.data)


async def create_new_application(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.CREATE)
    except ActionError as e:
        return _handle_action_error(e)

    try:
        body = await request.json()
        app_data = ApplicationCreate(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        application = create_application(db, app_data, user_id)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"), status_code=201)
    finally:
        db.close()


async def update_existing_application(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.UPDATE)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        app_data = ApplicationUpdate(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = update_application(db, app_id, app_data, user_id, app_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def submit_existing_application(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.SUBMIT)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = SubmitRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = submit_application(db, app_id, user_id, req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def start_application_audit(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.START_AUDIT)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = StartAuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = start_audit(db, app_id, user_id, req_data.remark or "", req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def request_application_correction(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.REQUEST_CORRECTION)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = CorrectionRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = request_correction(
                db, app_id, user_id,
                req_data.correction_request,
                req_data.version,
                req_data.material_reviews or {},
            )
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def audit_pass_application(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.AUDIT_PASS)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = AuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        opinion = req_data.opinion or ""
        try:
            application = audit_pass(
                db, app_id, user_id, opinion,
                req_data.version,
                req_data.material_reviews or {},
            )
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def audit_reject_application(request: Request):
    if request.state.user_role != RoleEnum.AUDIT_SUPERVISOR.value:
        return error_response("只有审核主管可以审核拒绝", error_code="FORBIDDEN")

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = AuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = audit_reject(db, app_id, user_id, req_data.opinion or "", req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def review_pass_application(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.REVIEW_PASS)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = AuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        opinion = req_data.opinion or ""
        try:
            application = review_pass(db, app_id, user_id, opinion, req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def review_reject_application(request: Request):
    if request.state.user_role != RoleEnum.REVIEW_LEADER.value:
        return error_response("只有复核负责人可以复核拒绝", error_code="FORBIDDEN")

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = AuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        try:
            application = review_reject(db, app_id, user_id, req_data.opinion or "", req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def archive_application_endpoint(request: Request):
    try:
        check_role_permission(request.state.user_role, AuditActionEnum.ARCHIVE)
    except ActionError as e:
        return _handle_action_error(e)

    app_id = request.path_params["app_id"]
    try:
        body = await request.json()
        req_data = AuditRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        opinion = req_data.opinion or req_data.remark or ""
        try:
            application = archive_application(db, app_id, user_id, opinion, req_data.version)
        except ActionError as e:
            db.rollback()
            return _handle_action_error(e)
        result = ApplicationResponse.model_validate(application)
        return JSONResponse(result.model_dump(mode="json"))
    finally:
        db.close()


async def check_overdue_applications(request: Request):
    db = next(get_db())
    try:
        count = check_all_overdue(db)
        return JSONResponse({"overdue_count": count})
    finally:
        db.close()


async def batch_process_applications(request: Request):
    try:
        body = await request.json()
        req_data = BatchActionRequest(**body)
    except Exception as e:
        return error_response(f"请求参数错误: {str(e)}", error_code="BAD_REQUEST")

    db = next(get_db())
    try:
        user_id = request.state.user_id
        role = request.state.user_role
        items = [{"id": item.id, "version": item.version} for item in req_data.items]
        results = batch_action(db, items, req_data.action, user_id, role, req_data.remark or "")
        return JSONResponse(results)
    finally:
        db.close()


router.add_route("/", get_applications, methods=["GET"])
router.add_route("/", create_new_application, methods=["POST"])
router.add_route("/{app_id:int}", get_application, methods=["GET"])
router.add_route("/{app_id:int}", update_existing_application, methods=["PUT"])
router.add_route("/{app_id:int}/submit", submit_existing_application, methods=["POST"])
router.add_route("/{app_id:int}/start-audit", start_application_audit, methods=["POST"])
router.add_route("/{app_id:int}/request-correction", request_application_correction, methods=["POST"])
router.add_route("/{app_id:int}/audit-pass", audit_pass_application, methods=["POST"])
router.add_route("/{app_id:int}/audit-reject", audit_reject_application, methods=["POST"])
router.add_route("/{app_id:int}/review-pass", review_pass_application, methods=["POST"])
router.add_route("/{app_id:int}/review-reject", review_reject_application, methods=["POST"])
router.add_route("/{app_id:int}/archive", archive_application_endpoint, methods=["POST"])
router.add_route("/check-overdue", check_overdue_applications, methods=["POST"])
router.add_route("/batch", batch_process_applications, methods=["POST"])
