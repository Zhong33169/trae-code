from ninja import Schema
from typing import Optional


class LoginRequest(Schema):
    username: str
    password: str


class UserInfo(Schema):
    id: int
    username: str
    role: str
    display_name: str
    is_active: bool


class LoginResponse(Schema):
    token: str
    user: UserInfo
