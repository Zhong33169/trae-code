from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from uuid import uuid4

from .models import (
    ContractConfirmation,
    ContractStatus,
    Customer,
    Material,
    MaterialType,
    PriceQuotation,
    Role,
    SalesContract,
    Statistics,
)
from .store import store


class ValidationError(Exception):
    pass


class PermissionError(Exception):
    pass


class ConcurrencyError(Exception):
    pass


def _validate_materials_for_audit(contract: SalesContract) -> List[str]:
    errors = []
    has_customer = any(m.type == MaterialType.CUSTOMER_INFO for m in contract.materials)
    has_quotation = any(m.type == MaterialType.PRICE_QUOTATION for m in contract.materials)
    if not has_customer:
        errors.append("缺少用电客户资料")
    if not has_quotation:
        errors.append("缺少报价测算材料")
    return errors


def _validate_for_review(contract: SalesContract) -> List[str]:
    errors = []
    has_confirm = any(m.type == MaterialType.CONTRACT_CONFIRM for m in contract.materials)
    if not has_confirm:
        errors.append("缺少合同确认材料")
    if not contract.contract_confirm:
        errors.append("未填写合同确认信息")
    else:
        cc = contract.contract_confirm
        if not cc.signing_date:
            errors.append("合同确认信息缺少签署日期")
        if not cc.settlement_method or len(cc.settlement_method.strip()) < 2:
            errors.append("合同确认信息缺少结算方式")
        if not cc.breach_clause or len(cc.breach_clause.strip()) < 2:
            errors.append("合同确认信息缺少违约条款")
        if cc.confirmed_price <= 0:
            errors.append("合同确认电价必须大于0")
        if cc.confirmed_term_months <= 0:
            errors.append("合同确认期限必须大于0")
    if not contract.customer:
        errors.append("用电客户信息不完整")
    if not contract.price_quotation:
        errors.append("报价测算信息不完整")
    if contract.contract_confirm and contract.price_quotation:
        cc = contract.contract_confirm
        pq = contract.price_quotation
        if abs(cc.confirmed_price - pq.quoted_price) > 0.001:
            errors.append(
                f"合同确认电价({cc.confirmed_price})与报价测算电价({pq.quoted_price})不一致"
            )
        if cc.confirmed_term_months != pq.contract_term_months:
            errors.append(
                f"合同确认期限({cc.confirmed_term_months}月)与报价测算期限({pq.contract_term_months}月)不一致"
            )
        if cc.settlement_method and pq.settlement_method:
            cc_key = cc.settlement_method.split("，")[0].split(",")[0].strip()
            pq_key = pq.settlement_method.split("，")[0].split(",")[0].strip()
            if cc_key != pq_key:
                errors.append(
                    f"合同确认结算方式({cc.settlement_method})与报价测算({pq.settlement_method})不一致"
                )
    return errors


def _check_role_permission(role: Role, action: str, contract: SalesContract) -> None:
    status = contract.status
    if status == ContractStatus.DRAFT:
        if role != Role.REGISTRAR or action not in ("submit", "update_draft", "delete"):
            raise PermissionError("只有登记员可编辑或提交草稿")
    elif status == ContractStatus.PENDING_AUDIT:
        if role != Role.AUDITOR or action not in ("audit_pass", "audit_reject"):
            raise PermissionError("只有审核主管可处理待审核合同")
    elif status == ContractStatus.NEEDS_CORRECTION:
        if role != Role.REGISTRAR or action not in ("resubmit", "update_correction"):
            raise PermissionError("只有登记员可补正待补正合同")
    elif status == ContractStatus.PENDING_REVIEW:
        if role != Role.REVIEWER or action not in ("review_pass", "review_reject"):
            raise PermissionError("只有复核负责人可处理待复核合同")
    elif status == ContractStatus.REVIEW_REJECTED:
        if role != Role.AUDITOR or action not in ("re_review", "resubmit_review"):
            raise PermissionError("只有审核主管可处理复核驳回的合同")
    elif status == ContractStatus.ARCHIVED:
        raise PermissionError("已归档合同不可操作")


def _check_concurrency(contract: SalesContract, expected_version: Optional[int]) -> None:
    if expected_version is not None and contract.version != expected_version:
        raise ConcurrencyError(
            f"合同已被他人修改（当前版本 v{contract.version}，您提交的版本 v{expected_version}），请刷新后重试"
        )


