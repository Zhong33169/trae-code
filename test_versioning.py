import json
import urllib.request

base = "http://localhost:8001/api"

def login(username, password):
    data = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(f"{base}/login", data=data, method="POST",
        headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["token"]

def api_call(token, path, method="GET", data=None):
    url = f"{base}{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}"
        })
    try:
        resp = urllib.request.urlopen(req)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def print_test(title, status, result):
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    print(f"  HTTP 状态: {status}")
    print(f"  响应:")
    print(json.dumps(result, ensure_ascii=False, indent=4))
    print()

print("\n" + "=" * 60)
print("  版本一致性验证测试")
print("=" * 60 + "\n")

token_reg = login("zhangsan", "123456")
token_rev = login("lisi", "123456")

# 测试1: 提交审核带正确版本号(缺证据应该失败)
status, result = api_call(token_reg, "/applications/1/submit", "POST", {"current_version": 1})
print_test("测试1: 提交审核-带版本号(缺证据应该失败)", status, result)

# 测试2: 批量审核-混合场景
status, result = api_call(token_rev, "/applications/batch-review", "POST", {
    "applications": [
        {"application_id": 2, "current_version": 2},
        {"application_id": 5, "current_version": 5},
        {"application_id": 6, "current_version": 1},
        {"application_id": 1, "current_version": 1},
    ],
    "approved": True
})
print_test("测试2: 批量审核-混合场景(状态错+版本错+正常)", status, result)

# 测试3: 用旧版本号审核申请2
status, result = api_call(token_rev, "/applications/2/review", "POST", {
    "current_version": 1,
    "approved": True
})
print_test("测试3: 审核-用旧版本号(应该报版本冲突)", status, result)

# 测试4: 版本历史查询-确认保留证据和备注
status, history = api_call(token_rev, "/applications/5/history")
print_test("测试4: 版本历史-确认保留证据和备注", status, history)

print("=" * 60)
print("  所有测试完成!")
print("=" * 60)
