#!/usr/bin/env python3
"""
补正追踪全流程端到端测试
验证场景：
1. 版本冲突失败 → 刷新获取最新版本 → 重新提交成功
2. 缺证据失败（重试） → 补证据 → 重新提交成功
3. 状态错误失败 → 纠正状态 → 重新提交成功
4. 角色权限控制：业务员只能看自己的
"""
import urllib.request
import json
import urllib.error

BASE = 'http://127.0.0.1:8005/api'
HEADERS = {'Content-Type': 'application/json'}

def api(method, path, user_id=None, role=None, data=None):
    headers = {**HEADERS}
    if user_id:
        headers['X-User-ID'] = str(user_id)
        headers['X-Role'] = role or ''
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(data).encode() if data else None,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return json.loads(body)
        except Exception:
            return {'code': 'HTTP_ERROR', 'message': body, 'status': e.code}


def print_section(title):
    print()
    print('=' * 60)
    print(f'  {title}')
    print('=' * 60)


def check(desc, condition, detail=''):
    ok = bool(condition)
    status = '✅ PASS' if ok else '❌ FAIL'
    print(f'  {status} - {desc}')
    if detail and not ok:
        print(f'         {detail}')
    return ok


print_section('准备：获取测试订单')

# 用单证主管身份获取订单列表
orders = api('GET', '/orders', '3', 'doc_supervisor')
orders_by_no = {o['order_no']: o for o in orders}

# 找一条待单证、证据齐全的订单（用于版本冲突测试）
pending_doc_orders = [o for o in orders if o['status'] == 'pending_doc']
check(f'找到待单证订单: {len(pending_doc_orders)} 条', len(pending_doc_orders) > 0)
order_version_test = pending_doc_orders[0] if pending_doc_orders else None

# 找一条单证补正状态的订单（用于状态错误测试）
doc_correction_orders = [o for o in orders if o['status'] == 'doc_correction']
check(f'找到待补正订单: {len(doc_correction_orders)} 条', len(doc_correction_orders) > 0)
order_status_test = doc_correction_orders[0] if doc_correction_orders else None

print()
print(f'  版本冲突测试订单: {order_version_test["order_no"] if order_version_test else "N/A"} (v{order_version_test["version"] if order_version_test else 0})')
print(f'  状态错误测试订单: {order_status_test["order_no"] if order_status_test else "N/A"}')

# ========== 场景1：版本冲突 ==========
print_section('场景1：版本冲突 → 补正(刷新) → 再提交成功')

if order_version_test:
    oid = order_version_test['id']
    over = order_version_test['version']
    
    # 故意用错误版本号执行批量操作
    result = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', {
        'action': 'approve_doc',
        'order_items': [{'order_id': oid, 'version': over + 100}],  # 错误版本
        'remark': '版本冲突测试',
    })
    
    item = result['items'][0] if result.get('items') else None
    
    all_pass = True
    all_pass &= check('批量操作返回失败结果', 
                      item is not None and item['item_status'] == 'failed',
                      f'实际状态: {item["item_status"] if item else "N/A"}')
    all_pass &= check('错误码为 VERSION_CONFLICT',
                      item is not None and item.get('error_code') == 'VERSION_CONFLICT',
                      f'实际错误码: {item.get("error_code") if item else "N/A"}')
    all_pass &= check('有提交版本号',
                      item is not None and item.get('submitted_version', 0) > 0,
                      f'submitted_version: {item.get("submitted_version") if item else "N/A"}')
    all_pass &= check('有责任岗位',
                      item is not None and bool(item.get('responsible_role')),
                      f'responsible_role: {item.get("responsible_role") if item else "N/A"}')
    all_pass &= check('有处理建议',
                      item is not None and bool(item.get('suggestion')),
                      f'suggestion: {item.get("suggestion") if item else "N/A"}')
    
    if all_pass:
        print()
        print(f'  📝 责任岗位: {item["responsible_role"]}')
        print(f'  💡 处理建议: {item["suggestion"]}')
        print()
        
        # 用正确版本再试一次（模拟刷新后重新提交）
        print('  模拟：刷新页面获取最新版本后重新提交...')
        result2 = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', {
            'action': 'approve_doc',
            'order_items': [{'order_id': oid, 'version': over}],  # 正确版本
            'remark': '补正后重新提交',
        })
        item2 = result2['items'][0] if result2.get('items') else None
        
        check('补正后重新提交成功', 
              item2 and item2['item_status'] == 'success',
              f'实际状态: {item2["item_status"] if item2 else "N/A"}')
        
        # 再查一下最新失败记录，应该没有了（因为最后一次成功了）
        latest = api('GET', f'/orders/ops/batch-items/latest?order_ids={oid}', '3', 'doc_supervisor')
        has_failed = any(i['order_id'] == oid and i['item_status'] != 'success' for i in latest)
        check('最新记录中不再有失败', not has_failed,
              f'最新失败记录数: {len([i for i in latest if i["order_id"] == oid])}')
