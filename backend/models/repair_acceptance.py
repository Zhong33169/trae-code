from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Date, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class RepairAcceptance(Base):
    __tablename__ = "repair_acceptances"

    id = Column(Integer, primary_key=True, index=True)
    inspection_order_id = Column(Integer, ForeignKey("inspection_orders.id"), nullable=False)
    inspection_order = relationship("InspectionOrder", back_populates="repair_acceptance")

    repair_company = Column(String(200), nullable=False)
    repair_person = Column(String(100), nullable=False)
    repair_phone = Column(String(50))
    repair_start_date = Column(DateTime(timezone=True))
    repair_end_date = Column(DateTime(timezone=True))

    repair_content = Column(Text, nullable=False)
    parts_replaced = Column(Text)
    repair_cost = Column(String(100))
    is_guarantee = Column(Boolean, default=False)

    acceptance_result = Column(String(50), nullable=False)
    acceptance_check_items = Column(Text)
    acceptance_opinion = Column(Text)
    accepted_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    accepted_at = Column(DateTime(timezone=True), server_default=func.now())

    attachment_paths = Column(Text)
    material_complete = Column(Boolean, default=True)
    material_note = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
