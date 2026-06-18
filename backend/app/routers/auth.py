from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Router

from app.database import get_db
from app.services.user_service import authenticate_user, get_user_by_id
from app.schemas import UserLogin, UserResponse
from app.utils.auth import create_token

router = Router()


async def login(request: Request):
    try:
        body = await request.json()
        login_data = UserLogin(**body)
    except Exception as e:
        return JSONResponse(status_code=400, content={"detail": "请求参数错误"})

    db = next(get_db())
    try:
        user = authenticate_user(db, login_data.username, login_data.password)
        if not user:
            return JSONResponse(status_code=401, content={"detail": "用户名或密码错误"})

        token = create_token(user.id, user.role.value)
        user_data = UserResponse.model_validate(user)

        return JSONResponse({
            "access_token": token,
            "token_type": "bearer",
            "user": user_data.model_dump(mode="json")
        })
    finally:
        db.close()


async def get_current_user(request: Request):
    db = next(get_db())
    try:
        user_id = request.state.user_id
        user = get_user_by_id(db, user_id)
        if not user:
            return JSONResponse(status_code=404, content={"detail": "用户不存在"})
        user_data = UserResponse.model_validate(user)
        return JSONResponse(user_data.model_dump(mode="json"))
    finally:
        db.close()


router.add_route("/login", login, methods=["POST"])
router.add_route("/me", get_current_user, methods=["GET"])
