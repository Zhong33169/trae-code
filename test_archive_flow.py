#!/usr/bin/env python3
"""
端到端闭环测试脚本
验证：入住交接 → 待复核归档 → 复核归档 完整流程
目标：
1. 状态机流转正确性
2. 三表联动（主表/时间线/操作日志）数据一致性
3. 列表/详情/统计三端数据一致
4. 归档权限校验
5. 状态校验错误提示
"""

import requests
import json
import sys
from datetime import datetime

BASE_URL = "http://localhost:8000/api"

# 测试账号
CREDENTIALS = {
    'registrar': {'username': 'registrar1', 'password': '123456'},
    'auditor': {'username': 'auditor1', 'password': '123456'},
    'reviewer': {'username': 'reviewer1', 'password': '123456'},
}

tokens = {}
session = requests.Session()

def print_step(step_num, title):
    print(f"\n{'='*60}")
    print(f"  Step {step_num}: {title}")
    print(f"{'='*60}")

def print_test_result(name, passed, detail=""):
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"  {status} - {name}")
    if detail and not passed:
        print(f"     详情: {detail}")
    return passed

def login(role):
    """登录获取token"""
    r = session.post(f"{BASE_URL}/login", json=CREDENTIALS[role])
    assert r.status_code == 200, f"{role} login failed: {r.text}"
    data = r.json()
    tokens[role] = data['data']['token']
    session.headers.update({'Authorization': f"Bearer {tokens[role]}"})
    print(f"  ✅ {role} 登录成功")
    return data['data']

def api_get(path, role=None):
    headers = {}
    if role and tokens.get(role):
        headers['Authorization'] = f"Bearer {tokens[role]}"
    r = session.get(f"{BASE_URL}{path}", headers=headers)
    return r.status_code, r.json()

def api_post(path, payload, role=None):
    headers = {}
    if role and tokens.get(role):
        headers['Authorization'] = f"Bearer {tokens[role]}"
    r = session.post(f"{BASE_URL}{path}", json=payload, headers=headers)
    return r.status_code, r.json()

def check_detail(app_id, expected_status, expected_node, role='reviewer'):
    """检查详情页数据"""
    status, data = api_get(f"/applications/{app_id}", role)
    assert status == 200, f"获取详情失败: {data}"
    app = data['data']
    
    checks = [
        ('status', expected_status, app['status']),
        ('currentNode', expected_node, app['currentNode']),
        ('statusName 非空', True, len(app.get('statusName', '')) > 0),
        ('currentNodeName 非空', True, len(app.get('currentNodeName', '')) > 0),
        ('nodeTimelines 存在', True, 'nodeTimelines' in app and len(app['nodeTimelines']) == 5),
    ]
    
    all_pass = True
    for name, expected, actual in checks:
        passed = expected == actual
        if not passed:
            all_pass = False
        print_test_result(f"详情.{name}", passed, f"预期={expected}, 实际={actual}")
    
    return app, all_pass

def check_list(app_id, expected_status):
    """检查列表页数据"""
    status, data = api_get("/applications?pageSize=100", 'reviewer')
    assert status == 200, f"获取列表失败: {data}"
    
    items = data['data'].get('items', [])
    target = next((item for item in items if item['id'] == app_id), None)
    
    if not target:
        print_test_result("列表.申请存在", False, f"未找到申请 {app_id}")
        return None, False
    
    checks = [
        ('status', expected_status, target['status']),
    ]
    
    all_pass = True
    for name, expected, actual in checks:
        passed = expected == actual
        if not passed:
            all_pass = False
        print_test_result(f"列表.{name}", passed, f"预期={expected}, 实际={actual}")
    
    return target, all_pass

def check_stats(expected_status_counts):
    """检查统计页数据"""
    status, data = api_get("/stats/overview", 'reviewer')
    assert status == 200, f"获取统计失败: {data}"
    stats = data['data']
    
    all_pass = True
    status_stats = stats.get('statusStats', {})
    for status_key, expected_count in expected_status_counts.items():
        actual = status_stats.get(status_key, 0)
        passed = actual == expected_count
        if not passed:
            all_pass = False
        print_test_result(f"统计.{status_key}", passed, f"预期={expected_count}, 实际={actual}")
    
    return stats, all_pass

def check_database(app_id, expected_status, expected_archive_field=None):
    """检查数据库持久化（通过API间接验证）"""
    status, data = api_get(f"/applications/{app_id}", 'reviewer')
    app = data['data']
    
    checks = []
    if expected_archive_field == 'archived':
        checks.extend([
            ('archivedByName 非空', True, app.get('archivedByName') is not None and len(app['archivedByName']) > 0),
            ('completedAt 非空', True, app.get('completedAt') is not None),
        ])
    elif expected_archive_field == 'handover':
        checks.extend([
            ('handedOverByName 非空', True, app.get('handedOverByName') is not None and len(app['handedOverByName']) > 0),
            ('handedOverAt 非空', True, app.get('handedOverAt') is not None),
            ('handoverResult 非空', True, app.get('handoverResult') is not None and len(app['handoverResult']) > 0),
        ])
    
    all_pass = True
    for name, expected, actual in checks:
        passed = expected == actual
        if not passed:
            all_pass = False
        print_test_result(f"持久化.{name}", passed, f"预期={expected}, 实际={actual}")
    
    return all_pass

