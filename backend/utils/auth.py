from datetime import datetime, timedelta
from jose import jwt
import hashlib
import hmac
import os
import base64
from typing import Optional

from config import settings
from models.user import User


def _hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    hash_result = _hash_password(password, salt)
    combined = salt + hash_result
    return base64.b64encode(combined).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        decoded = base64.b64decode(hashed_password.encode('utf-8'))
        salt = decoded[:16]
        stored_hash = decoded[16:]
        computed_hash = _hash_password(plain_password, salt)
        return hmac.compare_digest(computed_hash, stored_hash)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
