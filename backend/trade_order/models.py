from django.db import models
from django.contrib.auth.models import User


class Role(models.TextChoices):
    SALES = "sales", "外贸业务员"
    DOC_SUPERVISOR = "doc_supervisor", "单证主管"
    BIZ_MANAGER = "biz_manager", "业务经理"


class OrderStatus(models.TextChoices):
    DRAFT = "draft", "草稿"
    PENDING_DOC = "pending_doc", "待单证处理"
    DOC_PROCESSING = "doc_processing", "单证处理中"
    DOC_EXCEPTION = "doc_exception", "单证异常"
    DOC_CORRECTION = "doc_correction", "待业务员补正"
    PENDING_CONFIRM = "pending_confirm", "待业务经理确认"
    CONFIRM_EXCEPTION = "confirm_exception", "确认异常"
    CONFIRM_CORRECTION = "confirm_correction", "待单证补正"
    COMPLETED = "completed", "已完成"
    REJECTED = "rejected", "已退回"


class EvidenceType(models.TextChoices):
    INQUIRY = "inquiry", "客户询盘"
    QUOTATION = "quotation", "报价确认"
    CONTRACT = "contract", "订单签订"


class BatchStatus(models.TextChoices):
    PENDING = "pending", "待执行"
    RUNNING = "running", "执行中"
    COMPLETED = "completed", "已完成"
    FAILED = "failed", "执行失败"


class ItemStatus(models.TextChoices):
    SUCCESS = "success", "成功"
    FAILED = "failed", "失败"
    RETRY = "retry", "需重试"


class BatchAction(models.TextChoices):
    SUBMIT_TO_DOC = "submit_to_doc", "提交单证处理"
    APPROVE_DOC = "approve_doc", "单证复核通过"
    REJECT_DOC = "reject_doc", "单证退回补正"
    MARK_EXCEPTION_DOC = "mark_exception_doc", "单证标记异常"
    SUBMIT_TO_CONFIRM = "submit_to_confirm", "提交经理确认"
    APPROVE_CONFIRM = "approve_confirm", "经理确认通过"
    REJECT_CONFIRM = "reject_confirm", "经理退回补正"
    MARK_EXCEPTION_CONFIRM = "mark_exception_confirm", "确认标记异常"


class TradeOrder(models.Model):
    order_no = models.CharField(max_length=50, unique=True, verbose_name="订单编号")
    customer_name = models.CharField(max_length=200, verbose_name="客户名称")
    country = models.CharField(max_length=100, verbose_name="目的国")
    product_name = models.CharField(max_length=200, verbose_name="产品名称")
    quantity = models.DecimalField(max_digits=15, decimal_places=2, verbose_name="数量")
    unit = models.CharField(max_length=20, default="PCS", verbose_name="单位")
    amount = models.DecimalField(max_digits=18, decimal_places=2, verbose_name="订单金额(USD)")
    currency = models.CharField(max_length=10, default="USD", verbose_name="币种")

    status = models.CharField(
        max_length=30,
        choices=OrderStatus.choices,
        default=OrderStatus.DRAFT,
        verbose_name="状态",
    )
    version = models.IntegerField(default=1, verbose_name="版本号(乐观锁)")

    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="created_orders",
        verbose_name="创建人(业务员)",
    )
    doc_handler = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="doc_orders",
        null=True,
        blank=True,
        verbose_name="单证处理人",
    )
    confirm_handler = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name="confirm_orders",
        null=True,
        blank=True,
        verbose_name="确认人(经理)",
    )

    sales_remark = models.TextField(blank=True, verbose_name="业务员备注")
    doc_remark = models.TextField(blank=True, verbose_name="单证主管备注")
    confirm_remark = models.TextField(blank=True, verbose_name="业务经理备注")
    exception_remark = models.TextField(blank=True, verbose_name="异常说明")

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新时间")
    submitted_at = models.DateTimeField(null=True, blank=True, verbose_name="提交时间")
    doc_processed_at = models.DateTimeField(null=True, blank=True, verbose_name="单证处理时间")
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name="确认完成时间")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "外贸订单"
        verbose_name_plural = "外贸订单"

    def __str__(self):
        return f"{self.order_no} - {self.customer_name}"


