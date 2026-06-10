from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from typing import Optional, Tuple, List
from datetime import datetime

from models.inspection import InspectionOrder, InspectionStatus
from models.charging_pile import ChargingPile
from models.qr_record import QRCodeRecord, ScanResult
from models.fault_report import FaultReport
from models.repair_acceptance import RepairAcceptance
from models.user import User


def validate_inspection_materials(
    inspection: InspectionOrder,
    target_status: InspectionStatus
) -> Tuple[bool, Optional[str], Optional[List[str]]]:
    missing_fields = []

    if target_status == InspectionStatus.PENDING_REVIEW:
        if not inspection.appearance_check:
            missing_fields.append("外观检查结果")
        if not inspection.cable_check:
            missing_fields.append("线缆检查结果")
        if not inspection.connector_check:
            missing_fields.append("连接器检查结果")
        if not inspection.display_check:
            missing_fields.append("显示屏检查结果")
        if not inspection.charging_check:
            missing_fields.append("充电功能检查结果")
        if not inspection.emergency_stop_check:
            missing_fields.append("急停功能检查结果")
        if not inspection.grounding_check:
            missing_fields.append("接地检查结果")
        if not inspection.overall_result:
            missing_fields.append("总体检查结论")
        if not inspection.registrar_opinion:
            missing_fields.append("登记员处理意见")

    elif target_status == InspectionStatus.PENDING_FINAL_REVIEW:
        if not inspection.supervisor_opinion:
            missing_fields.append("审核主管处理意见")

    if missing_fields:
        return False, f"材料不完整，缺少: {', '.join(missing_fields)}", missing_fields

    return True, None, None


async def validate_qr_code(
    db: AsyncSession,
    qr_code_content: str,
    inspection_order_id: Optional[int] = None
) -> Tuple[bool, Optional[str], Optional[ChargingPile], Optional[InspectionOrder]]:
    result = await db.execute(
        select(ChargingPile).where(ChargingPile.qr_code == qr_code_content)
    )
    pile = result.scalar_one_or_none()

    if not pile:
        return False, "无效的二维码", None, None

    if not pile.is_active:
        return False, "该充电桩已停用", pile, None

    inspection = None
    if inspection_order_id:
        result = await db.execute(
            select(InspectionOrder).where(InspectionOrder.id == inspection_order_id)
        )
        inspection = result.scalar_one_or_none()

        if not inspection:
            return False, "巡检单不存在", pile, None

        if inspection.charging_pile_id != pile.id:
            return False, "二维码与巡检单充电桩不匹配", pile, inspection

        allowed_statuses = [
            InspectionStatus.DRAFT,
            InspectionStatus.REVIEW_REJECTED,
            InspectionStatus.FINAL_REVIEW_REJECTED,
            InspectionStatus.ACCEPTANCE_REJECTED,
        ]
        if inspection.status not in allowed_statuses:
            return False, f"当前状态 [{inspection.status}] 不允许扫码核验", pile, inspection

    return True, None, pile, inspection


async def check_duplicate_scan(
    db: AsyncSession,
    inspection_order_id: int,
    user_id: int
) -> Tuple[bool, Optional[str]]:
    result = await db.execute(
        select(QRCodeRecord).where(
            QRCodeRecord.inspection_order_id == inspection_order_id,
            QRCodeRecord.scanned_by == user_id,
            QRCodeRecord.result == ScanResult.SUCCESS
        )
    )
    existing_scan = result.scalars().first()

    if existing_scan:
        return True, f"该巡检单已于 {existing_scan.scan_time.strftime('%Y-%m-%d %H:%M:%S')} 完成扫码核验"

    return False, None


def validate_time_limit(
    inspection: InspectionOrder
) -> Tuple[bool, Optional[str]]:
    if inspection.time_limit and datetime.utcnow() > inspection.time_limit:
        return False, "已超过处理时限，请联系相关人员处理"
    return True, None


def validate_fault_report_materials(
    fault_report: FaultReport
) -> Tuple[bool, Optional[str]]:
    if not fault_report.fault_code:
        return False, "故障代码不能为空"
    if not fault_report.fault_description:
        return False, "故障描述不能为空"
    if not fault_report.fault_level:
        return False, "故障等级不能为空"
    if not fault_report.repair_deadline:
        return False, "修复时限不能为空"
    return True, None


def validate_repair_acceptance_materials(
    acceptance: RepairAcceptance
) -> Tuple[bool, Optional[str]]:
    if not acceptance.repair_company:
        return False, "维修单位不能为空"
    if not acceptance.repair_person:
        return False, "维修人员不能为空"
    if not acceptance.repair_content:
        return False, "维修内容不能为空"
    if not acceptance.acceptance_result:
        return False, "验收结果不能为空"
    return True, None
