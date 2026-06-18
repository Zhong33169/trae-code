from typing import Any, Optional
from starlette.responses import JSONResponse


def success_response(data: Any = None, message: str = "ok", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": 0,
            "message": message,
            "data": data,
        },
    )


def error_response(message: str, code: int = 400, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "code": code,
            "message": message,
            "data": None,
        },
    )
