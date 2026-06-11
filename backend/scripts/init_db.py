import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.db import connection
from app.models import User, Ticket, TicketLog, Evidence
from django.utils import timezone
from datetime import timedelta


def init_database():
    with connection.schema_editor() as schema_editor:
        from app.models import User, Ticket, TicketLog, Evidence
        for model in [User, Ticket, TicketLog, Evidence]:
            try:
                schema_editor.create_model(model)
                print(f'创建表: {model._meta.db_table}')
            except Exception as e:
                print(f'表已存在或创建失败 {model._meta.db_table}: {e}')


def create_users():
    users = [
        {'username': 'registrar1', 'password': '123456', 'name': '张登记', 'role': 'registrar'},
        {'username': 'registrar2', 'password': '123456', 'name': '李登记', 'role': 'registrar'},
        {'username': 'auditor1', 'password': '123456', 'name': '王审核', 'role': 'auditor'},
        {'username': 'auditor2', 'password': '123456', 'name': '赵审核', 'role': 'auditor'},
        {'username': 'reviewer1', 'password': '123456', 'name': '陈复核', 'role': 'reviewer'},
    ]

    created = []
    for u in users:
        user, is_new = User.objects.get_or_create(
            username=u['username'],
            defaults={'name': u['name'], 'role': u['role']}
        )
        if is_new:
            user.set_password(u['password'])
            user.save()
            print(f'创建用户: {user.username} ({user.name}, {user.get_role_display()})')
        else:
            print(f'用户已存在: {user.username}')
        created.append(user)

    return created


