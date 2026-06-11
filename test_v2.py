#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"
PASS = 0
FAIL = 0

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    d = r.json()
    return d.get('data', {}).get('token', '')

def h(tok): return {"Authorization": f"Bearer {tok}"}

def test(name, method, path, tok=None, body=None, expect_http=200, checks=None, extract=None):
    global PASS, FAIL
    r = requests.request(method, f"{BASE}{path}", headers=h(tok) if tok else None, json=body)
    status = r.status_code
    try: d = r.json()
    except: d = r.text
    ok = status == expect_http
    if checks and ok:
        for k, v in checks.items():
            if isinstance(d, dict) and d.get(k) != v:
                ok = False
                break
    if ok: PASS += 1; marker = "✅"
    else: FAIL += 1; marker = "❌"
    code = d.get('code') if isinstance(d, dict) else None
    msg = d.get('message') if isinstance(d, dict) else None
    print(f"{marker} {name}")
    if not ok:
        print(f"   HTTP={status} (expect {expect_http}) | code={code} | msg={msg}")
    if extract and isinstance(d, dict):
        return d.get(extract) if d.get(extract) is not None else d
    return d

# ========== 准备 ==========
print("=" * 70)
print("🧪 V2 验收测试：证据累积前置 × 批次重试 × 审计明细")
print("=" * 70)

tok_csm = login("csm_wang", "123456")
tok_del = login("delivery_zhang", "123456")
tok_dir = login("director_zhao", "123456")
tok_li = login("csm_li", "123456")

# ========== 1. 证据累积前置规则 ==========
print("\n--- 1. 证据累积前置规则 ---")

# 1.1 submit 需 REG 证据（DRAFT + 无证据 → MISSING_EVIDENCE）
test("CSM submit DRAFT #3 (缺REG)", "POST", "/api/plans/3/action", tok_csm,
     {"action":"submit","version":1},
     expect_http=400, checks={"code":"MISSING_EVIDENCE"})

# 1.2 verify_pass 需 REG + VER 证据（PENDING_REVIEW + 只有REG → MISSING_EVIDENCE）
r = test("DELIVERY verify_pass #1 (有REG缺VER)", "POST", "/api/plans/1/action", tok_del,
         {"action":"verify_pass","version":1},
         expect_http=400, checks={"code":"MISSING_EVIDENCE"})

# 1.3 verify_pass 有 REG+VER → 成功
test("DELIVERY verify_pass #7 (REG+VER齐全)", "POST", "/api/plans/7/action", tok_del,
     {"action":"verify_pass","version":1},
     expect_http=200, checks={"code":0})

# 1.4 confirm_pass 需 REG+VER+ARC（缺 ARC → MISSING_EVIDENCE）
test("DIRECTOR confirm_pass #9 (缺ARC)", "POST", "/api/plans/9/action", tok_dir,
     {"action":"confirm_pass","version":1},
     expect_http=400, checks={"code":"MISSING_EVIDENCE"})

# 1.5 confirm_pass 三证据齐全 → 成功
test("DIRECTOR confirm_pass #2 (三证据齐全)", "POST", "/api/plans/2/action", tok_dir,
     {"action":"confirm_pass","version":2},
     expect_http=200, checks={"code":0})

# ========== 2. 详情接口返回 missing_evidences ==========
print("\n--- 2. 详情接口 missing_evidences ---")

r = test("详情 #1: available_actions 含 missing_evidences", "GET", "/api/plans/1", tok_del)
if isinstance(r, dict) and r.get('data'):
    actions = r['data'].get('available_actions', [])
    verify = next((a for a in actions if a['action'] == 'verify_pass'), None)
    if verify:
        missing = verify.get('missing_evidences', [])
        labels = verify.get('missing_labels', [])
        allowed = verify.get('allowed')
        role_match = verify.get('role_match')
        ok = (not allowed) and ('VERIFICATION' in missing) and ('登记证据' not in labels)
        print(f"   verify_pass: allowed={allowed}, missing={missing}, labels={labels} → {'✅' if ok else '❌'}")
        if ok: PASS += 1
        else: FAIL += 1
    else:
        print("   ❌ 找不到 verify_pass action")
        FAIL += 1

# ========== 3. 证据上传后按钮可用性变化 ==========
print("\n--- 3. 证据上传 → 按钮状态变化 ---")

# 3.1 查 #1 当前状态（有REG缺VER，verify_pass 禁用）
r1 = requests.get(f"{BASE}/api/plans/1", headers=h(tok_del)).json()
v1 = next((a for a in r1['data']['available_actions'] if a['action']=='verify_pass'), None)
print(f"   #1 上传前: verify_pass allowed={v1['allowed']}, missing={v1['missing_labels']}")

# 3.2 上传 VER 证据
r_up = requests.post(f"{BASE}/api/plans/1/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "核验报告.pdf",
    "url": "/ev/001_核验.pdf",
    "version": 1
}).json()
print(f"   上传 VER 证据: code={r_up.get('code')}")

# 3.3 再查详情，verify_pass 应该变 allowed=true
r2 = requests.get(f"{BASE}/api/plans/1", headers=h(tok_del)).json()
v2 = next((a for a in r2['data']['available_actions'] if a['action']=='verify_pass'), None)
ok = v2['allowed'] == True and len(v2['missing_evidences']) == 0
print(f"   #1 上传后: allowed={v2['allowed']}, missing={v2['missing_labels']} → {'✅' if ok else '❌'}")
if ok: PASS += 1
else: FAIL += 1

# 3.4 证据上传返回完整 plan（version 已 +1）
plan_after = r_up.get('data', {})
v_after = plan_after.get('version', 0)
print(f"   上传后返回 plan version={v_after} → {'✅' if v_after > 1 else '❌'}")
if v_after > 1: PASS += 1
else: FAIL += 1

