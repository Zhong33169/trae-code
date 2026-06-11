import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from app.models import Ticket

titles = [
    '中风险-供应商管理系统（待接手：王审核转交给赵审核）',
    '高风险-金融报表系统（已接手：赵审核从王审核处接手）',
    '低风险-员工考勤小程序（回收退回：已退回给登记员待补正）',
]

for title in titles:
    tickets = Ticket.objects.filter(title=title)
    count = tickets.count()
    if count > 0:
        tickets.delete()
        print(f'已删除: {title[:30]}... ({count} 条)')
    else:
        print(f'不存在: {title[:30]}...')

print('完成！')
