from datetime import datetime
from typing import Optional
import sqlite3
from ..database import get_sqlite_conn


def generate_application_no(conn: Optional[sqlite3.Connection] = None) -> str:
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"ACCT{today}"

    def _query(cursor):
        cursor.execute(
            "SELECT application_no FROM account_applications "
            "WHERE application_no LIKE ? "
            "ORDER BY application_no DESC LIMIT 1",
            (f"{prefix}%",)
        )
        return cursor.fetchone()

    if conn is not None:
        row = _query(conn.cursor())
    else:
        new_conn = get_sqlite_conn()
        try:
            row = _query(new_conn.cursor())
        finally:
            new_conn.close()

    if row:
        last_no = row[0]
        seq = int(last_no[-4:]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"

