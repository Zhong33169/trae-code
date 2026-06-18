from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.db import transaction

from trade_order.models import (
    UserProfile, Role,
    TradeOrder, OrderStatus, OrderEvidence, EvidenceType,
    OrderHistory,
    BatchOperation, BatchOperationItem, BatchAction, ItemStatus, ResolvedStatus,
)


SAMPLE_ORDERS = [
    {
        "order_no": "PO202506180001",
        "customer_name": "ABC Trading Co., Ltd.",
        "country": "美国",
        "product_name": "无线蓝牙耳机",
        "quantity": 5000,
        "unit": "PCS",
        "amount": 45000.00,
        "currency": "USD",
        "status": OrderStatus.DRAFT,
        "has_evidences": [],
        "exception_remark": "",
        "remark": "正常草稿：还未上传任何证据，业务员刚创建",
    },
    {
        "order_no": "PO202506180002",
        "customer_name": "Global Imports Inc.",
        "country": "德国",
        "product_name": "智能手表",
        "quantity": 2000,
        "unit": "PCS",
        "amount": 120000.00,
        "currency": "USD",
        "status": OrderStatus.DRAFT,
        "has_evidences": [EvidenceType.INQUIRY],
        "exception_remark": "",
        "remark": "缺证据草稿：只有询盘，缺报价和合同",
    },
    {
        "order_no": "PO202506180003",
        "customer_name": "Euro Electronics GmbH",
        "country": "法国",
        "product_name": "Type-C 数据线",
        "quantity": 20000,
        "unit": "PCS",
        "amount": 36000.00,
        "currency": "USD",
        "status": OrderStatus.PENDING_DOC,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "",
        "remark": "正常待单证：证据齐全，等待单证主管处理",
    },
    {
        "order_no": "PO202506180004",
        "customer_name": "Pacific Traders Ltd.",
        "country": "澳大利亚",
        "product_name": "移动电源 10000mAh",
        "quantity": 8000,
        "unit": "PCS",
        "amount": 64000.00,
        "currency": "USD",
        "status": OrderStatus.PENDING_DOC,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION],
        "exception_remark": "",
        "remark": "单证风险订单：状态是待单证，但缺少合同证据（可能被业务员误删）",
    },
    {
        "order_no": "PO202506180005",
        "customer_name": "Nordic Tech AB",
        "country": "瑞典",
        "product_name": "USB-C 充电器 65W",
        "quantity": 3000,
        "unit": "PCS",
        "amount": 52500.00,
        "currency": "USD",
        "status": OrderStatus.DOC_CORRECTION,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "",
        "remark": "待补正：单证主管已退回，需要业务员补正后重新提交",
    },
    {
        "order_no": "PO202506180006",
        "customer_name": "South American Distribuidora",
        "country": "巴西",
        "product_name": "TWS 入耳式耳机",
        "quantity": 10000,
        "unit": "PCS",
        "amount": 85000.00,
        "currency": "USD",
        "status": OrderStatus.DOC_EXCEPTION,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "客户资质存疑，对方是新注册公司，付款方式存在风险，需进一步核实背景",
        "remark": "单证异常：已被标记异常，客户资质问题",
    },
    {
        "order_no": "PO202506180007",
        "customer_name": "Japan Precision Co.",
        "country": "日本",
        "product_name": "精密电子元件",
        "quantity": 50000,
        "unit": "PCS",
        "amount": 150000.00,
        "currency": "USD",
        "status": OrderStatus.PENDING_CONFIRM,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "",
        "remark": "正常待经理确认：单证已通过，等经理确认",
    },
    {
        "order_no": "PO202506180008",
        "customer_name": "Middle East Traders LLC",
        "country": "阿联酋",
        "product_name": "智能手机壳",
        "quantity": 30000,
        "unit": "PCS",
        "amount": 45000.00,
        "currency": "USD",
        "status": OrderStatus.CONFIRM_CORRECTION,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "",
        "remark": "待单证补正：经理退回，需单证主管重新核查单据",
    },
    {
        "order_no": "PO202506180009",
        "customer_name": "UK Retail Group",
        "country": "英国",
        "product_name": "便携式蓝牙音箱",
        "quantity": 6000,
        "unit": "PCS",
        "amount": 78000.00,
        "currency": "USD",
        "status": OrderStatus.CONFIRM_EXCEPTION,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "订单金额与市场行情偏离较大，利润率异常，怀疑报价有误，需业务和产品部门联合复核",
        "remark": "确认异常：经理标记，利润率异常",
    },
    {
        "order_no": "PO202506180010",
        "customer_name": "Korea Best Partner",
        "country": "韩国",
        "product_name": "手机贴膜",
        "quantity": 100000,
        "unit": "PCS",
        "amount": 25000.00,
        "currency": "USD",
        "status": OrderStatus.COMPLETED,
        "has_evidences": [EvidenceType.INQUIRY, EvidenceType.QUOTATION, EvidenceType.CONTRACT],
        "exception_remark": "",
        "remark": "已完成：正常流程走完的订单",
    },
]