# ========== 4. 批量操作部分成功 + 失败项保留 ==========
print("\n--- 4. 批量操作：部分成功 + 失败项不被吞 ---")

r_batch = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1, 4, 8],    # 1号刚上传了VER可通过，4/8 只有REG缺VER会失败
    "action": "verify_pass",
    "comment": "批量核验测试",
    "plan_versions": {1: v_after, 4: 1, 8: 1}
}).json()
batch_no = r_batch['data']['batch_no']
print(f"   批次号: {batch_no}")
print(f"   total={r_batch['data']['total']} success={r_batch['data']['success_count']} failed={r_batch['data']['failed_count']}")

items = r_batch['data']['items']
succ = [x for x in items if x['result'] == 'SUCCESS']
fail = [x for x in items if x['result'] == 'FAILED']
ok = len(succ) == 1 and len(fail) == 2 and all(x.get('error_code') for x in fail)
print(f"   成功{len(succ)}条 / 失败{len(fail)}条，失败项均含 error_code → {'✅' if ok else '❌'}")
if ok: PASS += 1
else: FAIL += 1

# ========== 5. 失败重试 + 统计修正 ==========
print("\n--- 5. 失败重试 + 批次统计修正 ---")

# 5.1 先给 #4 上传 VER 证据
requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION", "name": "SSO核验记录.pdf", "url": "/ev/004_核验.pdf", "version": 1
})

# 5.2 重试批次
r_retry = requests.post(f"{BASE}/api/batch/{batch_no.replace('BATCH-', '')}/retry", headers=h(tok_del), json={
    "comment": "补证据后重试"
}).json()
# 等等，batchId 是数字 id，不是 batch_no。让我先获取 batch 详情
# 先拿 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
batch = next((b for b in r_list['data']['list'] if b['batch_no'] == batch_no), None)
if batch:
    bid = batch['id']
    r_retry = requests.post(f"{BASE}/api/batch/{bid}/retry", headers=h(tok_del), json={
        "comment": "补证据后重试"
    }).json()
    print(f"   重试结果: retry_success={r_retry['data']['retry_success']} retry_failed={r_retry['data']['retry_failed']}")
    print(f"   重算后: total_success={r_retry['data']['total_success']} total_failed={r_retry['data']['total_failed']}")
    
    # 原批次：1 成功, 2 失败
    # 重试 2 个失败项，其中 #4 补了证据会成功，#8 还是缺 VER 会失败
    # 预期：retry_success=1, retry_failed=1
    # total_success = 1 + 1 = 2, total_failed = 2 - 1 = 1 (因为有一个成功了)
    ok = r_retry['data']['retry_success'] == 1 and r_retry['data']['retry_failed'] == 1
    ok2 = r_retry['data']['total_success'] == 2 and r_retry['data']['total_failed'] == 1
    print(f"   重试数量正确 → {'✅' if ok else '❌'}")
    print(f"   重算后统计正确 → {'✅' if ok2 else '❌'}")
    if ok: PASS += 1
    else: FAIL += 1
    if ok2: PASS += 1
    else: FAIL += 1

# ========== 6. 全链路审计明细 ==========
print("\n--- 6. 全链路审计明细 ---")

r_audit = requests.get(f"{BASE}/api/audit-logs", headers=h(tok_dir)).json()
logs = r_audit['data']
actions = set(log.get('action') for log in logs)
required = ['UPLOAD_EVIDENCE', 'ACTION_VERIFY_PASS', 'ACTION_CONFIRM_PASS',
            'BATCH_VERIFY_PASS', 'CREATE_BATCH', 'BATCH_RETRY']
found = [a for a in required if a in actions or any(a in x for x in actions)]
print(f"   审计动作类型数: {len(actions)}")
print(f"   关键审计动作: {', '.join(sorted(actions)[:10])}...")
print(f"   核心审计类型存在 → {'✅' if len(found) >= 4 else '❌'}")
if len(found) >= 4: PASS += 1
else: FAIL += 1

# 检查一条证据上传审计的 detail 是否含丰富字段
upload_logs = [l for l in logs if l.get('action') == 'UPLOAD_EVIDENCE']
if upload_logs:
    detail = upload_logs[0].get('detail', '{}')
    try:
        detail_obj = json.loads(detail)
        has_fields = all(k in detail_obj for k in ['evidence_type', 'evidence_name', 'plan_no'])
        print(f"   UPLOAD_EVIDENCE 含 detail 字段: evidence_type/evidence_name/plan_no → {'✅' if has_fields else '❌'}")
        if has_fields: PASS += 1
        else: FAIL += 1
    except:
        print("   ⚠️ 审计 detail 不是 JSON")

# ========== 7. 角色按钮权限计算正确 ==========
print("\n--- 7. 角色×按钮可用性 ---")

# 7.1 CSM 看 PENDING_REVIEW 状态的单据，不应有 verify_pass 权限
r_csm_1 = requests.get(f"{BASE}/api/plans/8", headers=h(tok_csm)).json()
acts_csm = r_csm_1['data']['available_actions']
has_vp = any(a['action'] == 'verify_pass' for a in acts_csm)
vp_role_match = next((a['role_match'] for a in acts_csm if a['action'] == 'verify_pass'), None)
print(f"   CSM 看 #8(PENDING_REVIEW): verify_pass role_match={vp_role_match} → {'✅' if vp_role_match == False else '❌'}")
if vp_role_match == False: PASS += 1
else: FAIL += 1

# ========== 总结 ==========
print("\n" + "=" * 70)
print(f"🏁 测试完成：✅ {PASS} 通过 / ❌ {FAIL} 失败")
print("=" * 70)