def list_contracts(role: Optional[Role] = None, status_filter: Optional[ContractStatus] = None) -> List[dict]:
    now = datetime.now()
    if role:
        contracts = store.list_by_role(role)
    else:
        contracts = store.list_all()

    if status_filter:
        contracts = [c for c in contracts if c.status == status_filter]

    result = []
    for c in contracts:
        expiry = c.get_expiry_info(now)
        data = c.model_dump()
        data["expiry_info"] = expiry.model_dump()
        result.append(data)
    return result


def get_contract_detail(contract_id: str) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")
    now = datetime.now()
    expiry = contract.get_expiry_info(now)
    data = contract.model_dump()
    data["expiry_info"] = expiry.model_dump()
    return data


def get_statistics() -> Statistics:
    return store.get_statistics()


def create_contract(role: Role, operator: str, title: str) -> dict:
    if role != Role.REGISTRAR:
        raise PermissionError("只有登记员可以创建合同")
    contract = SalesContract(
        title=title,
        created_by=operator,
        created_by_role=role,
        status=ContractStatus.DRAFT,
        current_handler_role=Role.REGISTRAR,
    )
    contract.add_audit_record(role, operator, "创建草稿", ContractStatus.DRAFT)
    store.add(contract)
    return contract.model_dump()


def update_draft(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    customer: Optional[dict] = None,
    price_quotation: Optional[dict] = None,
    materials: Optional[List[dict]] = None,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    _check_role_permission(role, "update_draft", contract)
    _check_concurrency(contract, expected_version)

    if customer:
        contract.customer = Customer(**customer)
    if price_quotation:
        contract.price_quotation = PriceQuotation(**price_quotation)
    if materials is not None:
        contract.materials = [Material(**m) for m in materials]

    contract.version += 1
    contract.registrar_comment = None
    store.update(contract)
    return get_contract_detail(contract_id)


def submit_to_audit(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    deadline_hours: int = 48,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    if contract.status == ContractStatus.DRAFT:
        _check_role_permission(role, "submit", contract)
    elif contract.status == ContractStatus.NEEDS_CORRECTION:
        _check_role_permission(role, "resubmit", contract)
    else:
        raise ValidationError(f"当前状态 {contract.status.display_name} 不可提交审核")

    _check_concurrency(contract, expected_version)

    errors = _validate_materials_for_audit(contract)
    if not contract.customer:
        errors.append("用电客户信息未填写")
    if not contract.price_quotation:
        errors.append("报价测算信息未填写")
    if errors:
        raise ValidationError("提交前请补充以下内容：\n" + "\n".join(errors))

    _prev_status = contract.status
    contract.status = ContractStatus.PENDING_AUDIT
    contract.current_handler_role = Role.AUDITOR
    contract.current_deadline = datetime.now() + timedelta(hours=deadline_hours)
    contract.version += 1

    contract.add_audit_record(
        role,
        operator,
        "提交审核",
        ContractStatus.PENDING_AUDIT,
        f"处理时限 {deadline_hours} 小时",
        previous_status=_prev_status,
    )
    store.update(contract)
    return get_contract_detail(contract_id)


def audit_pass(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    comment: str,
    deadline_hours: int = 72,
    contract_confirm: Optional[dict] = None,
    materials: Optional[List[dict]] = None,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    if contract.status == ContractStatus.REVIEW_REJECTED:
        _check_role_permission(role, "resubmit_review", contract)
    else:
        _check_role_permission(role, "audit_pass", contract)

    _check_concurrency(contract, expected_version)

    if not comment or len(comment.strip()) < 2:
        raise ValidationError("请填写审核意见（至少2个字符）")

    if contract_confirm:
        try:
            cc = ContractConfirmation(**contract_confirm)
            contract.contract_confirm = cc
        except Exception as e:
            raise ValidationError(f"合同确认信息格式错误：{e}")

    if materials is not None:
        for m in materials:
            material = Material(**m)
            contract.materials.append(material)

    errors = _validate_for_review(contract)
    if errors:
        raise ValidationError("提交复核前请补充以下内容：\n" + "\n".join(errors))

    confirm_snapshot = ""
    if contract.contract_confirm:
        cc = contract.contract_confirm
        confirm_snapshot = (
            f"[确认电价:{cc.confirmed_price}元/kWh, "
            f"确认期限:{cc.confirmed_term_months}月, "
            f"结算方式:{cc.settlement_method or '未填'}, "
            f"违约条款:{cc.breach_clause or '未填'}, "
            f"签署日期:{cc.signing_date.strftime('%Y-%m-%d') if cc.signing_date else '未填'}]"
        )

    _prev_status = contract.status
    contract.auditor_comment = comment
    contract.status = ContractStatus.PENDING_REVIEW
    contract.current_handler_role = Role.REVIEWER
    contract.current_deadline = datetime.now() + timedelta(hours=deadline_hours)
    contract.version += 1

    audit_comment = comment
    if confirm_snapshot:
        audit_comment = f"{comment}\n合同确认信息快照: {confirm_snapshot}"

    contract.add_audit_record(
        role,
        operator,
        "审核通过，提交复核",
        ContractStatus.PENDING_REVIEW,
        audit_comment,
        previous_status=_prev_status,
    )
    store.update(contract)
    return get_contract_detail(contract_id)


def audit_reject(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    comment: str,
    deadline_hours: int = 24,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    _check_role_permission(role, "audit_reject", contract)
    _check_concurrency(contract, expected_version)

    if not comment or len(comment.strip()) < 5:
        raise ValidationError("请填写详细的补正意见（至少5个字符）")

    _prev_status = contract.status
    contract.auditor_comment = comment
    contract.status = ContractStatus.NEEDS_CORRECTION
    contract.current_handler_role = Role.REGISTRAR
    contract.current_deadline = datetime.now() + timedelta(hours=deadline_hours)
    contract.version += 1

    contract.add_audit_record(
        role,
        operator,
        "审核退回，需要补正",
        ContractStatus.NEEDS_CORRECTION,
        comment,
        previous_status=_prev_status,
    )
    store.update(contract)
    return get_contract_detail(contract_id)


def review_pass(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    comment: str,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    _check_role_permission(role, "review_pass", contract)
    _check_concurrency(contract, expected_version)

    if not comment or len(comment.strip()) < 2:
        raise ValidationError("请填写复核意见（至少2个字符）")

    errors = _validate_for_review(contract)
    if errors:
        raise ValidationError("归档前请确认以下内容：\n" + "\n".join(errors))

    _prev_status = contract.status
    contract.reviewer_comment = comment
    contract.status = ContractStatus.ARCHIVED
    contract.current_handler_role = None
    contract.current_deadline = None
    contract.version += 1

    contract.add_audit_record(
        role,
        operator,
        "复核通过，合同归档",
        ContractStatus.ARCHIVED,
        comment,
        previous_status=_prev_status,
    )
    store.update(contract)
    return get_contract_detail(contract_id)


def review_reject(
    contract_id: str,
    role: Role,
    operator: str,
    expected_version: Optional[int],
    comment: str,
    deadline_hours: int = 24,
) -> dict:
    contract = store.get(contract_id)
    if not contract:
        raise ValidationError(f"合同 {contract_id} 不存在")

    _check_role_permission(role, "review_reject", contract)
    _check_concurrency(contract, expected_version)

    if not comment or len(comment.strip()) < 5:
        raise ValidationError("请填写详细的驳回意见（至少5个字符）")

    _prev_status = contract.status
    contract.reviewer_comment = comment
    contract.status = ContractStatus.REVIEW_REJECTED
    contract.current_handler_role = Role.AUDITOR
    contract.current_deadline = datetime.now() + timedelta(hours=deadline_hours)
    contract.version += 1

    contract.add_audit_record(
        role,
        operator,
        "复核驳回",
        ContractStatus.REVIEW_REJECTED,
        comment,
        previous_status=_prev_status,
    )
    store.update(contract)
    return get_contract_detail(contract_id)


def batch_process(
    contract_ids: List[str],
    role: Role,
    operator: str,
    action: str,
    comment: str,
) -> Tuple[List[str], List[Tuple[str, str]]]:
    success_ids: List[str] = []
    failed: List[Tuple[str, str]] = []

    for cid in contract_ids:
        try:
            contract = store.get(cid)
            if not contract:
                failed.append((cid, "合同不存在"))
                continue

            if action == "audit_pass":
                audit_pass(cid, role, operator, contract.version, comment or "批量审核通过")
            elif action == "audit_reject":
                audit_reject(cid, role, operator, contract.version, comment or "批量退回补正")
            elif action == "review_pass":
                review_pass(cid, role, operator, contract.version, comment or "批量复核通过")
            elif action == "review_reject":
                review_reject(cid, role, operator, contract.version, comment or "批量复核驳回")
            else:
                failed.append((cid, f"不支持的批量操作: {action}"))
                continue

            success_ids.append(cid)
        except (ValidationError, PermissionError, ConcurrencyError) as e:
            failed.append((cid, str(e)))

    return success_ids, failed
