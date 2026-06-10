from models.inspection import InspectionStatus, InspectionType
from models.user import UserRole
from models.audit_log import AuditAction
from models.qr_record import ScanResult

STATUS_LABELS = {
    InspectionStatus.DRAFT: "草稿",
    InspectionStatus.PENDING_REVIEW: "待审核主管办理",
    InspectionStatus.REVIEWING: "审核主管办理中",
    InspectionStatus.REVIEW_REJECTED: "审核退回补正",
    InspectionStatus.PENDING_FAULT_REPORT: "待故障上报",
    InspectionStatus.FAULT_REPORTED: "已上报故障",
    InspectionStatus.PENDING_REPAIR: "待修复",
    InspectionStatus.REPAIR_COMPLETED: "修复完成待验收",
    InspectionStatus.PENDING_ACCEPTANCE: "待修复验收",
    InspectionStatus.ACCEPTANCE_REJECTED: "验收不合格",
    InspectionStatus.PENDING_FINAL_REVIEW: "待复核归档",
    InspectionStatus.FINAL_REVIEW_REJECTED: "复核退回",
    InspectionStatus.ARCHIVED: "已归档",
    InspectionStatus.CANCELLED: "已取消",
}

ROLE_LABELS = {
    UserRole.REGISTRAR: "设备巡检登记员",
    UserRole.SUPERVISOR: "设备巡检审核主管",
    UserRole.REVIEWER: "新能源汽车充电站复核负责人",
}

ACTION_LABELS = {
    AuditAction.CREATE: "创建",
    AuditAction.UPDATE: "更新",
    AuditAction.SUBMIT: "提交",
    AuditAction.REVIEW: "审核",
    AuditAction.REJECT: "退回",
    AuditAction.SCAN_QR: "扫码核验",
    AuditAction.REPORT_FAULT: "上报故障",
    AuditAction.REPAIR_COMPLETE: "修复完成",
    AuditAction.ACCEPT: "验收",
    AuditAction.FINAL_REVIEW: "复核",
    AuditAction.ARCHIVE: "归档",
    AuditAction.CANCEL: "取消",
    AuditAction.BATCH_PROCESS: "批量处理",
}

SCAN_RESULT_LABELS = {
    ScanResult.SUCCESS: "核验成功",
    ScanResult.INVALID_QR: "无效二维码",
    ScanResult.DUPLICATE_SCAN: "重复扫码",
    ScanResult.USER_MISMATCH: "扫码人不匹配",
    ScanResult.ORDER_NOT_FOUND: "巡检单不存在",
    ScanResult.INVALID_STATUS: "状态不允许扫码",
    ScanResult.PILE_NOT_MATCH: "充电桩不匹配",
    ScanResult.TIME_OUT: "扫码超时",
}

TYPE_LABELS = {
    InspectionType.ROUTINE: "常规巡检",
    InspectionType.SPECIAL: "专项巡检",
    InspectionType.EMERGENCY: "紧急巡检",
}


def get_status_label(status: InspectionStatus) -> str:
    return STATUS_LABELS.get(status, status.value)


def get_role_label(role: UserRole) -> str:
    return ROLE_LABELS.get(role, role.value)


def get_action_label(action: AuditAction) -> str:
    return ACTION_LABELS.get(action, action.value)


def get_scan_result_label(result: ScanResult) -> str:
    return SCAN_RESULT_LABELS.get(result, result.value)


def get_type_label(inspection_type: InspectionType) -> str:
    return TYPE_LABELS.get(inspection_type, inspection_type.value)
