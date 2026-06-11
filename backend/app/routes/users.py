from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route

from ..database import get_db
from ..models import User
from ..schemas import UserOut


async def list_users(request: Request):
    db = next(get_db())
    users = db.query(User).all()
    result = [UserOut.model_validate(u).model_dump(mode='json') for u in users]
    return JSONResponse({"items": result})


async def get_user(request: Request):
    username = request.path_params.get("username")
    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()
    if not user:
        return JSONResponse({"detail": "用户不存在"}, status_code=404)
    return JSONResponse(UserOut.model_validate(user).model_dump(mode='json'))


async def current_user(request: Request):
    role = request.headers.get("X-User-Role", "registrar")
    username = request.headers.get("X-User-Name", "registrar")
    db = next(get_db())
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = db.query(User).filter(User.role == role).first()
    if user:
        return JSONResponse(UserOut.model_validate(user).model_dump(mode='json'))
    return JSONResponse({
        "id": 0,
        "username": username,
        "name": "未知用户",
        "role": role,
        "department": ""
    })


routes = [
    Route("/", list_users, methods=["GET"]),
    Route("/current", current_user, methods=["GET"]),
    Route("/{username}", get_user, methods=["GET"]),
]
