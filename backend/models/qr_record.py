from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base
import enum


class ScanResult(str, enum.Enum):
    SUCCESS = "success"
    INVALID_QR = "invalid_qr"
    DUPLICATE_SCAN = "duplicate_scan"
    USER_MISMATCH = "user_mismatch"
    ORDER_NOT_FOUND = "order_not_found"
    INVALID_STATUS = "invalid_status"
    PILE_NOT_MATCH = "pile_not_match"
    TIME_OUT = "time_out"


class QRCodeRecord(Base):
    __tablename__ = "qr_code_records"

    id = Column(Integer, primary_key=True, index=True)
    qr_code_content = Column(String(255), nullable=False)
    scan_time = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    result = Column(Enum(ScanResult), nullable=False)
    scanned_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    scanner = relationship("User", foreign_keys=[scanned_by])

    @property
    def result_label(self) -> str:
        labels = {
            ScanResult.SUCCESS: "核验成功",
            ScanResult.INVALID_QR: "无效二维码",
            ScanResult.DUPLICATE_SCAN: "重复扫码",
            ScanResult.USER_MISMATCH: "扫码人不匹配",
            ScanResult.ORDER_NOT_FOUND: "巡检单不存在",
            ScanResult.INVALID_STATUS: "状态不允许扫码",
            ScanResult.PILE_NOT_MATCH: "充电桩不匹配",
            ScanResult.TIME_OUT: "扫码超时",
        }
        return labels.get(self.result, self.result.value)

    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"))
    inspection_order = relationship("InspectionOrder", back_populates="qr_records")

    charging_pile_id = Column(Integer, ForeignKey("charging_piles.id"))
    charging_pile = relationship("ChargingPile", back_populates="qr_records")

    location_evidence = Column(String(255))
    photo_evidence = Column(LargeBinary)
    photo_evidence_path = Column(String(500))
    note = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
