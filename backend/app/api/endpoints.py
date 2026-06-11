from starlette.responses import JSONResponse
from starlette.requests import Request
from typing import Optional
from ..schemas.models import OperationSubmitRequest
from ..utils.service import (
    get_application_list,
    get_application_detail,
    get_operation_records,
    get_risk_level_logs,
    get_statistics,
    get_users,
    handle_submit_operation,
    create_application,
)


async def health_check(request: Request):
    return JSONResponse({
        "status": "ok",
        "app": "银行网点-风险分级处置开户申请系统",
    })


async def list_applications(request: Request):
    stage = request.query_params.get("stage")
    status = request.query_params.get("status")
    risk_level = request.query_params.get("risk_level")
    handler_id = request.query_params.get("handler_id")
    handler_id_int = int(handler_id) if handler_id else None

    result = get_application_list(
        stage=stage,
        status=status,
        risk_level=risk_level,
        handler_id=handler_id_int,
    )
    return JSONResponse({"code": 0, "data": result})


async def get_application(request: Request):
    app_id = int(request.path_params["id"])
    result = get_application_detail(app_id)
    if not result:
        return JSONResponse({"code": 1, "message": "申请不存在"}, status_code=404)
    return JSONResponse({"code": 0, "data": result})


async def get_operations(request: Request):
    app_id = int(request.path_params["id"])
    result = get_operation_records(app_id)
    return JSONResponse({"code": 0, "data": result})


async def get_risk_logs(request: Request):
    app_id = int(request.path_params["id"])
    result = get_risk_level_logs(app_id)
    return JSONResponse({"code": 0, "data": result})


async def submit_operation(request: Request):
    body = await request.json()
    try:
        req = OperationSubmitRequest(**body)
    except Exception as e:
        return JSONResponse({"code": 1, "message": f"参数错误: {str(e)}"}, status_code=400)

    ok, msg, data = handle_submit_operation(req)
    if not ok:
        return JSONResponse({"code": 1, "message": msg}, status_code=400)
    return JSONResponse({"code": 0, "message": msg, "data": data})


async def stats_overview(request: Request):
    result = get_statistics()
    return JSONResponse({"code": 0, "data": result})


async def list_users(request: Request):
    result = get_users()
    return JSONResponse({"code": 0, "data": result})


async def create_new_application(request: Request):
    body = await request.json()
    ok, msg, data = create_application(body)
    if not ok:
        return JSONResponse({"code": 1, "message": msg}, status_code=400)
    return JSONResponse({"code": 0, "message": msg, "data": data})
