import requests

BASE_URL = 'http://localhost:8007'

login_resp = requests.post(f'{BASE_URL}/api/auth/login', json={
    'username': 'registrar',
    'password': '123456'
})
print(f'Login status: {login_resp.status_code}')
if login_resp.status_code != 200:
    print(f'Login error: {login_resp.text}')
    exit(1)
token = login_resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

list_resp = requests.get(
    f'{BASE_URL}/api/inspections',
    params={'page': 1, 'page_size': 3},
    headers=headers
)
print(f'List status: {list_resp.status_code}')
if list_resp.status_code == 200:
    data = list_resp.json()
    print(f'Total: {data["total"]}')
    print(f'my_todo: {data["statistics"]["my_todo"]}')
    print(f'my_created: {data["statistics"]["my_created"]}')
    print(f'all: {data["statistics"]["all"]}')
    if data['items']:
        item = data['items'][0]
        print(f'First item: {item["order_no"]}')
        print(f'  status: {item["status"]}')
        print(f'  allowed_actions: {item["allowed_actions"]}')
else:
    print(f'Error: {list_resp.text}')

print('\n--- Testing detail ---')
order_id = data['items'][0]['id']
detail_resp = requests.get(
    f'{BASE_URL}/api/inspections/{order_id}',
    headers=headers
)
print(f'Detail status: {detail_resp.status_code}')
if detail_resp.status_code == 200:
    detail = detail_resp.json()
    print(f'Order no: {detail["order_no"]}')
    print(f'Allowed actions: {detail["allowed_actions"]}')
    print(f'QR records count: {len(detail.get("qr_records", []))}')
else:
    print(f'Error: {detail_resp.text}')

print('\n--- Testing supervisor ---')
sup_resp = requests.post(f'{BASE_URL}/api/auth/login', json={
    'username': 'supervisor',
    'password': '123456'
})
sup_token = sup_resp.json()['access_token']
sup_headers = {'Authorization': f'Bearer {sup_token}'}

sup_list_resp = requests.get(
    f'{BASE_URL}/api/inspections',
    params={'page': 1, 'page_size': 3, 'queue': 'my_todo'},
    headers=sup_headers
)
print(f'Supervisor list status: {sup_list_resp.status_code}')
if sup_list_resp.status_code == 200:
    sup_data = sup_list_resp.json()
    print(f'Supervisor my_todo total: {sup_data["total"]}')
    print(f'Supervisor my_todo stats: {sup_data["statistics"]["my_todo"]}')
    if sup_data['items']:
        item = sup_data['items'][0]
        print(f'First item: {item["order_no"]} - {item["status"]}')
        print(f'  allowed_actions: {item["allowed_actions"]}')
else:
    print(f'Error: {sup_list_resp.text}')
