import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    code = models.CharField(max_length=50, unique=True)
    description = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'sys_role'

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    phone = models.CharField(max_length=20, blank=True)
    department = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'sys_user_profile'

    def __str__(self):
        return f'{self.user.username} - {self.role.name}'


class ExtensionApplication(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_PENDING_REVIEW = 'pending_review'
    STATUS_REVIEW_APPROVED = 'review_approved'
    STATUS_RETURNED_FOR_CORRECTION = 'returned_for_correction'
    STATUS_FINAL_APPROVED = 'final_approved'
    STATUS_REJECTED = 'rejected'
    STATUS_ARCHIVED = 'archived'

    STATUS_CHOICES = [
        (STATUS_DRAFT, '草稿'),
        (STATUS_PENDING_REVIEW, '待审核'),
        (STATUS_REVIEW_APPROVED, '审核通过待复核'),
        (STATUS_RETURNED_FOR_CORRECTION, '退回补正'),
        (STATUS_FINAL_APPROVED, '复核通过待归档'),
        (STATUS_REJECTED, '已拒绝'),
        (STATUS_ARCHIVED, '已归档'),
    ]

    application_no = models.CharField(max_length=32, unique=True)
    qr_code = models.CharField(max_length=64, unique=True)
    borrower_name = models.CharField(max_length=100)
    borrower_id_card = models.CharField(max_length=18)
    borrower_phone = models.CharField(max_length=20)
    loan_contract_no = models.CharField(max_length=50)
    original_principal = models.DecimalField(max_digits=15, decimal_places=2)
    original_interest_rate = models.DecimalField(max_digits=5, decimal_places=2)
    original_due_date = models.DateField()
    extension_days = models.IntegerField()
    extension_reason = models.TextField()
    new_due_date = models.DateField()
    new_interest_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    current_handler_role = models.CharField(max_length=50, blank=True)

    registrar = models.ForeignKey(User, on_delete=models.PROTECT, related_name='registered_applications')
    reviewer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='reviewed_applications', null=True, blank=True)
    final_reviewer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='final_reviewed_applications', null=True, blank=True)

    review_opinion = models.TextField(blank=True)
    final_review_opinion = models.TextField(blank=True)

    deadline = models.DateTimeField(null=True, blank=True)
    is_urgent = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    version = models.IntegerField(default=1)

    class Meta:
        db_table = 'extension_application'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.application_no} - {self.borrower_name}'


class RepaymentPlan(models.Model):
    application = models.ForeignKey(ExtensionApplication, on_delete=models.CASCADE, related_name='repayment_plans')
    plan_no = models.IntegerField()
    due_date = models.DateField()
    principal = models.DecimalField(max_digits=15, decimal_places=2)
    interest = models.DecimalField(max_digits=15, decimal_places=2)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2)
    is_extension_period = models.BooleanField(default=False)

    class Meta:
        db_table = 'repayment_plan'
        ordering = ['plan_no']

    def __str__(self):
        return f'{self.application.application_no} - 第{self.plan_no}期'


class Material(models.Model):
    MATERIAL_TYPE_ID_CARD = 'id_card'
    MATERIAL_TYPE_LOAN_CONTRACT = 'loan_contract'
    MATERIAL_TYPE_EXTENSION_AGREEMENT = 'extension_agreement'
    MATERIAL_TYPE_INCOME_PROOF = 'income_proof'
    MATERIAL_TYPE_SITE_PHOTO = 'site_photo'
    MATERIAL_TYPE_OTHER = 'other'

    MATERIAL_TYPE_CHOICES = [
        (MATERIAL_TYPE_ID_CARD, '身份证'),
        (MATERIAL_TYPE_LOAN_CONTRACT, '借款合同'),
        (MATERIAL_TYPE_EXTENSION_AGREEMENT, '展期协议'),
        (MATERIAL_TYPE_INCOME_PROOF, '收入证明'),
        (MATERIAL_TYPE_SITE_PHOTO, '现场照片'),
        (MATERIAL_TYPE_OTHER, '其他材料'),
    ]

    application = models.ForeignKey(ExtensionApplication, on_delete=models.CASCADE, related_name='materials')
    material_type = models.CharField(max_length=30, choices=MATERIAL_TYPE_CHOICES)
    material_name = models.CharField(max_length=200)
    file_url = models.CharField(max_length=500, blank=True)
    is_required = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    upload_time = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'application_material'
        ordering = ['material_type', 'upload_time']

    def __str__(self):
        return f'{self.get_material_type_display()} - {self.material_name}'


