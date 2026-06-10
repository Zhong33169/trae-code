import requests
import json

login_resp = requests.post('http://localhost:8005/api/auth/login', json={
    'username': 'registrar',
    'password': '123456'
})
print(f'Login status: {login_resp.status_code}')
token = login_resp.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

list_resp = requests.get(
    'http://localhost:8005/api/inspections',
    params={'page': 1, 'page_size': 3},
    headers=headers
)
print(f'List status: {list_resp.status_code}')
if list_resp.status_code == 200:
    data = list_resp.json()
    print(f'Total: {data["total"]}')
    print(f'Statistics keys: {list(data["statistics"].keys())}')
    print(f'my_todo count: {data["statistics"]["my_todo"]}')
    print(f'my_created count: {data["statistics"]["my_created"]}')
    print(f'all count: {data["statistics"]["all"]}')
    if data['items']:
        item = data['items'][0]
        print(f'First item: {item["order_no"]}')
        print(f'  status: {item["status"]}')
        print(f'  allowed_actions: {item["allowed_actions"]}')
        print(f'  can_operate: {item["can_operate"]}')
else:
    print(f'Error: {list_resp.text}')

print('\n--- Testing supervisor ---')
login_resp2 = requests.post('http://localhost:8005/api/auth/login', json={
    'username': 'supervisor',
    'password': '123456'
})
token2 = login_resp2.json()['access_token']
headers2 = {'Authorization': f'Bearer {token2}'}

list_resp2 = requests.get(
    'http://localhost:8005/api/inspections',
    params={'page': 1, 'page_size': 3, 'queue': 'my_todo'},
    headers=headers2
)
print(f'Supervisor list status: {list_resp2.status_code}')
if list_resp2.status_code == 200:
    data2 = list_resp2.json()
    print(f'Supervisor total my_todo: {data2["total"]}')
    print(f'Supervisor stats my_todo: {data2["statistics"]["my_todo"]}')
    if data2['items']:
        item = data2['items'][0]
        print(f'First item: {item["order_no"]}')
        print(f'  status: {item["status"]}')
        print(f'  allowed_actions: {item["allowed_actions"]}')
else:
    print(f'Error: {list_resp2.text}')
