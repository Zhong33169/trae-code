from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    ROLE_TA = 'teaching_assistant'
    ROLE_LAB_ADMIN = 'lab_admin'
    ROLE_COLLEGE_HEAD = 'college_head'

    ROLE_CHOICES = [
        (ROLE_TA, '实验助教'),
        (ROLE_LAB_ADMIN, '实验室管理员'),
        (ROLE_COLLEGE_HEAD, '学院负责人'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=32, choices=ROLE_CHOICES)
    department = models.CharField(max_length=100, blank=True, default='')
    phone = models.CharField(max_length=20, blank=True, default='')

    class Meta:
        db_table = 'user_profiles'

    def __str__(self):
        return f'{self.user.username} ({self.get_role_display()})'


class LabReservation(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_SUBMITTED = 'submitted'
    STATUS_LAB_REVIEWED = 'lab_reviewed'
    STATUS_LAB_REJECTED = 'lab_rejected'
    STATUS_CONFIRMED = 'confirmed'
    STATUS_COLLEGE_REJECTED = 'college_rejected'

    STATUS_CHOICES = [
        (STATUS_DRAFT, '草稿'),
        (STATUS_SUBMITTED, '已提交（待实验室审核）'),
        (STATUS_LAB_REVIEWED, '实验室审核通过（待学院确认）'),
        (STATUS_LAB_REJECTED, '实验室退回'),
        (STATUS_CONFIRMED, '学院已确认'),
        (STATUS_COLLEGE_REJECTED, '学院退回'),
    ]

    reservation_no = models.CharField(max_length=32, unique=True)
    title = models.CharField(max_length=200)
    lab_name = models.CharField(max_length=100)
    course_name = models.CharField(max_length=100, blank=True, default='')
    experiment_name = models.CharField(max_length=200)

    applicant = models.ForeignKey(User, on_delete=models.PROTECT, related_name='reservations')
    department = models.CharField(max_length=100)

    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    student_count = models.IntegerField(default=0)

    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    version = models.IntegerField(default=1)

    has_experiment_plan = models.BooleanField(default=False)
    has_material_application = models.BooleanField(default=False)
    has_safety_confirmation = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    submitted_at = models.DateTimeField(null=True, blank=True)
    lab_reviewed_at = models.DateTimeField(null=True, blank=True)
    lab_reviewer = models.ForeignKey(
        User, on_delete=models.PROTECT, null=True, blank=True, related_name='lab_reviews'
    )
    lab_review_comment = models.TextField(blank=True, default='')

    confirmed_at = models.DateTimeField(null=True, blank=True)
    confirmer = models.ForeignKey(
        User, on_delete=models.PROTECT, null=True, blank=True, related_name='confirmations'
    )
    confirm_comment = models.TextField(blank=True, default='')

    rejection_reason = models.TextField(blank=True, default='')
    rejected_by = models.ForeignKey(
        User, on_delete=models.PROTECT, null=True, blank=True, related_name='rejections'
    )
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'lab_reservations'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reservation_no} - {self.title}'

    def get_required_evidence(self):
        return ['experiment_plan', 'material_application', 'safety_confirmation']

    def get_missing_evidence(self):
        missing = []
        if not self.has_experiment_plan:
            missing.append('experiment_plan')
        if not self.has_material_application:
            missing.append('material_application')
        if not self.has_safety_confirmation:
            missing.append('safety_confirmation')
        return missing

    def can_submit(self, user):
        if user.profile.role != UserProfile.ROLE_TA:
            return False, '只有实验助教可以提交预约单'
        if self.status != self.STATUS_DRAFT and self.status not in [
            self.STATUS_LAB_REJECTED, self.STATUS_COLLEGE_REJECTED
        ]:
            return False, f'当前状态「{self.get_status_display()}」不能提交'
        missing = self.get_missing_evidence()
        if missing:
            return False, f'缺少必要证据材料：{", ".join(missing)}'
        if self.applicant_id != user.id:
            return False, '只能提交自己创建的预约单'
        return True, ''

    def can_lab_review(self, user):
        if user.profile.role != UserProfile.ROLE_LAB_ADMIN:
            return False, '只有实验室管理员可以审核预约单'
        if self.status != self.STATUS_SUBMITTED:
            return False, f'当前状态「{self.get_status_display()}」不能进行实验室审核'
        return True, ''

    def can_college_confirm(self, user):
        if user.profile.role != UserProfile.ROLE_COLLEGE_HEAD:
            return False, '只有学院负责人可以确认预约单'
        if self.status != self.STATUS_LAB_REVIEWED:
            return False, f'当前状态「{self.get_status_display()}」不能进行学院确认'
        return True, ''

    def can_supplement(self, user):
        if user.profile.role != UserProfile.ROLE_TA:
            return False, '只有实验助教可以补录材料'
        if self.applicant_id != user.id:
            return False, '只能补录自己创建的预约单'
        if self.status not in [
            self.STATUS_DRAFT,
            self.STATUS_LAB_REJECTED,
            self.STATUS_COLLEGE_REJECTED,
            self.STATUS_SUBMITTED,
            self.STATUS_LAB_REVIEWED,
        ]:
            return False, f'当前状态「{self.get_status_display()}」不能补录材料'
        return True, ''


class Evidence(models.Model):
    TYPE_EXPERIMENT_PLAN = 'experiment_plan'
    TYPE_MATERIAL_APPLICATION = 'material_application'
    TYPE_SAFETY_CONFIRMATION = 'safety_confirmation'

    TYPE_CHOICES = [
        (TYPE_EXPERIMENT_PLAN, '实验预约方案'),
        (TYPE_MATERIAL_APPLICATION, '耗材申领单'),
        (TYPE_SAFETY_CONFIRMATION, '安全确认书'),
    ]

    reservation = models.ForeignKey(
        LabReservation, on_delete=models.CASCADE, related_name='evidences'
    )
    evidence_type = models.CharField(max_length=32, choices=TYPE_CHOICES)
    title = models.CharField(max_length=200)
    file_name = models.CharField(max_length=255, blank=True, default='')
    file_url = models.CharField(max_length=500, blank=True, default='')
    description = models.TextField(blank=True, default='')
    uploaded_by = models.ForeignKey(User, on_delete=models.PROTECT)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    version = models.IntegerField(default=1)
    is_supplementary = models.BooleanField(default=False)

    class Meta:
        db_table = 'evidences'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f'{self.get_evidence_type_display()} - {self.title}'


class SupplementaryRecord(models.Model):
    ACTION_ADD_EVIDENCE = 'add_evidence'
    ACTION_UPDATE_INFO = 'update_info'
    ACTION_RESUBMIT = 'resubmit'

    ACTION_CHOICES = [
        (ACTION_ADD_EVIDENCE, '补充证据材料'),
        (ACTION_UPDATE_INFO, '更新预约信息'),
        (ACTION_RESUBMIT, '重新提交'),
    ]

    reservation = models.ForeignKey(
        LabReservation, on_delete=models.CASCADE, related_name='supplementary_records'
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    description = models.TextField()
    supplementer = models.ForeignKey(User, on_delete=models.PROTECT, related_name='supplements')
    supplementary_at = models.DateTimeField(auto_now_add=True)
    previous_status = models.CharField(max_length=32, blank=True, default='')
    new_status = models.CharField(max_length=32, blank=True, default='')
    related_evidence = models.ForeignKey(
        Evidence, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = 'supplementary_records'
        ordering = ['-supplementary_at']

    def __str__(self):
        return f'{self.reservation.reservation_no} - {self.get_action_display()}'


class AuditLog(models.Model):
    ACTION_SUBMIT = 'submit'
    ACTION_LAB_REVIEW_PASS = 'lab_review_pass'
    ACTION_LAB_REJECT = 'lab_reject'
    ACTION_COLLEGE_CONFIRM = 'college_confirm'
    ACTION_COLLEGE_REJECT = 'college_reject'
    ACTION_SUPPLEMENT = 'supplement'
    ACTION_CREATE = 'create'
    ACTION_UPDATE = 'update'

    ACTION_CHOICES = [
        (ACTION_CREATE, '创建'),
        (ACTION_UPDATE, '更新'),
        (ACTION_SUBMIT, '提交'),
        (ACTION_LAB_REVIEW_PASS, '实验室审核通过'),
        (ACTION_LAB_REJECT, '实验室退回'),
        (ACTION_COLLEGE_CONFIRM, '学院确认'),
        (ACTION_COLLEGE_REJECT, '学院退回'),
        (ACTION_SUPPLEMENT, '补录'),
    ]

    reservation = models.ForeignKey(
        LabReservation, on_delete=models.CASCADE, related_name='audit_logs'
    )
    action = models.CharField(max_length=32, choices=ACTION_CHOICES)
    actor = models.ForeignKey(User, on_delete=models.PROTECT)
    action_time = models.DateTimeField(auto_now_add=True)
    comment = models.TextField(blank=True, default='')
    previous_status = models.CharField(max_length=32, blank=True, default='')
    new_status = models.CharField(max_length=32, blank=True, default='')
    reason = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'audit_logs'
        ordering = ['-action_time']

    def __str__(self):
        return f'{self.reservation.reservation_no} - {self.get_action_display()}'
