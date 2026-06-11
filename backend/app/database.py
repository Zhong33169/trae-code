import databases
import sqlite3
from .config import settings

database = databases.Database(settings.DATABASE_URL)


def get_sqlite_conn() -> sqlite3.Connection:
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    return sqlite3.connect(db_path)
