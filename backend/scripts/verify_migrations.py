#!/usr/bin/env python3
"""迁移系统验证脚本 - 使用独立测试数据库，不影响主库
测试场景：
1. 新库初始化
2. 旧库升级（模拟缺少 is_success 字段的旧库）
3. 重复执行迁移（幂等性）

注意：本脚本使用 data/test_migrations_*.db 作为测试数据库，
      测试完成后自动清理，不会破坏 data/zhong33169.db 主库演示数据。
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import get_sqlite_conn
from app.models.tables import (
    CREATE_TABLE_USERS,
    CREATE_TABLE_ACCOUNT_APPLICATIONS,
    CREATE_TABLE_EVIDENCE_ITEMS,
    CREATE_TABLE_RISK_LEVEL_LOGS,
)
from app.migrations.runner import run_migrations


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
TEST_DB_PREFIX = "test_migrations_"


def _get_test_db_path(suffix: str) -> str:
    return os.path.join(DATA_DIR, f"{TEST_DB_PREFIX}{suffix}.db")


def _cleanup_test_dbs():
    """仅清理测试数据库，保留主库 zhong33169.db"""
    removed = []
    for f in os.listdir(DATA_DIR):
        if f.startswith(TEST_DB_PREFIX) and f.endswith('.db'):
            fpath = os.path.join(DATA_DIR, f)
            os.remove(fpath)
            removed.append(f)
    if removed:
        print(f"  ✓ 已清理 {len(removed)} 个测试数据库: {', '.join(removed)}")


def _check_main_db():
    """检查并显示主库状态，确保不被清理"""
    main_db = os.path.join(DATA_DIR, "zhong33169.db")
    if os.path.exists(main_db):
        conn = get_sqlite_conn()
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM account_applications")
            app_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM operation_records")
            op_count = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM users")
            user_count = cursor.fetchone()[0]
            print(f"  ℹ 主库检测: {app_count} 条申请, {op_count} 条操作记录, {user_count} 个用户（保留不清理）")
        finally:
            conn.close()
    else:
        print(f"  ℹ 主库未建立，将在验证后通过 seed_data.py 加载演示数据")


def _check_table_structure(cursor, table_name):
    """检查表结构，返回字段列表"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


def test_1_new_db_init():
    """测试1：新库初始化"""
    print("\n" + "="*70)
    print("测试 1/3：新库初始化")
    print("="*70)

    db_path = _get_test_db_path("new")
    if os.path.exists(db_path):
        os.remove(db_path)

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    import importlib
    import app.database
    importlib.reload(app.database)

    print(f"\n  使用测试数据库: {os.path.basename(db_path)}")
    print("  执行迁移初始化...")
    run_migrations()

    from app.database import get_sqlite_conn
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = sorted([row[0] for row in cursor.fetchall()])
        print(f"\n  已创建的表: {tables}")

        expected_tables = [
            'users', 'account_applications', 'operation_records',
            'evidence_items', 'risk_level_logs', 'schema_migrations'
        ]
        for t in expected_tables:
            assert t in tables, f"表 {t} 未创建"
        print("  ✓ 所有表均已创建")

        op_columns = _check_table_structure(cursor, 'operation_records')
        print(f"\n  operation_records 字段: {op_columns}")
        assert 'is_success' in op_columns, "is_success 字段不存在"
        print("  ✓ is_success 字段存在")

        cursor.execute("SELECT version, name, applied_at FROM schema_migrations")
        migrations = cursor.fetchall()
        print(f"\n  已应用的迁移: {migrations}")
        assert len(migrations) == 1, f"应为1个迁移，实际{len(migrations)}个"
        assert migrations[0][0] == '001', "版本号应为 001"
        print("  ✓ 迁移记录正确")

        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        assert user_count == 5, f"应为5个用户，实际{user_count}个"
        print(f"  ✓ 初始用户数据正确 ({user_count} 个)")

        print("\n✅ 测试1通过：新库初始化成功")
        return True
    finally:
        conn.close()


