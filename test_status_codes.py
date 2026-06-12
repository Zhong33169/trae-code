import requests
from datetime import datetime

BASE = "http://localhost:8008"

# 登录街道科员
r = requests.post(f"{BASE}/api/auth/login", json={"username":"lina","password":"123456"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# 获取待核实列表
r = requests.get(f"{BASE}/api/applications?status=pending_verify", headers=headers)
apps = r.json()
test_app = None
for a in apps:
    if a["applicant_name"].startswith("测试"):
        test_app = a
        break

if test_app:
    print(f"测试申请: {test_app['application_no']}, v{test_app['version']}")
    
    # 测试1：缺意见 - 应该返回422
    payload = {
        "action": "verify",
        "opinion": "",
        "materials": [],
        "version": test_app["version"],
        "overdue_reason": ""
    }
    r = requests.post(f"{BASE}/api/applications/{test_app['id']}/advance", json=payload, headers=headers)
    print(f"\n测试1（缺意见）: HTTP {r.status_code}")
    print(f"  响应: {r.text}")
    print(f"  状态码422: {'✅' if r.status_code == 422 else '❌'}")
    
    # 测试2：有意见缺材料 - 应该返回422
    payload = {
        "action": "verify",
        "opinion": "测试意见",
        "materials": [],
        "version": test_app["version"],
        "overdue_reason": ""
    }
    r = requests.post(f"{BASE}/api/applications/{test_app['id']}/advance", json=payload, headers=headers)
    print(f"\n测试2（缺材料）: HTTP {r.status_code}")
    print(f"  响应: {r.text}")
    print(f"  状态码422: {'✅' if r.status_code == 422 else '❌'}")

# 测试逾期
print("\n" + "="*50)
r = requests.post(f"{BASE}/api/auth/login", json={"username":"wangqiang","password":"123456"})
leader_token = r.json()["token"]
leader_headers = {"Authorization": f"Bearer {leader_token}"}

r = requests.get(f"{BASE}/api/applications?status=pending_approve", headers=leader_headers)
apps = r.json()
overdue_app = None
for a in apps:
    if a.get("deadline") and a["status"] == "pending_approve":
        dl = datetime.fromisoformat(a["deadline"].replace("Z", "+00:00"))
        if datetime.now(dl.tzinfo) > dl:
            overdue_app = a
            break

if overdue_app:
    print(f"逾期申请: {overdue_app['application_no']}, v{overdue_app['version']}")
    print(f"截止日期: {overdue_app['deadline'][:10]}")
    
    # 测试3：逾期缺说明 - 应该返回422
    payload = {
        "action": "approve",
        "opinion": "同意",
        "materials": [{
            "stage": "approval",
            "file_name": "test.pdf",
            "file_path": "test.pdf",
            "material_type": "审批意见"
        }],
        "version": overdue_app["version"],
        "overdue_reason": ""
    }
    r = requests.post(f"{BASE}/api/applications/{overdue_app['id']}/advance", json=payload, headers=leader_headers)
    print(f"\n测试3（逾期缺说明）: HTTP {r.status_code}")
    print(f"  响应: {r.text}")
    print(f"  状态码422: {'✅' if r.status_code == 422 else '❌'}")

# 测试4：version冲突 - 应该返回409
print("\n" + "="*50)
if test_app:
    payload = {
        "action": "verify",
        "opinion": "测试",
        "materials": [],
        "version": test_app["version"] + 100,
        "overdue_reason": ""
    }
    r = requests.post(f"{BASE}/api/applications/{test_app['id']}/advance", json=payload, headers=headers)
    print(f"测试4（version冲突）: HTTP {r.status_code}")
    print(f"  响应: {r.text}")
    print(f"  状态码409: {'✅' if r.status_code == 409 else '❌'}")

print("\n" + "="*50)
print("状态码测试完成！")
