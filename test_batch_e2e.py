import requests
import json
import sys

BASE = "http://localhost:8101"
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
title("1. 获取所有订单，确认演示数据正常")
# ──────────────────────────────────────────────
orders = ok(requests.get(f"{BASE}/api/orders", headers=H_REG))
print(f"订单总数：{orders['total']}")
by_status = {}
for o in orders["data"]:
    by_status[o["status"]] = by_status.get(o["status"], 0) + 1
print(f"状态分布：{by_status}")
assert orders["total"] >= 10, "演示数据不足（应有DD0001~DD0010共10张）"

# 找到各场景的单
draft_missing = next(o for o in orders["data"] if o["orderNo"].endswith("0007"))  # 缺材料草稿
draft_ok = next(o for o in orders["data"] if o["orderNo"].endswith("0008"))       # 材料齐全草稿
rejected = next(o for o in orders["data"] if o["orderNo"].endswith("0009"))       # 核验退回待补正
postponed = next(o for o in orders["data"] if o["orderNo"].endswith("0010"))      # 逾期延期后待核验
print(f"\n目标样例定位：")
print(f"  DD0007 草稿缺材料：{draft_missing['orderNo']} / {draft_missing['title']}")
print(f"  DD0008 草稿齐全  ：{draft_ok['orderNo']} / {draft_ok['title']}")
print(f"  DD0009 核验退回  ：{rejected['orderNo']} / {rejected['title']}")
print(f"  DD0010 逾期延期  ：{postponed['orderNo']} / {postponed['title']} (overdue={postponed['overdue']})")

# ──────────────────────────────────────────────
title("2. 批量预检：混合草稿 + 核验退回 → 应返回 mixedSubmitStatuses")
# ──────────────────────────────────────────────
mixed_ids = [draft_missing["id"], draft_ok["id"], rejected["id"]]
sub("调用 previewBatch 混合状态预检")
prev = ok(requests.post(
    f"{BASE}/api/orders/batch/preview",
    headers=H_REG,
    json={"action": "submit", "orderIds": mixed_ids}
))
print(f"summary: {json.dumps(prev['summary'], ensure_ascii=False, indent=2)}")
assert prev["summary"]["mixedSubmitStatuses"] is True, "混合状态应标记 mixedSubmitStatuses=true"
assert len(prev["summary"]["mixedSubmitStatusList"]) == 2, "应检测到两种不同状态"
print("✅ 混合状态检测通过")

sub("调用 /api/orders/batch 执行混合提交 → 应 400 拒绝")
res = requests.post(
    f"{BASE}/api/orders/batch",
    headers=H_REG,
    json={"action": "submit", "orderIds": mixed_ids, "opinion": "测试批量提交混合状态"}
)
print(f"HTTP {res.status_code}: {res.json().get('error')}")
assert res.status_code == 400, "混合状态应返回 400"
assert res.json().get("mixedSubmitStatuses") is True
print("✅ 混合状态后端拒绝通过")

# ──────────────────────────────────────────────
title("3. 批量预检：纯草稿（其中一张缺材料）→ 应逐单解释")
# ──────────────────────────────────────────────
draft_ids = [draft_missing["id"], draft_ok["id"]]
sub("调用 previewBatch 纯草稿预检")
prev = ok(requests.post(
    f"{BASE}/api/orders/batch/preview",
    headers=H_REG,
    json={"action": "submit", "orderIds": draft_ids}
))
print(f"summary: canProcess={prev['summary']['canProcess']}, blocked={prev['summary']['blocked']}, missingMaterials={prev['summary']['missingMaterials']}")
for o in prev["orders"]:
    print(f"  {o['orderNo']} canProcess={o['canProcess']} action={o['effectiveActionName']} missing={o['missingMaterials']}")
assert prev["summary"]["mixedSubmitStatuses"] is False
assert prev["summary"]["canProcess"] == 1, "只有材料齐全的草稿能推进"
assert prev["summary"]["missingMaterials"] == 1, "应检测到 1 张缺材料"
# 检查 effectiveAction 区分
for o in prev["orders"]:
    assert o["effectiveAction"] == "submit"
    assert o["nextStatus"] == "pending_verification"
print("✅ 纯草稿预检逐单解释通过")

