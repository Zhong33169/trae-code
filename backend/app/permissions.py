from typing import Tuple, Optional, Dict, Any, List
from datetime import datetime

STATUS_FLOW = {
    "draft": {
        "registrar": ["submit", "update", "delete"],
        "auditor": [],
        "reviewer": [],
    },
    "pending_audit": {
        "registrar": ["read"],
        "auditor": ["audit_pass", "return"],
        "reviewer": ["read"],
    },
    "approved": {
        "registrar": ["usage_confirm", "read"],
        "auditor": ["read"],
        "reviewer": ["read"],
    },
    "usage_confirmed": {
        "registrar": ["read"],
        "auditor": ["read"],
        "reviewer": ["review_pass", "return"],
    },
    "returned": {
        "registrar": ["update", "submit", "read"],
        "auditor": ["read"],
        "reviewer": ["read"],
    },
    "archived": {
        "registrar": ["read"],
        "auditor": ["read"],
        "reviewer": ["read"],
    },
    "overdue": {
        "registrar": ["read"],
        "auditor": ["read"],
        "reviewer": ["read"],
    },
}

STATUS_TRANSITIONS = {
    "draft": {"submit": "pending_audit"},
    "returned": {"submit": "pending_audit"},
    "pending_audit": {"audit_pass": "approved", "return": "returned"},
    "approved": {"usage_confirm": "usage_confirmed"},
    "usage_confirmed": {"review_pass": "archived", "return": "returned"},
}

STATUS_LABELS = {
    "draft": "草稿",
    "pending_audit": "待审核",
    "approved": "审核通过",
    "usage_confirmed": "使用确认",
    "archived": "已归档",
    "returned": "已退回",
    "overdue": "已超时",
}

ACTION_LABELS = {
    "submit": "提交审核",
    "audit_pass": "审核通过",
    "return": "退回补正",
    "usage_confirm": "使用确认",
    "review_pass": "复核归档",
    "update": "编辑",
    "delete": "删除",
    "read": "查看",
}

ROLE_LABELS = {
    "registrar": "会议预约登记员",
    "auditor": "会议预约审核主管",
    "reviewer": "行政后勤中心复核负责人",
}


def check_permission(current_status: str, role: str, action: str) -> Tuple[bool, Optional[str]]:
    if current_status not in STATUS_FLOW:
        return False, f"未知状态: {current_status}"
    allowed = STATUS_FLOW.get(current_status, {}).get(role, [])
    if action not in allowed:
        role_label = ROLE_LABELS.get(role, role)
        status_label = STATUS_LABELS.get(current_status, current_status)
        return False, f"当前角色【{role_label}】在状态【{status_label}】下不允许执行操作【{ACTION_LABELS.get(action, action)}】"
    return True, None


def get_next_status(current_status: str, action: str) -> Optional[str]:
    return STATUS_TRANSITIONS.get(current_status, {}).get(action)