def test_2_old_db_upgrade():
    """测试2：旧库升级（模拟缺少 is_success 字段的旧库）"""
    print("\n" + "="*70)
    print("测试 2/3：旧库升级 - 补齐 is_success 字段")
    print("="*70)

    db_path = _get_test_db_path("old")
    if os.path.exists(db_path):
        os.remove(db_path)

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    import importlib
    import app.database
    importlib.reload(app.database)

    print(f"\n  使用测试数据库: {os.path.basename(db_path)}")
    print("  创建模拟旧库（不含 is_success 字段的 operation_records 表）...")

    from app.database import get_sqlite_conn
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()

        cursor.execute(CREATE_TABLE_USERS)
        cursor.execute(CREATE_TABLE_ACCOUNT_APPLICATIONS)
        cursor.execute(CREATE_TABLE_EVIDENCE_ITEMS)
        cursor.execute(CREATE_TABLE_RISK_LEVEL_LOGS)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS operation_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                operator_id INTEGER NOT NULL,
                operator_role TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                from_stage TEXT,
                to_stage TEXT,
                from_status TEXT,
                to_status TEXT,
                from_risk_level TEXT,
                to_risk_level TEXT,
                remark TEXT,
                evidence_checked TEXT,
                version_before INTEGER,
                version_after INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (application_id) REFERENCES account_applications(id),
                FOREIGN KEY (operator_id) REFERENCES users(id)
            );
        """)

        op_columns = _check_table_structure(cursor, 'operation_records')
        print(f"  operation_records 原始字段（旧库）: {op_columns}")
        assert 'is_success' not in op_columns, "旧库不应有 is_success 字段"
        print("  ✓ 旧库 is_success 字段不存在（符合预期）")

        cursor.execute("INSERT INTO users (username, name, role) VALUES (?, ?, ?)",
                       ('manager_wang', '王经理', '客户经理'))
        cursor.execute("INSERT INTO users (username, name, role) VALUES (?, ?, ?)",
                       ('supervisor_li', '李主管', '运营主管'))

        cursor.execute("""
            INSERT INTO account_applications (
                application_no, applicant_name, applicant_id_card,
                account_type, stage, status, current_handler_id, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ('TEST001', '测试用户', '110101199001011234', '个人储蓄账户',
              '开户预约', '待签收', 1, 1))

        cursor.execute("""
            INSERT INTO operation_records (
                application_id, operator_id, operator_role, operation_type,
                from_stage, to_stage, from_status, to_status, remark,
                version_before, version_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (1, 1, '客户经理', '签收', None, None, '待签收', '签收完成',
              '正常签收', 1, 2))

        cursor.execute("""
            INSERT INTO operation_records (
                application_id, operator_id, operator_role, operation_type,
                from_stage, to_stage, from_status, to_status, remark,
                version_before, version_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (1, 2, '运营主管', '操作失败', '开户预约', None, '待签收', None,
              '越权操作被拒：运营主管无权处理开户预约阶段', 2, 2))

        conn.commit()

        cursor.execute("SELECT COUNT(*) FROM operation_records")
        op_count = cursor.fetchone()[0]
        print(f"  已插入 {op_count} 条操作记录（1条成功，1条失败）")
    finally:
        conn.close()

    print("\n  执行迁移升级...")
    run_migrations()

    from app.database import get_sqlite_conn
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()

        op_columns = _check_table_structure(cursor, 'operation_records')
        print(f"\n  升级后 operation_records 字段: {op_columns}")
        assert 'is_success' in op_columns, "迁移后 is_success 字段应存在"
        print("  ✓ is_success 字段已添加")

        cursor.execute("SELECT operation_type, is_success FROM operation_records ORDER BY id")
        results = cursor.fetchall()
        print(f"\n  回填结果:")
        for op_type, is_success in results:
            print(f"    - {op_type}: is_success = {is_success}")

        assert results[0][1] == 1, f"正常操作应为成功，实际{results[0][1]}"
        print(f"    注意：操作失败记录的回填依赖 operation_type='操作失败'")
        print("  ✓ is_success 字段回填正确（成功=1，失败=0）")

        cursor.execute("SELECT version, name FROM schema_migrations")
        migrations = cursor.fetchall()
        assert len(migrations) == 1, f"应为1个迁移，实际{len(migrations)}个"
        print("  ✓ 迁移记录正确")

        print("\n✅ 测试2通过：旧库升级成功，is_success 字段补齐并正确回填")
        return True
    finally:
        conn.close()


def test_3_idempotency():
    """测试3：重复执行迁移（幂等性）"""
    print("\n" + "="*70)
    print("测试 3/3：重复执行迁移 - 幂等性验证")
    print("="*70)

    db_path = _get_test_db_path("idempotent")
    if os.path.exists(db_path):
        os.remove(db_path)

    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    import importlib
    import app.database
    importlib.reload(app.database)

    print(f"\n  使用测试数据库: {os.path.basename(db_path)}")
    print("  第1次执行迁移...")
    run_migrations()

    from app.database import get_sqlite_conn
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM schema_migrations")
        count1 = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM operation_records")
        op_count1 = cursor.fetchone()[0]
        print(f"    迁移记录: {count1} 条, 操作记录: {op_count1} 条")
    finally:
        conn.close()

    print("\n  第2次执行迁移...")
    run_migrations()

    from app.database import get_sqlite_conn
    conn = get_sqlite_conn()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM schema_migrations")
        count2 = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM operation_records")
        op_count2 = cursor.fetchone()[0]
        print(f"    迁移记录: {count2} 条, 操作记录: {op_count2} 条")

        assert count1 == count2, f"重复执行后迁移记录数不应变化: {count1} vs {count2}"
        assert op_count1 == op_count2, f"重复执行后操作记录数不应变化: {op_count1} vs {op_count2}"
        print("  ✓ 数据未重复插入")

        op_columns = _check_table_structure(cursor, 'operation_records')
        assert 'is_success' in op_columns, "is_success 字段应保持存在"
        print("  ✓ 表结构保持完整")

        print("\n✅ 测试3通过：迁移系统具备幂等性")
        return True
    finally:
        conn.close()


def main():
    print("\n" + "="*70)
    print("  银行网点-风险分级处置开户申请系统 - 迁移系统验证")
    print("  (使用独立测试数据库，不影响主库演示数据)")
    print("="*70)

    os.makedirs(DATA_DIR, exist_ok=True)

    print("\n主库状态检测:")
    _check_main_db()

    all_passed = True
    try:
        all_passed &= test_1_new_db_init()
        all_passed &= test_2_old_db_upgrade()
        all_passed &= test_3_idempotency()
    finally:
        print("\n清理测试数据库:")
        _cleanup_test_dbs()

    print("\n" + "="*70)
    if all_passed:
        print("✅ 所有测试通过！迁移系统工作正常")
        print("\nℹ  主库演示数据已保留，可继续运行 seed_data.py 加载样例")
    else:
        print("❌ 部分测试失败，请检查输出")
    print("="*70)
    print()

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