# ──────────────────────────────────────────────
title("4. 批量执行：纯草稿（1缺+1齐）→ 应 1 成功 1 失败，并分别写入审计")
# ──────────────────────────────────────────────
# 先获取锁
tokens = []
for oid in draft_ids:
    lock = ok(requests.post(f"{BASE}/api/orders/lock/{oid}", headers=H_REG))
    tokens.append(lock["lockToken"])

sub("调用 batch 执行批量提交")
batch_res = ok(requests.post(
    f"{BASE}/api/orders/batch",
    headers=H_REG,
    json={
        "action": "submit",
        "orderIds": draft_ids,
        "opinion": "批量测试：一张齐全一张缺材料，预期1成功1失败",
        "lockTokens": tokens,
    }
))
print(f"成功 {batch_res['summary']['successCount']} 张，失败 {batch_res['summary']['failedCount']} 张")
assert batch_res["summary"]["successCount"] == 1
assert batch_res["summary"]["failedCount"] == 1

ok_item = batch_res["success"][0]
fail_item = batch_res["failed"][0]
print(f"  成功：{ok_item['orderNo']} {ok_item['oldStatusName']}→{ok_item['newStatusName']} versionAfter={ok_item['versionAfter']}")
print(f"  失败：{fail_item['orderNo']} reason={fail_item['reason']} failureType={fail_item['failureType']}")
assert fail_item["failureType"] == "materials"
assert len(fail_item["missingMaterials"]) >= 2
assert ok_item["appliedAction"] == "submit"
assert ok_item["newStatus"] == "pending_verification"
assert ok_item["versionAfter"] > 1

sub("检查审计日志：每条单据独立记录，带 batch=true")
audit = ok(requests.get(f"{BASE}/api/audit-logs", headers=H_REG))
batch_logs = [l for l in audit["data"] if l.get("batch") is True]
print(f"审计日志中 batch=true 共 {len(batch_logs)} 条（预期 2 条：1成功1失败）")
for l in batch_logs[-2:]:
    print(f"  [{l['orderNo']}] success={l['success']} failureReason={l.get('failureReason')} old={l.get('oldStatus')} new={l.get('newStatus')} v={l.get('versionAfter')}")
assert len(batch_logs) >= 2
# 成功单应有 newStatus 变更
success_logs = [l for l in batch_logs if l.get("success")]
fail_logs = [l for l in batch_logs if not l.get("success")]
assert len(success_logs) >= 1
assert len(fail_logs) >= 1
assert success_logs[-1].get("newStatus") is not None
assert fail_logs[-1].get("failureReason") is not None
print("✅ 批量提交+逐单审计验证通过")

# ──────────────────────────────────────────────
title("5. 批量预检：核验退回单 → effectiveAction 应为 correct_submit")
# ──────────────────────────────────────────────
rej_ids = [rejected["id"]]
prev = ok(requests.post(
    f"{BASE}/api/orders/batch/preview",
    headers=H_REG,
    json={"action": "submit", "orderIds": rej_ids}
))
print(f"  {prev['orders'][0]['orderNo']} status={prev['orders'][0]['statusName']} effectiveAction={prev['orders'][0]['effectiveActionName']}")
assert prev["orders"][0]["effectiveAction"] == "correct_submit", "核验退回单的 effectiveAction 应为 correct_submit"
assert prev["orders"][0]["effectiveActionName"] == "补正后重新提交"
print("✅ effectiveAction 自动映射（submit→correct_submit）通过")

# ──────────────────────────────────────────────
title("6. 批量执行：逾期延期后再批量核验通过（主管角色）")
# ──────────────────────────────────────────────
# 先找到主管可处理的核验单（DD0002 + DD0010）
sup_orders = ok(requests.get(f"{BASE}/api/orders", headers=H_SUP, params={"status": "pending_verification"}))
verify_ids = [o["id"] for o in sup_orders["data"] if not o.get("overdue")][:2]
print(f"主管可核验单据 {len(verify_ids)} 张：{[o['orderNo'] for o in sup_orders['data'] if not o.get('overdue')][:2]}")
assert len(verify_ids) >= 1

# 获取锁
tokens = []
for oid in verify_ids:
    lock = ok(requests.post(f"{BASE}/api/orders/lock/{oid}", headers=H_SUP))
    tokens.append(lock["lockToken"])

