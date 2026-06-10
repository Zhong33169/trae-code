import requests

login_resp = requests.post('http://localhost:8005/api/auth/login', json={
    'username': 'supervisor',
    'password': '123456'
})
token = login_resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

list_resp = requests.get(
    'http://localhost:8005/api/inspections',
    params={'page': 1, 'page_size': 1, 'queue': 'my_todo'},
    headers=headers
)
data = list_resp.json()
order_id = data['items'][0]['id']
print(f'Testing order ID: {order_id}')

detail_resp = requests.get(
    f'http://localhost:8005/api/inspections/{order_id}',
    headers=headers
)
print(f'Detail status: {detail_resp.status_code}')
if detail_resp.status_code == 200:
    detail = detail_resp.json()
    print(f'Order no: {detail["order_no"]}')
    print(f'Status: {detail["status"]}')
    print(f'Allowed actions: {detail["allowed_actions"]}')
    print(f'Can operate: {detail["can_operate"]}')
    print(f'Has qr_records: {"qr_records" in detail}')
    if detail.get('qr_records'):
        print(f'QR records count: {len(detail["qr_records"])}')
else:
    print(f'Error: {detail_resp.text}')

print('\n--- Testing status update ---')
update_resp = requests.post(
    f'http://localhost:8005/api/inspections/{order_id}/status',
    json={
        'target_status': 'pending_final_review',
        'opinion': '测试审核通过',
        'signature': '李主管'
    },
    headers=headers
)
print(f'Update status: {update_resp.status_code}')
if update_resp.status_code == 200:
    result = update_resp.json()
    print(f'New status: {result["status"]}')
    print(f'Allowed actions: {result["allowed_actions"]}')
else:
    print(f'Error: {update_resp.text}')
