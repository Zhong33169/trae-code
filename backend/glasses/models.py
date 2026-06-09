import uuid
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    REGISTRAR = 'registrar', '配镜登记员'
    SUPERVISOR = 'supervisor', '配镜审核主管'
    REVIEWER = 'reviewer', '眼科诊所复核负责人'


class OrderStatus(models.TextChoices):
    PENDING_REGISTRATION = 'pending_registration', '待登记'
    PENDING_REVIEW = 'pending_review', '待审核'
    PENDING_FINAL = 'pending_final', '待复核'
    ARCHIVED = 'archived', '已归档'
    RETURNED = 'returned', '已退回'
    ABNORMAL = 'abnormal', '异常'


class OfflineStatus(models.TextChoices):
    NOT_RECORDED = 'not_recorded', '线下未登记'
    REGISTERED = 'registered', '线下已登记'
    REVIEWED = 'reviewed', '线下已审核'
    FINALIZED = 'finalized', '线下已复核'
    ARCHIVED = 'archived', '线下已归档'


class AnomalyType(models.TextChoices):
    DUPLICATE_BATCH = 'duplicate_batch', '重复批次'
    STATUS_MISMATCH = 'status_mismatch', '状态不一致'
    MISSING_MATERIALS = 'missing_materials', '材料缺失'
    OVERDUE = 'overdue', '超时'


class GlassesOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order_no = models.CharField(max_length=32, unique=True, verbose_name='订单编号')
    batch_no = models.CharField(max_length=32, verbose_name='批次号')
    patient_name = models.CharField(max_length=64, verbose_name='患者姓名')
    patient_id_card = models.CharField(max_length=32, blank=True, verbose_name='身份证号')
    lens_type = models.CharField(max_length=64, blank=True, verbose_name='镜片类型')
    lens_power = models.CharField(max_length=64, blank=True, verbose_name='镜片度数')
    frame_model = models.CharField(max_length=64, blank=True, verbose_name='镜架型号')
    prescription_no = models.CharField(max_length=64, blank=True, verbose_name='处方单号')

    has_prescription = models.BooleanField(default=False, verbose_name='是否有处方单')
    has_insurance = models.BooleanField(default=False, verbose_name='是否有医保材料')
    has_id_copy = models.BooleanField(default=False, verbose_name='是否有身份证复印件')
    has_receipt = models.BooleanField(default=False, verbose_name='是否有收费凭证')

    status = models.CharField(
        max_length=32,
        choices=OrderStatus.choices,
        default=OrderStatus.PENDING_REGISTRATION,
        verbose_name='订单状态',
    )
    offline_status = models.CharField(
        max_length=32,
        choices=OfflineStatus.choices,
        default=OfflineStatus.NOT_RECORDED,
        verbose_name='线下台账状态',
    )

    registered_by = models.CharField(max_length=64, blank=True, verbose_name='登记人')
    registered_at = models.DateTimeField(null=True, blank=True, verbose_name='登记时间')
    reviewed_by = models.CharField(max_length=64, blank=True, verbose_name='审核人')
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    finalized_by = models.CharField(max_length=64, blank=True, verbose_name='复核人')
    finalized_at = models.DateTimeField(null=True, blank=True, verbose_name='复核时间')

    return_reason = models.TextField(blank=True, verbose_name='退回原因')
    return_by = models.CharField(max_length=64, blank=True, verbose_name='退回人')
    return_at = models.DateTimeField(null=True, blank=True, verbose_name='退回时间')

    audit_remark = models.TextField(blank=True, verbose_name='审计备注')
    result_remark = models.TextField(blank=True, verbose_name='结果说明')

    is_overdue = models.BooleanField(default=False, verbose_name='是否超时')
    anomaly_types = models.JSONField(default=list, blank=True, verbose_name='异常类型列表')
    anomaly_remark = models.TextField(blank=True, verbose_name='异常说明')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        verbose_name = '配镜订单'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.order_no} - {self.patient_name}'

    def detect_anomalies(self):
        anomalies = []
        remarks = []

        if self.batch_no:
            duplicate_count = GlassesOrder.objects.filter(
                batch_no=self.batch_no
            ).exclude(id=self.id).count()
            if duplicate_count > 0:
                anomalies.append(AnomalyType.DUPLICATE_BATCH)
                remarks.append(f'批次号 {self.batch_no} 存在 {duplicate_count} 条重复记录')

        status_map = {
            OrderStatus.PENDING_REGISTRATION: OfflineStatus.NOT_RECORDED,
            OrderStatus.PENDING_REVIEW: OfflineStatus.REGISTERED,
            OrderStatus.PENDING_FINAL: OfflineStatus.REVIEWED,
            OrderStatus.ARCHIVED: OfflineStatus.ARCHIVED,
            OrderStatus.RETURNED: None,
        }
        expected_offline = status_map.get(self.status)
        if expected_offline and self.offline_status != expected_offline:
            anomalies.append(AnomalyType.STATUS_MISMATCH)
            remarks.append(
                f'线上状态「{self.get_status_display()}」与线下状态「{self.get_offline_status_display()}」不一致'
            )

        if not self.has_prescription:
            anomalies.append(AnomalyType.MISSING_MATERIALS)
            remarks.append('缺少处方单')

        if self.created_at:
            age_days = (timezone.now() - self.created_at).days
            if age_days > 3 and self.status not in [OrderStatus.ARCHIVED]:
                self.is_overdue = True
                if AnomalyType.OVERDUE not in anomalies:
                    anomalies.append(AnomalyType.OVERDUE)
                remarks.append(f'订单创建已 {age_days} 天，超过 3 天处理时限')
            else:
                self.is_overdue = False

        self.anomaly_types = anomalies
        self.anomaly_remark = '; '.join(remarks) if remarks else ''
        return anomalies


class OrderAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        GlassesOrder,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='所属订单',
    )
    file_name = models.CharField(max_length=255, verbose_name='文件名')
    file_type = models.CharField(max_length=64, verbose_name='文件类型')
    file_size = models.IntegerField(default=0, verbose_name='文件大小(字节)')
    file_url = models.CharField(max_length=512, blank=True, verbose_name='文件地址')
    uploaded_by = models.CharField(max_length=64, verbose_name='上传人')
    uploaded_at = models.DateTimeField(auto_now_add=True, verbose_name='上传时间')
    remark = models.CharField(max_length=255, blank=True, verbose_name='备注')

    class Meta:
        verbose_name = '订单附件'
        verbose_name_plural = verbose_name
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.file_name


class AuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        GlassesOrder,
        on_delete=models.CASCADE,
        related_name='audit_logs',
        null=True,
        blank=True,
        verbose_name='关联订单',
    )
    action = models.CharField(max_length=64, verbose_name='操作类型')
    actor = models.CharField(max_length=64, verbose_name='操作人')
    actor_role = models.CharField(
        max_length=32,
        choices=Role.choices,
        verbose_name='操作人角色',
    )
    status_before = models.CharField(max_length=32, blank=True, verbose_name='操作前状态')
    status_after = models.CharField(max_length=32, blank=True, verbose_name='操作后状态')
    reason = models.TextField(blank=True, verbose_name='原因')
    detail = models.TextField(blank=True, verbose_name='详情')
    is_failure = models.BooleanField(default=False, verbose_name='是否失败操作')
    failure_reason = models.TextField(blank=True, verbose_name='失败原因')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='操作时间')

    class Meta:
        verbose_name = '审计日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.actor} - {self.action}'


class SystemUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    username = models.CharField(max_length=64, unique=True, verbose_name='用户名')
    name = models.CharField(max_length=64, verbose_name='姓名')
    role = models.CharField(
        max_length=32,
        choices=Role.choices,
        verbose_name='角色',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '系统用户'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.name} ({self.get_role_display()})'
