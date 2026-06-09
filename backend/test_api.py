import httpx
import json

base = 'http://localhost:8010'

print("=" * 60)
print("K12课程服务单系统 - API 测试")
print("=" * 60)

r = httpx.post(f'{base}/api/auth/login', json={'username': 'registrar1', 'password': '123456'})
token = r.json()['access_token']
print(f"\n✓ 登记员登录成功: {r.json()['user']['name']}")
headers = {'Authorization': f'Bearer {token}'}

print("\n" + "=" * 60)
print("1. 测试扫码核验 - 无效码")
print("=" * 60)
r = httpx.post(f'{base}/api/orders/scan', json={'qr_code': 'INVALID_123456'}, headers=headers)
data = r.json()
print(f"状态码: {r.status_code}")
print(f"valid: {data.get('valid')}")
print(f"message: {data.get('message')}")
print(f"error_code: {data.get('error_code')}")

print("\n" + "=" * 60)
print("2. 测试扫码核验 - 重复码(已完成)")
print("=" * 60)
r = httpx.post(f'{base}/api/orders/scan', json={'qr_code': 'QRD4E5F6G7H8I9J0'}, headers=headers)
data = r.json()
print(f"状态码: {r.status_code}")
print(f"valid: {data.get('valid')}")
print(f"message: {data.get('message')}")
print(f"error_code: {data.get('error_code')}")

print("\n" + "=" * 60)
print("3. 测试扫码核验 - 非当前处理人(登记员扫待审核单)")
print("=" * 60)
r = httpx.post(f'{base}/api/orders/scan', json={'qr_code': 'QRB2C3D4E5F6G7H8'}, headers=headers)
data = r.json()
print(f"状态码: {r.status_code}")
print(f"valid: {data.get('valid')}")
print(f"message: {data.get('message')}")
print(f"error_code: {data.get('error_code')}")

print("\n" + "=" * 60)
print("4. 测试扫码核验 - 审核员扫待审核单(应该通过)")
print("=" * 60)
r2 = httpx.post(f'{base}/api/auth/login', json={'username': 'reviewer1', 'password': '123456'})
token2 = r2.json()['access_token']
headers2 = {'Authorization': f'Bearer {token2}'}
r = httpx.post(f'{base}/api/orders/scan', json={'qr_code': 'QRB2C3D4E5F6G7H8'}, headers=headers2)
data = r.json()
print(f"状态码: {r.status_code}")
print(f"valid: {data.get('valid')}")
print(f"message: {data.get('message')}")
if data.get('order'):
    print(f"订单号: {data['order'].get('order_no')}")
    print(f"状态: {data['order'].get('status')}")

print("\n" + "=" * 60)
print("5. 测试统计数据")
print("=" * 60)
r = httpx.get(f'{base}/api/statistics', headers=headers)
data = r.json()
print(f"总单数: {data.get('total')}")
print(f"草稿: {data.get('draft')}")
print(f"待审核: {data.get('pending_review')}")
print(f"待复核: {data.get('pending_finalize')}")
print(f"已完成: {data.get('completed')}")
print(f"已驳回: {data.get('rejected')}")

print("\n" + "=" * 60)
print("6. 测试服务单列表")
print("=" * 60)
r = httpx.get(f'{base}/api/orders?page=1&page_size=5', headers=headers)
data = r.json()
print(f"总数: {data.get('total')}")
print(f"返回条数: {len(data.get('items', []))}")
for item in data.get('items', [])[:3]:
    print(f"  - {item['order_no']} ({item['status']})")

print("\n" + "=" * 60)
print("7. 测试服务单详情")
print("=" * 60)
order_id = data['items'][0]['id']
r = httpx.get(f'{base}/api/orders/{order_id}', headers=headers)
detail = r.json()
print(f"订单号: {detail.get('order_no')}")
print(f"状态: {detail.get('status')}")
print(f"学员: {detail.get('student', {}).get('name')}")
print(f"课程: {detail.get('course', {}).get('name')}")
print(f"材料数: {len(detail.get('materials', []))}")
print(f"审计日志数: {len(detail.get('audit_logs', []))}")
print(f"版本号: {detail.get('version')}")

print("\n" + "=" * 60)
print("✓ 所有基础测试完成!")
print("=" * 60)
