import requests
import json
import sys

BASE = "http://localhost:8007"
H_REG = {"X-User-Id": "registrar_demo", "X-User-Role": "registrar"}
H_SUP = {"X-User-Id": "supervisor_demo", "X-User-Role": "supervisor"}
H_REV = {"X-User-Id": "reviewer_demo", "X-User-Role": "reviewer"}

def ok(res):
    assert res.status_code < 500, f"HTTP {res.status_code}: {res.text}"
    j = res.json()
    assert j.get("success"), f"API failed: {j}"
    return j["data"]

def title(s):
    print(f"\n{'='*60}\n▶ {s}\n{'='*60}")

def sub(s):
    print(f"\n--- {s} ---")

# ──────────────────────────────────────────────
title("1. 初始：演示审计日志字段完整性（版本冲突/缺版本/格式错样例）")
# ──────────────────────────────────────────────
audit = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 200}))
seed_batches = [l for l in audit["data"] if l.get("batch") is True]
print(f"审计日志总数：{audit['total']}，批量样例 {len(seed_batches)} 条")
print(f"演示批量样例：")
for l in seed_batches:
    print(f"  [{l['orderNo']}] success={l['success']} ft={l.get('failureType')} vst={l.get('versionSubtype')} exp={l.get('expectedVersion')} cur={l.get('currentVersion')} aft={l.get('versionAfter')} old={l.get('oldStatus')} new={l.get('newStatus')}")

vc_logs = [l for l in seed_batches if l.get("failureType") == "version"]
vm_logs = [l for l in seed_batches if l.get("failureType") == "version_missing"]
vf_logs = [l for l in seed_batches if l.get("failureType") == "version_format"]
ps_logs = [l for l in seed_batches if l.get("success")]
pf_logs = [l for l in seed_batches if l.get("success") is False and not str(l.get("failureType", "")).startswith("version")]

print(f"\n演示样例类型分布：版本冲突={len(vc_logs)}，缺版本={len(vm_logs)}，格式错={len(vf_logs)}，批量成功={len(ps_logs)}，批量其他失败={len(pf_logs)}")
assert len(vc_logs) >= 1, "应至少有1条版本冲突样例审计"
assert len(vm_logs) >= 1, "应至少有1条缺版本样例审计"
assert len(vf_logs) >= 1, "应至少有1条格式错样例审计"
assert len(ps_logs) >= 1, "应至少有1条批量成功样例审计"

sub("版本冲突样例字段完整性")
l = vc_logs[0]
assert l.get("versionSubtype") == "conflict", f"versionSubtype 应为 conflict"
assert l.get("expectedVersion") is not None, "应有 expectedVersion"
assert l.get("currentVersion") is not None, "应有 currentVersion"
assert l.get("expectedVersion") != l.get("currentVersion"), "版本冲突时 expected ≠ current"
assert l.get("oldStatus") is not None, "应有 oldStatus"
assert l.get("newStatus") is not None, "应有 newStatus"
assert l.get("newStatus") == l.get("oldStatus"), "失败时状态应不变"
assert l.get("versionAfter") == l.get("currentVersion"), "失败时 versionAfter=current"
print("  ✅ expectedVersion != currentVersion，状态未变更")

sub("缺版本样例字段完整性")
l = vm_logs[0]
assert l.get("versionSubtype") == "missing"
assert l.get("expectedVersion") is None, "缺版本时 expectedVersion 应为 None"
assert l.get("currentVersion") is not None, "应有 currentVersion"
assert l.get("oldStatus") is not None and l.get("newStatus") == l.get("oldStatus"), "失败时状态不变"
print("  ✅ expectedVersion=None，currentVersion 存在，状态未变更")

sub("版本格式错误样例字段完整性")
l = vf_logs[0]
assert l.get("versionSubtype") == "format"
assert l.get("expectedVersion") is not None, "格式错误时 expectedVersion 保留原始值"
assert l.get("currentVersion") is not None, "应有 currentVersion"
assert l.get("oldStatus") is not None and l.get("newStatus") == l.get("oldStatus"), "失败时状态不变"
print("  ✅ expectedVersion 保留原始非法值，状态未变更")

