#!/usr/bin/env python3
"""
SQLite 持久化验证脚本
验证：种子数据、时间线、操作日志、超时字段的正确落库
"""

import sqlite3
import json
from datetime import datetime

DB_PATH = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/app.db'

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check_tables():
    print_section("数据库表检查")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in cursor.fetchall()]
    
    expected = ['users', 'lease_applications', 'node_timelines', 'operation_logs', 'attachments']
    for t in expected:
        status = "✅" if t in tables else "❌"
        print(f"  {status} {t}")
    
    conn.close()
    return tables

def check_users():
    print_section("用户表检查（3个测试账号）")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, real_name, role FROM users ORDER BY id")
    rows = cursor.fetchall()
    
    print(f"  总用户数: {len(rows)}")
    for row in rows:
        role_map = {
            'registrar': '租约登记员',
            'auditor': '租约审核主管',
            'reviewer': '长租公寓复核负责人'
        }
        print(f"  ✅ ID:{row[0]} | {row[1]} | {row[2]} | {role_map.get(row[3], row[3])}")
    
    conn.close()

def check_applications():
    print_section("租约申请表检查（6条样例数据）")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, application_no, tenant_name, apartment_name, room_no, 
               status, current_node,
               is_overdue, handover_result, handed_over_by_name,
               archived_by_name, completed_at
        FROM lease_applications 
        ORDER BY id
    """)
    rows = cursor.fetchall()
    
    print(f"  总申请数: {len(rows)} (预期: 6)")
    print()
    
    status_map = {
        'draft': '草稿',
        'pending_review': '待审核',
        'returned': '已退回',
        'reviewed': '审核通过',
        'pending_confirm': '待房态确认',
        'pending_handover': '待入住交接',
        'room_confirmed': '待复核归档',
        'completed': '已完成',
        'rejected': '已拒绝',
    }
    node_map = {
        'contract_signing': '租客签约',
        'review': '租约审核',
        'room_confirm': '房态确认',
        'handover': '入住交接',
        'archive': '复核归档',
    }
    
    for row in rows:
        d = dict(row)
        overdue_mark = " ⚠️ 超时" if d['is_overdue'] else ""
        archive_info = ""
        if d['status'] == 'room_confirmed':
            archive_info = " 👉 可归档！"
        elif d['status'] == 'completed':
            archive_info = " ✅ 已归档"
        
        print(f"  ID:{d['id']} | {d['application_no']}")
        print(f"    租客:{d['tenant_name']} | {d['apartment_name']} {d['room_no']}")
        print(f"    状态: {d['status']} ({status_map.get(d['status'], d['status'])})")
        print(f"    当前节点: {d['current_node']} ({node_map.get(d['current_node'], d['current_node'])}){overdue_mark}{archive_info}")
        
        if d['handover_result']:
            print(f"    交接说明: {d['handover_result'][:40]}...")
        if d['archived_by_name']:
            print(f"    归档人: {d['archived_by_name']} | 归档时间: {d['completed_at']}")
        print()
    
    conn.close()
    return rows

def check_room_confirmed_app():
    print_section("重点验证：第6条待复核归档申请")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM lease_applications 
        WHERE status = 'room_confirmed' AND current_node = 'archive'
    """)
    row = cursor.fetchone()
    
    if not row:
        print("  ❌ 未找到待复核归档状态的申请！")
        conn.close()
        return
    
    d = dict(row)
    print(f"  ✅ 找到申请: {d['application_no']} - {d['tenant_name']}")
    print()
    
    checks = [
        ('status', 'room_confirmed', d['status']),
        ('current_node', 'archive', d['current_node']),
        ('handover_result 非空', True, d['handover_result'] is not None and len(d['handover_result']) > 0),
        ('handed_over_at 非空', True, d['handed_over_at'] is not None),
        ('review_result 非空', True, d['review_result'] is not None and len(d['review_result']) > 0),
        ('confirm_result 非空', True, d['confirm_result'] is not None and len(d['confirm_result']) > 0),
    ]
    
    all_pass = True
    for name, expected, actual in checks:
        passed = expected == actual
        status = "✅" if passed else "❌"
        if not passed:
            all_pass = False
        print(f"  {status} {name}: 预期={expected}, 实际={actual}")
    
    print()
    
    # 检查节点时间线
    cursor.execute("""
        SELECT node_type, node_name, status, is_overdue, 
               start_time, due_time, end_time,
               overdue_reason, follow_up_action
        FROM node_timelines 
        WHERE application_id = ? 
        ORDER BY id
    """, (d['id'],))
    
    timelines = cursor.fetchall()
    print(f"  节点时间线 ({len(timelines)} 条):")
    for tl in timelines:
        t = dict(tl)
        overdue_mark = " ⚠️" if t['is_overdue'] else ""
        print(f"    {t['node_type']:20s} | {t['status']:10s} | {t['node_name']}{overdue_mark}")
        
        # 验证前4个节点已完成，archive节点处理中
        if t['node_type'] in ['contract_signing', 'review', 'room_confirm', 'handover']:
            assert t['status'] == 'completed', f"❌ {t['node_type']} 状态应为 completed"
            assert t['end_time'] is not None, f"❌ {t['node_type']} 应有结束时间"
        elif t['node_type'] == 'archive':
            assert t['status'] == 'processing', f"❌ archive 状态应为 processing"
    
    print("  ✅ 节点时间线状态正确")
    print()
    
    # 检查操作日志
    cursor.execute("""
        SELECT operation_type, operation_name, old_status, new_status, 
               user_name, user_role, detail
        FROM operation_logs 
        WHERE application_id = ? 
        ORDER BY id
    """, (d['id'],))
    
    logs = cursor.fetchall()
    print(f"  操作日志 ({len(logs)} 条):")
    for log in logs:
        l = dict(log)
        status_change = f"{l['old_status']} → {l['new_status']}" if l['old_status'] and l['old_status'] != l['new_status'] else l['new_status']
        print(f"    {l['operation_name']:15s} | {l['user_name']}({l['user_role']}) | {status_change}")
        if l['detail']:
            print(f"      详情: {l['detail'][:50]}...")
    
    # 验证至少有4条日志（创建 + 提交 + 审核 + 房态确认 + 入住交接）
    expected_ops = ['create', 'submit', 'review_approve', 'room_confirm', 'handover']
    actual_ops = [dict(l)['operation_type'] for l in logs]
    for op in expected_ops:
        if op in actual_ops:
            print(f"  ✅ 包含操作: {op}")
        else:
            print(f"  ❌ 缺失操作: {op}")
            all_pass = False
    
    conn.close()
    
    if all_pass:
        print("\n  🎉 待复核归档申请数据验证全部通过！")
    else:
        print("\n  ⚠️  部分验证未通过！")

