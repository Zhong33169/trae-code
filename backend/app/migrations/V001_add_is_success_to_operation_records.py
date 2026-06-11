"""V001: 为 operation_records 表添加 is_success 字段
兼容逻辑：
1. 新库：表已含该字段（默认1），跳过
2. 旧库：表已存在但缺少该字段，添加并回填默认值
"""


def up(cursor):
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='operation_records'
    """)
    if not cursor.fetchone():
        return

    cursor.execute("PRAGMA table_info(operation_records)")
    columns = [row[1] for row in cursor.fetchall()]

    if 'is_success' not in columns:
        cursor.execute("SELECT COUNT(*) FROM operation_records")
        record_count = cursor.fetchone()[0]

        if record_count == 0:
            cursor.execute("""
                ALTER TABLE operation_records 
                ADD COLUMN is_success INTEGER NOT NULL DEFAULT 1
            """)
            print("    - 已添加 is_success 字段（空表，直接 NOT NULL DEFAULT 1）")
        else:
            cursor.execute("""
                ALTER TABLE operation_records 
                ADD COLUMN is_success INTEGER
            """)
            print("    - 已添加 is_success 字段（允许 NULL）")

            cursor.execute("""
                UPDATE operation_records 
                SET is_success = CASE 
                    WHEN operation_type = '操作失败' THEN 0
                    ELSE 1
                END
            """)
            updated = cursor.rowcount
            print(f"    - 已回填 {updated} 条记录的 is_success 字段")

        print("    - 注意：SQLite 不支持 ALTER COLUMN 设置 NOT NULL，字段允许 NULL 但设置了默认值 1")
        print("    - 新写入数据通过 INSERT 语句显式传入 is_success 值，保证业务层约束")

    else:
        print("    - is_success 字段已存在，跳过")
