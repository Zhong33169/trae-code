from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta

from reservations.models import (
    UserProfile,
    LabReservation,
    Evidence,
    SupplementaryRecord,
    AuditLog,
)


class Command(BaseCommand):
    help = '初始化演示数据：创建用户和测试预约单'

    def handle(self, *args, **options):
        self.stdout.write('开始初始化数据...')

        self._create_users()
        self._create_reservations()

        self.stdout.write(self.style.SUCCESS('数据初始化完成！'))

    def _create_users(self):
        self.stdout.write('创建用户账号...')

        users_data = [
            {
                'username': 'ta_wang',
                'password': '123456',
                'role': UserProfile.ROLE_TA,
                'first_name': '王',
                'last_name': '助教',
                'department': '计算机学院',
            },
            {
                'username': 'ta_li',
                'password': '123456',
                'role': UserProfile.ROLE_TA,
                'first_name': '李',
                'last_name': '助教',
                'department': '物理学院',
            },
            {
                'username': 'labadmin_zhang',
                'password': '123456',
                'role': UserProfile.ROLE_LAB_ADMIN,
                'first_name': '张',
                'last_name': '管理员',
                'department': '实验中心',
            },
            {
                'username': 'labadmin_liu',
                'password': '123456',
                'role': UserProfile.ROLE_LAB_ADMIN,
                'first_name': '刘',
                'last_name': '管理员',
                'department': '实验中心',
            },
            {
                'username': 'college_chen',
                'password': '123456',
                'role': UserProfile.ROLE_COLLEGE_HEAD,
                'first_name': '陈',
                'last_name': '主任',
                'department': '计算机学院',
            },
            {
                'username': 'college_zhao',
                'password': '123456',
                'role': UserProfile.ROLE_COLLEGE_HEAD,
                'first_name': '赵',
                'last_name': '院长',
                'department': '物理学院',
            },
        ]

        for data in users_data:
            if not User.objects.filter(username=data['username']).exists():
                user = User.objects.create_user(
                    username=data['username'],
                    password=data['password'],
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                )
                UserProfile.objects.create(
                    user=user,
                    role=data['role'],
                    department=data['department'],
                )
                self.stdout.write(f'  创建用户: {data["username"]} ({data["role"]})')
            else:
                self.stdout.write(f'  用户已存在: {data["username"]}')

    def _create_reservations(self):
        self.stdout.write('创建测试预约单...')

        ta_wang = User.objects.get(username='ta_wang')
        ta_li = User.objects.get(username='ta_li')
        labadmin_zhang = User.objects.get(username='labadmin_zhang')
        college_chen = User.objects.get(username='college_chen')

        now = timezone.now()

        if LabReservation.objects.exists():
            self.stdout.write('  预约单已存在，跳过创建')
            return

        reservations_data = [
            {
                'no': 'LAB202506010001',
                'title': '操作系统实验 - 进程调度模拟',
                'lab': '计算机实验室A301',
                'course': '操作系统',
                'experiment': '进程调度算法模拟实验',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=3),
                'end': now + timedelta(days=3, hours=2),
                'students': 45,
                'status': LabReservation.STATUS_DRAFT,
                'has_plan': True,
                'has_material': False,
                'has_safety': False,
                'description': '草稿状态，缺少耗材申领和安全确认',
                'add_evidence': ['experiment_plan'],
            },
            {
                'no': 'LAB202506010002',
                'title': '数据结构实验 - 二叉树遍历',
                'lab': '计算机实验室A302',
                'course': '数据结构',
                'experiment': '二叉树的三种遍历方式',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=2),
                'end': now + timedelta(days=2, hours=3),
                'students': 50,
                'status': LabReservation.STATUS_SUBMITTED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '已提交待实验室审核，证据齐全',
                'submitted': True,
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010003',
                'title': '物理实验 - 光栅衍射',
                'lab': '物理实验室B105',
                'course': '大学物理',
                'experiment': '光栅衍射测光波波长',
                'applicant': ta_li,
                'dept': '物理学院',
                'start': now + timedelta(days=5),
                'end': now + timedelta(days=5, hours=2),
                'students': 40,
                'status': LabReservation.STATUS_SUBMITTED,
                'has_plan': True,
                'has_material': False,
                'has_safety': True,
                'description': '已提交但缺少耗材申领单，用于测试证据不足拦截',
                'submitted': True,
                'add_evidence': ['experiment_plan', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010004',
                'title': '计算机网络实验 - TCP协议分析',
                'lab': '计算机实验室A303',
                'course': '计算机网络',
                'experiment': 'TCP三次握手与流量控制',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now - timedelta(days=1),
                'end': now - timedelta(days=1, hours=2),
                'students': 48,
                'status': LabReservation.STATUS_LAB_REVIEWED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '实验室已审核通过，待学院确认',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_zhang,
                'review_comment': '实验方案合理，设备可用',
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010005',
                'title': '数据库实验 - 索引优化',
                'lab': '计算机实验室A301',
                'course': '数据库原理',
                'experiment': 'B+树索引与查询优化',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=7),
                'end': now + timedelta(days=7, hours=2),
                'students': 45,
                'status': LabReservation.STATUS_CONFIRMED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '已完成全部审批流程的预约单',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_zhang,
                'review_comment': '材料齐全，同意',
                'college_confirmed': True,
                'confirmer': college_chen,
                'confirm_comment': '学院确认通过',
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010006',
                'title': '编译原理实验 - 词法分析器',
                'lab': '计算机实验室A302',
                'course': '编译原理',
                'experiment': '基于DFA的词法分析器实现',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=4),
                'end': now + timedelta(days=4, hours=3),
                'students': 42,
                'status': LabReservation.STATUS_LAB_REJECTED,
                'has_plan': True,
                'has_material': False,
                'has_safety': True,
                'description': '被实验室退回的预约单（缺少耗材申领），测试补录后重提',
                'submitted': True,
                'lab_rejected': True,
                'rejector': labadmin_zhang,
                'rejection_reason': '缺少耗材申领单，请补充相关材料后重新提交',
                'add_evidence': ['experiment_plan', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010007',
                'title': '软件工程实验 - 需求分析',
                'lab': '计算机实验室A303',
                'course': '软件工程',
                'experiment': '软件需求规格说明书编写',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=6),
                'end': now + timedelta(days=6, hours=2),
                'students': 46,
                'status': LabReservation.STATUS_LAB_REVIEWED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '有补录记录的预约单 - 最初缺安全确认，补录后通过',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_zhang,
                'review_comment': '补录材料齐全，审核通过',
                'add_evidence': ['experiment_plan', 'material_application'],
                'has_supplementary': True,
                'supplement_type': 'safety_confirmation',
                'supplement_title': '安全确认书（补录版）',
            },
            {
                'no': 'LAB202506010008',
                'title': '人工智能实验 - 神经网络入门',
                'lab': '计算机实验室A304',
                'course': '人工智能导论',
                'experiment': '单层感知机与BP神经网络',
                'applicant': ta_li,
                'dept': '物理学院',
                'start': now + timedelta(days=10),
                'end': now + timedelta(days=10, hours=4),
                'students': 35,
                'status': LabReservation.STATUS_DRAFT,
                'has_plan': False,
                'has_material': False,
                'has_safety': False,
                'description': '完全空白的草稿，测试各种缺证据场景',
                'add_evidence': [],
            },
            {
                'no': 'LAB202506010009',
                'title': '数字电路实验 - 触发器设计',
                'lab': '电子实验室C201',
                'course': '数字逻辑与电路',
                'experiment': 'JK触发器与D触发器设计',
                'applicant': ta_li,
                'dept': '物理学院',
                'start': now + timedelta(days=8),
                'end': now + timedelta(days=8, hours=3),
                'students': 38,
                'status': LabReservation.STATUS_COLLEGE_REJECTED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '学院退回的预约单 - 实验时间与学院活动冲突',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_liu,
                'review_comment': '设备可用，同意',
                'college_rejected': True,
                'rejector': college_zhao,
                'rejection_reason': '实验时间与学院年度学术报告冲突，请调整时间后重新提交',
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010010',
                'title': '微机原理实验 - 中断系统',
                'lab': '计算机实验室A305',
                'course': '微机原理与接口技术',
                'experiment': '8259A中断控制器实验',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=9),
                'end': now + timedelta(days=9, hours=2),
                'students': 44,
                'status': LabReservation.STATUS_LAB_REVIEWED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '刘管理员审核通过，待赵院长确认 - 跨学院审批场景',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_liu,
                'review_comment': '实验方案合理，设备齐全',
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
            {
                'no': 'LAB202506010011',
                'title': '计算机组成原理实验 - 流水线设计',
                'lab': '计算机实验室A302',
                'course': '计算机组成原理',
                'experiment': '五级流水线CPU设计',
                'applicant': ta_wang,
                'dept': '计算机学院',
                'start': now + timedelta(days=12),
                'end': now + timedelta(days=12, hours=4),
                'students': 40,
                'status': LabReservation.STATUS_CONFIRMED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '完整流程：提交→退回→补录→再提交→审核→确认 - 多角色连续办理',
                'submitted': True,
                'lab_reviewed': True,
                'reviewer': labadmin_zhang,
                'review_comment': '补录材料齐全，同意通过',
                'college_confirmed': True,
                'confirmer': college_chen,
                'confirm_comment': '学院确认通过，请按计划开展实验',
                'add_evidence': ['experiment_plan'],
                'has_supplementary': True,
                'supplement_type': 'material_application',
                'supplement_title': '耗材申领单（补录版）',
                'has_second_supplementary': True,
                'second_supplement_type': 'safety_confirmation',
                'second_supplement_title': '安全确认书（补录版）',
                'was_lab_rejected': True,
                'first_rejection_reason': '缺少耗材申领单和安全确认书，两项证据缺失',
            },
            {
                'no': 'LAB202506010012',
                'title': '嵌入式系统实验 - GPIO编程',
                'lab': '嵌入式实验室D101',
                'course': '嵌入式系统开发',
                'experiment': 'STM32 GPIO输入输出实验',
                'applicant': ta_li,
                'dept': '物理学院',
                'start': now + timedelta(days=11),
                'end': now + timedelta(days=11, hours=3),
                'students': 32,
                'status': LabReservation.STATUS_SUBMITTED,
                'has_plan': True,
                'has_material': True,
                'has_safety': True,
                'description': '刘管理员待审核 - 多管理员场景',
                'submitted': True,
                'add_evidence': ['experiment_plan', 'material_application', 'safety_confirmation'],
            },
        ]

        for data in reservations_data:
            reservation = LabReservation.objects.create(
                reservation_no=data['no'],
                title=data['title'],
                lab_name=data['lab'],
                course_name=data['course'],
                experiment_name=data['experiment'],
                applicant=data['applicant'],
                department=data['dept'],
                start_time=data['start'],
                end_time=data['end'],
                student_count=data['students'],
                status=data['status'],
                version=1,
                has_experiment_plan=data['has_plan'],
                has_material_application=data['has_material'],
                has_safety_confirmation=data['has_safety'],
            )

            AuditLog.objects.create(
                reservation=reservation,
                action=AuditLog.ACTION_CREATE,
                actor=data['applicant'],
                comment='创建预约单',
                previous_status='',
                new_status=LabReservation.STATUS_DRAFT,
            )

            evidence_type_map = {
                'experiment_plan': ('实验预约方案', '实验方案文档.pdf'),
                'material_application': ('耗材申领单', '耗材申领表.xlsx'),
                'safety_confirmation': ('安全确认书', '安全责任确认书.pdf'),
            }

            version_counter = 1
            for ev_type in data.get('add_evidence', []):
                ev_title, ev_file = evidence_type_map[ev_type]
                Evidence.objects.create(
                    reservation=reservation,
                    evidence_type=ev_type,
                    title=ev_title,
                    file_name=ev_file,
                    file_url=f'/uploads/{reservation.reservation_no}/{ev_file}',
                    description=f'{data["description"]} - {ev_title}',
                    uploaded_by=data['applicant'],
                    version=version_counter,
                    is_supplementary=False,
                )
                version_counter += 1

            if data.get('submitted'):
                reservation.submitted_at = data['start'] - timedelta(days=2)
                reservation.version += 1
                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_SUBMIT,
                    actor=data['applicant'],
                    comment='提交预约单',
                    previous_status=LabReservation.STATUS_DRAFT,
                    new_status=LabReservation.STATUS_SUBMITTED,
                )

            if data.get('lab_reviewed'):
                reservation.lab_reviewed_at = data['start'] - timedelta(days=1)
                reservation.lab_reviewer = data['reviewer']
                reservation.lab_review_comment = data.get('review_comment', '')
                reservation.version += 1
                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_LAB_REVIEW_PASS,
                    actor=data['reviewer'],
                    comment=data.get('review_comment', ''),
                    previous_status=LabReservation.STATUS_SUBMITTED,
                    new_status=LabReservation.STATUS_LAB_REVIEWED,
                    reason='材料齐全，审核通过',
                )

            if data.get('lab_rejected'):
                reservation.rejection_reason = data.get('rejection_reason', '')
                reservation.rejected_by = data.get('rejector')
                reservation.rejected_at = data['start'] - timedelta(days=1)
                reservation.version += 1
                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_LAB_REJECT,
                    actor=data['rejector'],
                    comment=data.get('rejection_reason', ''),
                    previous_status=LabReservation.STATUS_SUBMITTED,
                    new_status=LabReservation.STATUS_LAB_REJECTED,
                    reason=data.get('rejection_reason', ''),
                )

            if data.get('college_confirmed'):
                reservation.confirmed_at = data['start'] - timedelta(hours=12)
                reservation.confirmer = data['confirmer']
                reservation.confirm_comment = data.get('confirm_comment', '')
                reservation.version += 1
                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_COLLEGE_CONFIRM,
                    actor=data['confirmer'],
                    comment=data.get('confirm_comment', ''),
                    previous_status=LabReservation.STATUS_LAB_REVIEWED,
                    new_status=LabReservation.STATUS_CONFIRMED,
                    reason='学院确认通过',
                )

            if data.get('college_rejected'):
                reservation.rejection_reason = data.get('rejection_reason', '')
                reservation.rejected_by = data.get('rejector')
                reservation.rejected_at = data['start'] - timedelta(hours=6)
                reservation.version += 1
                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_COLLEGE_REJECT,
                    actor=data['rejector'],
                    comment=data.get('rejection_reason', ''),
                    previous_status=LabReservation.STATUS_LAB_REVIEWED,
                    new_status=LabReservation.STATUS_COLLEGE_REJECTED,
                    reason=data.get('rejection_reason', ''),
                )

            if data.get('has_supplementary'):
                supplement_type = data.get('supplement_type', 'safety_confirmation')
                ev_title, ev_file = evidence_type_map[supplement_type]
                supp_title = data.get('supplement_title', f'补录-{ev_title}')

                evidence = Evidence.objects.create(
                    reservation=reservation,
                    evidence_type=supplement_type,
                    title=supp_title,
                    file_name=f'supplementary_{ev_file}',
                    file_url=f'/uploads/{reservation.reservation_no}/supplementary_{ev_file}',
                    description=f'补录的{ev_title}，因初次提交缺少此材料',
                    uploaded_by=data['applicant'],
                    version=2,
                    is_supplementary=True,
                )

                if supplement_type == 'experiment_plan':
                    reservation.has_experiment_plan = True
                elif supplement_type == 'material_application':
                    reservation.has_material_application = True
                elif supplement_type == 'safety_confirmation':
                    reservation.has_safety_confirmation = True

                reservation.version += 1
                reservation.save()

                SupplementaryRecord.objects.create(
                    reservation=reservation,
                    action=SupplementaryRecord.ACTION_ADD_EVIDENCE,
                    description=f'补充{ev_title}：{supp_title}',
                    supplementer=data['applicant'],
                    previous_status=reservation.status,
                    new_status=reservation.status,
                    related_evidence=evidence,
                )

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_SUPPLEMENT,
                    actor=data['applicant'],
                    comment=f'补录{ev_title}',
                    previous_status=reservation.status,
                    new_status=reservation.status,
                    reason=f'补充证据材料：{supp_title}',
                )

            if data.get('has_second_supplementary'):
                second_type = data.get('second_supplement_type', 'safety_confirmation')
                ev_title2, ev_file2 = evidence_type_map[second_type]
                supp_title2 = data.get('second_supplement_title', f'补录-{ev_title2}')

                evidence2 = Evidence.objects.create(
                    reservation=reservation,
                    evidence_type=second_type,
                    title=supp_title2,
                    file_name=f'supplementary_v2_{ev_file2}',
                    file_url=f'/uploads/{reservation.reservation_no}/supplementary_v2_{ev_file2}',
                    description=f'第二次补录的{ev_title2}，继续完善材料',
                    uploaded_by=data['applicant'],
                    version=3,
                    is_supplementary=True,
                )

                if second_type == 'experiment_plan':
                    reservation.has_experiment_plan = True
                elif second_type == 'material_application':
                    reservation.has_material_application = True
                elif second_type == 'safety_confirmation':
                    reservation.has_safety_confirmation = True

                reservation.version += 1
                reservation.save()

                SupplementaryRecord.objects.create(
                    reservation=reservation,
                    action=SupplementaryRecord.ACTION_ADD_EVIDENCE,
                    description=f'补充{ev_title2}：{supp_title2}',
                    supplementer=data['applicant'],
                    previous_status=reservation.status,
                    new_status=reservation.status,
                    related_evidence=evidence2,
                )

                AuditLog.objects.create(
                    reservation=reservation,
                    action=AuditLog.ACTION_SUPPLEMENT,
                    actor=data['applicant'],
                    comment=f'补录{ev_title2}',
                    previous_status=reservation.status,
                    new_status=reservation.status,
                    reason=f'补充证据材料：{supp_title2}',
                )

            reservation.save()
            self.stdout.write(f'  创建预约单: {data["no"]} - {data["status"]}')

        self.stdout.write(f'  共创建 {len(reservations_data)} 条预约单')