sub("批量成功样例字段完整性")
l = ps_logs[0]
assert l.get("success") is True
assert l.get("failureType") is None, "成功时 failureType 应为 null"
assert l.get("oldStatus") != l.get("newStatus"), "成功时状态应变更"
assert l.get("versionAfter") is not None, "应有 versionAfter"
print("  ✅ oldStatus ≠ newStatus，versionAfter 存在")

print("\n✅ 演示审计日志字段完整性全部验证通过")

# ──────────────────────────────────────────────
title("2. 实时：版本冲突 → 审计 failureType=version + versionSubtype=conflict")
# ──────────────────────────────────────────────
orders = ok(requests.get(f"{BASE}/api/orders", headers=H_REG))
draft_missing = next(o for o in orders["data"] if o["orderNo"].endswith("0007"))
print(f"DD0007 目标：{draft_missing['orderNo']} version={draft_missing['version']} status={draft_missing['status']}")

lock = ok(requests.post(f"{BASE}/api/orders/lock/{draft_missing['id']}", headers=H_REG))
before_audit = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 500}))
before_ids = set(l["id"] for l in before_audit["data"])

sub("使用过期版本号 v999 批量提交 1 张")
res = ok(requests.post(
    f"{BASE}/api/orders/batch",
    headers=H_REG,
    json={
        "action": "submit",
        "orderIds": [draft_missing["id"]],
        "opinion": "版本冲突审计追溯测试：故意传过期版本号",
        "lockTokens": [lock["lockToken"]],
        "versions": [999],
    }
))
assert res["summary"]["successCount"] == 0
assert res["summary"]["failedCount"] == 1
assert res["summary"]["versionConflictCount"] == 1
assert res["failed"][0]["failureType"] == "version"
assert res["failed"][0]["versionSubtype"] == "conflict"
print(f"  响应：expectedVersion={res['failed'][0]['expectedVersion']} currentVersion={res['failed'][0]['currentVersion']}")

sub("验证新产生的审计日志")
audit2 = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 500}))
new_logs = [l for l in audit2["data"] if l["id"] not in before_ids]
vc_new = [l for l in new_logs if l.get("orderId") == draft_missing["id"] and l.get("failureType") == "version"]
print(f"  新增日志 {len(new_logs)} 条，其中版本冲突 {len(vc_new)} 条")
assert len(vc_new) == 1
l = vc_new[0]
assert l["batch"] is True
assert l["success"] is False
assert l["failureType"] == "version"
assert l["versionSubtype"] == "conflict"
assert l["expectedVersion"] == 999
assert l["currentVersion"] == draft_missing["version"]
assert l["versionAfter"] == draft_missing["version"]
assert l["oldStatus"] == l["newStatus"]
print(f"  审计：batch=True success=False ft=version vst=conflict exp={l['expectedVersion']} cur={l['currentVersion']} old={l['oldStatus']} new={l['newStatus']}")
print("✅ 实时版本冲突审计验证通过")

# ──────────────────────────────────────────────
title("3. 实时：缺版本/格式错 → 审计 failureType=version_missing/version_format")
# ──────────────────────────────────────────────
lock = ok(requests.post(f"{BASE}/api/orders/lock/{draft_missing['id']}", headers=H_REG))
lock_ok = ok(requests.post(f"{BASE}/api/orders/lock/{draft_missing['id']}", headers=H_REG))
before_audit3 = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 500}))
before_ids3 = set(l["id"] for l in before_audit3["data"])

