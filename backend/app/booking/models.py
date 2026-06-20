from django.db import models
from django.contrib.auth.models import AbstractUser


class RoleChoices(models.TextChoices):
    REGISTRAR = 'registrar', '订舱登记员'
    SUPERVISOR = 'supervisor', '订舱审核主管'
    REVIEWER = 'reviewer', '外贸公司复核负责人'


class User(AbstractUser):
    real_name = models.CharField('姓名', max_length=50, blank=True)
    role = models.CharField('角色', max_length=20, choices=RoleChoices.choices, default=RoleChoices.REGISTRAR)
    phone = models.CharField('手机号', max_length=20, blank=True)

    class Meta:
        verbose_name = '用户'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.real_name or self.username} ({self.get_role_display()})'


class BookingStatusChoices(models.TextChoices):
    DRAFT = 'draft', '草稿'
    PENDING_REVIEW = 'pending_review', '待审核'
    REVIEW_PASSED = 'review_passed', '审核通过'
    BOOKED = 'booked', '已订舱'
    BOOKING_FAILED = 'booking_failed', '订舱失败'
    RETURNED = 'returned', '已退回'
    CORRECTING = 'correcting', '补正中'
    ARCHIVED = 'archived', '已归档'


class LoadingStatusChoices(models.TextChoices):
    NOT_ARRANGED = 'not_arranged', '未安排'
    PENDING_CONFIRM = 'pending_confirm', '待确认'
    CONFIRMED = 'confirmed', '已确认'
    LOADED = 'loaded', '已装柜'
    LOAD_FAILED = 'load_failed', '装柜失败'


class BlStatusChoices(models.TextChoices):
    NOT_ISSUED = 'not_issued', '未出单'
    PENDING_COLLECT = 'pending_collect', '待回收'
    COLLECTED = 'collected', '已回收'
    ARCHIVED = 'archived', '已归档'


class ExceptionTypeChoices(models.TextChoices):
    NONE = 'none', '无'
    MISSING_MATERIALS = 'missing_materials', '缺材料'
    TIMEOUT = 'timeout', '超时'
    REJECTED = 'rejected', '退回'
    STATUS_MISMATCH = 'status_mismatch', '状态不一致'
    DUPLICATE_BATCH = 'duplicate_batch', '重复批次'


class ActionChoices(models.TextChoices):
    CREATE = 'create', '发起申请'
    SUBMIT = 'submit', '提交审核'
    REVIEW_PASS = 'review_pass', '审核通过'
    REVIEW_REJECT = 'review_reject', '审核退回'
    BOOK_CONFIRM = 'book_confirm', '订舱确认'
    BOOK_FAIL = 'book_fail', '订舱失败'
    CORRECT = 'correct', '补正资料'
    RESUBMIT = 'resubmit', '重新提交'
    LOAD_ARRANGE = 'load_arrange', '安排装柜'
    LOAD_CONFIRM = 'load_confirm', '装柜确认'
    LOAD_FAIL = 'load_fail', '装柜失败'
    BL_ISSUE = 'bl_issue', '提单出单'
    BL_COLLECT = 'bl_collect', '提单回收'
    REVIEW_ARCHIVE = 'review_archive', '复核归档'
    OFFLINE_FILL = 'offline_fill', '离线台账回填'
    AUDIT_NOTE = 'audit_note', '添加审计备注'
    UPLOAD_ATTACH = 'upload_attach', '上传附件'
    BATCH_RESULT = 'batch_result', '批量处理'


