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
print("🧪 V5 验收测试：补传证据追溯办理")
print("=" * 70)

tok_del = login("delivery_zhang", "123456")
tok_dir = login("director_zhao", "123456")

# ========== 场景一：补证后仍失败 ==========
print("\n--- 场景一：补证后仍失败（补一个证据但仍缺另一个） ---")

# plan4 (PENDING_REVIEW, missing REG+VER)
# 只补 VER (缺 REG 仍然存在，补证后仍不能重试成功)
r_batch_still_fail = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [4], "action": "verify_pass", "comment": "v5 batch 1", "plan_versions": {4: 1}
}).json()
b1_no = r_batch_still_fail['data']['batch_no']
print(f"  批次: {b1_no}")

r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
b1 = next(b for b in r_list['data']['list'] if b['batch_no'] == b1_no)

r_d1 = requests.get(f"{BASE}/api/batches/{b1['id']}", headers=h(tok_del)).json()
item4 = r_d1['data']['items'][0]
print(f"  初始: missing={item4['missing_labels']} upload_count={item4['upload_count']}")

# 1) 补 VER (但仍然缺 REG)
r_plan4 = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
ver = r_plan4['data']['plan']['version']

r_upload = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "SSO核验报告_批次补传.pdf",
    "url": "/ev/plan4_ver_v5.pdf",
    "version": ver,
    "batch_item_id": item4['item_id'],
    "source": "batch_detail",
    "note": "补充了SSO登录验证截图，仍需客户成功经理补充登记证据"
}).json()
check("补传成功", r_upload.get('code') == 0)

# 2) 刷新批次详情，检查 can_retry_reason
r_d1_after = requests.get(f"{BASE}/api/batches/{b1['id']}", headers=h(tok_del)).json()
it4 = r_d1_after['data']['items'][0]
print(f"  补 VER 后: upload_count={it4['upload_count']} can_retry={it4['can_retry']} reason={it4.get('can_retry_reason')}")
check("补传后 upload_count=1", it4['upload_count'] == 1)
check("仍缺 REG 所以 can_retry=false", it4['can_retry'] == False)
check("can_retry_reason 包含仍缺", '仍缺' in (it4.get('can_retry_reason') or ''))
check("uploads[0] 含 source_label=批次详情补传", it4['uploads'][0].get('source_label') == '批次详情补传')
check("uploads[0] 含 evidence_label", '核验' in (it4['uploads'][0].get('evidence_label') or ''))
check("uploads[0] 含 batch_no", it4['uploads'][0].get('batch_no') == b1_no)
check("uploads[0] 含 note", it4['uploads'][0].get('note') == "补充了SSO登录验证截图，仍需客户成功经理补充登记证据")
check("uploads[0] 含 uploader_name=张交付", it4['uploads'][0].get('uploader_name') == '张交付')

# 3) 重试 — 应该仍然失败（缺 REG）
r_retry_fail = requests.post(f"{BASE}/api/batch/{b1['id']}/retry", headers=h(tok_del), json={
    "comment": "补了 VER 后重试"
}).json()
print(f"  重试结果: success={r_retry_fail['data']['retry_success']} failed={r_retry_fail['data']['retry_failed']}")
check("补 VER 后重试仍失败 (缺 REG)", r_retry_fail['data']['retry_success'] == 0 and r_retry_fail['data']['retry_failed'] == 1)

# ========== 场景二：补证后成功 ==========
print("\n--- 场景二：补证后成功（补齐缺失证据重试成功） ---")

# plan1 (PENDING_REVIEW, missing VER 无 REG) — 已有 REG
# plan1 之前缺 VER，需要补 VER
r_batch_success = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1], "action": "verify_pass", "comment": "v5 batch 2", "plan_versions": {1: 1}
}).json()
b2_no = r_batch_success['data']['batch_no']
print(f"  批次: {b2_no}")

r_list2 = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
b2 = next(b for b in r_list2['data']['list'] if b['batch_no'] == b2_no)

r_d2 = requests.get(f"{BASE}/api/batches/{b2['id']}", headers=h(tok_del)).json()
item1 = r_d2['data']['items'][0]
print(f"  plan1 初始: missing={item1['missing_labels']} upload_count={item1['upload_count']}")

# 补 VER
r_plan1 = requests.get(f"{BASE}/api/plans/1", headers=h(tok_del)).json()
ver1 = r_plan1['data']['plan']['version']
print(f"  plan1 当前 version={ver1}")

r_up1 = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "权限核验报告_v5补传.pdf",
    "url": "/ev/plan1_ver_v5.pdf",
    "version": ver1,
    "batch_item_id": item1['item_id'],
    "source": "batch_detail",
    "note": "补充完整的权限核验日志和前后对比截图"
}).json()
check("plan1 补 VER 成功", r_up1.get('code') == 0)

