import os
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import (
    User, MaterialChangeOrder, Attachment, AuditLog,
    Role, ChangeOrderStatus, AttachmentStatus, AuditAction
)


class Command(BaseCommand):
    help = 'Seed database with sample data for normal, missing-material, overdue, and returned orders'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database...')
        
        self._create_users()
        self._create_normal_order()
        self._create_missing_material_order()
        self._create_overdue_order()
        self._create_returned_order()
        
        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))

    def _create_users(self):
        users_data = [
            {'username': 'registrar01', 'name': '张登记', 'role': Role.REGISTRAR},
            {'username': 'registrar02', 'name': '李登记', 'role': Role.REGISTRAR},
            {'username': 'supervisor01', 'name': '王主管', 'role': Role.SUPERVISOR},
            {'username': 'supervisor02', 'name': '赵主管', 'role': Role.SUPERVISOR},
            {'username': 'reviewer01', 'name': '陈复核', 'role': Role.REVIEWER},
        ]
        
        for data in users_data:
            User.objects.get_or_create(
                username=data['username'],
                defaults={'name': data['name'], 'role': data['role']}
            )
        self.stdout.write('  Users created.')

    def _create_attachment(self, order, user, file_name, status=AttachmentStatus.UPLOADED, reject_reason=None):
        media_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), '..', 'media')
        os.makedirs(media_dir, exist_ok=True)
        
        fake_path = f'/media/sample_{order.order_no}_{file_name}.pdf'
        
        att = Attachment.objects.create(
            order=order,
            file_name=file_name,
            file_path=fake_path,
            file_type='application/pdf',
            file_size=102400,
            uploaded_by=user,
            status=status,
            reject_reason=reject_reason,
            rejected_by=User.objects.filter(role=Role.SUPERVISOR).first() if status == AttachmentStatus.REJECTED else None,
            rejected_at=timezone.now() if status == AttachmentStatus.REJECTED else None
        )
        return att

    def _create_audit(self, order, action, operator, reason=''):
        AuditLog.objects.create(
            order=order,
            action=action,
            operator=operator,
            reason=reason,
            detail={}
        )

    def _create_normal_order(self):
        registrar = User.objects.get(username='registrar01')
        supervisor = User.objects.get(username='supervisor01')
        reviewer = User.objects.get(username='reviewer01')
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0001',
            title='电阻阻值规格变更（正常流程单）',
            material_code='RES-001-10K',
            material_name='贴片电阻 10KΩ 0805',
            change_type='参数变更',
            description='由于供应商工艺调整，电阻阻值容差由±5%调整为±1%，需同步更新BOM及检验标准。',
            status=ChangeOrderStatus.ARCHIVED,
            registrar=registrar,
            supervisor=supervisor,
            reviewer=reviewer,
            audit_remark='变更合理，资料齐全，同意归档。',
            is_overdue=False,
            deadline=timezone.now() + timedelta(days=7),
            submitted_at=timezone.now() - timedelta(days=5),
            archived_at=timezone.now() - timedelta(days=1),
            created_at=timezone.now() - timedelta(days=10)
        )
        
        self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        self._create_attachment(order, registrar, '供应商技术通知.pdf', AttachmentStatus.APPROVED)
        self._create_attachment(order, registrar, 'BOM变更对比表.pdf', AttachmentStatus.APPROVED)
        
        self._create_audit(order, AuditAction.CREATED, registrar)
        self._create_audit(order, AuditAction.SUBMITTED, registrar)
        self._create_audit(order, AuditAction.APPROVED_SUPERVISOR, supervisor, reason='附件齐全，变更合理')
        self._create_audit(order, AuditAction.APPROVED_FINAL, reviewer, reason='复核通过，予以归档')
        
        self.stdout.write('  Normal order (MCO-2026-0001) created - 已归档.')

    def _create_missing_material_order(self):
        registrar = User.objects.get(username='registrar02')
        supervisor = User.objects.get(username='supervisor01')
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0002',
            title='电容封装尺寸变更（缺材料单）',
            material_code='CAP-002-100nF',
            material_name='贴片电容 100nF 0603',
            change_type='封装变更',
            description='电容封装由0603变更为0402，需要补齐封装尺寸图和SMT制程评估报告。',
            status=ChangeOrderStatus.SUPPLEMENT_REQUIRED,
            registrar=registrar,
            supervisor=supervisor,
            return_reason='缺少：1.封装尺寸图纸；2.SMT贴片可行性评估报告；3.焊盘设计对比表。请补充后重新提交。',
            audit_remark='核心技术资料缺失，退回补正。',
            is_overdue=False,
            deadline=timezone.now() + timedelta(days=3),
            submitted_at=timezone.now() - timedelta(days=2),
            created_at=timezone.now() - timedelta(days=5)
        )
        
        att1 = self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        att2 = self._create_attachment(
            order, registrar, '初步方案说明.pdf',
            AttachmentStatus.REJECTED,
            reject_reason='此文档仅为初步说明，缺少正式的技术评估数据和签字确认，请重新提交正式版本。'
        )
        
        self._create_audit(order, AuditAction.CREATED, registrar)
        self._create_audit(order, AuditAction.SUBMITTED, registrar)
        self._create_audit(
            order, AuditAction.ATTACHMENT_REJECTED, supervisor,
            reason='此文档仅为初步说明，缺少正式的技术评估数据和签字确认，请重新提交正式版本。'
        )
        self._create_audit(
            order, AuditAction.REJECTED_SUPERVISOR, supervisor,
            reason='缺少：1.封装尺寸图纸；2.SMT贴片可行性评估报告；3.焊盘设计对比表。请补充后重新提交。'
        )
        
        self.stdout.write('  Missing material order (MCO-2026-0002) created - 需补正附件（含被驳回附件）.')

    def _create_overdue_order(self):
        registrar = User.objects.get(username='registrar01')
        supervisor = User.objects.get(username='supervisor02')
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0003',
            title='芯片型号替换（超时单）',
            material_code='IC-003-STM32F103',
            material_name='MCU STM32F103C8T6',
            change_type='型号替换',
            description='原芯片停产，替换为STM32F103CBT6，需审核资料是否齐全。',
            status=ChangeOrderStatus.OVERDUE,
            registrar=registrar,
            supervisor=supervisor,
            is_overdue=True,
            deadline=timezone.now() - timedelta(days=5),
            submitted_at=timezone.now() - timedelta(days=15),
            created_at=timezone.now() - timedelta(days=20)
        )
        
        self._create_attachment(order, registrar, '芯片停产通知.pdf', AttachmentStatus.APPROVED)
        self._create_attachment(order, registrar, '替代型号对比表.pdf', AttachmentStatus.UPLOADED)
        
        self._create_audit(order, AuditAction.CREATED, registrar)
        self._create_audit(order, AuditAction.SUBMITTED, registrar)
        self._create_audit(order, AuditAction.MARKED_OVERDUE, supervisor, reason='超过7天审核时限，系统自动标记')
        
        self.stdout.write('  Overdue order (MCO-2026-0003) created - 已超时.')

    def _create_returned_order(self):
        registrar = User.objects.get(username='registrar02')
        supervisor = User.objects.get(username='supervisor01')
        reviewer = User.objects.get(username='reviewer01')
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0004',
            title='PCB板材升级（复核退回单）',
            material_code='PCB-004-FR4',
            material_name='PCB板材 FR-4 TG130',
            change_type='材料升级',
            description='PCB板材由TG130升级为TG150，提升耐高温性能。',
            status=ChangeOrderStatus.RETURNED,
            registrar=registrar,
            supervisor=supervisor,
            reviewer=reviewer,
            return_reason='复核退回：缺少可靠性测试报告（高温高湿、热循环测试数据），且未说明成本影响评估。请补充可靠性试验报告及成本分析后重新走流程。',
            audit_remark='升级方向正确但验证数据不充分，成本影响未评估。',
            is_overdue=False,
            deadline=timezone.now() - timedelta(days=2),
            submitted_at=timezone.now() - timedelta(days=8),
            created_at=timezone.now() - timedelta(days=12)
        )
        
        self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        self._create_attachment(order, registrar, '板材规格书.pdf', AttachmentStatus.APPROVED)
        self._create_attachment(order, registrar, '供应商资质.pdf', AttachmentStatus.APPROVED)
        
        self._create_audit(order, AuditAction.CREATED, registrar)
        self._create_audit(order, AuditAction.SUBMITTED, registrar)
        self._create_audit(order, AuditAction.APPROVED_SUPERVISOR, supervisor, reason='资料基本齐全，提交复核')
        self._create_audit(
            order, AuditAction.REJECTED_FINAL, reviewer,
            reason='复核退回：缺少可靠性测试报告（高温高湿、热循环测试数据），且未说明成本影响评估。请补充可靠性试验报告及成本分析后重新走流程。'
        )
        
        self.stdout.write('  Returned order (MCO-2026-0004) created - 已退回（复核阶段）.')