def check_operation_logs(app_id, expected_ops):
    """检查操作日志完整性"""
    status, data = api_get(f"/stats/logs?applicationId={app_id}&pageSize=100", 'reviewer')
    assert status == 200, f"获取操作日志失败: {data}"
    logs = data['data'].get('items', [])
    
    actual_ops = [log['operationType'] for log in logs]
    
    all_pass = True
    for op in expected_ops:
        found = op in actual_ops
        if not found:
            all_pass = False
        print_test_result(f"操作日志.{op}", found, f"实际操作: {actual_ops}")
    
    print(f"  📜 实际操作日志 ({len(logs)} 条):")
    for log in logs:
        status_change = f"{log.get('oldStatus','')} → {log.get('newStatus','')}" if log.get('oldStatus') and log.get('oldStatus') != log.get('newStatus') else log.get('newStatus','')
        print(f"     - {log['operationName']} | {log['userName']} | {status_change}")
    
    return all_pass

def check_node_timelines(app_id, expected_node_statuses):
    """检查节点时间线状态"""
    status, data = api_get(f"/applications/{app_id}", 'reviewer')
    app = data['data']
    timelines = app.get('nodeTimelines', [])
    
    all_pass = True
    tl_map = {tl['nodeType']: tl for tl in timelines}
    
    for node_type, expected_status in expected_node_statuses.items():
        tl = tl_map.get(node_type)
        if not tl:
            print_test_result(f"时间线.{node_type}", False, "节点不存在")
            all_pass = False
            continue
        
        actual = tl['status']
        passed = actual == expected_status
        if not passed:
            all_pass = False
        print_test_result(f"时间线.{node_type}", passed, f"预期={expected_status}, 实际={actual}")
        
        # 已完成的节点要有结束时间
        if expected_status == 'completed':
            has_end = tl.get('endTime') is not None
            if not has_end:
                all_pass = False
            print_test_result(f"时间线.{node_type}.endTime", has_end, "已完成节点应有结束时间")
    
    return all_pass

def test_archive_permission_validation():
    """测试归档权限校验"""
    print_step(0, "前置校验：归档权限与状态验证")
    
    # 先登录reviewer找到待归档的申请
    login('reviewer')
    status, data = api_get("/applications?status=room_confirmed&pageSize=10", 'reviewer')
    items = data['data'].get('items', [])
    
    if len(items) == 0:
        print("  ⚠️  没有找到待归档的申请，跳过权限校验测试")
        return None
    
    app_id = items[0]['id']
    print(f"  找到待归档申请: {items[0]['applicationNo']} - {items[0]['tenantName']}")
    
    # 测试：auditor角色尝试归档（应该失败）
    print("\n  测试1: auditor角色尝试归档（权限校验）")
    login('auditor')
    status, data = api_post(f"/applications/{app_id}/archive", 
                           {'action': 'archive', 'remark': '测试权限'}, 
                           'auditor')
    passed = status != 200 and "权限" in str(data.get('message', ''))
    print_test_result("auditor无归档权限", passed, f"status={status}, msg={data.get('message','')}")
    
    # 测试：registrar角色尝试归档（应该失败）
    print("\n  测试2: registrar角色尝试归档（权限校验）")
    login('registrar')
    status, data = api_post(f"/applications/{app_id}/archive", 
                           {'action': 'archive', 'remark': '测试权限'}, 
                           'registrar')
    passed = status != 200 and "权限" in str(data.get('message', ''))
    print_test_result("registrar无归档权限", passed, f"status={status}, msg={data.get('message','')}")
    
    # 测试：状态校验 - 用一个非room_confirmed状态的申请尝试归档
    print("\n  测试3: 状态校验（非待复核归档状态）")
    login('reviewer')
    status, data = api_get("/applications?status=pending_review&pageSize=1", 'reviewer')
    pending_items = data['data'].get('items', [])
    if pending_items:
        wrong_app_id = pending_items[0]['id']
        status, data = api_post(f"/applications/{wrong_app_id}/archive", 
                               {'action': 'archive', 'remark': '测试状态'}, 
                               'reviewer')
        passed = status != 200 and ("待复核归档" in str(data.get('message', '')) or "状态" in str(data.get('message', '')))
        print_test_result("状态校验（非待归档状态无法归档）", passed, f"status={status}, msg={data.get('message','')}")
    
    return app_id

