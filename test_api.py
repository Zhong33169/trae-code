import json
import urllib.request

base = "http://localhost:8000/api"

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
print("  后端 API 验证测试")
print("=" * 60 + "\n")

token_registrar = login("zhangsan", "123456")
token_reviewer = login("lisi", "123456")
token_final = login("wangwu", "123456")

status, result = api_call(token_reviewer, "/applications", "POST",
    {"store_id": 1, "items": [{"sku": "TEST", "name": "测试商品", "quantity": 10, "unit": "件"}]})
print_test("测试1: 错角色 - 审核主管创建申请", status, result)

status, result = api_call(token_registrar, "/applications/1/submit", "POST")
print_test("测试2: 缺证据 - 提交无凭证的草稿", status, result)

status, result = api_call(token_reviewer, "/applications/5/review", "POST",
    {"current_version": 5, "approved": True})
print_test("测试3: 错状态 - 审核已归档的申请", status, result)

status, result = api_call(token_reviewer, "/applications/batch-review", "POST",
    {"application_ids": [1, 2, 5, 6], "approved": True})
print_test("测试4: 批量审核（混合正常和异常状态）", status, result)

status, app = api_call(token_registrar, "/applications/1")
current_ver = app.get("current_version", 1)
status, result = api_call(token_registrar, "/applications/1", "PUT", {
    "current_version": 1,
    "store_id": 1,
    "items": [{"sku": "TEST", "name": "测试商品", "quantity": 5, "unit": "件"}]
})
print_test(f"测试5: 旧版本 - 当前版本{current_ver}，使用版本1更新", status, result)

status, result = api_call(token_final, "/applications/2/final-review", "POST",
    {"current_version": 1, "approved": True})
print_test("测试6: 错角色 - 复核负责人去审核(不是复核)", status, result)

status, result = api_call(token_registrar, "/applications/3/review", "POST",
    {"current_version": 1, "approved": True})
print_test("测试7: 错角色 - 登记员去审核", status, result)

print("=" * 60)
print("  所有测试完成!")
print("=" * 60)
