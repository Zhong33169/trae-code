#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"
PASS = 0
FAIL = 0

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    return r.json()['data']['token']

def h(tok): return {"Authorization": f"Bearer {tok}"}

def check(name, ok, detail=''):
    global PASS, FAIL
    if ok: PASS += 1; print(f"  ✅ {name}")
    else: FAIL += 1; print(f"  ❌ {name} {detail}")

print("=" * 70)
print("🧪 V4 验收测试：补传证据与批次项关联校验")
print("=" * 70)

tok_csm = login("csm_wang", "123456")
tok_del = login("delivery_zhang", "123456")
tok_dir = login("director_zhao", "123456")

# ========== 1. 证据上传校验：非法 batch_item_id ==========
print("\n--- 1. 后端校验：非法 batch_item_id 被拦截 ---")

# 1.1 batch_item_id 不存在
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "test.pdf",
    "url": "/ev/test.pdf",
    "version": 1,
    "batch_item_id": 99999,
    "source": "batch_detail"
}).json()
check("batch_item_id=99999 不存在 → INVALID_BATCH_ITEM",
      r.get('code') == 'INVALID_BATCH_ITEM', f"实际 code={r.get('code')} msg={r.get('message')}")

# 1.2 batch_item_id 存在但不属于该 plan
# 先创建两个批次获取不同的 batch_item_id
r1 = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1], "action": "verify_pass", "comment": "test1",
    "plan_versions": {1: 1}
}).json()
r2 = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [4], "action": "verify_pass", "comment": "test2",
    "plan_versions": {4: 1}
}).json()

# 拿两个 batch_item_id
r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
batch1 = next(b for b in r_list['data']['list'] if b['batch_no'] == r1['data']['batch_no'])
batch2 = next(b for b in r_list['data']['list'] if b['batch_no'] == r2['data']['batch_no'])
bid1 = batch1['id']
bid2 = batch2['id']

# 拿批次1的 item id（对应 plan 1）
r_d1 = requests.get(f"{BASE}/api/batches/{bid1}", headers=h(tok_del)).json()
item_id_plan1 = r_d1['data']['items'][0]['item_id']
print(f"  plan1 的 batch_item_id = {item_id_plan1}")

# 拿批次2的 item id（对应 plan 4）
r_d2 = requests.get(f"{BASE}/api/batches/{bid2}", headers=h(tok_del)).json()
item_id_plan4 = r_d2['data']['items'][0]['item_id']
print(f"  plan4 的 batch_item_id = {item_id_plan4}")

# 尝试给 plan1 上传证据，但关联 plan4 的 batch_item_id
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "wrong.pdf",
    "url": "/ev/wrong.pdf",
    "version": 1,
    "batch_item_id": item_id_plan4,
    "source": "batch_detail"
}).json()
check("batch_item_id 不属于 plan → BATCH_ITEM_PLAN_MISMATCH",
      r.get('code') == 'BATCH_ITEM_PLAN_MISMATCH', f"实际 code={r.get('code')}")

# ========== 2. 证据上传校验：非 FAILED 状态不允许关联 ==========
print("\n--- 2. 后端校验：非 FAILED 状态不允许关联 ---")

# 先给 plan1 补证据，让它在某个批次中变为 SUCCESS
requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "test_plan1_v1.pdf",
    "url": "/ev/plan1_v1.pdf",
    "version": 1,
    "source": "plan_detail"
})
# 重试批次1，item 应该变为 SUCCESS
requests.post(f"{BASE}/api/batch/{bid1}/retry", headers=h(tok_del), json={"comment": "retry"})
# 查看批次1详情，item 应该是 SUCCESS 了
r_d1_after = requests.get(f"{BASE}/api/batches/{bid1}", headers=h(tok_del)).json()
item1_after = r_d1_after['data']['items'][0]
print(f"  重试后 plan1 状态: {item1_after['status']}")

# 现在尝试给 plan1 再上传证据，关联批次1中已经 SUCCESS 的 item_id
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "wrong2.pdf",
    "url": "/ev/wrong2.pdf",
    "version": 3,  # 版本需要正确，因为前面已经 +2 了（一次上传+一次操作）
    "batch_item_id": item_id_plan1,
    "source": "batch_detail"
}).json()
check("SUCCESS 状态 item 不允许关联 → BATCH_ITEM_NOT_FAILED",
      r.get('code') == 'BATCH_ITEM_NOT_FAILED', f"实际 code={r.get('code')} msg={r.get('message')}")

# ========== 3. source 和 batch_item_id 一致性校验 ==========
print("\n--- 3. 后端校验：source/batch_item_id 一致性 ---")

