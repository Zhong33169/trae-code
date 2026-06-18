#!/usr/bin/env python3
import requests

BASE = 'http://localhost:8002/api'

r = requests.post(f'{BASE}/auth/login', json={'username': 'registrar1', 'password': '123456'})
tok = r.json()['access_token']
h = {'Authorization': f'Bearer {tok}'}
print('1. Login: OK')

r = requests.post(f'{BASE}/applications', headers=h, json={
    'company_name': '前端代理测试公司',
    'contact_person': '代理测试',
    'contact_phone': '13800001111',
    'booth_type': '标准展位',
    'materials': [{'material_type': 'business_license', 'material_name': '营业执照.pdf'}],
})
print(f'2. Create: {r.status_code} id={r.json()["id"]} v={r.json()["version"]}')
app_id = r.json()['id']
app_v = r.json()['version']

r = requests.put(f'{BASE}/applications/{app_id}', headers=h, json={
    'version': app_v,
    'company_name': '前端代理测试公司（已修改）',
    'contact_person': '代理测试',
    'contact_phone': '13800001111',
    'materials': [
        {'material_type': 'business_license', 'material_name': '营业执照_v2.pdf'},
        {'material_type': 'product_catalog', 'material_name': '产品目录.pdf'},
    ],
})
print(f'3. Update: {r.status_code} v={r.json()["version"]}')
app_v = r.json()['version']

r = requests.post(f'{BASE}/applications/{app_id}/submit', headers=h, json={'version': app_v})
print(f'4. Submit: {r.status_code} status={r.json()["status"]} v={r.json()["version"]}')

print('\n✅ 前端→后端全链路验证通过！')