def validate_required_fields(data: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors = []
    required = [
        ("title", "会议主题"),
        ("meeting_room", "会议室"),
        ("meeting_date", "会议日期"),
        ("start_time", "开始时间"),
        ("end_time", "结束时间"),
        ("participants", "参会人数"),
    ]
    for field, label in required:
        if not data.get(field):
            errors.append(f"{label}不能为空")

    if data.get("participants", 0) <= 0:
        errors.append("参会人数必须大于0")

    if data.get("offline_attachment_count", 0) > 0 and not data.get("attachment_names"):
        errors.append("存在线下附件但未填写附件清单")

    return len(errors) == 0, errors


def reconcile_offline_online(
    online_items: List[Any],
    offline_count: int,
    offline_statuses: List[Dict[str, Any]] = None,
    offline_attachments: List[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    diffs = []
    item_results = []
    is_consistent = True
    is_blocked = False

    offline_statuses = offline_statuses or []
    offline_attachments = offline_attachments or []

    online_count = len(online_items)
    if online_count != offline_count:
        diffs.append({
            "field": "数量",
            "online_value": online_count,
            "offline_value": offline_count,
            "status": "diff",
            "message": f"线上 {online_count} 条，线下 {offline_count} 条，数量不一致",
        })
        is_consistent = False

    offline_by_no = {}
    for s in offline_statuses:
        no = s.get("reservation_no")
        if no:
            offline_by_no[no] = s
    for a in offline_attachments:
        no = a.get("reservation_no")
        if no:
            if no in offline_by_no:
                offline_by_no[no]["attachments"] = a.get("attachments", [])
            else:
                offline_by_no[no] = {"reservation_no": no, "attachments": a.get("attachments", [])}

    for r in online_items:
        online_att_list = []
        if hasattr(r, 'offline_attachment_list') and r.offline_attachment_list:
            online_att_list = r.offline_attachment_list if isinstance(r.offline_attachment_list, list) else []
        online_att_names = set(a.strip() for a in (r.attachment_names or "").split(",") if a.strip())

        item = {
            "reservation_no": r.reservation_no,
            "title": r.title,
            "online_status": r.status,
            "offline_status": None,
            "online_attachments": sorted(online_att_names) if online_att_names else [],
            "offline_attachments": [],
            "status_diffs": [],
            "attachment_diffs": [],
            "is_consistent": True,
        }

        offline = offline_by_no.get(r.reservation_no)
        if offline:
            item["offline_status"] = offline.get("status")
            if offline.get("status") and r.status != offline.get("status"):
                item["status_diffs"].append({
                    "field": "状态",
                    "online_value": STATUS_LABELS.get(r.status, r.status),
                    "offline_value": STATUS_LABELS.get(offline["status"], offline["status"]),
                    "message": f"线上状态【{STATUS_LABELS.get(r.status, r.status)}】与线下【{STATUS_LABELS.get(offline['status'], offline['status'])}】不一致",
                })
                item["is_consistent"] = False
                is_consistent = False

            offline_att_raw = offline.get("attachments", [])
            if isinstance(offline_att_raw, str):
                offline_att_set = set(a.strip() for a in offline_att_raw.split(",") if a.strip())
            elif isinstance(offline_att_raw, list):
                offline_att_set = set(str(a).strip() for a in offline_att_raw if str(a).strip())
            else:
                offline_att_set = set()
            item["offline_attachments"] = sorted(offline_att_set) if offline_att_set else []

            if online_att_names != offline_att_set:
                missing_online = offline_att_set - online_att_names
                missing_offline = online_att_names - offline_att_set
                item["attachment_diffs"].append({
                    "field": "附件",
                    "online_value": sorted(online_att_names) if online_att_names else "(空)",
                    "offline_value": sorted(offline_att_set) if offline_att_set else "(空)",
                    "missing_online": sorted(missing_online),
                    "missing_offline": sorted(missing_offline),
                    "message": "附件清单不一致" + (f"，线下多出{sorted(missing_online)}" if missing_online else "") + (f"，线上多出{sorted(missing_offline)}" if missing_offline else ""),
                })
                item["is_consistent"] = False
                is_consistent = False
        else:
            if online_att_names:
                item["offline_attachments"] = []
                if online_att_names:
                    item["attachment_diffs"].append({
                        "field": "附件",
                        "online_value": sorted(online_att_names),
                        "offline_value": "(未填写)",
                        "missing_online": [],
                        "missing_offline": sorted(online_att_names),
                        "message": "线下未登记附件",
                    })
                    item["is_consistent"] = False
                    is_consistent = False

        item_results.append(item)

    online_statuses = set(r.status for r in online_items)
    if len(online_statuses) > 1:
        is_blocked = True
        is_consistent = False
        diffs.append({
            "field": "批次状态一致性",
            "online_value": [STATUS_LABELS.get(s, s) for s in online_statuses],
            "offline_value": None,
            "status": "diff",
            "message": f"批次内存在不同状态：{', '.join(STATUS_LABELS.get(s, s) for s in online_statuses)}，不允许继续提交",
        })

    message = "线上线下一致，可以继续处理" if is_consistent else "存在差异，请核对后再处理"
    if is_blocked:
        message = "批次内状态不一致，已阻断提交。请逐单核对线下台账状态。"

    return {
        "is_consistent": is_consistent,
        "is_blocked": is_blocked,
        "message": message,
        "total_online": online_count,
        "total_offline": offline_count,
        "diff_count": len(diffs),
        "diffs": diffs,
        "item_results": item_results,
    }