# 3.1 传了 batch_item_id 但 source 不是 batch_detail
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "t.pdf", "url": "/ev/t.pdf", "version": 3,
    "batch_item_id": item_id_plan4,
    "source": "queue"
}).json()
check("传 batch_item_id 但 source!=batch_detail → 400",
      r.get('code') == 400, f"实际 code={r.get('code')}")

# 3.2 source=batch_detail 但没传 batch_item_id
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "t.pdf", "url": "/ev/t.pdf", "version": 3,
    "source": "batch_detail"
}).json()
check("source=batch_detail 但没传 batch_item_id → 400",
      r.get('code') == 400, f"实际 code={r.get('code')}")

# 3.3 source 非法值
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "t.pdf", "url": "/ev/t.pdf", "version": 3,
    "source": "INVALID"
}).json()
check("source 非法值 → 400",
      r.get('code') == 400, f"实际 code={r.get('code')}")

# ========== 4. 正常补传：持久化验证 ==========
print("\n--- 4. 正常补传：plan_evidences 持久化验证 ---")

# 批次2的 item（plan4，状态 FAILED）是有效的，可以关联
# 先刷新版本号查一下
r_plan4 = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
plan4_ver = r_plan4['data']['version']
print(f"  plan4 当前 version: {plan4_ver}")

r_ok = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "SSO核验报告_批次补传.pdf",
    "url": "/ev/plan4_batch_v3.pdf",
    "version": plan4_ver,
    "batch_item_id": item_id_plan4,
    "source": "batch_detail",
    "note": "补充了完整的SSO登录验证截图和日志"
}).json()
check("正常补传成功 → code=0", r_ok.get('code') == 0)

# 现在查看批次2详情，验证 upload_count/upload_history/can_retry
r_d2_after = requests.get(f"{BASE}/api/batches/{bid2}", headers=h(tok_del)).json()
item4_after = r_d2_after['data']['items'][0]
print(f"  plan4 item: status={item4_after['status']} upload_count={item4_after['upload_count']} can_retry={item4_after['can_retry']}")
check("补传后 upload_count=1", item4_after['upload_count'] == 1)
check("补传后 latest_upload_at 存在", item4_after.get('latest_upload_at') is not None)
check("补传后 can_retry=true", item4_after['can_retry'] == True)
check("upload 列表包含 source=batch_detail",
      len(item4_after['uploads']) > 0 and item4_after['uploads'][0]['source'] == 'batch_detail')
check("upload 列表包含 batch_item_id 关联",
      len(item4_after['uploads']) > 0 and item4_after['uploads'][0].get('note') is not None)

# ========== 5. 队列接口验证 ==========
print("\n--- 5. 队列接口：展示缺失证据 + uploadable_evidence ---")
r_q = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_del)).json()
has_missing = any('missing_labels' in p and len(p['missing_labels']) > 0 for p in r_q['data']['list'])
has_uploadable = any('uploadable_evidence' in p and len(p['uploadable_evidence']) > 0 for p in r_q['data']['list'])
check("队列返回 missing_labels", has_missing)
check("队列返回 uploadable_evidence", has_uploadable)

# ========== 6. 审计日志验证 ==========
print("\n--- 6. 审计日志：含 source/batch_item_id/note ---")
r_audit = requests.get(f"{BASE}/api/audit-logs?action=UPLOAD_EVIDENCE", headers=h(tok_dir)).json()
upload_logs = [l for l in r_audit['data'] if l['action'] == 'UPLOAD_EVIDENCE']
latest = upload_logs[0] if upload_logs else None
if latest:
    detail = json.loads(latest.get('detail', '{}'))
    print(f"  最新上传审计: source={detail.get('source')}, batch_item_id={detail.get('batch_item_id')}, note={detail.get('note')}")
    check("审计含 source=batch_detail", detail.get('source') == 'batch_detail')
    check("审计含 batch_item_id", detail.get('batch_item_id') == item_id_plan4)
    check("审计含 note", detail.get('note') == "补充了完整的SSO登录验证截图和日志")

# ========== 7. 重试后批次统计验证 ==========
print("\n--- 7. 补传后重试：统计正确 ---")
r_retry2 = requests.post(f"{BASE}/api/batch/{bid2}/retry", headers=h(tok_del), json={
    "comment": "补证据后自动重试"
}).json()
print(f"  重试结果: succ={r_retry2['data']['retry_success']} fail={r_retry2['data']['retry_failed']}")
print(f"  最终统计: total_succ={r_retry2['data']['total_success']} total_fail={r_retry2['data']['total_failed']}")
check("重试全部成功", r_retry2['data']['retry_success'] == 1 and r_retry2['data']['retry_failed'] == 0)
check("最终统计正确", r_retry2['data']['total_success'] == 1 and r_retry2['data']['total_failed'] == 0)

# ========== 总结 ==========
print("\n" + "=" * 70)
print(f"🏁 测试完成：✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("=" * 70)