class BookingApplication(models.Model):
    form_no = models.CharField('订舱单号', max_length=50, unique=True)
    batch_no = models.CharField('批次号', max_length=50)
    customer = models.CharField('客户名称', max_length=100)
    forwarder = models.CharField('货代/船公司', max_length=100, blank=True)
    port_of_loading = models.CharField('起运港', max_length=50, blank=True)
    port_of_discharge = models.CharField('目的港', max_length=50, blank=True)
    container_type = models.CharField('柜型', max_length=30, blank=True)
    container_qty = models.IntegerField('柜量', default=1)
    cargo_desc = models.TextField('货物描述', blank=True)
    weight = models.DecimalField('重量(吨)', max_digits=12, decimal_places=2, default=0)
    volume = models.DecimalField('体积(立方)', max_digits=12, decimal_places=2, default=0)
    etd = models.DateField('预计开船日', null=True, blank=True)
    eta = models.DateField('预计到港日', null=True, blank=True)
    bl_no = models.CharField('提单号', max_length=50, blank=True)
    vessel = models.CharField('船名航次', max_length=100, blank=True)
    so_no = models.CharField('SO号', max_length=50, blank=True)

    booking_status = models.CharField(
        '订舱状态', max_length=20,
        choices=BookingStatusChoices.choices,
        default=BookingStatusChoices.DRAFT,
    )
    loading_status = models.CharField(
        '装柜状态', max_length=20,
        choices=LoadingStatusChoices.choices,
        default=LoadingStatusChoices.NOT_ARRANGED,
    )
    bl_status = models.CharField(
        '提单状态', max_length=20,
        choices=BlStatusChoices.choices,
        default=BlStatusChoices.NOT_ISSUED,
    )
    is_exception = models.BooleanField('是否异常', default=False)
    exception_type = models.CharField(
        '异常类型', max_length=30,
        choices=ExceptionTypeChoices.choices,
        default=ExceptionTypeChoices.NONE,
    )
    exception_note = models.TextField('异常说明', blank=True)

    return_reason = models.TextField('退回原因', blank=True)
    audit_remark = models.TextField('审计备注', blank=True)
    result_note = models.TextField('处理结果说明', blank=True)

    offline_booking_status = models.CharField(
        '离线台账-订舱状态', max_length=20,
        choices=BookingStatusChoices.choices,
        default=BookingStatusChoices.DRAFT, blank=True,
    )
    offline_loading_status = models.CharField(
        '离线台账-装柜状态', max_length=20,
        choices=LoadingStatusChoices.choices,
        default=LoadingStatusChoices.NOT_ARRANGED, blank=True,
    )
    offline_bl_status = models.CharField(
        '离线台账-提单状态', max_length=20,
        choices=BlStatusChoices.choices,
        default=BlStatusChoices.NOT_ISSUED, blank=True,
    )

    deadline = models.DateTimeField('办理时限', null=True, blank=True)
    submitter = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='submitted_bookings', verbose_name='提交人',
    )
    reviewer = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='reviewed_bookings', verbose_name='审核人',
    )
    archivist = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='archived_bookings', verbose_name='归档人',
    )
    submitted_at = models.DateTimeField('提交时间', null=True, blank=True)
    reviewed_at = models.DateTimeField('审核时间', null=True, blank=True)
    archived_at = models.DateTimeField('归档时间', null=True, blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '订舱申请'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.form_no} - {self.customer}'

    @property
    def booking_status_label(self):
        return dict(BookingStatusChoices.choices).get(self.booking_status, self.booking_status)

    @property
    def loading_status_label(self):
        return dict(LoadingStatusChoices.choices).get(self.loading_status, self.loading_status)

    @property
    def bl_status_label(self):
        return dict(BlStatusChoices.choices).get(self.bl_status, self.bl_status)

    @property
    def status_mismatch(self):
        mismatches = []
        if self.offline_booking_status and self.offline_booking_status != self.booking_status:
            mismatches.append(
                f'订舱状态：线上[{self.booking_status_label}] vs 离线[{dict(BookingStatusChoices.choices).get(self.offline_booking_status, "")}]'
            )
        if self.offline_loading_status and self.offline_loading_status != self.loading_status:
            mismatches.append(
                f'装柜状态：线上[{self.loading_status_label}] vs 离线[{dict(LoadingStatusChoices.choices).get(self.offline_loading_status, "")}]'
            )
        if self.offline_bl_status and self.offline_bl_status != self.bl_status:
            mismatches.append(
                f'提单状态：线上[{self.bl_status_label}] vs 离线[{dict(BlStatusChoices.choices).get(self.offline_bl_status, "")}]'
            )
        return mismatches


