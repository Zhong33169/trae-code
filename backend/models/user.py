from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.sql import func
from database import Base
import enum


class UserRole(str, enum.Enum):
    REGISTRAR = "registrar"
    SUPERVISOR = "supervisor"
    REVIEWER = "reviewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    station_code = Column(String(50))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    @property
    def role_label(self) -> str:
        labels = {
            UserRole.REGISTRAR: "设备巡检登记员",
            UserRole.SUPERVISOR: "设备巡检审核主管",
            UserRole.REVIEWER: "新能源汽车充电站复核负责人",
        }
        return labels.get(self.role, self.role.value)
