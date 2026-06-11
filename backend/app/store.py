from __future__ import annotations

import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .models import (
    ContractStatus,
    Material,
    MaterialType,
    Role,
    SalesContract,
    Statistics,
)


class ContractStore:
    def __init__(self) -> None:
        self._contracts: Dict[str, SalesContract] = {}
        self._lock = threading.RLock()

    def add(self, contract: SalesContract) -> SalesContract:
        with self._lock:
            self._contracts[contract.id] = contract
            return contract

    def get(self, contract_id: str) -> Optional[SalesContract]:
        with self._lock:
            return self._contracts.get(contract_id)

    def list_all(self) -> List[SalesContract]:
        with self._lock:
            return list(self._contracts.values())

    def list_by_role(self, role: Role) -> List[SalesContract]:
        with self._lock:
            contracts = list(self._contracts.values())
            if role == Role.REGISTRAR:
                return [c for c in contracts if c.status in (
                    ContractStatus.DRAFT,
                    ContractStatus.NEEDS_CORRECTION,
                )]
            elif role == Role.AUDITOR:
                return [c for c in contracts if c.status in (
                    ContractStatus.PENDING_AUDIT,
                    ContractStatus.REVIEW_REJECTED,
                )]
            elif role == Role.REVIEWER:
                return [c for c in contracts if c.status == ContractStatus.PENDING_REVIEW]
            return contracts

    def update(self, contract: SalesContract) -> SalesContract:
        with self._lock:
            contract.updated_at = datetime.now()
            self._contracts[contract.id] = contract
            return contract

    def get_statistics(self) -> Statistics:
        with self._lock:
            stats = Statistics(total=len(self._contracts))
            now = datetime.now()
            for c in self._contracts.values():
                status_key = c.status.value
                if hasattr(stats, status_key):
                    setattr(stats, status_key, getattr(stats, status_key) + 1)
                expiry = c.get_expiry_info(now)
                if expiry.is_expired:
                    stats.expired += 1
            return stats


store = ContractStore()


