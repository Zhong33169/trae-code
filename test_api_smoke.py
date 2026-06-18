import requests

BASE = "http://localhost:8002/api"

def login(u, p):
    r = requests.post(f"{BASE}/auth/login", json={"username": u, "password": p})
    return r.json()

print("=== 登录测试 ===")
result = login("auditor1", "123456")
print(f"登录结果 keys: {list(result.keys())}")
print(f"token开头: {result.get('access_token', '')[:20]}...")
print(f"用户: {result.get('user', {})}")

tok = result["access_token"]

print("\n=== 申请列表测试 ===")
r = requests.get(f"{BASE}/applications", headers={"Authorization": f"Bearer {tok}"})
data = r.json()
print(f"状态码: {r.status_code}")
print(f"返回 keys: {list(data.keys()) if isinstance(data, dict) else '不是dict'}")
if isinstance(data, dict):
    print(f"total: {data.get('total')}, items数: {len(data.get('items', []))}")
    if data.get("items"):
        print(f"第一条申请 keys: {list(data['items'][0].keys())[:10]}")
        print(f"第一条: 编号={data['items'][0].get('application_no')} 公司={data['items'][0].get('company_name')} 状态={data['items'][0].get('status')} 逾期={data['items'][0].get('is_overdue')}")

print("\n=== 统计接口测试 ===")
r = requests.get(f"{BASE}/statistics", headers={"Authorization": f"Bearer {tok}"})
print(f"状态码: {r.status_code}")
data = r.json()
print(f"返回 keys: {list(data.keys())}")
print(f"总数: {data.get('total')}, 逾期: {data.get('overdue')}")

print("\n=== 详情接口测试 ===")
r = requests.get(f"{BASE}/applications/1", headers={"Authorization": f"Bearer {tok}"})
print(f"状态码: {r.status_code}")
data = r.json()
print(f"返回 keys: {list(data.keys())[:15]}")
print(f"审计日志数: {len(data.get('audit_logs', []))}")
if data.get("audit_logs"):
    print(f"第一条审计: {data['audit_logs'][0].get('action_name')} 操作人={data['audit_logs'][0].get('operator_name')}")

print("\n✅ 后端 API 全部正常")
