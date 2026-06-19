from typing import Optional

from litestar import Controller, get, post
from litestar.status_codes import HTTP_201_CREATED
from litestar.params import Parameter
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import AppealCreate, AppealResponse, ProcessRequest, ResubmitRequest
from app.service import _parse_evidence_urls
from app import service


class AppealsController(Controller):
    path = "/api/appeals"
    dependencies = {"session": get_session}

    @get("/failures")
    async def list_failed_records(
        self,
        session: AsyncSession,
        operator_id: Optional[str] = Parameter(query="operator_id", default=None, required=False),
        failure_scope: Optional[str] = Parameter(query="failure_scope", default=None, required=False),
        failure_type: Optional[str] = Parameter(query="failure_type", default=None, required=False),
        limit: int = Parameter(query="limit", default=20, required=False),
    ) -> list:
        return await service.get_failed_records(session, operator_id, failure_scope, failure_type, limit)

    @get()
    async def list_appeals(
        self,
        session: AsyncSession,
        status: Optional[str] = Parameter(query="status", default=None, required=False),
    ) -> list[AppealResponse]:
        return await service.get_appeals(session, status)

    @get("/{appeal_id:str}")
    async def get_appeal_detail(self, session: AsyncSession, appeal_id: str) -> dict:
        return await service.get_appeal(session, appeal_id)

    @post(status_code=HTTP_201_CREATED)
    async def create_appeal(self, session: AsyncSession, data: AppealCreate) -> AppealResponse:
        appeal = await service.create_appeal(session, data)
        handler = await service._get_user_by_id(session, appeal.current_handler_id) if appeal.current_handler_id else None
        return AppealResponse(
            id=appeal.id,
            appeal_no=appeal.appeal_no,
            visitor_name=appeal.visitor_name,
            visitor_phone=appeal.visitor_phone,
            appointment_date=appeal.appointment_date,
            anomaly_type=appeal.anomaly_type,
            description=appeal.description,
            evidence_urls=_parse_evidence_urls(appeal.evidence_urls),
            status=appeal.status,
            current_handler_id=appeal.current_handler_id,
            current_handler_role=appeal.current_handler_role,
            current_handler_name=handler.name if handler else None,
            version=appeal.version,
            created_at=appeal.created_at,
            updated_at=appeal.updated_at,
        )

    @post("/{appeal_id:str}/process")
    async def process_appeal(self, session: AsyncSession, appeal_id: str, data: ProcessRequest) -> AppealResponse:
        appeal = await service.process_appeal(session, appeal_id, data)
        handler = await service._get_user_by_id(session, appeal.current_handler_id) if appeal.current_handler_id else None
        return AppealResponse(
            id=appeal.id,
            appeal_no=appeal.appeal_no,
            visitor_name=appeal.visitor_name,
            visitor_phone=appeal.visitor_phone,
            appointment_date=appeal.appointment_date,
            anomaly_type=appeal.anomaly_type,
            description=appeal.description,
            evidence_urls=_parse_evidence_urls(appeal.evidence_urls),
            status=appeal.status,
            current_handler_id=appeal.current_handler_id,
            current_handler_role=appeal.current_handler_role,
            current_handler_name=handler.name if handler else None,
            version=appeal.version,
            created_at=appeal.created_at,
            updated_at=appeal.updated_at,
        )

    @post("/{appeal_id:str}/resubmit")
    async def resubmit_appeal(self, session: AsyncSession, appeal_id: str, data: ResubmitRequest) -> AppealResponse:
        appeal = await service.resubmit_appeal(session, appeal_id, data)
        handler = await service._get_user_by_id(session, appeal.current_handler_id) if appeal.current_handler_id else None
        return AppealResponse(
            id=appeal.id,
            appeal_no=appeal.appeal_no,
            visitor_name=appeal.visitor_name,
            visitor_phone=appeal.visitor_phone,
            appointment_date=appeal.appointment_date,
            anomaly_type=appeal.anomaly_type,
            description=appeal.description,
            evidence_urls=_parse_evidence_urls(appeal.evidence_urls),
            status=appeal.status,
            current_handler_id=appeal.current_handler_id,
            current_handler_role=appeal.current_handler_role,
            current_handler_name=handler.name if handler else None,
            version=appeal.version,
            created_at=appeal.created_at,
            updated_at=appeal.updated_at,
        )
