"""SQLite 幂等迁移管理器 - 按版本顺序执行，兼容新旧数据库
迁移脚本按 V<版本号>_<描述>.py 命名，从 V001 开始
"""
import os
import importlib
from typing import List, Tuple
from ..database import get_sqlite_conn
from ..models.tables import ALL_DDL


MIGRATION_TABLE = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
"""


def _ensure_migration_table(conn) -> None:
    conn.execute(MIGRATION_TABLE)
    conn.commit()


def _get_applied_versions(conn) -> set:
    cursor = conn.execute("SELECT version FROM schema_migrations")
    return {row[0] for row in cursor.fetchall()}


def _get_migration_files() -> List[Tuple[str, str, str]]:
    migrations_dir = os.path.dirname(os.path.abspath(__file__))
    files = []
    for f in sorted(os.listdir(migrations_dir)):
        if f.startswith('V') and f.endswith('.py') and f != '__init__.py':
            version = f.split('_')[0][1:]
            name = '_'.join(f.split('_')[1:]).replace('.py', '')
            files.append((version, name, os.path.join(migrations_dir, f)))
    files.sort(key=lambda x: x[0])
    return files


def run_migrations() -> List[str]:
    """执行所有未应用的迁移，返回已应用的版本列表
    1. 新建库：先执行建表 DDL，再执行所有迁移
    2. 旧库：先检查迁移表，再执行缺失的迁移
    """
    conn = get_sqlite_conn()
    try:
        applied = []
        cursor = conn.cursor()

        print("=" * 60)
        print("银行网点-风险分级处置开户申请系统 - 数据库迁移")
        print("=" * 60)

        is_fresh_db = False
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='account_applications'")
            if not cursor.fetchone():
                is_fresh_db = True
        except Exception:
            is_fresh_db = True

        if is_fresh_db:
            print("\n[新库检测：执行初始化 DDL...")
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
                print(f"  [{idx}/{len(ALL_DDL)}] 创建{obj_type}: {obj_name}")
                cursor.execute(ddl)
            conn.commit()
            print("✓ 数据库表结构创建成功")
        else:
            print("\n已有库检测：跳过基础表已存在")

        _ensure_migration_table(conn)

        migration_files = _get_migration_files()
        applied_versions = _get_applied_versions(conn)

        for version, name, filepath in migration_files:
            if version in applied_versions:
                print(f"\n  ✓ 迁移 V{version} {name} 已应用，跳过")
                continue

            print(f"\n  → 应用迁移 V{version} {name}...")
            spec = importlib.util.spec_from_file_location(f"migration_{version}", filepath)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            try:
                module.up(cursor)
                cursor.execute(
                    "INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
                    (version, name)
                )
                conn.commit()
                applied.append(version)
                print(f"    ✓ 迁移 V{version} {name} 应用成功")
            except Exception as e:
                conn.rollback()
                print(f"    ✗ 迁移 V{version} {name} 失败: {e}")
                raise

        if not migration_files:
            print("\n  ✓ 没有需要应用的迁移")
        else:
            print(f"\n✓ 共应用 {len(applied)} 个迁移: {', '.join(f'V{v}' for v in applied)}")

        try:
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
        except Exception:
            pass

        print("\n" + "=" * 60)
        print("数据库迁移完成！")
        print("=" * 60)

        return applied
    finally:
        conn.close()