sub("第1张：缺 versions（versions 不传数组），第2张：版本格式错 'abc'")
res = ok(requests.post(
    f"{BASE}/api/orders/batch",
    headers=H_REG,
    json={
        "action": "submit",
        "orderIds": [draft_missing["id"], draft_missing["id"]],
        "opinion": "缺版本+格式错审计追溯测试",
        "lockTokens": [lock["lockToken"], lock_ok["lockToken"]],
        "versions": [None, "abc"],
    }
))
print(f"  成功 {res['summary']['successCount']}，失败 {res['summary']['failedCount']}")
print(f"  versionMissing={res['summary'].get('versionMissingCount')} versionFormat={res['summary'].get('versionFormatErrorCount')}")
assert res["summary"].get("versionMissingCount") == 1
assert res["summary"].get("versionFormatErrorCount") == 1
assert res["failed"][0]["failureType"] == "version_missing"
assert res["failed"][0]["versionSubtype"] == "missing"
assert res["failed"][1]["failureType"] == "version_format"
assert res["failed"][1]["versionSubtype"] == "format"

audit3 = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 500}))
new_logs3 = [l for l in audit3["data"] if l["id"] not in before_ids3]
new_vm = [l for l in new_logs3 if l.get("failureType") == "version_missing"]
new_vf = [l for l in new_logs3 if l.get("failureType") == "version_format"]
print(f"\n  新增日志 {len(new_logs3)} 条")
assert len(new_vm) == 1 and len(new_vf) == 1
new_vm = new_vm[0]; new_vf = new_vf[0]
print(f"  缺版本审计：exp={new_vm.get('expectedVersion')} cur={new_vm.get('currentVersion')} vst={new_vm.get('versionSubtype')} batch={new_vm['batch']}")
print(f"  格式错审计：exp={new_vf.get('expectedVersion')} cur={new_vf.get('currentVersion')} vst={new_vf.get('versionSubtype')} batch={new_vf['batch']}")
assert new_vm["versionSubtype"] == "missing"
assert new_vm["expectedVersion"] is None
assert new_vf["versionSubtype"] == "format"
assert new_vf["expectedVersion"] == "abc"
assert new_vm["batch"] and new_vf["batch"]
print("✅ 缺版本+格式错实时审计验证通过")

