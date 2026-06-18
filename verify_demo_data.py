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


print('=== 验证补正追踪演示数据 ===')
print()

# 1. 取订单列表，看看哪些有批量失败记录
orders = api('GET', '/orders', '3', 'doc_supervisor')
print(f'共 {len(orders)} 条订单')

# 取前 5 条订单的最新批量记录
order_ids = [str(o['id']) for o in orders[:5]]
print(f"查询订单 {','.join(order_ids)} 的最新批量失败记录")
print()

latest = api('GET', f'/orders/ops/batch-items/latest?order_ids={",".join(order_ids)}', '3', 'doc_supervisor')
print(f'返回 {len(latest)} 条最新失败/重试记录')
for item in latest:
    print()
    print(f'  📋 订单: {item["order_no"]}')
    status_text = {
        'success': '✅ 成功',
        'failed': '❌ 失败',
        'retry': '⚠️ 需重试',
    }.get(item['item_status'], item['item_status'])
    print(f'     状态: {status_text}')
    print(f'     提交版本: v{item["submitted_version"]}')
    if item['error_code']:
        print(f'     错误码: {item["error_code"]}')
    if item['error_message']:
        print(f'     原因: {item["error_message"]}')
    if item['responsible_role']:
        role_text = {
            'sales': '外贸业务员',
            'doc_supervisor': '单证主管',
            'biz_manager': '业务经理',
            'operator': '操作人',
            'admin': '系统管理员',
        }.get(item['responsible_role'], item['responsible_role'])
        print(f'     责任岗位: {role_text}')
    if item['suggestion']:
        print(f'     💡 处理建议: {item["suggestion"]}')

print()
print('--- 单订单批量历史示例 (PO202506180003) ---')
# 找订单号为 PO202506180003 的订单
order3 = next((o for o in orders if o['order_no'] == 'PO202506180003'), None)
if order3:
    items = api('GET', f'/orders/ops/orders/{order3["id"]}/batch-items', '3', 'doc_supervisor')
    print(f'共 {len(items)} 条批量操作记录')
    for i, item in enumerate(items):
        status_text = {
            'success': '✅ 成功',
            'failed': '❌ 失败',
            'retry': '⚠️ 需重试',
        }.get(item['item_status'], item['item_status'])
        print(f'  [{i+1}] {status_text} - v{item["submitted_version"]}', end='')
        if item['error_code']:
            print(f' - {item["error_code"]}', end='')
        if item['responsible_role']:
            print(f' - 责任: {item["responsible_role"]}', end='')
        print()

print()
print('=== 验证完成 ===')
