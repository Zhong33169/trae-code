from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from typing import Optional, List
from datetime import datetime, timezone

from database import get_db
from deps import allow_all_authenticated, allow_registrar_supervisor
from models.user import User
from models.inspection import InspectionOrder, InspectionStatus
from models.charging_pile import ChargingPile
from models.qr_record import QRCodeRecord, ScanResult
from models.audit_log import AuditAction
from schemas.qr_record import (
    QRCodeScanRequest,
    QRCodeRecordResponse,
    ScanResultResponse,
)
from utils import (
    validate_qr_code,
    check_duplicate_scan,
    create_audit_log,
    generate_request_id,
    get_scan_result_label,
    get_status_label,
)

router = APIRouter()


def get_next_step_suggestion(result: ScanResult, inspection: Optional[InspectionOrder] = None) -> tuple[Optional[str], Optional[str]]:
    if result == ScanResult.SUCCESS:
        return "扫码核验成功", "请继续完成巡检内容填写，然后提交审核"
    elif result == ScanResult.INVALID_QR:
        return "二维码无效", "请检查二维码是否正确，或联系管理员确认充电桩信息"
    elif result == ScanResult.DUPLICATE_SCAN:
        return "重复扫码", "该巡检单已完成扫码核验，无需重复扫码"
    elif result == ScanResult.USER_MISMATCH:
        return "扫码人不匹配", "请确认您是该巡检单指定的巡检员"
    elif result == ScanResult.ORDER_NOT_FOUND:
        return "巡检单不存在", "请检查巡检单ID是否正确"
    elif result == ScanResult.INVALID_STATUS:
        if inspection:
            status_label = get_status_label(inspection.status)
            return f"当前状态不允许扫码", f"巡检单当前状态为 [{status_label}]，请在草稿或退回状态下进行扫码核验"
        return "状态不允许扫码", "请在草稿或退回状态下进行扫码核验"
    elif result == ScanResult.PILE_NOT_MATCH:
        return "充电桩不匹配", "请扫描与巡检单对应的充电桩二维码"
    elif result == ScanResult.TIME_OUT:
        return "扫码超时", "请重新扫码"
    return None, None


@router.post("/scan", response_model=ScanResultResponse, summary="扫码核验", description="扫码核验，校验二维码有效性、巡检单状态、扫码人权限等")
async def scan_qr_code(
    scan_data: QRCodeScanRequest,
    request: Request,
    current_user: User = Depends(allow_registrar_supervisor),
    db: AsyncSession = Depends(get_db)
):
    request_id = scan_data.request_id or generate_request_id()
    scan_result = ScanResult.SUCCESS
    result_message = "扫码核验成功"
    inspection_order = None
    charging_pile = None

    valid, message, pile, inspection = await validate_qr_code(
        db=db,
        qr_code_content=scan_data.qr_code_content,
        inspection_order_id=scan_data.inspection_order_id,
    )

    charging_pile = pile

    if not valid:
        if "无效的二维码" in message:
            scan_result = ScanResult.INVALID_QR
        elif "已停用" in message:
            scan_result = ScanResult.INVALID_QR
        elif "巡检单不存在" in message:
            scan_result = ScanResult.ORDER_NOT_FOUND
        elif "不匹配" in message and "充电桩" in message:
            scan_result = ScanResult.PILE_NOT_MATCH
        elif "状态" in message and "不允许" in message:
            scan_result = ScanResult.INVALID_STATUS
            inspection_order = inspection
        result_message = message

    if scan_result == ScanResult.SUCCESS and inspection:
        inspection_order = inspection

        if inspection.inspector_name != current_user.full_name:
            scan_result = ScanResult.USER_MISMATCH
            result_message = f"扫码人不匹配，指定巡检员为: {inspection.inspector_name}"

    if scan_result == ScanResult.SUCCESS and inspection:
        is_duplicate, duplicate_msg = await check_duplicate_scan(
            db=db,
            inspection_order_id=inspection.id,
            user_id=current_user.id,
        )
        if is_duplicate:
            scan_result = ScanResult.DUPLICATE_SCAN
            result_message = duplicate_msg

    qr_record = QRCodeRecord(
        qr_code_content=scan_data.qr_code_content,
        result=scan_result,
        scanned_by=current_user.id,
        inspection_order_id=inspection_order.id if inspection_order else None,
        charging_pile_id=charging_pile.id if charging_pile else None,
        location_evidence=scan_data.location_evidence,
        photo_evidence_path=scan_data.photo_evidence_path,
        note=scan_data.note,
    )
    db.add(qr_record)
    await db.flush()

    if scan_result == ScanResult.SUCCESS:
        await create_audit_log(
            db=db,
            inspection_order_id=inspection_order.id,
            action=AuditAction.SCAN_QR,
            operator=current_user,
            from_status=inspection_order.status,
            to_status=inspection_order.status,
            detail=f"扫码核验成功，充电桩: {charging_pile.pile_name if charging_pile else '未知'}",
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            request_id=request_id,
        )

    await db.commit()
    await db.refresh(qr_record)

    next_step, suggestion = get_next_step_suggestion(scan_result, inspection_order)

    return ScanResultResponse(
        success=(scan_result == ScanResult.SUCCESS),
        result=scan_result,
        result_label=get_scan_result_label(scan_result),
        message=result_message,
        record_id=qr_record.id,
        inspection_order_id=inspection_order.id if inspection_order else None,
        inspection_order_no=inspection_order.order_no if inspection_order else None,
        scan_time=qr_record.scan_time,
        next_step=next_step,
        suggestion=suggestion,
    )


