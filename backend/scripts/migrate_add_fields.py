import os
import sys
import django

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.db import connection


def add_target_handler_column():
    with connection.cursor() as cursor:
        try:
            cursor.execute("""
                ALTER TABLE ticket_logs
                ADD COLUMN target_handler_id INTEGER REFERENCES users(id)
            """)
            print('添加 target_handler_id 列成功')
        except Exception as e:
            if 'duplicate column name' in str(e).lower():
                print('target_handler_id 列已存在，跳过')
            else:
                print(f'添加列失败: {e}')


def main():
    print('添加数据库新字段...')
    add_target_handler_column()
    print('完成！')


if __name__ == '__main__':
    main()
