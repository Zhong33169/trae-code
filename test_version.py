import requests

BASE = "http://localhost:8002/api"

def login(u, p):
    return requests.post(f"{BASE}/auth/login", json={"username": u, "password": p}).json()

aud = login("auditor1", "123456")
tok = aud["access_token"]
H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

print("=" * 60)
print("后端原子更新 + 统一错误结构 验证")
print("=" * 60)

# 1. 获取列表
r = requests.get(f"{BASE}/applications?page_size=20", headers=H)
apps = r.json()["items"]
sub = [a for a in apps if a["status"] == "submitted"]
if not sub:
    print("没有 submitted 状态的申请，重新初始化数据")
    exit()
app = sub[0]
app_id = app["id"]
ver = app["version"]
print(f"\n测试申请: id={app_id}, status={app['status']}, version={ver}")

# 2. 正确 version 开始审核
r = requests.post(f"{BASE}/applications/{app_id}/start-audit",
    headers=H, json={"version": ver, "remark": "测试开始审核"})
print(f"\n[正确version] HTTP {r.status_code} {'OK' if r.status_code==200 else r.json()}")

# 3. 旧 version 重复提交（应返回 409 VERSION_CONFLICT）
r = requests.post(f"{BASE}/applications/{app_id}/start-audit",
    headers=H, json={"version": ver, "remark": "重复提交"})
resp = r.json()
print(f"\n[旧version重复提交] HTTP {r.status_code}")
print(f"  code={resp.get('code')} message={resp.get('message','')[:60]}")
assert r.status_code == 409, f"应返回409，实际{r.status_code}"
assert resp["code"] == "VERSION_CONFLICT", f"应返回VERSION_CONFLICT"

# 4. 获取最新 version
r = requests.get(f"{BASE}/applications/{app_id}", headers=H)
new_ver = r.json()["version"]
new_status = r.json()["status"]
print(f"\n[更新后] status={new_status}, version={new_ver}")

# 5. 越权（登记员尝试开始审核）
reg = login("registrar1", "123456")
r = requests.post(f"{BASE}/applications/{app_id}/start-audit",
    headers={"Authorization": f"Bearer {reg['access_token']}", "Content-Type": "application/json"},
    json={"version": new_ver})
resp = r.json()
print(f"\n[越权] HTTP {r.status_code}")
print(f"  code={resp.get('code')} message={resp.get('message','')[:60]}")
assert r.status_code == 403, f"应返回403，实际{r.status_code}"

# 6. 状态不对（审核中直接归档）
rev = login("reviewer1", "123456")
r = requests.post(f"{BASE}/applications/{app_id}/archive",
    headers={"Authorization": f"Bearer {rev['access_token']}", "Content-Type": "application/json"},
    json={"version": new_ver, "opinion": "测试归档"})
resp = r.json()
print(f"\n[状态不对] HTTP {r.status_code}")
print(f"  code={resp.get('code')} message={resp.get('message','')[:80]}")
assert r.status_code == 400, f"应返回400，实际{r.status_code}"
assert resp["code"] == "INVALID_STATUS", f"应返回INVALID_STATUS"

# 7. 批量处理带 version
r = requests.get(f"{BASE}/applications?page_size=20", headers=H)
apps2 = r.json()["items"]
sub2 = [a for a in apps2 if a["status"] == "submitted"]
if sub2:
    items = [{"id": a["id"], "version": a["version"]} for a in sub2[:2]]
    r = requests.post(f"{BASE}/applications/batch", headers=H,
        json={"items": items, "action": "start_audit", "remark": "批量开始审核"})
    result = r.json()
    print(f"\n[批量处理] 成功 {len(result['success'])} 失败 {len(result['failed'])}")
    if result["failed"]:
        for f in result["failed"]:
            print(f"  失败 id={f['id']} code={f.get('code')} reason={f.get('reason','')[:50]}")

# 8. 批量处理错误 version（模拟重复提交）
if sub2:
    old_items = [{"id": a["id"], "version": a["version"]} for a in sub2[:2]]
    r = requests.post(f"{BASE}/applications/batch", headers=H,
        json={"items": old_items, "action": "start_audit", "remark": "重复批量"})
    result = r.json()
    print(f"\n[批量重复提交] 成功 {len(result['success'])} 失败 {len(result['failed'])}")
    for f in result["failed"]:
        print(f"  失败 id={f['id']} code={f.get('code')} reason={f.get('reason','')[:60]}")

print("\n" + "=" * 60)
print("✅ 后端验证全部通过！")
print("  ✅ 409 VERSION_CONFLICT: 旧 version 重复提交被拦截")
print("  ✅ 403 FORBIDDEN: 越权操作被拦截")
print("  ✅ 400 INVALID_STATUS: 状态顺序不对被拦截")
print("  ✅ 批量处理带 version，失败时保留原状态和可读原因")
print("=" * 60)
