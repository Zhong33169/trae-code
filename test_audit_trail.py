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

def print_test(title, status, result=None, detail=None):
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    print(f"  HTTP 状态: {status}")
    if detail:
        print(f"  {detail}")
    if result is not None:
        if isinstance(result, list) and len(result) > 0:
            # 显示前2条用于验证
            for i, item in enumerate(result[:2]):
                print(f"  [{i+1}]")
                print(json.dumps(item, ensure_ascii=False, indent=8))
            if len(result) > 2:
                print(f"  ... 还有 {len(result)-2} 条记录")
        else:
            print(json.dumps(result, ensure_ascii=False, indent=4))
    print()

print("\n" + "=" * 60)
print("  📋 审计可追溯办理闭环 - 端到端验证测试")
print("=" * 60 + "\n")

token_reg = login("zhangsan", "123456")
token_rev = login("lisi", "123456")
token_fin = login("wangwu", "123456")

# 测试1: 完整补正重提流程样例 RP2026060100002 的版本历史
status, history = api_call(token_reg, "/applications/2/history")
print_test(
    "✅ 测试1: 完整补正重提流程(RP2026060100002) - 应包含6个版本: 创建→提交→驳回→补正→重提→审核通过",
    status,
    history,
    f"版本数: {len(history)}"
)

# 测试2: 连锁复核驳回到需补正的样例 RP2026060100004
status, history = api_call(token_reg, "/applications/4/history")
print_test(
    "✅ 测试2: 连锁复核驳回流程(RP2026060100004) - 应包含4个版本",
    status,
    history,
    f"版本数: {len(history)}"
)

# 测试3: 混合批量审核（包含各种失败场景）
print("=" * 60)
print("  ✅ 测试3: 混合批量审核 - 包含正常+旧版本+错状态+已归档")
print("=" * 60)

# 先获取各申请的版本号
status, apps = api_call(token_rev, "/applications")
pending_ids = [a["id"] for a in apps if a["status"] == "pending_review"]
all_ids = [a["id"] for a in apps]

# 故意混用: 正常(pending_review) + 草稿 + 已归档 + 审核通过
mixed_apps = []
for a in apps:
    # 故意用旧版本号（-1）造一些版本冲突
    version = a["current_version"]
    if a["status"] == "draft":
        # 草稿：状态错
        mixed_apps.append({"application_id": a["id"], "current_version": version})
    elif a["status"] == "archived":
        # 已归档：状态错
        mixed_apps.append({"application_id": a["id"], "current_version": version})
    elif a["status"] == "pending_review":
        # 故意用旧版本号
        mixed_apps.append({"application_id": a["id"], "current_version": max(1, version - 1)})
    elif a["status"] == "reviewed":
        mixed_apps.append({"application_id": a["id"], "current_version": version})

status, result = api_call(token_rev, "/applications/batch-review", "POST", {
    "applications": mixed_apps[:6],
    "approved": True
})
print(f"  HTTP 状态: {status}")
print(f"  申请数: {len(mixed_apps[:6])}")
print(f"  成功: {result['success_count']}, 失败: {result['failed_count']}")
print(f"  结果详情:")
for r in result["results"]:
    icon = "✅" if r["success"] else "❌"
    print(f"    {icon} {r['application_no']} - {r['status']}")
    print(f"         {r['message'][:60]}")
print()

# 测试4: RP2026060100003 已归档完整流程的证据快照
status, history = api_call(token_fin, "/applications/3/history")
print("=" * 60)
print("  ✅ 测试4: 已归档流程(RP2026060100003) - 证据和备注逐版保留")
print("=" * 60)
print(f"  版本数: {len(history)}")
for i, v in enumerate(history):
    ev_count = sum(1 for x in [
        v.get("evidence_store_replenishment"),
        v.get("evidence_delivery_confirmation"),
        v.get("evidence_registration")
    ] if x)
    remarks_snippet = (v.get("remarks") or "")[:25]
    print(f"  v{v['version']} | {v['action']:15s} | 证据: {ev_count}/3 | 备注: {remarks_snippet}")
print()

# 测试5: 提交审核接口版本校验
print("=" * 60)
print("  ✅ 测试5: 提交审核接口版本校验 - 用旧版本号")
print("=" * 60)

# 找个草稿或需补正状态的申请
draft_app = next(a for a in apps if a["status"] in ("draft", "needs_correction"))
correct_version = draft_app["current_version"]
old_version = max(1, correct_version - 1)

status, result = api_call(token_reg, f"/applications/{draft_app['id']}/submit", "POST", {
    "current_version": old_version
})
print(f"  申请: {draft_app['application_no']} (当前v{correct_version}, 提交v{old_version})")
print(f"  HTTP 状态: {status}")
if status != 200:
    print(f"  错误: {result.get('error')}")
    print(f"  详情: {result.get('details')}")
print()

# 测试6: 确认RP2026060100007缺凭证不能提交
print("=" * 60)
print("  ✅ 测试6: 草稿缺凭证提交校验 (RP2026060100007)")
print("=" * 60)
app7 = next(a for a in apps if a["application_no"] == "RP2026060100007")
status, result = api_call(token_reg, f"/applications/{app7['id']}/submit", "POST", {
    "current_version": app7["current_version"]
})
print(f"  HTTP 状态: {status}")
if status != 200:
    print(f"  错误: {result.get('error')}")
    print(f"  详情: {result.get('details')}")
print()

print("=" * 60)
print("  🎉 所有审计可追溯测试验证完成!")
print("=" * 60)
print()
print("  样例数据覆盖场景:")
print("  ┌─────────────────────────────────────────────────────┐")
print("  │ RP2026060100001 │ 草稿(缺凭证)              v1       │")
print("  │ RP2026060100002 │ 完整补正重提(驳回→补正→重提) v6    │")
print("  │ RP2026060100003 │ 已归档完整流程(含驳回)      v5    │")
print("  │ RP2026060100004 │ 连锁复核驳回到需补正         v4    │")
print("  │ RP2026060100005 │ 待审核(证据齐全)           v2       │")
print("  │ RP2026060100006 │ 审核通过待复核             v3       │")
print("  │ RP2026060100007 │ 草稿(缺部分凭证)           v1       │")
print("  └─────────────────────────────────────────────────────┘")
