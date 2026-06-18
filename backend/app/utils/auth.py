import hashlib
import hmac
import json
import base64
from datetime import datetime, timedelta
from typing import Optional

from app.config import settings


def hash_password(password: str) -> str:
    return hashlib.sha256((password + settings.SECRET_KEY).encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed


def create_token(user_id: int, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": (datetime.utcnow() + timedelta(hours=settings.TOKEN_EXPIRE_HOURS)).timestamp()
    }
    payload_json = json.dumps(payload)
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload_json.encode(),
        hashlib.sha256
    ).hexdigest()
    token_data = base64.b64encode(f"{payload_json}.{signature}".encode()).decode()
    return token_data


def decode_token(token: str) -> Optional[dict]:
    try:
        decoded = base64.b64decode(token.encode()).decode()
        payload_json, signature = decoded.rsplit(".", 1)
        expected_signature = hmac.new(
            settings.SECRET_KEY.encode(),
            payload_json.encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            return None
        payload = json.loads(payload_json)
        if payload["exp"] < datetime.utcnow().timestamp():
            return None
        return payload
    except Exception:
        return None
