import urllib.request
import urllib.parse
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


print('=' * 60)
print('测试: 批量结果 submitted_version 和 order_id_tmp 验证')
print('=' * 60)

# 先重置数据库（重新 seed）
print('\n--- 步骤1: 查看订单列表（找一条待单证的订单） ---')
orders = api('GET', '/orders', '3', 'doc_supervisor')
pending_orders = [o for o in orders if o['status'] == 'pending_doc']
print(f'  找到 {len(pending_orders)} 条待单证订单')
for o in pending_orders[:3]:
    print(f'    - {o["order_no"]}  id={o["id"]}  v{o["version"]}  {o["status_display"]}')

if not pending_orders:
    print('  ❌ 没有待单证订单，无法测试')
    exit(1)

oid = pending_orders[0]['id']
over = pending_orders[0]['version']
print(f'\n  使用订单 id={oid}, version={over} 进行测试')

# 测试1：版本冲突，验证 submitted_version
print('\n--- 步骤2: 批量操作（版本冲突场景），验证 submitted_version ---')
batch_data = {
    'action': 'approve_doc',
    'order_items': [
        {'order_id': oid, 'version': 999},  # 版本冲突
    ],
    'remark': '测试submitted_version',
}
result = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', batch_data)
print(f'  批处理结果: {result["batch_no"]}')
print(f'  总计: {result["total_count"]}  成功: {result["success_count"]}  失败: {result["failed_count"]}  重试: {result["retry_count"]}')
for item in result['items']:
    print(f'    - {item["order_no"]}  提交版本: v{item["submitted_version"]}  结果: {item["item_status"]}')
    if item['error_code']:
        print(f'      错误码: {item["error_code"]}')

# 验证 submitted_version 是否等于提交时的版本
print('\n  🧪 验证 submitted_version:')
item1 = result['items'][0]
assert item1['submitted_version'] == 999, f'❌ 提交版本应该是 v999，实际 v{item1["submitted_version"]}'
print('    ✅ submitted_version 正确返回提交时的版本号')

# 测试2：不存在的订单，验证 order_id_tmp 和返回
print('\n--- 步骤3: 包含不存在订单的批量操作，验证 order_id_tmp ---')
fake_id = 99999
batch_data2 = {
    'action': 'approve_doc',
    'order_items': [
        {'order_id': fake_id, 'version': 1},          # 不存在的订单
        {'order_id': pending_orders[0]['id'], 'version': 1},  # 版本冲突的订单
    ],
    'remark': '测试不存在订单',
}
result2 = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', batch_data2)
print(f'  批处理结果: {result2["batch_no"]}')
print(f'  总计: {result2["total_count"]}  成功: {result2["success_count"]}  失败: {result2["failed_count"]}  重试: {result2["retry_count"]}')
for item in result2['items']:
    print(f'    - {item["order_no"]} (id={item["order_id"]})  提交版本: v{item["submitted_version"]}  结果: {item["item_status"]}')
    if item['error_code']:
        print(f'      错误码: {item["error_code"]} - {item["error_message"]}')

# 验证不存在订单的返回
fake_item = next(i for i in result2['items'] if i['order_id'] == fake_id)
assert fake_item['item_status'] == 'failed', '❌ 不存在订单应该是失败状态'
assert fake_item['error_code'] == 'ORDER_NOT_FOUND', '❌ 错误码应该是 ORDER_NOT_FOUND'
assert f'不存在-{fake_id}' in fake_item['order_no'], '❌ 订单号应该标记为不存在'
assert fake_item['submitted_version'] == 1, '❌ 提交版本应该是 v1'
print('    ✅ 不存在订单正确返回原始 order_id 和 submitted_version')

# 测试3：从批量历史列表读取，验证 order_id_tmp 还原
print('\n--- 步骤4: 从批量历史列表读取，验证 order_id_tmp 还原 ---')
batches = api('GET', '/orders/ops/batches', '3', 'doc_supervisor')
print(f'  获取到 {len(batches)} 条批量历史')

# 找到我们刚才执行的包含 fake_id 的批次
target_batch = None
for b in batches:
    for it in b['items']:
        if it['order_id'] == fake_id:
            target_batch = b
            break
    if target_batch:
        break

assert target_batch is not None, '❌ 找不到包含不存在订单的批次'
print(f'  找到批次: {target_batch["batch_no"]}')
for item in target_batch['items']:
    print(f'    - {item["order_no"]} (id={item["order_id"]})  提交版本: v{item["submitted_version"]}  结果: {item["item_status"]}')

fake_item2 = next(i for i in target_batch['items'] if i['order_id'] == fake_id)
assert fake_item2['order_id'] == fake_id, f'❌ 还原后 order_id 应该是 {fake_id}'
assert f'不存在-{fake_id}' in fake_item2['order_no'], '❌ 订单号应该标记为不存在'
assert fake_item2['submitted_version'] == 1, '❌ 提交版本应该是 v1'
print('    ✅ 从历史列表读取时，order_id_tmp 和 submitted_version 正确还原')

print('\n' + '=' * 60)
print('✅ 所有验证通过!')
print('=' * 60)
print()
print('验证总结:')
print('  1. ✅ 批量结果接口正确返回每条的 submitted_version')
print('  2. ✅ 不存在的订单正确写入 order_id_tmp 并返回原始 order_id')
print('  3. ✅ 批量历史列表读取时正确还原缺失订单编号')
print('  4. ✅ BatchOperationItem.version 字段正确记录提交版本')
