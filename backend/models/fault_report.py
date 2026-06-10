from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date, LargeBinary
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class FaultReport(Base):
    __tablename__ = "fault_reports"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="fault_report")

    fault_code = Column(String(50), nullable=False)
    fault_description = Column(Text, nullable=False)
    fault_level = Column(String(50), nullable=False)
    fault_location = Column(String(200))
    reported_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reported_at = Column(DateTime(timezone=True), server_default=func.now())

    repair_deadline = Column(DateTime(timezone=True), nullable=False)
    repair_company = Column(String(200))
    repair_contact = Column(String(100))
    repair_phone = Column(String(50))

    attachment_paths = Column(Text)
    report_opinion = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
