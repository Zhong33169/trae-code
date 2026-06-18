from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone

from apps.loan.models import (
    Role,
    UserProfile,
    ExtensionApplication,
    RepaymentPlan,
    Material,
    AuditLog,
)


class Command(BaseCommand):
    help = '初始化演示数据'

    def handle(self, *args, **options):
        self.stdout.write('开始初始化演示数据...')

        self._create_roles()
        self._create_users()
        self._create_applications()

        self.stdout.write(self.style.SUCCESS('演示数据初始化完成！'))
        self.stdout.write('登录账号：')
        self.stdout.write('  - 展期登记员: zhangsan')
        self.stdout.write('  - 展期审核主管: lisi')
        self.stdout.write('  - 小贷公司复核负责人: wangwu')
        self.stdout.write('  - 系统管理员: admin')

    def _create_roles(self):
        roles = [
            {'code': 'registrar', 'name': '展期登记员', 'description': '负责发起和补正展期申请'},
            {'code': 'reviewer', 'name': '展期审核主管', 'description': '负责审核展期申请'},
            {'code': 'final_reviewer', 'name': '小贷公司复核负责人', 'description': '负责复核和归档展期申请'},
            {'code': 'admin', 'name': '系统管理员', 'description': '系统管理员，拥有所有权限'},
        ]

        for role_data in roles:
            role, created = Role.objects.get_or_create(
                code=role_data['code'],
                defaults={
                    'name': role_data['name'],
                    'description': role_data['description'],
                }
            )
            if created:
                self.stdout.write(f'  创建角色: {role.name}')

    def _create_users(self):
        users = [
            {'username': 'zhangsan', 'role': 'registrar', 'department': '业务一部', 'phone': '13800138001'},
            {'username': 'lisi', 'role': 'reviewer', 'department': '风控部', 'phone': '13800138002'},
            {'username': 'wangwu', 'role': 'final_reviewer', 'department': '小贷公司', 'phone': '13800138003'},
            {'username': 'admin', 'role': 'admin', 'department': '技术部', 'phone': '13800138000'},
        ]

        for user_data in users:
            user, created = User.objects.get_or_create(
                username=user_data['username'],
                defaults={
                    'is_active': True,
                    'is_staff': True,
                }
            )
            if created:
                self.stdout.write(f'  创建用户: {user.username}')

            role = Role.objects.get(code=user_data['role'])
            UserProfile.objects.update_or_create(
                user=user,
                defaults={
                    'role': role,
                    'phone': user_data['phone'],
                    'department': user_data['department'],
                }
            )

    def _create_applications(self):
        registrar = User.objects.get(username='zhangsan')
        reviewer = User.objects.get(username='lisi')
        final_reviewer = User.objects.get(username='wangwu')

        demo_data = [
            {
                'application_no': 'EA20250101000001',
                'qr_code': 'QRDEMO0000000001',
                'borrower_name': '赵小明',
                'borrower_id_card': '110101199001011234',
                'borrower_phone': '13900139001',
                'loan_contract_no': 'JK2024120001',
                'original_principal': Decimal('50000.00'),
                'original_interest_rate': Decimal('12.00'),
                'original_due_date': date(2025, 1, 15),
                'extension_days': 30,
                'extension_reason': '春节前资金周转困难，申请展期30天',
                'status': ExtensionApplication.STATUS_DRAFT,
                'current_handler_role': 'registrar',
                'registrar': registrar,
                'is_urgent': True,
                'materials_verified': False,
            },
            {
                'application_no': 'EA20250102000002',
                'qr_code': 'QRDEMO0000000002',
                'borrower_name': '钱小红',
                'borrower_id_card': '310101199203045678',
                'borrower_phone': '13900139002',
                'loan_contract_no': 'JK2024120002',
                'original_principal': Decimal('100000.00'),
                'original_interest_rate': Decimal('10.00'),
                'original_due_date': date(2025, 1, 20),
                'extension_days': 60,
                'extension_reason': '工程款回收延迟，申请展期60天',
                'status': ExtensionApplication.STATUS_PENDING_REVIEW,
                'current_handler_role': 'reviewer',
                'registrar': registrar,
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250103000003',
                'qr_code': 'QRDEMO0000000003',
                'borrower_name': '孙大伟',
                'borrower_id_card': '440101198506078901',
                'borrower_phone': '13900139003',
                'loan_contract_no': 'JK2024120003',
                'original_principal': Decimal('200000.00'),
                'original_interest_rate': Decimal('11.50'),
                'original_due_date': date(2025, 1, 10),
                'extension_days': 45,
                'extension_reason': '经营资金周转紧张，申请展期45天',
                'status': ExtensionApplication.STATUS_REVIEW_APPROVED,
                'current_handler_role': 'final_reviewer',
                'registrar': registrar,
                'reviewer': reviewer,
                'review_opinion': '材料齐全，情况属实，同意展期。建议利率上浮至12%。',
                'new_interest_rate': Decimal('12.00'),
                'is_urgent': True,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250104000004',
                'qr_code': 'QRDEMO0000000004',
                'borrower_name': '李美丽',
                'borrower_id_card': '510101198809102345',
                'borrower_phone': '13900139004',
                'loan_contract_no': 'JK2024120004',
                'original_principal': Decimal('80000.00'),
                'original_interest_rate': Decimal('9.50'),
                'original_due_date': date(2025, 2, 1),
                'extension_days': 30,
                'extension_reason': '工资发放延迟，申请展期30天',
                'status': ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION,
                'current_handler_role': 'registrar',
                'registrar': registrar,
                'reviewer': reviewer,
                'review_opinion': '收入证明材料不清晰，请重新提交清晰的收入证明。',
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250105000005',
                'qr_code': 'QRDEMO0000000005',
                'borrower_name': '周建国',
                'borrower_id_card': '330101197512156789',
                'borrower_phone': '13900139005',
                'loan_contract_no': 'JK2024120005',
                'original_principal': Decimal('150000.00'),
                'original_interest_rate': Decimal('10.80'),
                'original_due_date': date(2024, 12, 30),
                'extension_days': 90,
                'extension_reason': '企业经营困难，申请展期90天',
                'status': ExtensionApplication.STATUS_FINAL_APPROVED,
                'current_handler_role': 'final_reviewer',
                'registrar': registrar,
                'reviewer': reviewer,
                'final_reviewer': final_reviewer,
                'review_opinion': '情况属实，同意展期',
                'final_review_opinion': '复核通过，同意展期90天',
                'new_interest_rate': Decimal('11.50'),
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250106000006',
                'qr_code': 'QRDEMO0000000006',
                'borrower_name': '吴海涛',
                'borrower_id_card': '320101198205203456',
                'borrower_phone': '13900139006',
                'loan_contract_no': 'JK2024120006',
                'original_principal': Decimal('300000.00'),
                'original_interest_rate': Decimal('12.50'),
                'original_due_date': date(2024, 11, 30),
                'extension_days': 60,
                'extension_reason': '投资项目回款延迟，申请展期',
                'status': ExtensionApplication.STATUS_REJECTED,
                'current_handler_role': '',
                'registrar': registrar,
                'reviewer': reviewer,
                'final_reviewer': final_reviewer,
                'review_opinion': '材料基本齐全，建议复核',
                'final_review_opinion': '风险较高，不符合展期条件，拒绝申请',
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250107000007',
                'qr_code': 'QRDEMO0000000007',
                'borrower_name': '郑小芳',
                'borrower_id_card': '420101199007084567',
                'borrower_phone': '13900139007',
                'loan_contract_no': 'JK2024120007',
                'original_principal': Decimal('60000.00'),
                'original_interest_rate': Decimal('9.00'),
                'original_due_date': date(2024, 10, 15),
                'extension_days': 30,
                'extension_reason': '个人消费贷款，因收入延迟申请展期',
                'status': ExtensionApplication.STATUS_ARCHIVED,
                'current_handler_role': '',
                'registrar': registrar,
                'reviewer': reviewer,
                'final_reviewer': final_reviewer,
                'review_opinion': '同意展期',
                'final_review_opinion': '复核通过',
                'new_interest_rate': Decimal('9.50'),
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250108000008',
                'qr_code': 'QRDEMO0000000008',
                'borrower_name': '陈志强',
                'borrower_id_card': '350101198711125678',
                'borrower_phone': '13900139008',
                'loan_contract_no': 'JK2024120008',
                'original_principal': Decimal('250000.00'),
                'original_interest_rate': Decimal('11.00'),
                'original_due_date': date(2025, 1, 25),
                'extension_days': 50,
                'extension_reason': '店铺装修，资金周转困难',
                'status': ExtensionApplication.STATUS_PENDING_REVIEW,
                'current_handler_role': 'reviewer',
                'registrar': registrar,
                'is_urgent': True,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250109000009',
                'qr_code': 'QRDEMO0000000009',
                'borrower_name': '黄丽华',
                'borrower_id_card': '500101199303156789',
                'borrower_phone': '13900139009',
                'loan_contract_no': 'JK2024120009',
                'original_principal': Decimal('75000.00'),
                'original_interest_rate': Decimal('10.50'),
                'original_due_date': date(2025, 2, 10),
                'extension_days': 40,
                'extension_reason': '教育支出较大，申请展期',
                'status': ExtensionApplication.STATUS_PENDING_REVIEW,
                'current_handler_role': 'reviewer',
                'registrar': registrar,
                'is_urgent': False,
                'materials_verified': True,
            },
            {
                'application_no': 'EA20250110000010',
                'qr_code': 'QRDEMO0000000010',
                'borrower_name': '刘建华',
                'borrower_id_card': '210101197809207890',
                'borrower_phone': '13900139010',
                'loan_contract_no': 'JK2024120010',
                'original_principal': Decimal('180000.00'),
                'original_interest_rate': Decimal('11.20'),
                'original_due_date': date(2025, 1, 30),
                'extension_days': 55,
                'extension_reason': '物流行业旺季，资金占用大',
                'status': ExtensionApplication.STATUS_REVIEW_APPROVED,
                'current_handler_role': 'final_reviewer',
                'registrar': registrar,
                'reviewer': reviewer,
                'review_opinion': '经营情况良好，同意展期',
                'is_urgent': False,
                'materials_verified': True,
            },
        ]

        material_types = [
            {'type': Material.MATERIAL_TYPE_ID_CARD, 'name': '借款人身份证'},
            {'type': Material.MATERIAL_TYPE_LOAN_CONTRACT, 'name': '原借款合同'},
            {'type': Material.MATERIAL_TYPE_EXTENSION_AGREEMENT, 'name': '展期协议'},
            {'type': Material.MATERIAL_TYPE_INCOME_PROOF, 'name': '收入证明'},
            {'type': Material.MATERIAL_TYPE_SITE_PHOTO, 'name': '现场核验照片'},
        ]

        for data in demo_data:
            app, created = ExtensionApplication.objects.get_or_create(
                application_no=data['application_no'],
                defaults={
                    'qr_code': data['qr_code'],
                    'borrower_name': data['borrower_name'],
                    'borrower_id_card': data['borrower_id_card'],
                    'borrower_phone': data['borrower_phone'],
                    'loan_contract_no': data['loan_contract_no'],
                    'original_principal': data['original_principal'],
                    'original_interest_rate': data['original_interest_rate'],
                    'original_due_date': data['original_due_date'],
                    'extension_days': data['extension_days'],
                    'extension_reason': data['extension_reason'],
                    'new_due_date': data['original_due_date'] + timedelta(days=data['extension_days']),
                    'new_interest_rate': data.get('new_interest_rate'),
                    'status': data['status'],
                    'current_handler_role': data['current_handler_role'],
                    'registrar': data['registrar'],
                    'reviewer': data.get('reviewer'),
                    'final_reviewer': data.get('final_reviewer'),
                    'review_opinion': data.get('review_opinion', ''),
                    'final_review_opinion': data.get('final_review_opinion', ''),
                    'is_urgent': data['is_urgent'],
                }
            )
            if created:
                self.stdout.write(f'  创建申请: {app.application_no} - {app.borrower_name} ({app.get_status_display()})')

            if not app.repayment_plans.exists():
                daily_rate = app.original_interest_rate / Decimal('360') / Decimal('100')
                interest = app.original_principal * daily_rate * Decimal(app.extension_days)
                RepaymentPlan.objects.create(
                    application=app,
                    plan_no=1,
                    due_date=app.new_due_date,
                    principal=app.original_principal,
                    interest=interest,
                    total_amount=app.original_principal + interest,
                    is_extension_period=True,
                )

            if not app.materials.exists():
                for mat in material_types:
                    Material.objects.create(
                        application=app,
                        material_type=mat['type'],
                        material_name=mat['name'],
                        is_required=True,
                        is_verified=data['materials_verified'],
                        verified_by=data['registrar'] if data['materials_verified'] else None,
                        verified_at=timezone.now() if data['materials_verified'] else None,
                    )

            if not app.audit_logs.exists():
                AuditLog.objects.create(
                    application=app,
                    operator=data['registrar'],
                    action='create',
                    action_detail='创建展期申请',
                    old_status='',
                    new_status=ExtensionApplication.STATUS_DRAFT,
                    created_at=timezone.now() - timedelta(days=3),
                )
                if data['status'] != ExtensionApplication.STATUS_DRAFT:
                    AuditLog.objects.create(
                        application=app,
                        operator=data['registrar'],
                        action='submit',
                        action_detail='提交审核',
                        old_status=ExtensionApplication.STATUS_DRAFT,
                        new_status=ExtensionApplication.STATUS_PENDING_REVIEW,
                        created_at=timezone.now() - timedelta(days=2),
                    )
                if data.get('reviewer'):
                    action_detail = '审核通过' if data['status'] in [
                        ExtensionApplication.STATUS_REVIEW_APPROVED,
                        ExtensionApplication.STATUS_FINAL_APPROVED,
                        ExtensionApplication.STATUS_REJECTED,
                        ExtensionApplication.STATUS_ARCHIVED,
                    ] else '审核退回'
                    AuditLog.objects.create(
                        application=app,
                        operator=data['reviewer'],
                        action='review',
                        action_detail=action_detail,
                        old_status=ExtensionApplication.STATUS_PENDING_REVIEW,
                        new_status=data['status'] if data['status'] in [
                            ExtensionApplication.STATUS_REVIEW_APPROVED,
                            ExtensionApplication.STATUS_RETURNED_FOR_CORRECTION,
                        ] else ExtensionApplication.STATUS_REVIEW_APPROVED,
                        remark=data.get('review_opinion', ''),
                        created_at=timezone.now() - timedelta(days=1),
                    )
                if data.get('final_reviewer'):
                    action_detail = '复核通过' if data['status'] in [
                        ExtensionApplication.STATUS_FINAL_APPROVED,
                        ExtensionApplication.STATUS_ARCHIVED,
                    ] else '复核拒绝'
                    old_status = ExtensionApplication.STATUS_REVIEW_APPROVED
                    new_status = data['status'] if data['status'] in [
                        ExtensionApplication.STATUS_FINAL_APPROVED,
                        ExtensionApplication.STATUS_REJECTED,
                    ] else ExtensionApplication.STATUS_FINAL_APPROVED
                    AuditLog.objects.create(
                        application=app,
                        operator=data['final_reviewer'],
                        action='final_review',
                        action_detail=action_detail,
                        old_status=old_status,
                        new_status=new_status,
                        remark=data.get('final_review_opinion', ''),
                        created_at=timezone.now() - timedelta(hours=12),
                    )
                if data['status'] == ExtensionApplication.STATUS_ARCHIVED:
                    AuditLog.objects.create(
                        application=app,
                        operator=data['final_reviewer'],
                        action='archive',
                        action_detail='归档完成',
                        old_status=ExtensionApplication.STATUS_FINAL_APPROVED,
                        new_status=ExtensionApplication.STATUS_ARCHIVED,
                        created_at=timezone.now() - timedelta(hours=6),
                    )
