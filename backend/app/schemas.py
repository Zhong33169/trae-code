from typing import Optional, List
from ninja import Schema
from datetime import datetime


class UserSchema(Schema):
    id: int
    username: str
    name: str
    role: str
    role_label: str


class LoginSchema(Schema):
    username: str
    password: str


class LoginResponse(Schema):
    token: str
    user: UserSchema


class EvidenceSchema(Schema):
    id: int
    name: str
    type: str
    type_label: str
    url: str
    uploaded_at: str


class EvidenceCreateSchema(Schema):
    name: str
    type: str = 'doc'
    url: str


class TicketLogSchema(Schema):
    id: int
    ticket_id: int
    action: str
    action_label: str
    from_stage: str
    to_stage: str
    from_status: str
    to_status: str
    operator_id: Optional[int]
    operator_name: str
    target_handler_id: Optional[int]
    target_handler_name: str
    comment: str
    created_at: str
    evidences: List[EvidenceSchema] = []


class TicketSchema(Schema):
    id: int
    title: str
    description: str
    risk_level: str
    risk_label: str
    stage: str
    stage_label: str
    status: str
    status_label: str
    priority: int
    version: int
    creator_id: int
    creator_name: str
    current_handler_id: Optional[int]
    current_handler_name: str
    handler_status: str
    created_at: str
    updated_at: str
    deadline: str


class TicketDetailSchema(TicketSchema):
    logs: List[TicketLogSchema] = []
    evidences: List[EvidenceSchema] = []
    available_transfer_users: List[UserSchema] = []


class TicketCreateSchema(Schema):
    title: str
    description: str
    risk_level: str
    deadline: Optional[str] = None
    evidences: List[EvidenceCreateSchema] = []


class TicketActionSchema(Schema):
    action: str
    comment: str = ''
    version: int
    target_user_id: Optional[int] = None
    evidences: List[EvidenceCreateSchema] = []


class TicketListResponse(Schema):
    total: int
    items: List[TicketSchema]
    page: int
    page_size: int


class DashboardStatsSchema(Schema):
    total_pending: int
    stage_counts: dict
    risk_counts: dict
    overdue_count: int
    my_todo_count: int
    my_handling_count: int
    my_pending_takeover_count: int
    my_returned_fix_count: int


class LogListResponse(Schema):
    total: int
    items: List[TicketLogSchema]
    page: int
    page_size: int
