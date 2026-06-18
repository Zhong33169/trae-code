import urllib.request
import json


def test_batch(action, items, remark, user_id=3, role='doc_supervisor', desc=''):
    print(f'\n{"="*60}')
    print(f'测试: {desc}')
    print(f'{"="*60}')
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
        print(f'操作: {result["action_display"]} | 备注: "{result["remark"]}"')
        print(f'总计: {result["total_count"]} | ✅成功: {result["success_count"]} | ❌失败: {result["failed_count"]} | 🔄重试: {result["retry_count"]}')
        for item in result['items']:
            status_map = {'success': '✅成功', 'failed': '❌失败', 'retry': '🔄重试'}
            print(f'  {status_map.get(item["item_status"], item["item_status"])} {item["order_no"]}:')
            if item.get('error_code'):
                print(f'    错误码: {item["error_code"]}')
            if item.get('error_message'):
                print(f'    说明: {item["error_message"]}')
        return result
    except urllib.error.HTTPError as e:
        print(f'HTTP {e.code}: {e.read().decode()}')
        return None


def get_orders(user_id=3, role='doc_supervisor'):
    req = urllib.request.Request(
        'http://localhost:8005/api/orders',
        headers={'x-user-id': str(user_id), 'x-role': role}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def get_order_history(order_id, user_id=3, role='doc_supervisor'):
    req = urllib.request.Request(
        f'http://localhost:8005/api/orders/{order_id}/histories',
        headers={'x-user-id': str(user_id), 'x-role': role}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


print('=== 获取当前订单列表 ===')
orders = get_orders()
order_map = {}
for o in orders:
    order_map[o['id']] = o
    print(f'  id={o["id"]} no={o["order_no"]} status={o["status_display"]} v{o["version"]}')

# 测试1: 单证主管批量审核 - 混合成功(状态正确+证据全)、失败(状态错误)、失败(版本冲突)
print('\n\n=== 测试1: 单证主管批量审核(混合场景) ===')
test_batch(
    'approve_doc',
    [
        {'order_id': 3, 'version': order_map[3]['version']},  # 待单证处理, 证据全 → 成功
        {'order_id': 4, 'version': 99},  # 待单证处理, 但版本错误 → 失败(VERSION_CONFLICT)
        {'order_id': 6, 'version': order_map[6]['version']},  # 单证异常 → 失败(INVALID_STATUS)
        {'order_id': 10, 'version': order_map[10]['version']},  # 已完成 → 失败(INVALID_STATUS)
    ],
    '测试批量复核',
    desc='单证主管批量审核(混合成功/版本冲突/状态错误)'
)

# 测试2: 单证主管批量退回 - 不填备注 → 应该拦截
print('\n\n=== 测试2: 单证主管批量退回(不填备注) ===')
test_batch(
    'reject_doc',
    [
        {'order_id': 4, 'version': order_map[4]['version']},  # 待单证处理
    ],
    '',
    desc='批量退回不填备注 → 应该被拦截(REMARK_REQUIRED)'
)

# 测试3: 单证主管批量退回 - 填备注 → 成功
print('\n\n=== 测试3: 单证主管批量退回(填备注) ===')
test_batch(
    'reject_doc',
    [
        {'order_id': 4, 'version': order_map[4]['version']},  # 待单证处理
    ],
    '缺少装箱单、商业发票和原产地证书，需补齐后重新提交',
    desc='批量退回填写备注 → 应该成功'
)

# 重新获取订单列表看变化
print('\n\n=== 操作后订单列表 ===')
orders2 = get_orders()
for o in orders2:
    changed = '' if o['version'] == order_map[o['id']]['version'] else ' ← 已变更'
    print(f'  id={o["id"]} no={o["order_no"]} status={o["status_display"]} v{o["version"]}{changed}')

# 查看订单4的操作历史
print('\n\n=== 订单4 (PO202506180004) 操作历史 ===')
histories = get_order_history(4)
for h in histories:
    print(f'  [{h["created_at"]}] {h["operator_name"]} - {h["action"]}')
    print(f'    {h["from_status_display"]} → {h["to_status_display"]}')
    if h['remark']:
        print(f'    备注: {h["remark"]}')

# 测试4: 业务员批量提交单证 - 混合成功(证据全)、重试(缺证据)
print('\n\n=== 测试4: 业务员批量提交单证(混合成功/重试) ===')
test_batch(
    'submit_to_doc',
    [
        {'order_id': 1, 'version': order_map[1]['version']},  # 草稿, 无证据 → 重试(MISSING_EVIDENCE)
        {'order_id': 2, 'version': order_map[2]['version']},  # 草稿, 仅询盘 → 重试(MISSING_EVIDENCE)
        {'order_id': 5, 'version': order_map[5]['version']},  # 待业务员补正, 证据全 → 成功
    ],
    '批量提交单证',
    user_id=1,
    role='sales',
    desc='业务员批量提交(混合重试/成功)'
)

print('\n\n' + '='*60)
print('✅ 所有端到端测试完成!')
print('='*60)
