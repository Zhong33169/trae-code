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


print('=== 测试补正追踪功能 ===')
print()

# 1. 先获取订单列表
orders = api('GET', '/orders', '3', 'doc_supervisor')
print(f'获取到 {len(orders)} 条订单')

# 找一条待单证的订单
pending = [o for o in orders if o['status'] == 'pending_doc']
print(f'待单证订单: {len(pending)} 条')

if pending:
    oid = pending[0]['id']
    over = pending[0]['version']
    print(f'  使用订单 id={oid}, version={over}')
    print()
    
    # 2. 执行一次批量操作（故意用错误版本）
    print('--- 执行批量操作（版本冲突场景） ---')
    result = api('POST', '/orders/ops/batches', '3', 'doc_supervisor', {
        'action': 'approve_doc',
        'order_items': [{'order_id': oid, 'version': 999}],
        'remark': '测试版本冲突',
    })
    print(f'  批处理结果: {result["batch_no"]}')
    for item in result['items']:
        print(f'    - {item["order_no"]}')
        print(f'      状态: {item["item_status"]}')
        print(f'      提交版本: v{item["submitted_version"]}')
        print(f'      错误码: {item["error_code"]}')
        print(f'      责任岗位: {item["responsible_role"]}')
        print(f'      处理建议: {item["suggestion"]}')
    print()
    
    # 3. 测试按订单聚合的最近批量记录
    print('--- 测试按订单聚合的最近批量记录 ---')
    latest = api('GET', f'/orders/ops/batch-items/latest?order_ids={oid}', '3', 'doc_supervisor')
    print(f'  返回 {len(latest)} 条记录')
    for item in latest:
        print(f'    - {item["order_no"]}')
        print(f'      状态: {item["item_status"]}')
        print(f'      提交版本: v{item["submitted_version"]}')
        print(f'      错误码: {item["error_code"]}')
        print(f'      责任岗位: {item["responsible_role"]}')
        print(f'      处理建议: {item["suggestion"]}')
    print()
    
    # 4. 测试单个订单的批量历史
    print('--- 测试单个订单的批量历史 ---')
    items = api('GET', f'/orders/ops/orders/{oid}/batch-items', '3', 'doc_supervisor')
    print(f'  返回 {len(items)} 条记录')
    for item in items[:3]:
        print(f'    - {item["order_no"]}')
        print(f'      状态: {item["item_status"]}')
        print(f'      提交版本: v{item["submitted_version"]}')
        print(f'      错误码: {item["error_code"]}')
        print(f'      责任岗位: {item["responsible_role"]}')
        print(f'      处理建议: {item["suggestion"]}')

print()
print('=== 测试完成 ===')