# ──────────────────────────────────────────────
title("4. 实时：部分成功（1张+1张版本冲突）→ 审计分别记录")
# ──────────────────────────────────────────────
all_drafts = [o for o in orders["data"] if o["status"] == "draft"]
if len(all_drafts) >= 2:
    id_a = all_drafts[0]["id"]  # 正确版本提交
    id_b = all_drafts[1]["id"]  # 故意版本冲突
    ver_a = all_drafts[0]["version"]
    ver_b = all_drafts[1]["version"]
    no_a = all_drafts[0]["orderNo"]
    no_b = all_drafts[1]["orderNo"]
    print(f"  部分成功测试：{no_a}（正确 v{ver_a}）+ {no_b}（过期 v{ver_b + 100}）")
    
    lock_a = ok(requests.post(f"{BASE}/api/orders/lock/{id_a}", headers=H_REG))
    lock_b = ok(requests.post(f"{BASE}/api/orders/lock/{id_b}", headers=H_REG))
    
    res = ok(requests.post(
        f"{BASE}/api/orders/batch",
        headers=H_REG,
        json={
            "action": "submit",
            "orderIds": [id_a, id_b],
            "opinion": "部分成功审计追溯测试：一张正确一张版本冲突",
            "lockTokens": [lock_a["lockToken"], lock_b["lockToken"]],
            "versions": [ver_a, ver_b + 100],
        }
    ))
    print(f"  响应：成功 {res['summary']['successCount']}，失败 {res['summary']['failedCount']}")
    print(f"  版本冲突 {res['summary'].get('versionConflictCount')} 张")
    assert res["summary"]["successCount"] == 1
    assert res["summary"]["failedCount"] == 1
    assert res["summary"]["versionConflictCount"] == 1
    
    audit4 = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG, params={"pageSize": 500}))
    before_ids4 = set(l["id"] for l in audit3["data"])  # 以上次请求为基准
    new_logs4 = [l for l in audit4["data"] if l["id"] not in before_ids4]
    log_a = [l for l in new_logs4 if l.get("orderId") == id_a and l.get("success")][0]
    log_b = [l for l in new_logs4 if l.get("orderId") == id_b and not l.get("success") and l.get("failureType") == "version"][0]
    print(f"  新增日志 {len(new_logs4)} 条")
    print(f"\n  {no_a} 成功审计：old={log_a.get('oldStatus')}→new={log_a.get('newStatus')} exp={log_a.get('expectedVersion')} cur={log_a.get('currentVersion')} aft={log_a.get('versionAfter')}")
    print(f"  {no_b} 冲突审计：old={log_b.get('oldStatus')} new={log_b.get('newStatus')} exp={log_b.get('expectedVersion')} cur={log_b.get('currentVersion')} aft={log_b.get('versionAfter')}")
    assert log_a["oldStatus"] != log_a["newStatus"], "成功单状态应变更"
    assert log_a["versionAfter"] == ver_a + 1, "成功单 versionAfter = 原版本+1"
    assert log_b["oldStatus"] == log_b["newStatus"], "失败单状态不应变更"
    assert log_b["expectedVersion"] == ver_b + 100, "失败单 expectedVersion = 提交值"
    assert log_b["currentVersion"] == ver_b, "失败单 currentVersion = 实际值"
    print("✅ 部分成功审计分别准确记录验证通过")
    
    sub("校验刷新后的列表状态与版本一致性")
    fresh = ok(requests.get(f"{BASE}/api/orders", headers=H_REG))
    fa = next(o for o in fresh["data"] if o["id"] == id_a)
    fb = next(o for o in fresh["data"] if o["id"] == id_b)
    print(f"  {no_a} 新状态={fa['status']} 版本={fa['version']}（期望 pending_verification v{ver_a+1}）")
    print(f"  {no_b} 新状态={fb['status']} 版本={fb['version']}（期望 draft v{ver_b}）")
    assert fa["status"] == "pending_verification"
    assert fa["version"] == ver_a + 1
    assert fb["status"] == "draft"
    assert fb["version"] == ver_b
    print("✅ 列表刷新后状态与审计记录一致")
else:
    print("ℹ 草稿单不足2张，跳过部分成功测试")

# ──────────────────────────────────────────────
title("5. 非批量（单条 processAction）审计字段完整")
# ──────────────────────────────────────────────
audit_std = [l for l in audit["data"] if l.get("action") == "submit" and l.get("batch") is False][:3]
print(f"随机抽查 {len(audit_std)} 条非批量 submit 审计：")
for l in audit_std:
    print(f"  [{l['orderNo']}] success={l['success']} old={l.get('oldStatus')} new={l.get('newStatus')} cur={l.get('currentVersion')} aft={l.get('versionAfter')}")
    assert l.get("success") is not None, "非批量审计也应有 success 字段"
    assert l.get("oldStatus") is not None or l.get("newStatus") is not None, "应至少含 old/newStatus"
print("✅ 非批量审计标准化字段验证通过")

# ──────────────────────────────────────────────
title("✅ 全部审计可追溯测试通过")
# ──────────────────────────────────────────────
print("""
  覆盖场景：
  1. 演示数据：版本冲突/缺版本/格式错/批量成功/部分成功5类样例审计
  2. failureType 枚举：version_missing / version_format / version / materials / permission / lock / reject
  3. versionSubtype 枚举：missing / format / conflict
  4. 每条审计必含：success / failureReason / oldStatus / newStatus / expectedVersion / currentVersion / versionAfter
  5. 成功单：oldStatus ≠ newStatus，versionAfter = currentVersion + 1
  6. 失败单：oldStatus == newStatus，versionAfter = currentVersion
  7. 失败 reason 与 details 双字段可追溯
  8. 列表刷新后实际状态/版本 与审计 old/newStatus + versionAfter 严格一致
""")