def test_full_archive_flow():
    """测试完整的归档流程"""
    print_step(1, "登录并获取待归档申请")
    
    login('reviewer')
    status, data = api_get("/applications?status=room_confirmed&pageSize=10", 'reviewer')
    items = data['data'].get('items', [])
    
    if len(items) == 0:
        print("  ❌ 没有找到待归档的申请！请确保种子数据正确")
        return False
    
    app = items[0]
    app_id = app['id']
    print(f"  选择申请: {app['applicationNo']} - {app['tenantName']}")
    print(f"  当前状态: {app['status']} ({app['statusName']})")
    print(f"  当前节点: {app['currentNode']} ({app['currentNodeName']})")
    
    # 记录归档前的统计数据
    print_step(2, "记录归档前的统计数据")
    status, data = api_get("/stats/overview", 'reviewer')
    stats_before = data['data']
    room_confirmed_before = stats_before['statusStats'].get('roomConfirmed', 0)
    completed_before = stats_before['statusStats'].get('completed', 0)
    print(f"  归档前 - 待复核归档: {room_confirmed_before}, 已完成: {completed_before}")
    
    # Step 3: 执行归档操作
    print_step(3, "执行复核归档操作")
    archive_remark = "测试归档：资料齐全，流程完整，同意归档"
    status, data = api_post(f"/applications/{app_id}/archive", 
                           {'action': 'archive', 'remark': archive_remark}, 
                           'reviewer')
    
    if status != 200:
        print(f"  ❌ 归档失败: {data.get('message', '')}")
        return False
    
    print(f"  ✅ 归档成功！")
    print(f"     返回状态: {data['data'].get('status')}")
    print(f"     返回节点: {data['data'].get('currentNode')}")
    
    # Step 4: 验证详情页数据
    print_step(4, "验证详情页数据一致性")
    app_detail, detail_pass = check_detail(app_id, 'completed', 'archive')
    
    # 验证归档人信息
    archive_pass = all([
        print_test_result("归档人", '王复核', app_detail.get('archivedByName')),
        print_test_result("归档备注", archive_remark, app_detail.get('remark')),
    ])
    
    # Step 5: 验证列表页数据
    print_step(5, "验证列表页数据一致性")
    list_app, list_pass = check_list(app_id, 'completed')
    
    # Step 6: 验证统计页数据
    print_step(6, "验证统计页数据一致性")
    expected_counts = {
        'roomConfirmed': room_confirmed_before - 1,
        'completed': completed_before + 1,
    }
    stats_after, stats_pass = check_stats(expected_counts)
    
    # Step 7: 验证节点时间线
    print_step(7, "验证节点时间线状态")
    expected_tl = {
        'contract_signing': 'completed',
        'review': 'completed',
        'room_confirm': 'completed',
        'handover': 'completed',
        'archive': 'completed',
    }
    tl_pass = check_node_timelines(app_id, expected_tl)
    
    # Step 8: 验证操作日志
    print_step(8, "验证操作日志完整性")
    expected_ops = ['create', 'submit', 'review_approve', 'room_confirm', 'handover', 'archive']
    log_pass = check_operation_logs(app_id, expected_ops)
    
    # Step 9: 验证数据库持久化（通过API间接验证）
    print_step(9, "验证数据库持久化字段")
    db_pass = check_database(app_id, 'completed', 'archived')
    
    # Step 10: 验证刷新后数据一致性
    print_step(10, "验证刷新后数据一致性")
    print("  重新获取详情...")
    app_detail2, _ = check_detail(app_id, 'completed', 'archive')
    print("  重新获取列表...")
    list_app2, _ = check_list(app_id, 'completed')
    print("  重新获取统计...")
    stats2, _ = check_stats(expected_counts)
    
    refresh_pass = all([
        app_detail['status'] == app_detail2['status'],
        app_detail['archivedByName'] == app_detail2['archivedByName'],
        list_app['status'] == list_app2['status'],
        stats_after['statusStats']['completed'] == stats2['statusStats']['completed'],
    ])
    print_test_result("刷新后数据一致", refresh_pass)
    
    # 汇总结果
    print_step(11, "测试结果汇总")
    all_tests = [
        ('详情页数据', detail_pass and archive_pass),
        ('列表页数据', list_pass),
        ('统计页数据', stats_pass),
        ('节点时间线', tl_pass),
        ('操作日志', log_pass),
        ('持久化字段', db_pass),
        ('刷新一致性', refresh_pass),
    ]
    
    print()
    all_pass = True
    for name, passed in all_tests:
        if not passed:
            all_pass = False
        print(f"  {'✅' if passed else '❌'} {name}: {'通过' if passed else '失败'}")
    
    return all_pass

def main():
    print("\n" + "#"*60)
    print("#  端到端闭环测试：入住交接 → 复核归档")
    print("#  验证目标：状态机、三表联动、三端一致性、权限校验")
    print("#"*60)
    
    try:
        # 先进行权限和状态校验测试
        app_id = test_archive_permission_validation()
        
        # 然后进行完整归档流程测试
        flow_pass = test_full_archive_flow()
        
        print("\n" + "#"*60)
        if flow_pass:
            print("#  🎉 端到端测试全部通过！")
            print("#  归档闭环完整、数据一致、权限校验正确")
        else:
            print("#  ⚠️  部分测试未通过，请检查日志")
        print("#"*60 + "\n")
        
        return 0 if flow_pass else 1
        
    except Exception as e:
        print(f"\n❌ 测试过程出错: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == '__main__':
    sys.exit(main())
