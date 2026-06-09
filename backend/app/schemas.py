from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserOut(BaseModel):
    id: int
    username: str
    name: str
    role: str

    class Config:
        from_attributes = True


class PatientOut(BaseModel):
    id: int
    name: str
    id_card: str
    phone: Optional[str]

    class Config:
        from_attributes = True


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    appointment_date: datetime
    department: Optional[str]
    doctor_name: Optional[str]
    status: str

    class Config:
        from_attributes = True


class VisitOut(BaseModel):
    id: int
    patient_id: int
    appointment_id: Optional[int]
    visit_date: datetime
    triage_nurse: Optional[str]
    department: Optional[str]
    diagnosis: Optional[str]

    class Config:
        from_attributes = True


class FollowUpVisitOut(BaseModel):
    id: int
    patient_id: int
    visit_id: Optional[int]
    follow_up_date: datetime
    follow_up_type: Optional[str]
    content: Optional[str]
    operator: Optional[str]

    class Config:
        from_attributes = True


class FollowUpRecordCreate(BaseModel):
    patient_id: int
    appointment_id: Optional[int] = None
    visit_id: Optional[int] = None
    follow_up_visit_id: Optional[int] = None
    follow_up_type: Optional[str] = None
    content: Optional[str] = None
    result: Optional[str] = None
    remarks: Optional[str] = None


class FollowUpRecordUpdate(BaseModel):
    follow_up_type: Optional[str] = None
    content: Optional[str] = None
    result: Optional[str] = None
    remarks: Optional[str] = None
    version: int


class FollowUpRecordOut(BaseModel):
    id: int
    record_no: str
    patient_id: int
    appointment_id: Optional[int]
    visit_id: Optional[int]
    follow_up_visit_id: Optional[int]
    status: str
    version: int
    follow_up_type: Optional[str]
    content: Optional[str]
    result: Optional[str]
    remarks: Optional[str]
    created_by: str
    created_at: datetime
    updated_by: Optional[str]
    updated_at: datetime
    doctor_opinion: Optional[str]
    doctor_verified: bool
    doctor_verified_at: Optional[datetime]
    director_opinion: Optional[str]
    director_verified: bool
    director_verified_at: Optional[datetime]

    patient: Optional[PatientOut] = None
    appointment: Optional[AppointmentOut] = None
    visit: Optional[VisitOut] = None
    follow_up_visit_obj: Optional[FollowUpVisitOut] = None

    class Config:
        from_attributes = True


class FollowUpRecordListOut(BaseModel):
    total: int
    items: List[FollowUpRecordOut]


class ProcessRecordRequest(BaseModel):
    version: int
    opinion: Optional[str] = None
    result: Optional[str] = None


class BatchOperationRequest(BaseModel):
    record_ids: List[int]
    version_map: Optional[dict] = None
    opinion: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
    field: Optional[str] = None