class OrderEvidence(models.Model):
    order = models.ForeignKey(
        TradeOrder, on_delete=models.CASCADE, related_name="evidences", verbose_name="订单"
    )
    evidence_type = models.CharField(
        max_length=20, choices=EvidenceType.choices, verbose_name="证据类型"
    )
    file_name = models.CharField(max_length=255, verbose_name="文件名称")
    file_url = models.URLField(verbose_name="文件地址/链接")
    uploader = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="uploaded_evidences", verbose_name="上传人"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name="上传时间")
    remark = models.CharField(max_length=500, blank=True, verbose_name="备注")

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "订单证据"
        verbose_name_plural = "订单证据"

    def __str__(self):
        return f"{self.order.order_no} - {self.get_evidence_type_display()}"


class BatchOperation(models.Model):
    batch_no = models.CharField(max_length=50, unique=True, verbose_name="批处理编号")
    action = models.CharField(max_length=40, choices=BatchAction.choices, verbose_name="批操作类型")
    operator = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="batch_operations", verbose_name="操作人"
    )
    status = models.CharField(
        max_length=20, choices=BatchStatus.choices, default=BatchStatus.PENDING, verbose_name="批处理状态"
    )
    total_count = models.IntegerField(default=0, verbose_name="总条数")
    success_count = models.IntegerField(default=0, verbose_name="成功条数")
    failed_count = models.IntegerField(default=0, verbose_name="失败条数")
    retry_count = models.IntegerField(default=0, verbose_name="需重试条数")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    started_at = models.DateTimeField(null=True, blank=True, verbose_name="开始时间")
    finished_at = models.DateTimeField(null=True, blank=True, verbose_name="完成时间")
    remark = models.TextField(blank=True, verbose_name="备注")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "批处理操作"
        verbose_name_plural = "批处理操作"

    def __str__(self):
        return f"{self.batch_no} - {self.get_action_display()}"


class BatchOperationItem(models.Model):
    batch = models.ForeignKey(
        BatchOperation, on_delete=models.CASCADE, related_name="items", verbose_name="批处理"
    )
    order = models.ForeignKey(
        TradeOrder, on_delete=models.PROTECT, related_name="batch_items", verbose_name="订单", null=True, blank=True
    )
    order_id_tmp = models.IntegerField(default=0, verbose_name="临时订单ID(用于不存在的订单)")
    item_status = models.CharField(
        max_length=20, choices=ItemStatus.choices, verbose_name="处理结果"
    )
    error_code = models.CharField(max_length=50, blank=True, verbose_name="错误码")
    error_message = models.TextField(blank=True, verbose_name="错误/结果说明")
    responsible_role = models.CharField(
        max_length=30, blank=True, verbose_name="责任岗位"
    )
    suggestion = models.TextField(blank=True, verbose_name="处理建议")
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name="处理时间")
    version = models.IntegerField(default=0, verbose_name="提交时的版本号")

    class Meta:
        ordering = ["id"]
        verbose_name = "批处理明细"
        verbose_name_plural = "批处理明细"

    def __str__(self):
        return f"{self.batch.batch_no} - {self.order.order_no if self.order else self.order_id_tmp}"


class OrderHistory(models.Model):
    order = models.ForeignKey(
        TradeOrder, on_delete=models.CASCADE, related_name="histories", verbose_name="订单"
    )
    operator = models.ForeignKey(
        User, on_delete=models.PROTECT, related_name="order_histories", verbose_name="操作人"
    )
    action = models.CharField(max_length=100, verbose_name="操作动作")
    from_status = models.CharField(max_length=30, blank=True, verbose_name="原状态")
    to_status = models.CharField(max_length=30, blank=True, verbose_name="新状态")
    remark = models.TextField(blank=True, verbose_name="备注")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="操作时间")

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "订单历史"
        verbose_name_plural = "订单历史"

    def __str__(self):
        return f"{self.order.order_no} - {self.action}"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile", verbose_name="用户")
    role = models.CharField(max_length=30, choices=Role.choices, verbose_name="角色")
    display_name = models.CharField(max_length=100, verbose_name="显示名称")
    phone = models.CharField(max_length=50, blank=True, verbose_name="联系电话")

    class Meta:
        verbose_name = "用户资料"
        verbose_name_plural = "用户资料"

    def __str__(self):
        return f"{self.display_name}({self.get_role_display()})"
