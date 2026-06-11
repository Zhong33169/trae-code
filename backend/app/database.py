import os
import sqlite3
from .config import settings


def _resolve_db_path() -> str:
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    return db_url.replace("sqlite:///", "")


def get_sqlite_conn() -> sqlite3.Connection:
    db_path = _resolve_db_path()
    os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else ".", exist_ok=True)
    return sqlite3.connect(db_path)