def create_sample_tickets():
    registrar1 = User.objects.get(username='registrar1')
    registrar2 = User.objects.get(username='registrar2')
    auditor1 = User.objects.get(username='auditor1')
    auditor2 = User.objects.get(username='auditor2')
    reviewer1 = User.objects.get(username='reviewer1')

    now = timezone.now()

    samples = [
        {
            'title': '高风险-核心支付模块外包需求',
            'description': '涉及用户支付核心流程，金额大，安全要求高，需高风险等级处理。包含支付网关对接、订单系统改造、对账模块开发。',
            'risk_level': 'high',
            'stage': 'confirm',
            'status': 'pending',
            'creator': registrar1,
            'handler': auditor1,
            'deadline': now + timedelta(hours=12),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, '创建高风险需求交付单'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, '提交审核，分配审核主管王审核办理'),
            ],
            'evidences_per_log': [
                [('需求规格说明书', 'doc', 'https://example.com/spec.docx'),
                 ('外包合同草案', 'doc', 'https://example.com/contract.pdf'),
                 ('安全评估报告', 'link', 'https://example.com/security')],
                [('需求规格说明书V2', 'doc', 'https://example.com/spec-v2.docx'),
                 ('外包合同正式版', 'doc', 'https://example.com/contract-final.pdf'),
                 ('安全评估报告', 'link', 'https://example.com/security')],
            ],
        },
        {
            'title': '中风险-会员管理系统开发',
            'description': '会员管理后台系统开发，包含会员信息管理、等级体系、积分系统等功能。属于中等复杂度业务系统。',
            'risk_level': 'medium',
            'stage': 'schedule',
            'status': 'pending',
            'creator': registrar2,
            'handler': auditor1,
            'deadline': now + timedelta(days=2),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar2, '创建需求交付单'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar2, '提交审核'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, '需求确认通过，已完成需求分析，进入排期评估阶段'),
            ],
            'evidences_per_log': [
                [('需求文档V1.0', 'doc', 'https://example.com/req-v1.docx')],
                [('需求文档V1.0', 'doc', 'https://example.com/req-v1.docx'),
                 ('原型设计稿', 'link', 'https://example.com/prototype')],
                [('需求评审会议纪要', 'doc', 'https://example.com/meeting-minutes.docx'),
                 ('原型设计稿', 'link', 'https://example.com/prototype')],
            ],
        },
        {
            'title': '低风险-官网页面改版',
            'description': '公司官网首页视觉改版，不涉及核心业务逻辑，主要为前端展示层调整。',
            'risk_level': 'low',
            'stage': 'acceptance',
            'status': 'pending',
            'creator': registrar1,
            'handler': reviewer1,
            'deadline': now + timedelta(days=3),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, '创建官网改版需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, '提交审核'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, '需求确认通过'),
                ('approve', 'schedule', 'acceptance', 'pending', 'pending', auditor1, '排期评估通过，开发已完成，进入交付验收阶段'),
            ],
            'evidences_per_log': [
                [('设计需求说明', 'doc', 'https://example.com/design-req.pdf')],
                [('设计需求说明', 'doc', 'https://example.com/design-req.pdf')],
                [('排期表', 'doc', 'https://example.com/schedule.xlsx')],
                [('测试报告', 'doc', 'https://example.com/test-report.pdf'),
                 ('验收标准', 'doc', 'https://example.com/acceptance.pdf')],
            ],
        },
        {
            'title': '高风险-数据迁移项目（退回补正→补正再提交→审核中）',
            'description': '历史业务系统数据迁移至新平台，涉及大量用户敏感数据，数据一致性要求极高。经历了缺证据被退回、补正后重新提交的完整流程。',
            'risk_level': 'high',
            'stage': 'confirm',
            'status': 'pending',
            'creator': registrar2,
            'handler': auditor1,
            'deadline': now + timedelta(days=1),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar2, '创建数据迁移项目需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar2, '首次提交审核'),
                ('validate_fail', 'confirm', 'confirm', 'pending', 'pending', auditor1, '校验失败（尝试approve）：高风险需求在需求确认阶段至少需要3份证据材料，当前仅1份'),
                ('reject', 'confirm', 'confirm', 'pending', 'returned', auditor1, '退回补正：缺少数据安全评估报告和迁移回滚方案，证据材料数量不足，高风险项目需至少3份证据'),
                ('revise', 'confirm', 'confirm', 'returned', 'pending', registrar2, '补正提交：已补充数据安全评估报告、迁移回滚方案和三方审计报告，重新提交审核'),
            ],
            'evidences_per_log': [
                [('迁移需求说明', 'doc', 'https://example.com/migration-req.docx')],
                [('迁移需求说明', 'doc', 'https://example.com/migration-req.docx')],
                [],
                [('退回意见说明', 'doc', 'https://example.com/reject-note.pdf')],
                [('数据安全评估报告', 'doc', 'https://example.com/security-assessment.pdf'),
                 ('迁移回滚方案', 'doc', 'https://example.com/rollback-plan.pdf'),
                 ('三方审计报告', 'link', 'https://example.com/audit-report')],
            ],
        },
        {
            'title': '中风险-客服工单系统优化（已逾期）',
            'description': '客服工单系统功能优化，增加自动派单、智能分类等功能。当前已逾期。',
            'risk_level': 'medium',
            'stage': 'schedule',
            'status': 'overdue',
            'creator': registrar1,
            'handler': auditor1,
            'deadline': now - timedelta(days=1),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, '创建客服系统优化需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, '提交审核'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, '需求确认通过，进入排期评估'),
                ('validate_fail', 'schedule', 'schedule', 'pending', 'overdue', None, '系统自动标记逾期'),
            ],
            'evidences_per_log': [
                [('需求文档', 'doc', 'https://example.com/cs-req.docx')],
                [('需求文档', 'doc', 'https://example.com/cs-req.docx'),
                 ('功能清单', 'doc', 'https://example.com/cs-features.xlsx')],
                [('确认意见', 'doc', 'https://example.com/confirm-opinion.pdf')],
                [],
            ],
        },
        {
            'title': '中风险-营销活动平台（已完成归档）',
            'description': '营销活动管理平台，支持活动创建、发布、数据统计等功能。已完成全部流程。',
            'risk_level': 'medium',
            'stage': 'acceptance',
            'status': 'completed',
            'creator': registrar2,
            'handler': None,
            'deadline': now - timedelta(days=5),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar2, '创建营销活动平台需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar2, '提交审核'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, '需求确认通过，评审通过'),
                ('approve', 'schedule', 'acceptance', 'pending', 'pending', auditor1, '排期评估通过，开发团队交付完成'),
                ('archive', 'acceptance', 'acceptance', 'pending', 'completed', reviewer1, '复核归档：验收通过，功能完整，性能达标，文档齐全'),
            ],
            'evidences_per_log': [
                [('活动平台需求V1', 'doc', 'https://example.com/marketing-req.docx')],
                [('活动平台需求V1', 'doc', 'https://example.com/marketing-req.docx'),
                 ('技术方案', 'link', 'https://example.com/tech-spec')],
                [('需求评审记录', 'doc', 'https://example.com/review.docx')],
                [('开发排期表', 'doc', 'https://example.com/dev-schedule.xlsx'),
                 ('交付清单', 'doc', 'https://example.com/delivery-list.docx')],
                [('验收报告', 'doc', 'https://example.com/acceptance-report.pdf'),
                 ('项目总结', 'doc', 'https://example.com/project-summary.pdf'),
                 ('源码仓库链接', 'link', 'https://github.com/example/marketing')],
            ],
        },
        {
            'title': '低风险-内部工具小需求（补正再提交流程）',
            'description': '内部使用的小工具开发，用于提升日常办公效率。经历了排期评估阶段被退回、补正后重新提交的完整流程。',
            'risk_level': 'low',
            'stage': 'schedule',
            'status': 'pending',
            'creator': registrar1,
            'handler': auditor1,
            'deadline': now + timedelta(days=4),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, '创建内部工具需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, '提交审核'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, '需求简单，确认通过'),
                ('validate_fail', 'schedule', 'schedule', 'pending', 'pending', auditor1, '校验失败（尝试approve）：中风险需求在排期评估阶段至少需要2份证据材料，当前仅0份'),
                ('reject', 'schedule', 'schedule', 'pending', 'returned', auditor1, '退回补正：排期不够明确，缺少人力资源分配信息，请补充详细排期表和人力配置'),
                ('revise', 'schedule', 'schedule', 'returned', 'pending', registrar1, '补正提交：已补充详细排期表和人力配置方案，重新提交审核'),
            ],
            'evidences_per_log': [
                [('工具需求描述', 'doc', 'https://example.com/tool-req.txt')],
                [('工具需求描述', 'doc', 'https://example.com/tool-req.txt')],
                [],
                [],
                [('退回说明', 'doc', 'https://example.com/schedule-reject.pdf')],
                [('详细排期表', 'doc', 'https://example.com/detailed-schedule.xlsx'),
                 ('人力配置方案', 'doc', 'https://example.com/staffing-plan.docx')],
            ],
        },
        {
            'title': '高风险-风控模型升级项目（处理人越权校验失败样例）',
            'description': '风控模型升级，涉及核心风控算法调整，影响面广，需严格评审。包含非当前处理人尝试操作的校验失败记录。',
            'risk_level': 'high',
            'stage': 'confirm',
            'status': 'pending',
            'creator': registrar1,
            'handler': auditor1,
            'deadline': now + timedelta(hours=8),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, None, '创建风控模型升级需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, None, '提交审核，分配审核主管王审核办理'),
                ('validate_fail', 'confirm', 'confirm', 'pending', 'pending', auditor2, None, '校验失败（尝试approve）：当前处理人为「王审核」，您无权办理此需求交付单'),
            ],
            'evidences_per_log': [
                [('模型升级方案', 'doc', 'https://example.com/risk-model.docx'),
                 ('影响评估报告', 'doc', 'https://example.com/impact-assessment.pdf'),
                 ('技术方案评审链接', 'link', 'https://example.com/tech-review')],
                [('模型升级方案', 'doc', 'https://example.com/risk-model.docx'),
                 ('影响评估报告', 'doc', 'https://example.com/impact-assessment.pdf'),
                 ('技术方案评审链接', 'link', 'https://example.com/tech-review')],
                [],
            ],
        },
        {
            'title': '中风险-供应商管理系统（待接手：王审核转交给赵审核）',
            'description': '供应商管理系统开发，包含供应商准入、评级、考核等模块。王审核因工作调整，将此单转交给赵审核处理。',
            'risk_level': 'medium',
            'stage': 'confirm',
            'status': 'pending',
            'creator': registrar1,
            'handler': auditor2,
            'deadline': now + timedelta(days=2),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, None, '创建供应商管理系统需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, None, '提交审核，分配王审核办理'),
                ('transfer', 'confirm', 'confirm', 'pending', 'pending', auditor1, auditor2, '工作调整，转交给赵审核继续处理，请尽快接手'),
            ],
            'evidences_per_log': [
                [('需求文档V1.0', 'doc', 'https://example.com/supplier-req.docx')],
                [('需求文档V1.0', 'doc', 'https://example.com/supplier-req.docx'),
                 ('业务流程图', 'doc', 'https://example.com/biz-flow.pdf')],
                [('工作调整说明', 'doc', 'https://example.com/work-adjust.docx')],
            ],
        },
        {
            'title': '高风险-金融报表系统（已接手：赵审核从王审核处接手）',
            'description': '金融监管报表系统开发，涉及合规要求高，数据准确性要求严格。原由王审核负责，后转交赵审核，赵审核已确认接手并开始处理。',
            'risk_level': 'high',
            'stage': 'schedule',
            'status': 'pending',
            'creator': registrar2,
            'handler': auditor2,
            'deadline': now + timedelta(days=2),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar2, None, '创建金融报表系统需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar2, None, '提交审核'),
                ('transfer', 'confirm', 'confirm', 'pending', 'pending', auditor1, auditor2, '项目交接，转交给赵审核'),
                ('takeover', 'confirm', 'confirm', 'pending', 'pending', auditor2, None, '确认接手，已了解需求背景和进度'),
                ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor2, None, '需求确认通过，评审通过，进入排期评估阶段'),
            ],
            'evidences_per_log': [
                [('需求规格书', 'doc', 'https://example.com/finance-spec.docx'),
                 ('监管要求文档', 'doc', 'https://example.com/regulation.pdf'),
                 ('参考样例链接', 'link', 'https://example.com/ref')],
                [('需求规格书', 'doc', 'https://example.com/finance-spec.docx'),
                 ('监管要求文档', 'doc', 'https://example.com/regulation.pdf'),
                 ('参考样例链接', 'link', 'https://example.com/ref')],
                [('交接清单', 'doc', 'https://example.com/handover-list.xlsx')],
                [],
                [('需求评审纪要', 'doc', 'https://example.com/review-minutes.docx'),
                 ('技术方案', 'link', 'https://example.com/tech-design'),
                 ('排期初稿', 'doc', 'https://example.com/schedule-draft.xlsx')],
            ],
        },
        {
            'title': '低风险-员工考勤小程序（回收退回：已退回给登记员待补正）',
            'description': '员工考勤打卡小程序开发，功能简单。审核时发现需求描述不够清晰，缺少关键功能清单，已退回给登记员补正。',
            'risk_level': 'low',
            'stage': 'confirm',
            'status': 'returned',
            'creator': registrar1,
            'handler': registrar1,
            'deadline': now + timedelta(days=3),
            'logs': [
                ('create', '', 'confirm', '', 'pending', registrar1, None, '创建员工考勤小程序需求'),
                ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar1, None, '提交审核'),
                ('reject', 'confirm', 'confirm', 'pending', 'returned', auditor1, None, '退回补正：需求描述过于简单，缺少功能清单、打卡规则说明和异常处理逻辑，请补充后重新提交'),
            ],
            'evidences_per_log': [
                [('需求简述', 'doc', 'https://example.com/attendance-req.txt')],
                [('需求简述', 'doc', 'https://example.com/attendance-req.txt')],
                [('退回意见说明', 'doc', 'https://example.com/reject-note.docx')],
            ],
        },
    ]

    for sample in samples:
        existing = Ticket.objects.filter(title=sample['title']).first()
        if existing:
            print(f'需求单已存在: {sample["title"][:30]}...')
            continue

        ticket = Ticket.objects.create(
            title=sample['title'],
            description=sample['description'],
            risk_level=sample['risk_level'],
            stage=sample['stage'],
            status=sample['status'],
            version=len(sample['logs']),
            creator=sample['creator'],
            current_handler=sample['handler'],
            deadline=sample['deadline'],
        )

        for i, log_info in enumerate(sample['logs']):
            if len(log_info) == 8:
                action, from_stage, to_stage, from_status, to_status, operator, target_handler, comment = log_info
            else:
                action, from_stage, to_stage, from_status, to_status, operator, comment = log_info
                target_handler = None
            log = TicketLog.objects.create(
                ticket=ticket,
                action=action,
                from_stage=from_stage,
                to_stage=to_stage,
                from_status=from_status,
                to_status=to_status,
                operator=operator,
                target_handler=target_handler,
                comment=comment,
            )

            if i < len(sample['evidences_per_log']):
                for ev_name, ev_type, ev_url in sample['evidences_per_log'][i]:
                    Evidence.objects.create(
                        ticket=ticket,
                        log=log,
                        name=ev_name,
                        type=ev_type,
                        url=ev_url,
                    )

        print(f'创建需求单: {sample["title"][:30]}... ({sample["risk_level"]}, {sample["stage"]}, {sample["status"]})')


