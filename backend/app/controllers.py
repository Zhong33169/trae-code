from __future__ import annotations

from typing import List, Optional

from litestar import Controller, Request, get, post, put
from litestar.exceptions import HTTPException
from pydantic import BaseModel

from .models import ContractStatus, Role
from . import services


class RoleContext:
    def __init__(self, request: Request) -> None:
        role_header = request.headers.get("X-Role", "registrar")
        user_header = request.headers.get("X-User", "演示用户")
        try:
            self.role = Role(role_header)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"无效角色: {role_header}")
        self.operator = user_header


class CreateContractRequest(BaseModel):
    title: str


class UpdateDraftRequest(BaseModel):
    expected_version: Optional[int] = None
    customer: Optional[dict] = None
    price_quotation: Optional[dict] = None
    materials: Optional[List[dict]] = None


class SubmitRequest(BaseModel):
    expected_version: Optional[int] = None
    deadline_hours: int = 48


class AuditRequest(BaseModel):
    expected_version: Optional[int] = None
    comment: str
    deadline_hours: int = 24
    contract_confirm: Optional[dict] = None
    materials: Optional[List[dict]] = None


class ReviewRequest(BaseModel):
    expected_version: Optional[int] = None
    comment: str
    deadline_hours: int = 24


class BatchRequest(BaseModel):
    contract_ids: List[str]
    action: str
    comment: str = ""


class ContractController(Controller):
    path = "/api/contracts"

    @get("/")
    async def list_contracts(
        self,
        request: Request,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        ctx = RoleContext(request)
        role: Optional[Role] = None
        status: Optional[ContractStatus] = None
        if role_filter:
            try:
                role = Role(role_filter)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效角色筛选: {role_filter}")
        else:
            role = ctx.role
        if status_filter:
            try:
                status = ContractStatus(status_filter)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"无效状态筛选: {status_filter}")

        contracts = services.list_contracts(role, status)
        return {
            "data": contracts,
            "current_role": ctx.role.value,
            "current_role_name": ctx.role.display_name,
            "current_user": ctx.operator,
        }

    @get("/statistics")
    async def get_statistics(self, request: Request) -> dict:
        stats = services.get_statistics()
        return {"data": stats.model_dump()}

    @get("/{contract_id:str}")
    async def get_contract(self, request: Request, contract_id: str) -> dict:
        try:
            return {"data": services.get_contract_detail(contract_id)}
        except services.ValidationError as e:
            raise HTTPException(status_code=404, detail=str(e))

    @post("/")
    async def create_contract(self, request: Request, data: CreateContractRequest) -> dict:
        ctx = RoleContext(request)
        try:
            contract = services.create_contract(ctx.role, ctx.operator, data.title)
            return {"data": contract}
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))

    @put("/{contract_id:str}/draft")
    async def update_draft(self, request: Request, contract_id: str, data: UpdateDraftRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.update_draft(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.customer,
                data.price_quotation,
                data.materials,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/{contract_id:str}/submit")
    async def submit(self, request: Request, contract_id: str, data: SubmitRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.submit_to_audit(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.deadline_hours,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/{contract_id:str}/audit-pass")
    async def audit_pass(self, request: Request, contract_id: str, data: AuditRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.audit_pass(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.comment,
                data.deadline_hours,
                data.contract_confirm,
                data.materials,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/{contract_id:str}/audit-reject")
    async def audit_reject(self, request: Request, contract_id: str, data: AuditRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.audit_reject(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.comment,
                data.deadline_hours,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/{contract_id:str}/review-pass")
    async def review_pass(self, request: Request, contract_id: str, data: ReviewRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.review_pass(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.comment,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/{contract_id:str}/review-reject")
    async def review_reject(self, request: Request, contract_id: str, data: ReviewRequest) -> dict:
        ctx = RoleContext(request)
        try:
            result = services.review_reject(
                contract_id,
                ctx.role,
                ctx.operator,
                data.expected_version,
                data.comment,
                data.deadline_hours,
            )
            return {"data": result}
        except services.ValidationError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except services.PermissionError as e:
            raise HTTPException(status_code=403, detail=str(e))
        except services.ConcurrencyError as e:
            raise HTTPException(status_code=409, detail=str(e))

    @post("/batch")
    async def batch_process(self, request: Request, data: BatchRequest) -> dict:
        ctx = RoleContext(request)
        success_ids, failed = services.batch_process(
            data.contract_ids,
            ctx.role,
            ctx.operator,
            data.action,
            data.comment,
        )
        return {
            "success_count": len(success_ids),
            "success_ids": success_ids,
            "failed_count": len(failed),
            "failed": [{"id": fid, "reason": reason} for fid, reason in failed],
        }