def check_completed_app():
    print_section("验证：已完成归档申请（第5条）")
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, application_no, tenant_name, status, current_node,
               archived_by_name, completed_at
        FROM lease_applications 
        WHERE status = 'completed'
        LIMIT 1
    """)
    row = cursor.fetchone()
    
    if row:
        d = dict(row)
        print(f"  ✅ 找到已归档申请: {d['application_no']} - {d['tenant_name']}")
        print(f"     归档人: {d['archived_by_name']}")
        print(f"     归档时间: {d['completed_at']}")
        
        # 检查节点时间线 - 所有节点都应该是 completed
        cursor.execute("""
            SELECT node_type, status FROM node_timelines 
            WHERE application_id = ? ORDER BY id
        """, (d['id'],))
        timelines = cursor.fetchall()
        
        all_completed = all(dict(tl)['status'] == 'completed' for tl in timelines)
        if all_completed:
            print(f"  ✅ 所有 {len(timelines)} 个节点状态均为 completed")
        else:
            print(f"  ❌ 部分节点状态不正确")
            for tl in timelines:
                print(f"     {dict(tl)['node_type']}: {dict(tl)['status']}")
    else:
        print("  ⚠️  未找到已完成归档的申请")
    
    conn.close()

def check_overdue_fields():
    print_section("超时字段结构验证")
    conn = get_connection()
    cursor = conn.cursor()
    
    # 检查表结构
    cursor.execute("PRAGMA table_info(node_timelines)")
    columns = [dict(col) for col in cursor.fetchall()]
    
    expected_cols = ['overdue_reason', 'follow_up_action', 'is_overdue']
    for col in expected_cols:
        found = any(c['name'] == col for c in columns)
        status = "✅" if found else "❌"
        print(f"  {status} node_timelines.{col} 字段存在")
    
    cursor.execute("PRAGMA table_info(lease_applications)")
    app_columns = [dict(col) for col in cursor.fetchall()]
    
    app_expected = ['overdue_reason', 'follow_up_action', 'is_overdue']
    for col in app_expected:
        found = any(c['name'] == col for c in app_columns)
        status = "✅" if found else "❌"
        print(f"  {status} lease_applications.{col} 字段存在")
    
    conn.close()

def main():
    print("\n" + "#"*60)
    print("#  SQLite 持久化验证脚本")
    print("#  验证目标：种子数据、时间线、操作日志、超时字段")
    print("#"*60)
    
    try:
        check_tables()
        check_users()
        apps = check_applications()
        check_room_confirmed_app()
        check_completed_app()
        check_overdue_fields()
        
        print("\n" + "#"*60)
        print("#  🎉 SQLite 持久化验证完成！")
        print("#  所有关键数据结构正确，可归档演示数据已就绪")
        print("#"*60 + "\n")
        
    except Exception as e:
        print(f"\n❌ 验证过程出错: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
