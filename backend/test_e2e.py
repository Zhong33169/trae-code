import requests

login_resp = requests.post('http://localhost:8005/api/auth/login', json={
    'username': 'supervisor',
    'password': '123456'
})
token = login_resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# 1. 测试列表接口
print('=== 列表接口测试 ===')
for queue in ['my_todo', 'my_created', 'all']:
    resp = requests.get(
        'http://localhost:8005/api/inspections',
        params={'page': 1, 'page_size': 100, 'queue': queue},
        headers=headers
    )
    data = resp.json()
    print(f'Queue {queue}: total={data["total"]}')
    for item in data['items'][:2]:
        print(f'  - {item["order_no"]} | status={item["status"]}')
        print(f'    allowed={item["allowed_actions"]}')

# 2. 测试审计日志接口
print()
print('=== 审计日志字段测试 ===')

# 先找有验收驳回记录的订单
list_resp = requests.get(
    'http://localhost:8005/api/inspections',
    params={'page': 1, 'page_size': 100, 'status': 'acceptance_rejected'},
    headers=headers
)
rejected = list_resp.json()['items']
if rejected:
    test_id = rejected[0]['id']
    detail_resp = requests.get(
        f'http://localhost:8005/api/audit/inspection/{test_id}',
        headers=headers
    )
    result = detail_resp.json()
    logs = result['items']
    print(f'验收驳回订单审计日志数量: {len(logs)}')
    for log in logs:
        print(f'  - [{log["action"]}] {log["operator_name"]}')
        if log.get('opinion'):
            print(f'    opinion: {log["opinion"][:40]}...')
        if log.get('signature'):
            print(f'    signature: {log["signature"]}')
        if log.get('error_code'):
            print(f'    error_code: {log["error_code"]}')
            print(f'    error_message: {log["error_message"]}')
            print(f'    suggestion: {log["suggestion"]}')
            print(f'    next_step: {log["next_step"]}')

# 3. 测试登记员的 created_by 权限
print()
print('=== 登记员 created_by 权限测试 ===')
reg_login = requests.post('http://localhost:8005/api/auth/login', json={
    'username': 'registrar',
    'password': '123456'
})
reg_token = reg_login.json()['access_token']
reg_headers = {'Authorization': f'Bearer {reg_token}'}

list_resp = requests.get(
    'http://localhost:8005/api/inspections',
    params={'page': 1, 'page_size': 100, 'queue': 'all'},
    headers=reg_headers
)
data = list_resp.json()
print(f'登记员看到的总数: {data["total"]}')
for item in data['items'][:3]:
    print(f'  - {item["order_no"]} | status={item["status"]}')
    print(f'    allowed_actions={item["allowed_actions"]}')

print()
print('✅ API 集成测试完成')