r_d2_after = requests.get(f"{BASE}/api/batches/{b2['id']}", headers=h(tok_del)).json()
it1 = r_d2_after['data']['items'][0]
print(f"  补 VER 后: upload_count={it1['upload_count']} can_retry={it1['can_retry']} reason={it1.get('can_retry_reason')}")
check("补后 can_retry=true", it1['can_retry'] == True)
check("can_retry_reason 包含'证据齐全'", '证据齐全' in (it1.get('can_retry_reason') or ''))

# 重试成功
r_retry_ok = requests.post(f"{BASE}/api/batch/{b2['id']}/retry", headers=h(tok_del), json={
    "comment": "补齐证据后重试成功"
}).json()
print(f"  重试结果: success={r_retry_ok['data']['retry_success']} failed={r_retry_ok['data']['retry_failed']}")
check("补证后重试成功 (成功1失败0)", r_retry_ok['data']['retry_success'] == 1 and r_retry_ok['data']['retry_failed'] == 0)
check("批次最终统计: total_success=1", r_retry_ok['data']['total_success'] == 1 and r_retry_ok['data']['total_failed'] == 0)

# ========== 场景三：计划单详情 evidence_trace ==========
print("\n--- 场景三：计划单详情 evidence_trace 完整追溯 ---")

r_detail4 = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
trace = r_detail4['data'].get('evidence_trace') or r_detail4['data']['plan'].get('evidence_trace') or r_detail4['data']['plan'].get('evidences', [])
print(f"  plan4 证据数量: {len(trace)}")
if trace:
    e = trace[0]
    print(f"  最新证据: source_label={e.get('source_label')} batch_no={e.get('batch_no')} note={e.get('note')} uploader={e.get('uploader_name')}")
    check("evidence_trace 含 source_label", e.get('source_label') is not None)
    check("evidence_trace 含 batch_no=" + b1_no, e.get('batch_no') == b1_no)
    check("evidence_trace 含 note", e.get('note') is not None)
    check("evidence_trace 含 uploader_name", e.get('uploader_name') is not None)
    check("evidence_trace 含 uploader_role", e.get('uploader_role') is not None)
    check("evidence_trace 含 batch_item_status", e.get('batch_item_status') is not None)
    check("evidence_trace 含 batch_item_retry_count", e.get('batch_item_retry_count') is not None)

# ========== 场景四：审计日志关联证据明细 ==========
print("\n--- 场景四：审计日志含关联证据明细 ---")

r_audit = requests.get(f"{BASE}/api/audit-logs?action=BATCH_RETRY", headers=h(tok_dir)).json()
retry_audits = [l for l in r_audit['data'] if l['action'].startswith('BATCH_RETRY')]
print(f"  找到 {len(retry_audits)} 条重试审计")

retry_success_audit = next((l for l in retry_audits if 'VERIFY' in l['action']), None)
if retry_success_audit:
    det = json.loads(retry_success_audit.get('detail', '{}'))
    print(f"  成功重试审计: batch_no={det.get('batch_no')} retried_evidences={len(det.get('retried_evidences', []))}")
    check("审计含 batch_item_id", det.get('batch_item_id') is not None)
    check("审计含 retried_evidences", len(det.get('retried_evidences', [])) > 0)
    if det.get('retried_evidences'):
        re = det['retried_evidences'][0]
        check("retried_evidences 含 source", re.get('source') is not None)
        check("retried_evidences 含 note", re.get('note') is not None)
        check("retried_evidences 含 uploader", re.get('uploader') is not None)

retry_fail_audit = next((l for l in retry_audits if l['action'] == 'BATCH_RETRY_FAIL'), None)
if retry_fail_audit:
    det = json.loads(retry_fail_audit.get('detail', '{}'))
    print(f"  失败重试审计: error={det.get('error_code')} evidences={len(det.get('retried_evidences', []))}")
    check("失败审计含 error_code", det.get('error_code') is not None)
    check("失败审计含 retried_evidences", len(det.get('retried_evidences', [])) > 0)

# ========== 场景五：队列接口返回证据追溯信息 ==========
print("\n--- 场景五：队列接口缺失证据 + 可补传标签 ---")

r_q = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_del)).json()
p_with_missing = next((p for p in r_q['data']['list'] if p.get('missing_labels')), None)
if p_with_missing:
    print(f"  队列计划单: {p_with_missing['plan_no']} missing_labels={p_with_missing.get('missing_labels')} uploadable={p_with_missing.get('uploadable_evidence')}")
    check("队列返回 missing_labels", len(p_with_missing.get('missing_labels', [])) > 0)
    check("队列返回 uploadable_evidence", len(p_with_missing.get('uploadable_evidence', [])) > 0)

# ========== 总结 ==========
print("\n" + "=" * 70)
print(f"🏁 V5 测试完成：✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("=" * 70)
if FAIL > 0: exit(1)
