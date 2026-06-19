from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AppealCreate:
    visitor_name: str
    visitor_phone: str
    appointment_date: str
    anomaly_type: str
    description: str
    operator_id: str
    evidence_urls: list[str] = field(default_factory=list)


@dataclass
class ProcessRequest:
    operator_id: str
    action: str
    opinion: str
    version: int


@dataclass
class ResubmitRequest:
    operator_id: str
    opinion: str
    version: int
    evidence_urls: list[str] = field(default_factory=list)


@dataclass
class AppealResponse:
    id: str
    appeal_no: str
    visitor_name: str
    visitor_phone: str
    appointment_date: str
    anomaly_type: str
    description: str
    evidence_urls: list[str]
    status: str
    current_handler_id: Optional[str]
    current_handler_role: Optional[str]
    current_handler_name: Optional[str]
    version: int
    created_at: str
    updated_at: str


@dataclass
class OperationRecordResponse:
    id: str
    appeal_id: Optional[str]
    operator_id: str
    operator_name: str
    operator_role: str
    action: str
    opinion: Optional[str]
    from_status: Optional[str]
    to_status: Optional[str]
    request_summary: Optional[str]
    failure_reason: Optional[str]
    original_version: Optional[int]
    failure_type: Optional[str]
    created_at: str


@dataclass
class StatsResponse:
    total: int
    pending_review: int
    pending_recheck: int
    returned: int
    rejected: int
    archived: int