EVIDENCE_SAMPLES = {
    EvidenceType.INQUIRY: [
        ("客户询盘邮件-20250618.eml", "https://cdn.example.com/evidence/inquiry_sample_1.pdf"),
        ("Inquiry Email from ABC Trading.pdf", "https://cdn.example.com/evidence/inquiry_sample_2.pdf"),
    ],
    EvidenceType.QUOTATION: [
        ("报价单-Quotation-v1.pdf", "https://cdn.example.com/evidence/quotation_sample_1.pdf"),
        ("PI Proforma Invoice.pdf", "https://cdn.example.com/evidence/quotation_sample_2.pdf"),
    ],
    EvidenceType.CONTRACT: [
        ("销售合同-Sales Contract.pdf", "https://cdn.example.com/evidence/contract_sample_1.pdf"),
        ("PO 采购订单确认件.pdf", "https://cdn.example.com/evidence/contract_sample_2.pdf"),
    ],
}


class Command(BaseCommand):
    help = "初始化演示用户和样例数据"

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("开始初始化演示数据...")

        users_data = [
            {"username": "sales01", "display_name": "张伟", "role": Role.SALES, "phone": "13800000001"},
            {"username": "sales02", "display_name": "李娜", "role": Role.SALES, "phone": "13800000002"},
            {"username": "doc01", "display_name": "王芳", "role": Role.DOC_SUPERVISOR, "phone": "13800000003"},
            {"username": "manager01", "display_name": "刘强", "role": Role.BIZ_MANAGER, "phone": "13800000004"},
        ]

        users = {}
        for ud in users_data:
            user, created = User.objects.get_or_create(
                username=ud["username"],
                defaults={
                    "is_active": True,
                    "is_staff": True,
                    "is_superuser": ud["role"] == Role.BIZ_MANAGER,
                }
            )
            user.set_password("123456")
            user.save()
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    "display_name": ud["display_name"],
                    "role": ud["role"],
                    "phone": ud["phone"],
                }
            )
            users[ud["role"]] = users.get(ud["role"], []) + [user]
            self.stdout.write(self.style.SUCCESS(f"  ✓ 用户: {ud['username']} / 123456 ({ud['display_name']} - {Role(ud['role']).label})"))

        sales_users = users[Role.SALES]
        doc_users = users[Role.DOC_SUPERVISOR]
        manager_users = users[Role.BIZ_MANAGER]

        for idx, od in enumerate(SAMPLE_ORDERS):
            sales_user = sales_users[idx % len(sales_users)]
            order, created = TradeOrder.objects.get_or_create(
                order_no=od["order_no"],
                defaults={
                    "customer_name": od["customer_name"],
                    "country": od["country"],
                    "product_name": od["product_name"],
                    "quantity": od["quantity"],
                    "unit": od["unit"],
                    "amount": od["amount"],
                    "currency": od["currency"],
                    "status": od["status"],
                    "created_by": sales_user,
                    "sales_remark": od["remark"],
                    "exception_remark": od["exception_remark"],
                }
            )

            if od["status"] in (OrderStatus.PENDING_DOC, OrderStatus.DOC_CORRECTION, OrderStatus.DOC_EXCEPTION,
                                OrderStatus.PENDING_CONFIRM, OrderStatus.CONFIRM_CORRECTION, OrderStatus.CONFIRM_EXCEPTION,
                                OrderStatus.COMPLETED):
                order.submitted_at = order.created_at
                order.doc_handler = doc_users[0]
                order.save()

            if od["status"] in (OrderStatus.PENDING_CONFIRM, OrderStatus.CONFIRM_CORRECTION, OrderStatus.CONFIRM_EXCEPTION, OrderStatus.COMPLETED):
                order.doc_processed_at = order.created_at
                order.save()

            if od["status"] == OrderStatus.COMPLETED:
                order.confirm_handler = manager_users[0]
                order.confirmed_at = order.created_at
                order.save()

            if created:
                self.stdout.write(self.style.SUCCESS(f"  ✓ 订单: {od['order_no']} - {od['customer_name']} ({OrderStatus(od['status']).label})"))

                ev_idx = 0
                for et in od["has_evidences"]:
                    ev_samples = EVIDENCE_SAMPLES.get(et, [("未命名文件.pdf", "https://cdn.example.com/evidence/default.pdf")])
                    fname, furl = ev_samples[ev_idx % len(ev_samples)]
                    OrderEvidence.objects.create(
                        order=order,
                        evidence_type=et,
                        file_name=f"{od['order_no']}_{fname}",
                        file_url=furl,
                        uploader=sales_user,
                        remark=f"样例数据 - {EvidenceType(et).label}",
                    )
                    ev_idx += 1

                OrderHistory.objects.create(
                    order=order,
                    operator=sales_user,
                    action="初始化-创建订单(样例数据)",
                    from_status="",
                    to_status=od["status"],
                    remark=od["remark"],
                )
            else:
                self.stdout.write(f"  - 订单已存在, 跳过: {od['order_no']}")

        # ===== 批量操作演示数据（补正追踪） =====
        self.stdout.write("\n生成批量操作演示数据...")
        
        orders_by_no = {o.order_no: o for o in TradeOrder.objects.all()}
        doc_user = doc_users[0]
        sales_user = sales_users[0]
        manager_user = manager_users[0]

        demo_batches = [
            {
                "batch_no_suffix": "BATCH-DEMO-001",
                "action": BatchAction.APPROVE_DOC,
                "operator": doc_user,
                "remark": "首次批量单证复核 - 暴露三类问题",
                "items": [
                    {
                        "order_no": "PO202506180003",
                        "item_status": ItemStatus.FAILED,
                        "error_code": "VERSION_CONFLICT",
                        "error_message": "版本冲突：订单已被其他人修改，当前版本号不匹配",
                        "responsible_role": "operator",
                        "suggestion": "请刷新页面获取最新版本号后重新提交",
                        "version": 5,
                    },
                    {
                        "order_no": "PO202506180004",
                        "item_status": ItemStatus.RETRY,
                        "error_code": "EVIDENCE_INCOMPLETE",
                        "error_message": "证据不完整：缺少销售合同(contract)类证据",
                        "responsible_role": "sales",
                        "suggestion": "请由外贸业务员补齐销售合同或采购订单扫描件后再提交复核",
                        "version": 1,
                    },
                    {
                        "order_no": "PO202506180005",
                        "item_status": ItemStatus.FAILED,
                        "error_code": "INVALID_STATUS",
                        "error_message": "状态错误：订单当前状态为'待补正(doc_correction)'，不能执行批量通过",
                        "responsible_role": "doc_supervisor",
                        "suggestion": "请先在订单详情页使用'退回补正'或其他操作将订单流转到可批量处理的状态",
                        "version": 2,
                    },
                ],
            },
            {
                "batch_no_suffix": "BATCH-DEMO-002",
                "action": BatchAction.APPROVE_DOC,
                "operator": doc_user,
                "remark": "版本冲突补正后：订单0003重新提交成功",
                "items": [
                    {
                        "order_no": "PO202506180003",
                        "item_status": ItemStatus.SUCCESS,
                        "error_code": "",
                        "error_message": "",
                        "responsible_role": "",
                        "suggestion": "",
                        "version": 2,
                        "_resolves": "PO202506180003",
                    },
                ],
            },
            {
                "batch_no_suffix": "BATCH-DEMO-003",
                "action": BatchAction.REJECT_DOC,
                "operator": doc_user,
                "remark": "缺证据场景：先批量退回业务员补正（标记corrected）",
                "items": [
                    {
                        "order_no": "PO202506180004",
                        "item_status": ItemStatus.SUCCESS,
                        "error_code": "",
                        "error_message": "",
                        "responsible_role": "",
                        "suggestion": "",
                        "version": 1,
                        "_corrected": "PO202506180004",
                    },
                ],
            },
            {
                "batch_no_suffix": "BATCH-DEMO-004",
                "action": BatchAction.SUBMIT_TO_DOC,
                "operator": sales_user,
                "remark": "缺证据补正后：业务员上传合同，重新提交单证",
                "items": [
                    {
                        "order_no": "PO202506180004",
                        "item_status": ItemStatus.SUCCESS,
                        "error_code": "",
                        "error_message": "",
                        "responsible_role": "",
                        "suggestion": "",
                        "version": 2,
                        "_resolves": "PO202506180004",
                    },
                ],
            },
            {
                "batch_no_suffix": "BATCH-DEMO-005",
                "action": BatchAction.REJECT_DOC,
                "operator": doc_user,
                "remark": "状态错误场景：先对订单0005做单条退回补正（此处用批量退回模拟纠正状态）",
                "items": [
                    {
                        "order_no": "PO202506180005",
                        "item_status": ItemStatus.SUCCESS,
                        "error_code": "",
                        "error_message": "",
                        "responsible_role": "",
                        "suggestion": "",
                        "version": 2,
                        "_corrected": "PO202506180005",
                    },
                ],
            },
            {
                "batch_no_suffix": "BATCH-DEMO-006",
                "action": BatchAction.SUBMIT_TO_DOC,
                "operator": sales_user,
                "remark": "状态纠正后：业务员重新提交订单0005到待单证",
                "items": [
                    {
                        "order_no": "PO202506180005",
                        "item_status": ItemStatus.SUCCESS,
                        "error_code": "",
                        "error_message": "",
                        "responsible_role": "",
                        "suggestion": "",
                        "version": 3,
                        "_resolves": "PO202506180005",
                    },
                ],
            },
        ]

        import datetime
        from django.utils import timezone
        base_time = timezone.now() - datetime.timedelta(hours=8)

        all_created_items = []

        for bi, bd in enumerate(demo_batches):
            existing = BatchOperation.objects.filter(batch_no__endswith=bd["batch_no_suffix"]).first()
            if existing:
                self.stdout.write(f"  - 批次已存在, 跳过: {bd['batch_no_suffix']}")
                continue

            batch_time = base_time + datetime.timedelta(hours=bi * 1)
            started_at = batch_time
            finished_at = batch_time + datetime.timedelta(seconds=15)
            batch = BatchOperation.objects.create(
                batch_no=f"DEMO{bi+1:03d}{bd['batch_no_suffix']}",
                action=bd["action"],
                operator=bd["operator"],
                remark=bd["remark"],
                total_count=len(bd["items"]),
                success_count=sum(1 for it in bd["items"] if it["item_status"] == ItemStatus.SUCCESS),
                failed_count=sum(1 for it in bd["items"] if it["item_status"] == ItemStatus.FAILED),
                retry_count=sum(1 for it in bd["items"] if it["item_status"] == ItemStatus.RETRY),
                status=BatchStatus.COMPLETED,
                created_at=batch_time,
                started_at=started_at,
                completed_at=finished_at,
                finished_at=finished_at,
            )

            for ii, item_data in enumerate(bd["items"]):
                order = orders_by_no.get(item_data["order_no"])
                item_time = batch_time + datetime.timedelta(seconds=ii * 5)
                resolved_status = ResolvedStatus.UNRESOLVED
                if item_data.get("_corrected"):
                    resolved_status = ResolvedStatus.CORRECTED
                item = BatchOperationItem.objects.create(
                    batch=batch,
                    order=order,
                    order_id_tmp=order.id if order else 0,
                    item_status=item_data["item_status"],
                    error_code=item_data["error_code"],
                    error_message=item_data["error_message"],
                    responsible_role=item_data["responsible_role"],
                    suggestion=item_data["suggestion"],
                    version=item_data["version"],
                    processed_at=item_time,
                    resolved_status=resolved_status,
                    resolved_at=item_time if resolved_status != ResolvedStatus.UNRESOLVED else None,
                )
                item._resolves_order_no = item_data.get("_resolves")
                item._corrected_order_no = item_data.get("_corrected")
                all_created_items.append(item)

            self.stdout.write(self.style.SUCCESS(f"  ✓ 演示批次: {batch.batch_no} ({BatchAction(bd['action']).label})"))

        resolves_map = {}
        corrected_map = {}
        for item in all_created_items:
            if getattr(item, "_resolves_order_no", None) and item.item_status == ItemStatus.SUCCESS:
                resolves_map[item._resolves_order_no] = item
            if getattr(item, "_corrected_order_no", None) and item.item_status == ItemStatus.SUCCESS:
                corrected_map[item._corrected_order_no] = item

        for c_order_no, c_item in corrected_map.items():
            for uitem in all_created_items:
                if uitem.order and uitem.order.order_no == c_order_no and uitem.item_status != ItemStatus.SUCCESS and uitem.resolved_status == ResolvedStatus.UNRESOLVED:
                    uitem.resolved_status = ResolvedStatus.CORRECTED
                    uitem.resolved_by = c_item
                    uitem.resolved_at = c_item.processed_at
                    uitem.save(update_fields=["resolved_status", "resolved_by", "resolved_at"])
                    self.stdout.write(f"    ↳ {c_order_no} 已标记补正(corrected), 关联: {c_item.batch.batch_no}")

        unresolveds = [i for i in all_created_items if i.item_status != ItemStatus.SUCCESS and i.resolved_status == ResolvedStatus.UNRESOLVED]
        for uitem in unresolveds:
            if not uitem.order:
                continue
            order_no = uitem.order.order_no
            resolver = resolves_map.get(order_no)
            if resolver:
                uitem.resolved_status = ResolvedStatus.RESUBMITTED
                uitem.resolved_by = resolver
                uitem.resolved_at = resolver.processed_at
                uitem.save(update_fields=["resolved_status", "resolved_by", "resolved_at"])
                self.stdout.write(f"    ↳ {order_no} 已关联解决批次: {resolver.batch.batch_no}")

        self.stdout.write(self.style.SUCCESS("演示数据初始化完成!"))
        self.stdout.write("")
        self.stdout.write("演示账号:")
        self.stdout.write("  外贸业务员: sales01 / 123456 (张伟)")
        self.stdout.write("  外贸业务员: sales02 / 123456 (李娜)")
        self.stdout.write("  单证主管:   doc01   / 123456 (王芳)")
        self.stdout.write("  业务经理:   manager01 / 123456 (刘强)")
