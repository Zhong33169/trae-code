import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("SECRET_KEY", "k12-training-secret-key-for-demo-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3002")

DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "data" / "k12.db"))

PORT = int(os.environ.get("BACKEND_PORT", 8002))
HOST = os.environ.get("BACKEND_HOST", "0.0.0.0")
