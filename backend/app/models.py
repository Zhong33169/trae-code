from django.db import models
from django.contrib.auth.hashers import make_password, check_password


class User(models.Model):
    ROLE_CHOICES = [
        ('registrar', '需求交付登记员'),
        ('auditor', '需求交付审核主管'),
        ('reviewer', '软件外包项目组复核负责人'),
    ]

    username = models.CharField(max_length=50, unique=True)
    password_hash = models.CharField(max_length=255)
    name = models.CharField(max_length=50)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    token = models.CharField(max_length=100, unique=True, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'

    def set_password(self, password):
        self.password_hash = make_password(password)

    def verify_password(self, password):
        return check_password(password, self.password_hash)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'name': self.name,
            'role': self.role,
            'role_label': self.get_role_display(),
        }


class Ticket(models.Model):
    RISK_LEVEL_CHOICES = [
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
    ]

    STAGE_CHOICES = [
        ('confirm', '需求确认'),
        ('schedule', '排期评估'),
        ('acceptance', '交付验收'),
    ]

    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('processing', '处理中'),
        ('returned', '已退回'),
        ('completed', '已完成'),
        ('overdue', '已逾期'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField()
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES)
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='confirm')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.IntegerField(default=50)
    version = models.IntegerField(default=1)
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tickets')
    current_handler = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='handling_tickets')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deadline = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'tickets'
        ordering = ['-priority', '-created_at']

    def save(self, *args, **kwargs):
        risk_priority = {'high': 100, 'medium': 50, 'low': 10}
        base_priority = risk_priority.get(self.risk_level, 50)
        if self.status == 'overdue':
            base_priority += 50
        self.priority = base_priority
        super().save(*args, **kwargs)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'risk_level': self.risk_level,
            'risk_label': self.get_risk_level_display(),
            'stage': self.stage,
            'stage_label': self.get_stage_display(),
            'status': self.status,
            'status_label': self.get_status_display(),
            'priority': self.priority,
            'version': self.version,
            'creator_id': self.creator_id,
            'creator_name': self.creator.name if self.creator else '',
            'current_handler_id': self.current_handler_id,
            'current_handler_name': self.current_handler.name if self.current_handler else '',
            'created_at': self.created_at.isoformat() if self.created_at else '',
            'updated_at': self.updated_at.isoformat() if self.updated_at else '',
            'deadline': self.deadline.isoformat() if self.deadline else '',
        }


class TicketLog(models.Model):
    ACTION_CHOICES = [
        ('create', '创建'),
        ('submit', '提交'),
        ('approve', '通过'),
        ('reject', '退回'),
        ('revise', '补正'),
        ('archive', '归档'),
        ('validate_fail', '校验失败'),
    ]

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='logs')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    from_stage = models.CharField(max_length=20, blank=True)
    to_stage = models.CharField(max_length=20, blank=True)
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20, blank=True)
    operator = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='operated_logs')
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ticket_logs'
        ordering = ['-created_at']

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'action': self.action,
            'action_label': self.get_action_display(),
            'from_stage': self.from_stage,
            'to_stage': self.to_stage,
            'from_status': self.from_status,
            'to_status': self.to_status,
            'operator_id': self.operator_id,
            'operator_name': self.operator.name if self.operator else '系统',
            'comment': self.comment,
            'created_at': self.created_at.isoformat() if self.created_at else '',
        }


class Evidence(models.Model):
    TYPE_CHOICES = [
        ('doc', '文档'),
        ('image', '图片'),
        ('link', '链接'),
        ('other', '其他'),
    ]

    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE, related_name='evidences')
    log = models.ForeignKey(TicketLog, on_delete=models.SET_NULL, null=True, blank=True, related_name='evidences')
    name = models.CharField(max_length=200)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='doc')
    url = models.CharField(max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'evidences'

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_id': self.ticket_id,
            'log_id': self.log_id,
            'name': self.name,
            'type': self.type,
            'type_label': self.get_type_display(),
            'url': self.url,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else '',
        }
