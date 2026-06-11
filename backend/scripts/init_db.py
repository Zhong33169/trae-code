#!/usr/bin/env python3
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_sqlite_conn
from app.models.tables import ALL_DDL


def init_database():
    print("=" * 60)
    print("银行网点-风险分级处置开户申请系统 - 数据库初始化")
    print("=" * 60)

    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
    os.makedirs(data_dir, exist_ok=True)

    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()
        for idx, ddl in enumerate(ALL_DDL, 1):
            if "TABLE" in ddl:
                obj_name = ddl.split("TABLE")[1].split("(")[0].replace("IF NOT EXISTS", "").strip()
                obj_type = "表"
            elif "INDEX" in ddl:
                obj_name = ddl.split("INDEX")[1].split("ON")[0].replace("IF NOT EXISTS", "").strip()
                obj_type = "索引"
            else:
                obj_name = f"ddl_{idx}"
                obj_type = "对象"
            print(f"[{idx}/{len(ALL_DDL)}] 创建{obj_type}: {obj_name}")
            cursor.execute(ddl)
        conn.commit()
        print("\n✓ 数据库表结构创建成功")

        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        if user_count == 0:
            print("\n正在插入初始用户数据...")
            users = [
                ("manager_wang", "王经理", "客户经理"),
                ("supervisor_li", "李主管", "运营主管"),
                ("president_zhang", "张行长", "支行行长"),
                ("manager_chen", "陈经理", "客户经理"),
                ("supervisor_liu", "刘主管", "运营主管"),
            ]
            for username, name, role in users:
                cursor.execute(
                    "INSERT INTO users (username, name, role) VALUES (?, ?, ?)",
                    (username, name, role)
                )
            conn.commit()
            print(f"✓ 已插入 {len(users)} 个初始用户")
        else:
            print(f"\nℹ 用户表已存在 {user_count} 条记录，跳过初始化")

        print("\n" + "=" * 60)
        print("数据库初始化完成！")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ 错误: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    init_database()