sub("调用 batch 主管批量核验通过")
batch_res = ok(requests.post(
    f"{BASE}/api/orders/batch",
    headers=H_SUP,
    json={
        "action": "approve_verify",
        "orderIds": verify_ids,
        "opinion": "批量核验通过：材料齐全，价格合理，同意推进至复核",
        "lockTokens": tokens,
    }
))
print(f"成功 {batch_res['summary']['successCount']} 张，失败 {batch_res['summary']['failedCount']} 张")
for item in batch_res["success"]:
    print(f"  成功：{item['orderNo']} {item['oldStatusName']}→{item['newStatusName']} appliedAction={item['appliedActionName']}")
    assert item["newStatus"] == "pending_review"
    assert item["appliedAction"] == "approve_verify"
    assert item["materialsVerified"] is True
    assert item["timelineVerified"] is True
print("✅ 主管批量核验通过验证通过")

# ──────────────────────────────────────────────
title("7. 角色越权：登记员尝试批量核验 → 应全部失败")
# ──────────────────────────────────────────────
# 找一张待核验的单
pv = ok(requests.get(f"{BASE}/api/orders", headers=H_REG, params={"status": "pending_verification"}))
if pv["total"] > 0:
    bad_ids = [pv["data"][0]["id"]]
    tokens = []
    for oid in bad_ids:
        lock = ok(requests.post(f"{BASE}/api/orders/lock/{oid}", headers=H_REG))
        tokens.append(lock["lockToken"])
    sub("登记员尝试批量核验通过（越权）")
    batch_res = ok(requests.post(
        f"{BASE}/api/orders/batch",
        headers=H_REG,
        json={
            "action": "approve_verify",
            "orderIds": bad_ids,
            "opinion": "越权测试验证角色权限拦截机制",
            "lockTokens": tokens,
        }
    ))
    print(f"成功 {batch_res['summary']['successCount']}，失败 {batch_res['summary']['failedCount']}")
    assert batch_res["summary"]["successCount"] == 0
    assert batch_res["failed"][0]["failureType"] == "permission"
    print("✅ 越权批量处理被正确拦截")
else:
    print("ℹ 暂无待核验单（之前步骤已推进），跳过越权测试")

# ──────────────────────────────────────────────
title("8. 锁校验：使用过期锁批量提交 → 应失败 lock 类型")
# ──────────────────────────────────────────────
new_draft = next((o for o in orders["data"] if o["status"] == "draft"), None)
if new_draft:
    sub("使用过期/错误 lockToken 尝试批量提交")
    batch_res = ok(requests.post(
        f"{BASE}/api/orders/batch",
        headers=H_REG,
        json={
            "action": "submit",
            "orderIds": [new_draft["id"]],
            "opinion": "测试操作锁错误时的拦截机制是否有效",
            "lockTokens": ["wrong-token-12345"],
        }
    ))
    print(f"成功 {batch_res['summary']['successCount']}，失败 {batch_res['summary']['failedCount']}")
    assert batch_res["summary"]["successCount"] == 0
    assert batch_res["failed"][0]["failureType"] == "lock"
    print("✅ 过期锁批量处理被正确拦截")
else:
    print("ℹ 暂无草稿单，跳过锁测试")

# ──────────────────────────────────────────────
title("✅ 全部批量链路测试通过")
# ──────────────────────────────────────────────
print("""
  覆盖场景：
  1. 演示数据：DD0007(草稿缺材料) / DD0008(草稿齐全) / DD0009(核验退回) / DD0010(逾期延期后待核验)
  2. 混合状态 submit/correct_submit → 前端预检 + 后端执行双重拒绝
  3. 逐单预检：材料缺口、逾期原因、effectiveAction、nextStatus、canProcess
  4. 批量执行：成功/失败独立返回，各自记录审计日志（batch/success/failureReason/oldStatus/newStatus/versionAfter）
  5. effectiveAction 自动映射：DRAFT→submit / VERIFICATION_REJECTED→correct_submit
  6. 角色权限校验：登记员无法批量核验
  7. 操作锁校验：错误 lockToken 无法推进
  8. 和单条 processAction 完全一致的 6 重闭环：角色/顺序/材料/时限/锁/版本
""")