@router.get("/records", response_model=dict, summary="获取扫码记录列表", description="获取扫码记录列表，支持分页和筛选")
async def get_qr_records(
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    inspection_order_id: Optional[int] = Query(None, description="巡检单ID"),
    result: Optional[ScanResult] = Query(None, description="核验结果"),
    start_date: Optional[datetime] = Query(None, description="开始日期"),
    end_date: Optional[datetime] = Query(None, description="结束日期"),
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    query = select(QRCodeRecord).options(
        joinedload(QRCodeRecord.scanner),
        joinedload(QRCodeRecord.charging_pile),
    )

    if inspection_order_id:
        query = query.where(QRCodeRecord.inspection_order_id == inspection_order_id)
    if result:
        query = query.where(QRCodeRecord.result == result)
    if start_date:
        query = query.where(QRCodeRecord.created_at >= start_date)
    if end_date:
        query = query.where(QRCodeRecord.created_at <= end_date)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    query = query.order_by(QRCodeRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result_set = await db.execute(query)
    records = result_set.scalars().all()

    return {
        "total": total,
        "items": [
            QRCodeRecordResponse(
                id=record.id,
                qr_code_content=record.qr_code_content,
                scan_time=record.scan_time,
                result=record.result,
                result_label=get_scan_result_label(record.result),
                scanned_by=record.scanned_by,
                scanner=record.scanner,
                inspection_order_id=record.inspection_order_id,
                charging_pile_id=record.charging_pile_id,
                location_evidence=record.location_evidence,
                photo_evidence_path=record.photo_evidence_path,
                note=record.note,
                created_at=record.created_at,
            )
            for record in records
        ],
        "page": page,
        "page_size": page_size,
    }


@router.get("/records/{record_id}", response_model=QRCodeRecordResponse, summary="获取扫码记录详情", description="根据ID获取扫码记录详情")
async def get_qr_record(
    record_id: int,
    current_user: User = Depends(allow_all_authenticated),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(QRCodeRecord)
        .options(
            joinedload(QRCodeRecord.scanner),
            joinedload(QRCodeRecord.charging_pile),
        )
        .where(QRCodeRecord.id == record_id)
    )
    record = result.scalar_one_or_none()

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"扫码记录ID {record_id} 不存在"
        )

    return QRCodeRecordResponse(
        id=record.id,
        qr_code_content=record.qr_code_content,
        scan_time=record.scan_time,
        result=record.result,
        result_label=get_scan_result_label(record.result),
        scanned_by=record.scanned_by,
        scanner=record.scanner,
        inspection_order_id=record.inspection_order_id,
        charging_pile_id=record.charging_pile_id,
        location_evidence=record.location_evidence,
        photo_evidence_path=record.photo_evidence_path,
        note=record.note,
        created_at=record.created_at,
    )
