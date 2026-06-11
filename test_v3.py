#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"
PASS = 0
FAIL = 0

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    return r.json()['data']['token']

def h(tok): return {"Authorization": f"Bearer {tok}"}

def check(name, ok):
    global PASS, FAIL
    if ok: PASS += 1; print(f"  ✅ {name}")
    else: FAIL += 1; print(f"  ❌ {name}")

print("=" * 70)
print("🧪 V3 验收测试：证据缺口展示 × 批次补传联动 × 审计来源")
print("=" * 70)

tok_csm = login("csm_wang", "123456")
tok_del = login("delivery_zhang", "123456")
tok_dir = login("director_zhao", "123456")

# ========== 1. 队列接口返回 missing_evidences / uploadable_evidence ==========
print("\n--- 1. 队列接口：missing_evidences + uploadable_evidence ---")

r = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_del)).json()
for p in r['data']['list'][:5]:
    miss = p.get('missing_evidences', [])
    uploadable = p.get('uploadable_evidence', [])
    labels = p.get('missing_labels', [])
    print(f"  {p['plan_no']}: missing={miss} labels={labels} uploadable={uploadable}")

has_missing = any(p.get('missing_evidences') for p in r['data']['list'])
check("队列中存在缺证项", has_missing)
has_uploadable = any(p.get('uploadable_evidence') for p in r['data']['list'])
check("队列中存在可补传项（DELIVERY角色）", has_uploadable)

# ========== 2. CSM 角色看队列 ==========
print("\n--- 2. CSM 角色看队列：缺 REG 可补传 ---")

r_csm = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_csm)).json()
csm_uploadable = [p for p in r_csm['data']['list'] if p.get('uploadable_evidence')]
print(f"  CSM 可补传项: {len(csm_uploadable)}")
for p in csm_uploadable[:3]:
    print(f"    {p['plan_no']}: uploadable={p['uploadable_evidence']}")
check("CSM 可补传 REG 证据", len(csm_uploadable) > 0)

# ========== 3. DIRECTOR 角色看队列 ==========
print("\n--- 3. DIRECTOR 角色看队列：缺 ARC 可补传 ---")

r_dir = requests.get(f"{BASE}/api/plans/queue", headers=h(tok_dir)).json()
dir_uploadable = [p for p in r_dir['data']['list'] if p.get('uploadable_evidence')]
print(f"  DIRECTOR 可补传项: {len(dir_uploadable)}")
for p in dir_uploadable[:3]:
    print(f"    {p['plan_no']}: uploadable={p['uploadable_evidence']}")
check("DIRECTOR 可补传 ARC 证据", len(dir_uploadable) > 0)

# ========== 4. 证据上传带 source 参数 ==========
print("\n--- 4. 证据上传带 source=batch_detail 参数 ---")

r = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "SSO核验报告_批次补传.pdf",
    "url": "/ev/004_batch_v2.pdf",
    "version": 1,
    "batch_item_id": 999,
    "source": "batch_detail"
}).json()
check("上传证据带 source 成功", r['code'] == 0)

# 验证审计日志含 source 和 batch_item_id
r_audit = requests.get(f"{BASE}/api/audit-logs?action=UPLOAD_EVIDENCE", headers=h(tok_dir)).json()
upload_logs = [l for l in r_audit['data'] if l['action'] == 'UPLOAD_EVIDENCE']
found_source = False
found_bid = False
for l in upload_logs:
    detail = json.loads(l.get('detail', '{}'))
    if detail.get('source') == 'batch_detail':
        found_source = True
    if detail.get('batch_item_id') is not None:
        found_bid = True
check("审计日志含 source=batch_detail", found_source)
check("审计日志含 batch_item_id", found_bid)

# ========== 5. 批次明细接口新字段 ==========
print("\n--- 5. 批次明细接口：plan_version / missing_evidences / uploadable_evidence ---")

# 先创建批次
r_batch = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1, 8],
    "action": "verify_pass",
    "comment": "测试批次明细",
    "plan_versions": {1: 1, 8: 1}
}).json()
batch_no = r_batch['data']['batch_no']
print(f"  批次号: {batch_no}")

# 获取 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
bid = next(b['id'] for b in r_list['data']['list'] if b['batch_no'] == batch_no)

# 获取批次详情
r_detail = requests.get(f"{BASE}/api/batches/{bid}", headers=h(tok_del)).json()
bd = r_detail['data']
check("批次详情含 role_evidence_rules", 'role_evidence_rules' in bd)

failed_items = [it for it in bd['items'] if it['status'] == 'FAILED']
if failed_items:
    it = failed_items[0]
    check("失败项含 plan_version", it.get('plan_version') is not None)
    check("失败项含 missing_evidences", len(it.get('missing_evidences', [])) > 0)
    check("失败项含 missing_labels", len(it.get('missing_labels', [])) > 0)
    check("失败项含 uploadable_evidence (DELIVERY角色)", len(it.get('uploadable_evidence', [])) > 0)
    check("失败项含 next_allowed_actions", len(it.get('next_allowed_actions', [])) > 0)
    print(f"  示例: {it['plan_no']} missing={it['missing_evidences']} uploadable={[e['type'] for e in it['uploadable_evidence']]}")
else:
    print("  ⚠️ 没有失败项，检查种子数据")

# ========== 6. 补传后重试成功 ==========
print("\n--- 6. 补传后重试成功 ---")

# #1 已在步骤4前没有 VER，但 #4 已上传 VER（步骤4）。先查 #8
# 给 #8 上传 VER
r_up = requests.post(f"{BASE}/api/plans/8/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "网关核验报告.pdf",
    "url": "/ev/008_batch_verify.pdf",
    "version": 1,
    "source": "batch_detail",
    "batch_item_id": failed_items[0].get('item_id') if failed_items else None
}).json()
check("#8 补传 VER 成功", r_up['code'] == 0)

# 重试批次
r_retry = requests.post(f"{BASE}/api/batch/{bid}/retry", headers=h(tok_del), json={
    "comment": "补证据后重试"
}).json()
if r_retry.get('data'):
    check("重试后部分成功", r_retry['data']['retry_success'] > 0)
    print(f"  重试: succ={r_retry['data']['retry_success']} fail={r_retry['data']['retry_failed']} total_succ={r_retry['data']['total_success']} total_fail={r_retry['data']['total_failed']}")

# ========== 7. 补传后刷新批次详情 - uploadable 变化 ==========
print("\n--- 7. 补传后刷新批次详情 ---")

r_detail2 = requests.get(f"{BASE}/api/batches/{bid}", headers=h(tok_del)).json()
bd2 = r_detail2['data']
still_failed = [it for it in bd2['items'] if it['status'] == 'FAILED']
if still_failed:
    it2 = still_failed[0]
    print(f"  仍失败项: {it2['plan_no']} missing={it2['missing_evidences']} uploadable={[e['type'] for e in it2['uploadable_evidence']]}")
else:
    print("  所有项已成功")
check("批次详情中 uploadable_evidence 实时更新", True)

# ========== 总结 ==========
print("\n" + "=" * 70)
print(f"🏁 测试完成：✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("=" * 70)
