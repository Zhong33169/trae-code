import urllib.request
import json


def test_batch(action, items, remark, user_id=3, role='doc_supervisor'):
    data = {
        'action': action,
        'order_items': items,
        'remark': remark
    }
    req = urllib.request.Request(
        'http://localhost:8005/api/orders/ops/batches',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-user-id': str(user_id),
            'x-role': role
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as r:
            result = json.loads(r.read())
        print(f'=== 批量操作: {action} | remark: "{remark}" ===')
        print(f'  总计: {result["total_count"]} | 成功: {result["success_count"]} | 失败: {result["failed_count"]} | 重试: {result["retry_count"]}')
        for item in result['items']:
            status_map = {'success': '✅成功', 'failed': '❌失败', 'retry': '🔄重试'}
            print(f'  {status_map.get(item["item_status"], item["item_status"])} {item["order_no"]}: {item.get("error_code", "-")} | {item.get("error_message", "")}')
        print()
        return result
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read().decode()}')
        return None


def test_remark_required(action, items):
    """测试批量退回/标记异常时备注必填"""
    print(f'=== 测试备注必填: {action} ===')
    data = {
        'action': action,
        'order_items': items,
        'remark': ''
    }
    req = urllib.request.Request(
        'http://localhost:8005/api/orders/ops/batches',
        data=json.dumps(data).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'x-user-id': '3',
            'x-role': 'doc_supervisor'
        },
        method='POST'
    )
    with urllib.request.urlopen(req) as r:
        result = json.loads(r.read())
    for item in result['items']:
        if item.get('error_code') == 'REMARK_REQUIRED':
            print(f'  ✅ {item["order_no"]}: 正确拦截备注缺失')
        else:
            print(f'  ❌ {item["order_no"]}: 未正确拦截备注缺失')
    print()


# 先获取所有订单的当前版本
print('=== 获取订单列表和版本号 ===')
req = urllib.request.Request(
    'http://localhost:8005/api/orders',
    headers={'x-user-id': '3', 'x-role': 'doc_supervisor'}
)
with urllib.request.urlopen(req) as r:
    orders = json.loads(r.read())
for o in orders:
    print(f'  id={o["id"]} no={o["order_no"]} status={o["status_display"]} version={o["version"]}')
print()

# 测试1: 混合场景 - 版本冲突 + 成功 + 状态错误
test_batch(
    'approve_doc',
    [
        {'order_id': 3, 'version': 99},  # 版本冲突
        {'order_id': 4, 'version': 1},   # 应该成功
        {'order_id': 6, 'version': 1},   # 单证异常，状态错误
        {'order_id': 10, 'version': 1},  # 已完成，状态错误
    ],
    '测试批量复核'
)

# 测试2: 批量退回 - 备注必填
test_remark_required(
    'reject_doc',
    [{'order_id': 4, 'version': 2}]  # 订单4已在测试1中被处理，版本从1变2了
)

# 测试3: 批量标记异常 - 备注必填
test_remark_required(
    'mark_exception_doc',
    [{'order_id': 4, 'version': 2}]
)

# 测试4: 批量退回 - 带备注（正常）
test_batch(
    'reject_doc',
    [{'order_id': 4, 'version': 2}],
    '订单资料不完整，缺少装箱单和商业发票'
)

print('=== 全部测试完成 ===')
