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

tok_del = login("delivery_zhang", "123456")

# ========== 1. 校验：非法 batch_item_id ==========
print("\n--- 1. 后端校验：非法 batch_item_id ---")
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 1, "batch_item_id": 99999, "source": "batch_detail"
}).json()
check("不存在的 batch_item_id → INVALID_BATCH_ITEM", r.get('code') == 'INVALID_BATCH_ITEM')

# ========== 2. 准备测试数据 ==========
print("\n--- 2. 准备：创建两个批次获取不同的 batch_item_id ---")
r1 = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1], "action": "verify_pass", "comment": "t1", "plan_versions": {1: 1}
}).json()
r2 = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [4], "action": "verify_pass", "comment": "t2", "plan_versions": {4: 1}
}).json()
b1_no, b2_no = r1['data']['batch_no'], r2['data']['batch_no']

r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
b1 = next(b for b in r_list['data']['list'] if b['batch_no'] == b1_no)
b2 = next(b for b in r_list['data']['list'] if b['batch_no'] == b2_no)

r_d1 = requests.get(f"{BASE}/api/batches/{b1['id']}", headers=h(tok_del)).json()
r_d2 = requests.get(f"{BASE}/api/batches/{b2['id']}", headers=h(tok_del)).json()
item1_id = r_d1['data']['items'][0]['item_id']
item4_id = r_d2['data']['items'][0]['item_id']
print(f"  plan1 item_id={item1_id}, plan4 item_id={item4_id}")

# ========== 3. 校验：batch_item_id 不属于 plan ==========
print("\n--- 3. 后端校验：batch_item_id 与 plan 不匹配 ---")
r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 1, "batch_item_id": item4_id, "source": "batch_detail"
}).json()
check("batch_item_id 不属于 plan → BATCH_ITEM_PLAN_MISMATCH", r.get('code') == 'BATCH_ITEM_PLAN_MISMATCH')

# ========== 4. 先让 item1 变为 SUCCESS，验证非 FAILED 不可关联 ==========
print("\n--- 4. 后端校验：非 FAILED 状态不可关联 ---")
requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "ok.pdf", "url": "/ev/ok.pdf",
    "version": 1, "source": "plan_detail"
})
requests.post(f"{BASE}/api/batch/{b1['id']}/retry", headers=h(tok_del), json={"comment": "retry"})
r_d1_after = requests.get(f"{BASE}/api/batches/{b1['id']}", headers=h(tok_del)).json()
s = r_d1_after['data']['items'][0]['status']
print(f"  item1 现在状态: {s}")

r = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 3, "batch_item_id": item1_id, "source": "batch_detail"
}).json()
check("SUCCESS 状态不可关联 → BATCH_ITEM_NOT_FAILED", r.get('code') == 'BATCH_ITEM_NOT_FAILED')

# ========== 5. source 与 batch_item_id 一致性校验 ==========
print("\n--- 5. 后端校验：source/batch_item_id 一致性 ---")
r = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 1, "batch_item_id": item4_id, "source": "queue"
}).json()
check("传 batch_item_id 但 source!=batch_detail → 400", r.get('code') == 400)

r = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 1, "source": "batch_detail"
}).json()
check("source=batch_detail 但没传 batch_item_id → 400", r.get('code') == 400)

r = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "t.pdf", "url": "/ev/t.pdf",
    "version": 1, "source": "INVALID"
}).json()
check("source 非法值 → 400", r.get('code') == 400)

# ========== 6. 正常补传：持久化验证 ==========
print("\n--- 6. 正常补传：持久化 + 批次详情更新 ---")
r_plan4 = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
ver = r_plan4['data']['plan']['version']
print(f"  plan4 当前 version={ver}")

r_ok = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "SSO核验报告_批次补传.pdf",
    "url": "/ev/plan4_batch_v3.pdf",
    "version": ver,
    "batch_item_id": item4_id,
    "source": "batch_detail",
    "note": "补充了完整的SSO登录验证截图和日志"
}).json()
check("补传成功 → code=0", r_ok.get('code') == 0)

# 刷新批次2详情
r_d2_after = requests.get(f"{BASE}/api/batches/{b2['id']}", headers=h(tok_del)).json()
it4 = r_d2_after['data']['items'][0]
print(f"  plan4 item: upload_count={it4['upload_count']} can_retry={it4['can_retry']}")
print(f"  uploads[0]: source={it4['uploads'][0]['source']} note={it4['uploads'][0]['note']}")
check("补传后 upload_count=1", it4['upload_count'] == 1)
check("补传后 can_retry=true", it4['can_retry'] == True)
check("upload 记录含 source=batch_detail", it4['uploads'][0]['source'] == 'batch_detail')
check("upload 记录含 note", it4['uploads'][0]['note'] == "补充了完整的SSO登录验证截图和日志")

# ========== 7. 重试成功，统计正确 ==========
print("\n--- 7. 补传后重试：统计正确 ---")
r_retry = requests.post(f"{BASE}/api/batch/{b2['id']}/retry", headers=h(tok_del), json={
    "comment": "补证据后重试"
}).json()
check("重试后全部成功", r_retry['data']['retry_success'] == 1 and r_retry['data']['retry_failed'] == 0)
check("最终统计正确", r_retry['data']['total_success'] == 1 and r_retry['data']['total_failed'] == 0)

# ========== 8. 队列接口验证 ==========
print("\n--- 8. 队列接口：返回缺失证据标签 ---")
r_q = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_del)).json()
has_missing = any('missing_labels' in p for p in r_q['data']['list'])
has_uploadable = any('uploadable_evidence' in p for p in r_q['data']['list'])
check("队列返回 missing_labels", has_missing)
check("队列返回 uploadable_evidence", has_uploadable)

# ========== 9. 审计日志验证 ==========
print("\n--- 9. 审计日志：含完整信息 ---")
tok_dir = login("director_zhao", "123456")
r_audit = requests.get(f"{BASE}/api/audit-logs?action=UPLOAD_EVIDENCE", headers=h(tok_dir)).json()
uploads = [l for l in r_audit['data'] if l['action'] == 'UPLOAD_EVIDENCE']
if uploads:
    detail = json.loads(uploads[0].get('detail', '{}'))
    print(f"  最新审计: source={detail.get('source')} batch_item_id={detail.get('batch_item_id')} note={detail.get('note')}")
    check("审计含 source=batch_detail", detail.get('source') == 'batch_detail')
    check("审计含 batch_item_id", detail.get('batch_item_id') == item4_id)
    check("审计含 note", detail.get('note') == "补充了完整的SSO登录验证截图和日志")

# ========== 总结 ==========
print("\n" + "=" * 70)
print(f"🏁 测试完成：✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("=" * 70)