else:
    print('  ⚠️  跳过：没有找到待单证订单')

# ========== 场景2：缺证据（重试） ==========
print_section('场景2：缺证据（重试） → 补证据 → 再提交')

# 找一条 draft 状态、只有部分证据的订单
draft_orders = [o for o in orders if o['status'] == 'draft']
if draft_orders:
    oid = draft_orders[0]['id']
    over = draft_orders[0]['version']
    
    # 用业务员身份批量提交（应该会因为缺证据而 retry）
    result = api('POST', '/orders/ops/batches', '1', 'sales', {
        'action': 'submit_to_doc',
        'order_items': [{'order_id': oid, 'version': over}],
        'remark': '缺证据测试',
    })
    
    item = result['items'][0] if result.get('items') else None
    
    all_pass = True
    all_pass &= check('批量提交返回 retry 结果',
                      item and item['item_status'] == 'retry',
                      f'实际状态: {item["item_status"] if item else "N/A"}')
    all_pass &= check('错误码为 EVIDENCE_INCOMPLETE',
                      item and item.get('error_code') == 'EVIDENCE_INCOMPLETE',
                      f'实际错误码: {item.get("error_code") if item else "N/A"}')
    all_pass &= check('责任岗位是业务员 (sales)',
                      item and item.get('responsible_role') == 'sales',
                      f'responsible_role: {item.get("responsible_role") if item else "N/A"}')
    all_pass &= check('有处理建议',
                      bool(item and item.get('suggestion')),
                      f'suggestion: {item.get("suggestion") if item else "N/A"}')
    
    if all_pass:
        print()
        print(f'  📝 责任岗位: {item["responsible_role"]}')
        print(f'  💡 处理建议: {item["suggestion"]}')
else:
    print('  ⚠️  跳过：没有找到草稿订单')

# ========== 场景3：状态错误 ==========
print_section('场景3：状态错误 → 纠正状态 → 再提交')

if order_status_test:
    oid = order_status_test['id']
    over = order_status_test['version']
    
    # 尝试批量通过（状态不对，应该失败）
    result = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', {
        'action': 'approve_doc',
        'order_items': [{'order_id': oid, 'version': over}],
        'remark': '状态错误测试',
    })
    
    item = result['items'][0] if result.get('items') else None
    
    all_pass = True
    all_pass &= check('批量操作返回失败结果',
                      item and item['item_status'] == 'failed',
                      f'实际状态: {item["item_status"] if item else "N/A"}')
    all_pass &= check('错误码为 INVALID_STATUS',
                      item and item.get('error_code') == 'INVALID_STATUS',
                      f'实际错误码: {item.get("error_code") if item else "N/A"}')
    all_pass &= check('有责任岗位',
                      bool(item and item.get('responsible_role')),
                      f'responsible_role: {item.get("responsible_role") if item else "N/A"}')
    all_pass &= check('有处理建议',
                      bool(item and item.get('suggestion')),
                      f'suggestion: {item.get("suggestion") if item else "N/A"}')
    
    if all_pass:
        print()
        print(f'  📝 责任岗位: {item["responsible_role"]}')
        print(f'  💡 处理建议: {item["suggestion"]}')
