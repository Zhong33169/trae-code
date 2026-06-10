from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class FaultReportBase(BaseModel):
    fault_code: str
    fault_description: str
    fault_level: str
    fault_location: Optional[str] = None
    repair_deadline: datetime
    repair_company: Optional[str] = None
    repair_contact: Optional[str] = None
    repair_phone: Optional[str] = None
    attachment_paths: Optional[str] = None
    report_opinion: Optional[str] = None


class FaultReportCreate(FaultReportBase):
    inspection_order_id: int
    opinion: Optional[str] = None
    signature: Optional[str] = None


class FaultReportUpdate(FaultReportBase):
    pass


class FaultReportResponse(FaultReportBase):
    id: int
    inspection_order_id: int
    reported_by: int
    reported_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
