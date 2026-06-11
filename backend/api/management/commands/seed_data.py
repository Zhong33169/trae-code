import os
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import (
    User, MaterialChangeOrder, Attachment, AuditLog,
    Role, ChangeOrderStatus, AttachmentStatus, AuditAction
)


class Command(BaseCommand):
    help = 'Seed database with sample data including complete audit trails for all 4 order types'

    def handle(self, *args, **options):
        self.stdout.write('Seeding database with complete audit trails...')
        
        self._create_users()
        self._create_normal_order()
        self._create_missing_material_order()
        self._create_overdue_order()
        self._create_pure_overdue_order()
        self._create_returned_order()
        
        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))
        self.stdout.write('Sample orders:')
        for order in MaterialChangeOrder.objects.all():
            self.stdout.write(f'  {order.order_no}: {order.title} [{order.get_status_display()}] '
                            f'- {order.audit_logs.count()} audit logs')

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
        self.stdout.write('  ✅ 5 users created')

    def _create_attachment(self, order, user, file_name, status=AttachmentStatus.UPLOADED, reject_reason=None, rejected_by=None):
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
            rejected_by=rejected_by,
            rejected_at=timezone.now() - timedelta(days=1) if status == AttachmentStatus.REJECTED else None
        )
        return att

    def _audit(self, order, action, operator, reason='', detail=None):
        AuditLog.objects.create(
            order=order,
            action=action,
            operator=operator,
            reason=reason,
            detail=detail or {}
        )

    def _create_normal_order(self):
        """✅ 正常单：完整走完登记→审核→复核→归档全流程"""
        registrar = User.objects.get(username='registrar01')
        supervisor = User.objects.get(username='supervisor01')
        reviewer = User.objects.get(username='reviewer01')
        
        base_time = timezone.now() - timedelta(days=10)
        
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
            deadline=base_time + timedelta(days=7),
            submitted_at=base_time + timedelta(days=3),
            archived_at=base_time + timedelta(days=8),
            created_at=base_time
        )
        
        att1 = self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        att2 = self._create_attachment(order, registrar, '供应商技术通知.pdf', AttachmentStatus.APPROVED)
        att3 = self._create_attachment(order, registrar, 'BOM变更对比表.pdf', AttachmentStatus.APPROVED)
        
        self._audit(order, AuditAction.CREATED, registrar, 
            reason='登记员创建物料变更单：电阻阻值容差由±5%调整为±1%',
            detail={'order_no': order.order_no, 'material_code': order.material_code})
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「变更申请单.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「供应商技术通知.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「BOM变更对比表.pdf」')
        self._audit(order, AuditAction.SUBMITTED, registrar,
            reason=f'提交给 {supervisor.name} 审核办理，时限 7 天',
            detail={'supervisor': supervisor.name, 'deadline_days': 7})
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「变更申请单.pdf」核验通过，内容完整签字齐全')
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「供应商技术通知.pdf」核验通过，官方盖章有效')
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「BOM变更对比表.pdf」核验通过，变更项清晰准确')
        self._audit(order, AuditAction.APPROVED_SUPERVISOR, supervisor,
            reason='3个附件全部核验通过，变更原因合理，参数变更影响可控，已提交给陈复核复核',
            detail={'reviewer': reviewer.name, 'approved_count': 3, 'audit_remark': '附件齐全'})
        self._audit(order, AuditAction.APPROVED_FINAL, reviewer,
            reason='复核通过：变更流程合规、技术资料齐全、质量风险可控，予以正式归档',
            detail={'audit_remark': '变更合理，资料齐全，同意归档。'})
        
        self.stdout.write('  ✅ MCO-2026-0001 正常单 - 已归档 (10 audit logs)')

    def _create_missing_material_order(self):
        """⚠️ 缺材料单：审核主管退回，含被驳回附件"""
        registrar = User.objects.get(username='registrar02')
        supervisor = User.objects.get(username='supervisor01')
        
        base_time = timezone.now() - timedelta(days=5)
        
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
            supplement_note=None,
            is_overdue=False,
            deadline=base_time + timedelta(days=7),
            submitted_at=base_time + timedelta(days=2),
            created_at=base_time
        )
        
        att1 = self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        att2 = self._create_attachment(
            order, registrar, '初步方案说明.pdf',
            AttachmentStatus.REJECTED,
            reject_reason='此文档仅为初步说明，缺少正式的技术评估数据和签字确认，请重新提交正式版本。',
            rejected_by=supervisor
        )
        
        self._audit(order, AuditAction.CREATED, registrar,
            reason='登记员创建物料变更单：电容封装由0603变更为0402')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「变更申请单.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「初步方案说明.pdf」')
        self._audit(order, AuditAction.SUBMITTED, registrar,
            reason=f'提交给 {supervisor.name} 审核办理，时限 7 天')
        self._audit(order, AuditAction.ATTACHMENT_REJECTED, supervisor,
            reason='附件「初步方案说明.pdf」被驳回：此文档仅为初步说明，缺少正式的技术评估数据和签字确认，请重新提交正式版本。',
            detail={'attachment': '初步方案说明.pdf', 'reject_reason': '缺少正式技术评估数据和签字'})
        self._audit(order, AuditAction.REJECTED_SUPERVISOR, supervisor,
            reason='缺少：1.封装尺寸图纸；2.SMT贴片可行性评估报告；3.焊盘设计对比表。请补充后重新提交。',
            detail={'audit_remark': '核心技术资料缺失，退回补正。'})
        
        self.stdout.write('  ⚠️  MCO-2026-0002 缺材料单 - 需补正附件 (6 audit logs, 1 attachment rejected)')

    def _create_overdue_order(self):
        """⏰ 超时单：超时后被主管退回补正，完整展示超时→退回→补正链路"""
        registrar = User.objects.get(username='registrar01')
        supervisor = User.objects.get(username='supervisor02')
        
        base_time = timezone.now() - timedelta(days=20)
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0003',
            title='芯片型号替换（超时退回单）',
            material_code='IC-003-STM32F103',
            material_name='MCU STM32F103C8T6',
            change_type='型号替换',
            description='原芯片停产，替换为STM32F103CBT6，需审核资料是否齐全。',
            status=ChangeOrderStatus.SUPPLEMENT_REQUIRED,
            registrar=registrar,
            supervisor=supervisor,
            return_reason='超时后退回：缺少1.新旧芯片引脚兼容性测试报告；2.量产替代验证数据。请补充以上资料后重新提交。',
            audit_remark='本单超时15天未处理，现已退回补正。请登记员尽快补齐资料，避免影响生产计划。',
            is_overdue=False,
            deadline=base_time + timedelta(days=5),
            submitted_at=base_time + timedelta(days=3),
            created_at=base_time
        )
        
        att1 = self._create_attachment(order, registrar, '芯片停产通知.pdf', AttachmentStatus.APPROVED)
        att2 = self._create_attachment(
            order, registrar, '替代型号对比表.pdf',
            AttachmentStatus.REJECTED,
            reject_reason='对比表仅列出参数差异，缺少实际焊接测试数据和电气性能验证报告，请补充完整测试数据。',
            rejected_by=supervisor
        )
        
        self._audit(order, AuditAction.CREATED, registrar,
            reason='登记员创建物料变更单：原芯片停产，替换为STM32F103CBT6')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「芯片停产通知.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「替代型号对比表.pdf」')
        self._audit(order, AuditAction.SUBMITTED, registrar,
            reason=f'提交给 {supervisor.name} 审核办理，时限 5 天')
        self._audit(order, AuditAction.MARKED_OVERDUE, supervisor,
            reason=f'处理超时：超过5天审核时限未处理，原状态：待审核主管办理。请尽快跟进。',
            detail={'previous_status': ChangeOrderStatus.PENDING_REVIEW, 'days_overdue': 15})
        self._audit(order, AuditAction.OPERATION_FAILED, supervisor,
            reason='系统自动提醒：本单已超时15天未处理，影响生产计划安排',
            detail={'action': 'timeout_warning', 'overdue_days': 15})
        self._audit(order, AuditAction.ATTACHMENT_REJECTED, supervisor,
            reason='附件「替代型号对比表.pdf」被驳回：对比表仅列出参数差异，缺少实际焊接测试数据和电气性能验证报告，请补充完整测试数据。',
            detail={'attachment': '替代型号对比表.pdf', 'reject_reason': '缺少焊接测试和电气性能验证数据'})
        self._audit(order, AuditAction.REJECTED_SUPERVISOR, supervisor,
            reason='超时后退回：缺少1.新旧芯片引脚兼容性测试报告；2.量产替代验证数据。请补充以上资料后重新提交。',
            detail={'audit_remark': '本单超时15天未处理，现已退回补正。请登记员尽快补齐资料，避免影响生产计划。', 'is_overdue_cleared': True})
        
        self.stdout.write('  ⏰  MCO-2026-0003 超时退回单 - 需补正 (8 audit logs, 1 attachment rejected, overdue→returned flow)')

    def _create_returned_order(self):
        """❌ 退回单：复核阶段被退回，缺少可靠性测试数据"""
        registrar = User.objects.get(username='registrar02')
        supervisor = User.objects.get(username='supervisor01')
        reviewer = User.objects.get(username='reviewer01')
        
        base_time = timezone.now() - timedelta(days=12)
        
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
            deadline=base_time + timedelta(days=7),
            submitted_at=base_time + timedelta(days=2),
            created_at=base_time
        )
        
        att1 = self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.APPROVED)
        att2 = self._create_attachment(order, registrar, '板材规格书.pdf', AttachmentStatus.APPROVED)
        att3 = self._create_attachment(order, registrar, '供应商资质.pdf', AttachmentStatus.APPROVED)
        
        self._audit(order, AuditAction.CREATED, registrar,
            reason='登记员创建物料变更单：PCB板材由TG130升级为TG150')
        self._audit(order, AuditAction.UPDATED, registrar,
            reason='更新了变更说明，补充了耐高温性能提升的具体参数',
            detail={'changes': {'description': {'old': '旧描述', 'new': '新描述'}}})
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「变更申请单.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「板材规格书.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「供应商资质.pdf」')
        self._audit(order, AuditAction.SUBMITTED, registrar,
            reason=f'提交给 {supervisor.name} 审核办理，时限 7 天')
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「变更申请单.pdf」核验通过')
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「板材规格书.pdf」核验通过')
        self._audit(order, AuditAction.ATTACHMENT_APPROVED, supervisor,
            reason='附件「供应商资质.pdf」核验通过')
        self._audit(order, AuditAction.APPROVED_SUPERVISOR, supervisor,
            reason='资料基本齐全，板材升级方向正确，已提交给陈复核做最终复核',
            detail={'reviewer': reviewer.name, 'approved_count': 3})
        self._audit(order, AuditAction.OPERATION_FAILED, reviewer,
            reason='预审发现潜在问题：缺少可靠性测试数据和成本评估，准备退回',
            detail={'action': 'pre_review_check', 'issues': ['缺少可靠性测试报告', '缺少成本评估']})
        self._audit(order, AuditAction.REJECTED_FINAL, reviewer,
            reason='复核退回：缺少可靠性测试报告（高温高湿、热循环测试数据），且未说明成本影响评估。请补充可靠性试验报告及成本分析后重新走流程。',
            detail={'audit_remark': '升级方向正确但验证数据不充分，成本影响未评估。'})
        
        self.stdout.write('  ❌  MCO-2026-0004 退回单 - 已退回 (12 audit logs, with failure record)')

    def _create_pure_overdue_order(self):
        """⏰ 纯超时单：当前仍为超时状态，可用于演示主管退回链路"""
        registrar = User.objects.get(username='registrar02')
        supervisor = User.objects.get(username='supervisor01')
        
        base_time = timezone.now() - timedelta(days=15)
        
        order = MaterialChangeOrder.objects.create(
            order_no='MCO-2026-0005',
            title='二极管规格升级（纯超时单）',
            material_code='DIO-005-1N4007',
            material_name='整流二极管 1N4007',
            change_type='规格升级',
            description='将普通二极管升级为快恢复二极管，提升开关性能。',
            status=ChangeOrderStatus.OVERDUE,
            registrar=registrar,
            supervisor=supervisor,
            is_overdue=True,
            deadline=base_time + timedelta(days=5),
            submitted_at=base_time + timedelta(days=2),
            created_at=base_time
        )
        
        att1 = self._create_attachment(order, registrar, '变更申请单.pdf', AttachmentStatus.UPLOADED)
        att2 = self._create_attachment(order, registrar, '器件规格书.pdf', AttachmentStatus.UPLOADED)
        
        self._audit(order, AuditAction.CREATED, registrar,
            reason='登记员创建物料变更单：将普通二极管升级为快恢复二极管')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「变更申请单.pdf」')
        self._audit(order, AuditAction.ATTACHMENT_UPLOADED, registrar,
            reason='上传附件「器件规格书.pdf」')
        self._audit(order, AuditAction.SUBMITTED, registrar,
            reason=f'提交给 {supervisor.name} 审核办理，时限 5 天')
        self._audit(order, AuditAction.MARKED_OVERDUE, supervisor,
            reason=f'处理超时：超过5天审核时限未处理，原状态：待审核主管办理。请尽快跟进。',
            detail={'previous_status': ChangeOrderStatus.PENDING_REVIEW, 'days_overdue': 8})
        self._audit(order, AuditAction.OPERATION_FAILED, supervisor,
            reason='系统自动提醒：本单已超时8天未处理，影响试产计划',
            detail={'action': 'timeout_warning', 'overdue_days': 8})
        
        self.stdout.write('  ⏰  MCO-2026-0005 纯超时单 - 已超时 (6 audit logs, 可演示主管退回链路)')
