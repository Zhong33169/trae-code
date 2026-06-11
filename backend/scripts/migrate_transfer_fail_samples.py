import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.db import connection
from django.utils import timezone
from datetime import timedelta
from app.models import User, Ticket, TicketLog, Evidence


TRANSFER_FAIL_TICKET_TITLE = '中风险-项目管理平台（转交失败留痕：无原因、角色不符、目标不存在、版本冲突）'


def check_and_add_target_handler_column():
    with connection.cursor() as cursor:
        try:
            cursor.execute("""
                ALTER TABLE ticket_logs
                ADD COLUMN target_handler_id INTEGER REFERENCES users(id)
            """)
            print('✅ 添加 target_handler_id 列成功')
        except Exception as e:
            if 'duplicate column name' in str(e).lower():
                print('ℹ️  target_handler_id 列已存在，跳过')
            else:
                print(f'⚠️  添加列失败: {e}')


def add_transfer_fail_samples():
    registrar2 = User.objects.get(username='registrar2')
    auditor1 = User.objects.get(username='auditor1')
    auditor2 = User.objects.get(username='auditor2')
    reviewer1 = User.objects.get(username='reviewer1')

    now = timezone.now()

    existing = Ticket.objects.filter(title=TRANSFER_FAIL_TICKET_TITLE).first()
    if existing:
        print(f'ℹ️  转交失败样例 ticket 已存在，跳过创建: {TRANSFER_FAIL_TICKET_TITLE[:35]}...')
        return existing

    print(f'🔄 创建转交失败样例 ticket...')

    ticket = Ticket.objects.create(
        title=TRANSFER_FAIL_TICKET_TITLE,
        description='项目管理平台开发，包含进度跟踪、任务分配、甘特图等模块。样例演示转交时的各种校验失败场景。',
        risk_level='medium',
        stage='schedule',
        status='pending',
        version=7,
        creator=registrar2,
        current_handler=auditor1,
        deadline=now + timedelta(days=4),
    )

    logs_data = [
        ('create', '', 'confirm', '', 'pending', registrar2, None,
         '创建项目管理平台需求'),
        ('submit', 'confirm', 'confirm', 'pending', 'pending', registrar2, None,
         '提交审核，附带需求文档V1.0和业务流程图'),
        ('approve', 'confirm', 'schedule', 'pending', 'pending', auditor1, None,
         '需求确认通过，进入排期评估阶段'),
        ('validate_fail', 'schedule', 'schedule', 'pending', 'pending', auditor1, None,
         '校验失败（尝试transfer）：请填写转交原因'),
        ('validate_fail', 'schedule', 'schedule', 'pending', 'pending', auditor1, reviewer1,
         '校验失败（尝试transfer）：当前阶段只能转交给审核主管角色的用户'),
        ('validate_fail', 'schedule', 'schedule', 'pending', 'pending', auditor1, None,
         '校验失败（尝试transfer）：目标用户不存在'),
        ('validate_fail', 'schedule', 'schedule', 'pending', 'pending', auditor1, None,
         '校验失败（尝试transfer）：版本号不匹配（提交v4，当前v5），请刷新页面后重试'),
    ]

    evidences_per_log = [
        [('需求文档V1.0', 'doc', 'https://example.com/pm-platform.docx')],
        [('需求文档V1.0', 'doc', 'https://example.com/pm-platform.docx'),
         ('业务流程图', 'link', 'https://example.com/pm-flow')],
        [('需求评审纪要', 'doc', 'https://example.com/pm-review.docx'),
         ('技术方案初稿', 'link', 'https://example.com/pm-tech')],
        [], [], [], [],
    ]

    for i, log_info in enumerate(logs_data):
        action, from_stage, to_stage, from_status, to_status, operator, target_handler, comment = log_info
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

        for ev_data in evidences_per_log[i]:
            Evidence.objects.create(
                ticket=ticket,
                log=log,
                name=ev_data[0],
                type=ev_data[1],
                url=ev_data[2],
            )

    print(f'✅ 转交失败样例 ticket 创建成功: #{ticket.id} {TRANSFER_FAIL_TICKET_TITLE[:35]}...')
    return ticket


def verify_samples():
    ticket = Ticket.objects.filter(title=TRANSFER_FAIL_TICKET_TITLE).first()
    if not ticket:
        print('❌ 验证失败：转交失败样例 ticket 不存在')
        return False

    fail_logs = TicketLog.objects.filter(ticket=ticket, action='validate_fail')
    print(f'✅ 验证通过：样例 ticket #{ticket.id} 共 {fail_logs.count()} 条 validate_fail 日志')

    expected_comments = [
        '请填写转交原因',
        '当前阶段只能转交给审核主管角色的用户',
        '目标用户不存在',
        '版本号不匹配',
    ]

    for expected in expected_comments:
        found = fail_logs.filter(comment__contains=expected).exists()
        status = '✅' if found else '❌'
        print(f'  {status} {expected}')

    return True


def main():
    print('=' * 60)
    print('迁移脚本：补写转交失败留痕样例')
    print('=' * 60)

    print('\n1. 检查数据库字段...')
    check_and_add_target_handler_column()

    print('\n2. 补写转交失败样例（幂等）...')
    add_transfer_fail_samples()

    print('\n3. 验证样例数据...')
    verify_samples()

    print('\n' + '=' * 60)
    print('迁移完成！')
    print('=' * 60)


if __name__ == '__main__':
    main()
