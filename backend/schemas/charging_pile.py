from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ChargingPileBase(BaseModel):
    pile_code: str
    pile_name: str
    station_code: str
    station_name: str
    location: Optional[str] = None
    power_rating: Optional[str] = None
    qr_code: str


class ChargingPileCreate(ChargingPileBase):
    pass


class ChargingPileResponse(ChargingPileBase):
    id: int
    is_active: bool
    last_inspection_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