class AuditLog(models.Model):
    ACTION_CREATE = 'create'
    ACTION_SUBMIT = 'submit'
    ACTION_REVIEW = 'review'
    ACTION_CORRECT = 'correct'
    ACTION_FINAL_REVIEW = 'final_review'
    ACTION_REJECT = 'reject'
    ACTION_ARCHIVE = 'archive'
    ACTION_SCAN = 'scan'
    ACTION_MATERIAL_UPLOAD = 'material_upload'
    ACTION_MATERIAL_VERIFY = 'material_verify'
    ACTION_BATCH_PROCESS = 'batch_process'

    ACTION_CHOICES = [
        (ACTION_CREATE, '创建申请'),
        (ACTION_SUBMIT, '提交申请'),
        (ACTION_REVIEW, '审核'),
        (ACTION_CORRECT, '补正'),
        (ACTION_FINAL_REVIEW, '复核'),
        (ACTION_REJECT, '拒绝'),
        (ACTION_ARCHIVE, '归档'),
        (ACTION_SCAN, '扫码核验'),
        (ACTION_MATERIAL_UPLOAD, '材料上传'),
        (ACTION_MATERIAL_VERIFY, '材料核验'),
        (ACTION_BATCH_PROCESS, '批量处理'),
    ]

    application = models.ForeignKey(ExtensionApplication, on_delete=models.CASCADE, related_name='audit_logs', null=True, blank=True)
    operator = models.ForeignKey(User, on_delete=models.PROTECT)
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    action_detail = models.CharField(max_length=200, blank=True)
    old_status = models.CharField(max_length=30, blank=True)
    new_status = models.CharField(max_length=30, blank=True)
    remark = models.TextField(blank=True)
    ip_address = models.CharField(max_length=50, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_log'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.operator.username} - {self.get_action_display()}'


class QrCodeRecord(models.Model):
    SCAN_RESULT_SUCCESS = 'success'
    SCAN_RESULT_INVALID = 'invalid'
    SCAN_RESULT_DUPLICATE = 'duplicate'
    SCAN_RESULT_WRONG_HANDLER = 'wrong_handler'
    SCAN_RESULT_WRONG_STATUS = 'wrong_status'

    SCAN_RESULT_CHOICES = [
        (SCAN_RESULT_SUCCESS, '核验通过'),
        (SCAN_RESULT_INVALID, '无效码'),
        (SCAN_RESULT_DUPLICATE, '重复扫码'),
        (SCAN_RESULT_WRONG_HANDLER, '非当前处理人'),
        (SCAN_RESULT_WRONG_STATUS, '状态不匹配'),
    ]

    qr_code = models.CharField(max_length=64)
    application = models.ForeignKey(ExtensionApplication, on_delete=models.CASCADE, related_name='scan_records', null=True, blank=True)
    scanner = models.ForeignKey(User, on_delete=models.PROTECT)
    scan_result = models.CharField(max_length=30, choices=SCAN_RESULT_CHOICES)
    error_message = models.CharField(max_length=500, blank=True)
    scan_time = models.DateTimeField(auto_now_add=True)
    location = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'qr_code_record'
        ordering = ['-scan_time']

    def __str__(self):
        return f'{self.qr_code} - {self.get_scan_result_display()}'


class BatchTask(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_PARTIAL_FAILED = 'partial_failed'

    STATUS_CHOICES = [
        (STATUS_PENDING, '待处理'),
        (STATUS_PROCESSING, '处理中'),
        (STATUS_COMPLETED, '全部成功'),
        (STATUS_PARTIAL_FAILED, '部分失败'),
    ]

    task_no = models.CharField(max_length=32, unique=True)
    operator = models.ForeignKey(User, on_delete=models.PROTECT, related_name='batch_tasks')
    action = models.CharField(max_length=50)
    total_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failed_count = models.IntegerField(default=0)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    remark = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'batch_task'
        ordering = ['-created_at']


class BatchTaskItem(models.Model):
    STATUS_SUCCESS = 'success'
    STATUS_FAILED = 'failed'
    STATUS_PENDING = 'pending'

    STATUS_CHOICES = [
        (STATUS_PENDING, '待处理'),
        (STATUS_SUCCESS, '成功'),
        (STATUS_FAILED, '失败'),
    ]

    batch_task = models.ForeignKey(BatchTask, on_delete=models.CASCADE, related_name='items')
    application = models.ForeignKey(ExtensionApplication, on_delete=models.CASCADE, related_name='batch_items')
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_code = models.CharField(max_length=50, blank=True)
    error_message = models.CharField(max_length=500, blank=True)
    next_step = models.CharField(max_length=500, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'batch_task_item'
        ordering = ['id']