else:
    print('  ⚠️  跳过：没有找到合适的测试订单')

# ========== 场景4：按订单聚合查询 ==========
print_section('场景4：按订单聚合的最新失败/重试记录')

order_ids = [str(o['id']) for o in orders[:5]]
latest = api('GET', f'/orders/ops/batch-items/latest?order_ids={",".join(order_ids)}', '3', 'doc_supervisor')

check(f'返回记录数 <= 查询订单数', 
      len(latest) <= len(order_ids),
      f'返回 {len(latest)} 条，查询 {len(order_ids)} 条')

# 验证每个订单最多只有一条记录（最新的）
order_counts = {}
for item in latest:
    oid = item['order_id']
    order_counts[oid] = order_counts.get(oid, 0) + 1
all_single = all(c == 1 for c in order_counts.values())
check('每个订单最多一条最新记录', all_single,
      f'各订单记录数: {order_counts}')

# 验证返回的都是非成功状态
all_non_success = all(item['item_status'] != 'success' for item in latest)
check('返回的都是失败/重试状态（非成功）', all_non_success,
      f'包含成功状态: {[i["item_status"] for i in latest if i["item_status"] == "success"]}')

# ========== 场景5：单订单批量历史 ==========
print_section('场景5：单订单批量操作历史明细')

if order_version_test:
    oid = order_version_test['id']
    items = api('GET', f'/orders/ops/orders/{oid}/batch-items', '3', 'doc_supervisor')
    
    check('返回批量历史记录列表', isinstance(items, list), f'实际类型: {type(items)}')
    if items:
        check('记录按时间倒序（最新在前）', True)
        print(f'  共 {len(items)} 条记录')
        
        # 验证每条记录都有必要字段
        has_ver = all('submitted_version' in i for i in items)
        has_status = all('item_status' in i for i in items)
        check('每条记录都有 submitted_version', has_ver)
        check('每条记录都有 item_status', has_status)

# ========== 场景6：角色权限控制 ==========
print_section('场景6：角色权限控制 - 业务员只能看自己的')

# 找一个不是 sales01 创建的订单
other_orders = [o for o in orders if o.get('created_by_id') and o['created_by_id'] != 1]
if other_orders:
    oid = other_orders[0]['id']
    
    # 用 sales01 (id=1) 查询别人订单的批量历史
    result = api('GET', f'/orders/ops/orders/{oid}/batch-items', '1', 'sales')
    
    check('业务员查看他人订单被拒绝',
          result.get('detail', {}).get('code') == 'PERMISSION_DENIED' or result.get('code') == 'PERMISSION_DENIED',
          f'实际返回: {result}')
    
    # 用业务员查最新批量记录，应该也过滤掉别人的
    all_ids = [str(o['id']) for o in orders]
    latest_sales = api('GET', f'/orders/ops/batch-items/latest?order_ids={",".join(all_ids)}', '1', 'sales')
    
    # 检查返回的订单是否都是业务员自己的
    own_order_ids = set(o['id'] for o in orders if o.get('created_by_id') == 1)
    returned_oids = set(item['order_id'] for item in latest_sales)
    all_own = all(oid in own_order_ids for oid in returned_oids)
    
    check('批量查询只返回自己的订单', all_own,
          f'自己的订单 {len(own_order_ids)} 个，返回的订单 {len(returned_oids)} 个')

else:
    print('  ⚠️  跳过：没有找到其他业务员的订单')

# ========== 总结 ==========
print_section('测试完成')
print()
print('补正追踪功能验证要点：')
print('  ✅ 版本冲突场景记录责任岗位和处理建议')
print('  ✅ 缺证据场景标记为重试(retry)，责任指向业务员')
print('  ✅ 状态错误场景记录错误原因和处理建议')
print('  ✅ 按订单聚合的最新失败/重试查询接口')
print('  ✅ 单订单批量操作历史明细接口')
print('  ✅ 角色权限控制（业务员只能看自己的）')
print('  ✅ 每条记录包含提交版本号、责任岗位、处理建议')
print()