def main():
    print('=' * 60)
    print('软件外包项目组-风险分级处置需求交付单系统')
    print('数据库初始化脚本')
    print('=' * 60)

    print('\n[1/3] 初始化数据库表...')
    init_database()

    print('\n[2/3] 创建用户账号...')
    create_users()

    print('\n[3/3] 创建样例需求交付单...')
    create_sample_tickets()

    print('\n' + '=' * 60)
    print('初始化完成！')
    print('=' * 60)
    print('\n测试账号：')
    print('  需求交付登记员: registrar1 / 123456 (张登记)')
    print('  需求交付登记员: registrar2 / 123456 (李登记)')
    print('  需求交付审核主管: auditor1 / 123456 (王审核)')
    print('  需求交付审核主管: auditor2 / 123456 (赵审核)')
    print('  软件外包项目组复核负责人: reviewer1 / 123456 (陈复核)')
    print('\n样例数据包含:')
    print('  - 正常流转各阶段（含提交→审核→通过完整链路）')
    print('  - 高/中/低风险等级')
    print('  - 退回补正 → 补正再提交完整审计链')
    print('  - 逾期场景（含系统自动标记validate_fail）')
    print('  - 已完成归档')
    print('  - 证据不足校验失败留痕（validate_fail）')
    print('  - 非当前处理人越权操作校验失败留痕（handler_mismatch）')


if __name__ == '__main__':
    main()