class OperationLog(models.Model):
    booking = models.ForeignKey(
        BookingApplication, on_delete=models.CASCADE,
        related_name='operation_logs', verbose_name='订舱申请',
    )
    action = models.CharField('操作类型', max_length=30, choices=ActionChoices.choices)
    operator = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='operations', verbose_name='操作人',
    )
    operator_name = models.CharField('操作人姓名', max_length=50, blank=True)
    role = models.CharField('操作人角色', max_length=20, choices=RoleChoices.choices, blank=True)
    from_status = models.CharField('变更前状态', max_length=20, blank=True)
    to_status = models.CharField('变更后状态', max_length=20, blank=True)
    remark = models.TextField('备注/原因', blank=True)
    field_changed = models.CharField('变更字段', max_length=100, blank=True)
    old_value = models.TextField('旧值', blank=True)
    new_value = models.TextField('新值', blank=True)
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    created_at = models.DateTimeField('操作时间', auto_now_add=True)

    class Meta:
        verbose_name = '操作记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.booking.form_no} - {self.get_action_display()}'

    @property
    def action_label(self):
        return dict(ActionChoices.choices).get(self.action, self.action)

    @property
    def role_label(self):
        return dict(RoleChoices.choices).get(self.role, self.role)


class AuditLog(models.Model):
    class AuditTypeChoices(models.TextChoices):
        BOOKING = 'booking', '订舱审核'
        LOADING = 'loading', '装柜审核'
        BL = 'bl', '提单审核'
        FINAL = 'final', '复核归档'

    class ResultChoices(models.TextChoices):
        PASS = 'pass', '通过'
        FAIL = 'fail', '失败'
        RETURN = 'return', '退回'

    booking = models.ForeignKey(
        BookingApplication, on_delete=models.CASCADE,
        related_name='audit_logs', verbose_name='订舱申请',
    )
    audit_type = models.CharField('审计类型', max_length=20, choices=AuditTypeChoices.choices)
    auditor = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='audits', verbose_name='审计人',
    )
    auditor_name = models.CharField('审计人姓名', max_length=50, blank=True)
    result = models.CharField('审计结果', max_length=10, choices=ResultChoices.choices)
    fail_reason = models.TextField('失败/退回原因', blank=True)
    remark = models.TextField('备注', blank=True)
    created_at = models.DateTimeField('审计时间', auto_now_add=True)

    class Meta:
        verbose_name = '审计日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.booking.form_no} - {self.get_audit_type_display()}: {self.get_result_display()}'


class Attachment(models.Model):
    class CategoryChoices(models.TextChoices):
        BOOKING_DOC = 'booking_doc', '订舱资料'
        LOADING_DOC = 'loading_doc', '装柜单据'
        BL_DOC = 'bl_doc', '提单文件'
        CERTIFICATE = 'certificate', '证明文件'
        OTHER = 'other', '其他'

    booking = models.ForeignKey(
        BookingApplication, on_delete=models.CASCADE,
        related_name='attachments', verbose_name='订舱申请',
    )
    category = models.CharField('文件分类', max_length=20, choices=CategoryChoices.choices, default=CategoryChoices.OTHER)
    file = models.FileField('文件', upload_to='attachments/%Y/%m/')
    file_name = models.CharField('文件名', max_length=255, blank=True)
    file_size = models.IntegerField('文件大小(字节)', default=0)
    uploader = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='uploaded_attachments', verbose_name='上传人',
    )
    created_at = models.DateTimeField('上传时间', auto_now_add=True)

    class Meta:
        verbose_name = '附件'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.booking.form_no} - {self.file_name}'

    def save(self, *args, **kwargs):
        if self.file and not self.file_name:
            self.file_name = self.file.name.split('/')[-1]
        if self.file and not self.file_size:
            try:
                self.file_size = self.file.size
            except Exception:
                pass
        super().save(*args, **kwargs)


class OfflineLedgerRecord(models.Model):
    booking = models.ForeignKey(
        BookingApplication, on_delete=models.CASCADE,
        related_name='offline_records', verbose_name='订舱申请',
    )
    field_name = models.CharField('回填字段', max_length=100)
    field_label = models.CharField('字段说明', max_length=100, blank=True)
    old_value = models.TextField('原值', blank=True)
    new_value = models.TextField('新值', blank=True)
    source = models.CharField('数据来源', max_length=50, default='离线台账Excel')
    operator = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='offline_ops', verbose_name='操作人',
    )
    operator_name = models.CharField('操作人姓名', max_length=50, blank=True)
    remark = models.TextField('备注', blank=True)
    created_at = models.DateTimeField('回填时间', auto_now_add=True)

    class Meta:
        verbose_name = '离线台账回填记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.booking.form_no} - {self.field_name}: {self.old_value} -> {self.new_value}'
