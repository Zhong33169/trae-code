from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class ChargingPile(Base):
    __tablename__ = "charging_piles"

    id = Column(Integer, primary_key=True, index=True)
    pile_code = Column(String(50), unique=True, index=True, nullable=False)
    pile_name = Column(String(100), nullable=False)
    station_code = Column(String(50), nullable=False)
    station_name = Column(String(100), nullable=False)
    location = Column(String(200))
    power_rating = Column(String(50))
    qr_code = Column(String(255), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    last_inspection_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    inspections = relationship("InspectionOrder", back_populates="charging_pile")
    qr_records = relationship("QRCodeRecord", back_populates="charging_pile")
