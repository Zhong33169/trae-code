from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RepairAcceptanceBase(BaseModel):
    repair_company: str
    repair_person: str
    repair_phone: Optional[str] = None
    repair_start_date: Optional[datetime] = None
    repair_end_date: Optional[datetime] = None
    repair_content: str
    parts_replaced: Optional[str] = None
    repair_cost: Optional[str] = None
    is_guarantee: bool = False
    acceptance_result: str
    acceptance_check_items: Optional[str] = None
    acceptance_opinion: Optional[str] = None
    attachment_paths: Optional[str] = None
    material_complete: bool = True
    material_note: Optional[str] = None


class RepairAcceptanceCreate(RepairAcceptanceBase):
    inspection_order_id: int


class RepairAcceptanceUpdate(RepairAcceptanceBase):
    pass


class RepairAcceptanceResponse(RepairAcceptanceBase):
    id: int
    inspection_order_id: int
    accepted_by: int
    accepted_at: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
