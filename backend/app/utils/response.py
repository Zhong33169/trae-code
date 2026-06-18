from typing import Any, Optional
from starlette.responses import JSONResponse


ERROR_CODES = {
    "VERSION_CONFLICT": 409,
    "FORBIDDEN": 403,
    "INVALID_STATUS": 400,
    "NOT_FOUND": 404,
    "BAD_REQUEST": 400,
    "OVERDUE_REMARK_REQUIRED": 400,
    "MATERIAL_INCOMPLETE": 400,
    "CORRECTION_INCOMPLETE": 400,
}


def success_response(data: Any = None, message: str = "ok", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": 0,
            "message": message,
            "data": data,
        },
    )


def error_response(
    message: str,
    error_code: str = "BAD_REQUEST",
    data: Optional[dict] = None,
) -> JSONResponse:
    status_code = ERROR_CODES.get(error_code, 400)
    body: dict = {
        "code": error_code,
        "message": message,
        "data": data,
    }
    return JSONResponse(status_code=status_code, content=body)