def seed_demo_data() -> None:
    now = datetime.now()

    def make_materials() -> List[Material]:
        return [
            Material(
                type=MaterialType.CUSTOMER_INFO,
                name="营业执照副本.pdf",
                uploaded_at=now - timedelta(days=2),
                uploaded_by="登记员张三",
                note="已加盖公章",
            ),
            Material(
                type=MaterialType.PRICE_QUOTATION,
                name="报价测算表.xlsx",
                uploaded_at=now - timedelta(days=2),
                uploaded_by="登记员张三",
                note="含近3个月用电量明细",
            ),
        ]

    c1 = SalesContract(
        title="华盛纺织有限公司2026年度售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.PENDING_AUDIT,
        current_handler_role=Role.AUDITOR,
        current_deadline=now - timedelta(hours=5),
    )
    c1.customer = {
        "name": "华盛纺织有限公司",
        "customer_id": "CUS2026001",
        "address": "滨海工业园区纺织路18号",
        "contact_person": "李经理",
        "contact_phone": "13800138001",
        "power_consumption": 85.6,
    }
    c1.price_quotation = {
        "quoted_price": 0.62,
        "contract_term_months": 12,
        "estimated_annual_amount": 635.8,
        "settlement_method": "按月结算，次月15日前付款",
        "quotation_valid_until": now + timedelta(days=30),
    }
    c1.materials = make_materials()
    c1.add_audit_record(Role.REGISTRAR, "登记员张三", "提交审核", ContractStatus.PENDING_AUDIT, "材料齐全，请审核")
    store.add(c1)

    c2 = SalesContract(
        title="恒源机械制造有限公司售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.NEEDS_CORRECTION,
        current_handler_role=Role.REGISTRAR,
        current_deadline=now - timedelta(hours=2),
        auditor_comment="缺少近6个月电费发票；报价测算未包含违约金条款",
    )
    c2.customer = {
        "name": "恒源机械制造有限公司",
        "customer_id": "CUS2026002",
        "address": "经济开发区机械大道66号",
        "contact_person": "王总",
        "contact_phone": "13900139002",
        "power_consumption": 120.0,
    }
    c2.price_quotation = {
        "quoted_price": 0.58,
        "contract_term_months": 24,
        "estimated_annual_amount": 835.2,
        "settlement_method": "按月结算",
        "quotation_valid_until": now + timedelta(days=15),
    }
    c2.materials = make_materials()
    c2.add_audit_record(Role.REGISTRAR, "登记员张三", "提交审核", ContractStatus.PENDING_AUDIT)
    c2.add_audit_record(Role.AUDITOR, "审核主管李四", "退回补正", ContractStatus.NEEDS_CORRECTION, c2.auditor_comment)
    store.add(c2)

    c3 = SalesContract(
        title="新联电子科技有限公司售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.PENDING_REVIEW,
        current_handler_role=Role.REVIEWER,
        current_deadline=now + timedelta(hours=20),
    )
    c3.customer = {
        "name": "新联电子科技有限公司",
        "customer_id": "CUS2026003",
        "address": "高新区科技路88号",
        "contact_person": "赵工",
        "contact_phone": "13700137003",
        "power_consumption": 56.3,
    }
    c3.price_quotation = {
        "quoted_price": 0.65,
        "contract_term_months": 12,
        "estimated_annual_amount": 439.2,
        "settlement_method": "按月结算，违约金按日万分之五",
        "quotation_valid_until": now + timedelta(days=20),
    }
    c3.contract_confirm = {
        "confirmed_price": 0.65,
        "confirmed_term_months": 12,
        "signing_date": now - timedelta(days=1),
        "effective_date": now + timedelta(days=7),
        "expiry_date": now + timedelta(days=372),
    }
    c3.materials = make_materials() + [
        Material(
            type=MaterialType.CONTRACT_CONFIRM,
            name="合同确认书扫描件.pdf",
            uploaded_at=now - timedelta(days=1),
            uploaded_by="审核主管李四",
            note="双方签字盖章齐全",
        )
    ]
    c3.add_audit_record(Role.REGISTRAR, "登记员张三", "提交审核", ContractStatus.PENDING_AUDIT)
    c3.add_audit_record(Role.AUDITOR, "审核主管李四", "审核通过", ContractStatus.PENDING_REVIEW, "材料完整，报价合理")
    store.add(c3)

    c4 = SalesContract(
        title="永泰食品加工厂售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.DRAFT,
        current_handler_role=Role.REGISTRAR,
    )
    c4.customer = {
        "name": "永泰食品加工厂",
        "customer_id": "CUS2026004",
        "address": "农业园区食品街12号",
        "contact_person": "孙主任",
        "contact_phone": "13600136004",
        "power_consumption": 32.5,
    }
    store.add(c4)

    c5 = SalesContract(
        title="明达建筑工程公司售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.ARCHIVED,
    )
    c5.customer = {
        "name": "明达建筑工程公司",
        "customer_id": "CUS2025099",
        "address": "建设大道55号",
        "contact_person": "周经理",
        "contact_phone": "13500135005",
        "power_consumption": 68.0,
    }
    c5.price_quotation = {
        "quoted_price": 0.60,
        "contract_term_months": 12,
        "estimated_annual_amount": 489.6,
        "settlement_method": "按月结算",
        "quotation_valid_until": now - timedelta(days=100),
    }
    c5.contract_confirm = {
        "confirmed_price": 0.60,
        "confirmed_term_months": 12,
        "signing_date": now - timedelta(days=400),
        "effective_date": now - timedelta(days=390),
        "expiry_date": now - timedelta(days=30),
    }
    c5.materials = make_materials() + [
        Material(
            type=MaterialType.CONTRACT_CONFIRM,
            name="合同确认书扫描件.pdf",
            uploaded_at=now - timedelta(days=400),
            uploaded_by="审核主管李四",
        )
    ]
    c5.reviewer_comment = "合同执行完毕，正常归档"
    c5.add_audit_record(Role.REGISTRAR, "登记员张三", "提交审核", ContractStatus.PENDING_AUDIT)
    c5.add_audit_record(Role.AUDITOR, "审核主管李四", "审核通过", ContractStatus.PENDING_REVIEW)
    c5.add_audit_record(Role.REVIEWER, "复核负责人王五", "复核归档", ContractStatus.ARCHIVED, "复核通过")
    store.add(c5)

    c6 = SalesContract(
        title="宏达物流有限公司售电合同",
        created_by="登记员张三",
        created_by_role=Role.REGISTRAR,
        status=ContractStatus.REVIEW_REJECTED,
        current_handler_role=Role.AUDITOR,
        current_deadline=now + timedelta(hours=8),
        reviewer_comment="合同确认书中有效期与报价测算表不一致；结算条款缺少逾期付款约定",
    )
    c6.customer = {
        "name": "宏达物流有限公司",
        "customer_id": "CUS2026006",
        "address": "物流园区货运大道99号",
        "contact_person": "吴总",
        "contact_phone": "13400134006",
        "power_consumption": 45.2,
    }
    c6.price_quotation = {
        "quoted_price": 0.63,
        "contract_term_months": 12,
        "estimated_annual_amount": 341.8,
        "settlement_method": "按月结算",
        "quotation_valid_until": now + timedelta(days=10),
    }
    c6.contract_confirm = {
        "confirmed_price": 0.63,
        "confirmed_term_months": 24,
        "signing_date": now - timedelta(days=2),
    }
    c6.materials = make_materials() + [
        Material(
            type=MaterialType.CONTRACT_CONFIRM,
            name="合同确认书草稿.pdf",
            uploaded_at=now - timedelta(days=2),
            uploaded_by="审核主管李四",
        )
    ]
    c6.add_audit_record(Role.REGISTRAR, "登记员张三", "提交审核", ContractStatus.PENDING_AUDIT)
    c6.add_audit_record(Role.AUDITOR, "审核主管李四", "审核通过", ContractStatus.PENDING_REVIEW)
    c6.add_audit_record(Role.REVIEWER, "复核负责人王五", "复核驳回", ContractStatus.REVIEW_REJECTED, c6.reviewer_comment)
    store.add(c6)
