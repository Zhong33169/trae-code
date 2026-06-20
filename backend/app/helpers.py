from datetime import datetime
from .database import get_db, STATUS_LABELS, ROLE_LABELS, NODE_TIME_LIMITS

def get_user_name(user_id: int) -> str:
    conn = get_db()
    row = conn.execute("SELECT display_name FROM users WHERE id=?", (user_id,)).fetchone()
    conn.close()
    return row["display_name"] if row else "未知"

def enrich_form(row) -> dict:
    data = dict(row)
    data["status_label"] = STATUS_LABELS.get(data["status"], data["status"])
    data["created_by_name"] = get_user_name(data["created_by"]) if data.get("created_by") else None

    is_timeout = False
    remaining = None
    if data.get("current_node_entered_at") and data["status"] in NODE_TIME_LIMITS:
        entered = datetime.strptime(data["current_node_entered_at"], "%Y-%m-%d %H:%M:%S")
        limit_h = NODE_TIME_LIMITS[data["status"]]
        elapsed = (datetime.now() - entered).total_seconds() / 3600
        remaining = max(0, limit_h - elapsed)
        if elapsed > limit_h:
            is_timeout = True
    data["is_timeout"] = is_timeout
    data["timeout_remaining_hours"] = round(remaining, 1) if remaining is not None else None
    return data

def enrich_log(row) -> dict:
    data = dict(row)
    data["operator_name"] = get_user_name(data["operator_id"]) if data.get("operator_id") else None
    data["from_status_label"] = STATUS_LABELS.get(data["from_status"], data["from_status"]) if data.get("from_status") else None
    data["to_status_label"] = STATUS_LABELS.get(data["to_status"], data["to_status"]) if data.get("to_status") else None
    return data

def enrich_timeout(row) -> dict:
    data = dict(row)
    data["node_label"] = STATUS_LABELS.get(data["node_name"], data["node_name"])
    data["handled_by_name"] = get_user_name(data["handled_by"]) if data.get("handled_by") else None
    return data
