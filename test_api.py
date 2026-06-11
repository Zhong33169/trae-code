#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    d = r.json()
    print(f"\n🔐 login({u}) → code={d.get('code')}, token_len={len(d.get('data',{}).get('token',''))}, user={json.dumps(d.get('data',{}).get('user'), ensure_ascii=False)}")
    return d.get('data', {}).get('token', '')

def h(tok): return {"Authorization": f"Bearer {tok}"}

def test(name, method, path, tok=None, body=None, expect_http=200, checks=None):
    r = requests.request(method, f"{BASE}{path}", headers=h(tok) if tok else None, json=body)
    status = r.status_code
    try: d = r.json()
    except: d = r.text
    marker = "✅" if status == expect_http else "❌"
    code = d.get('code') if isinstance(d, dict) else None
    msg = d.get('message') if isinstance(d, dict) else None
    print(f"\n{marker} [{name}]")
    print(f"   {method} {path}")
    print(f"   HTTP={status} (expect={expect_http}) | code={code}")
    if msg: print(f"   msg: {msg}")
    if isinstance(d, dict) and d.get('data') is not None:
        print(f"   data: {json.dumps(d['data'], ensure_ascii=False)[:200]}")
    if checks:
        for k, v in checks.items():
            if isinstance(d, dict) and d.get(k) != v:
                print(f"   ❌ CHECK FAIL: {k} = {d.get(k)} expect {v}")
            elif isinstance(d, dict) and d.get(k) == v:
                print(f"   ✔ CHECK: {k} = {v}")

# ========== 开始 ==========
print("=" * 70)
print("🧪 上线计划单系统 API 验收测试")
print("=" * 70)

# 健康检查
test("Health", "GET", "/api/health")

# 登录 & 获取 Token
tok_csm = login("csm_wang", "123456")
tok_del = login("delivery_zhang", "123456")
tok_dir = login("director_zhao", "123456")

# CSM 看到的队列
test("CSM Queue stats", "GET", "/api/plans/stats", tok_csm,
     checks={"code":0})

# 详情
test("Plan #1 detail", "GET", "/api/plans/1", tok_csm)
test("Plan #4 detail (缺证据)", "GET", "/api/plans/4", tok_csm)

# ========== 错误拦截 ==========
print("\n" + "="*70)
print("🛡️ 错误拦截测试（绕页直调 API 均需被拦截并返回具体原因）")
print("="*70)

# 1. WRONG_ROLE: DIRECTOR 尝试 submit (DRAFT 状态 plan #3，角色应为 CSM)
test("WRONG_ROLE: DIRECTOR submit plan #3 (DRAFT, 仅CSM可)", "POST", "/api/plans/3/action", tok_dir,
     {"action":"submit","version":1},
     expect_http=400, checks={"code":"WRONG_ROLE"})

# 2. WRONG_ROLE: CSM 尝试 verify_pass (仅 DELIVERY)
test("WRONG_ROLE: CSM verify_pass plan #1", "POST", "/api/plans/1/action", tok_csm,
     {"action":"verify_pass","version":1},
     expect_http=400, checks={"code":"WRONG_ROLE"})

# 3. WRONG_STATUS: COMPLETED plan #5 再执行任何流转
test("WRONG_STATUS: COMPLETED #5 try submit", "POST", "/api/plans/5/action", tok_csm,
     {"action":"submit","version":3},
     expect_http=400, checks={"code":"WRONG_STATUS"})

# 4. OLD_VERSION: 用 v=99 操作 plan #1 (实际 v=1)
test("OLD_VERSION: submit plan #1 with v99", "POST", "/api/plans/1/action", tok_csm,
     {"action":"submit","version":99},
     expect_http=409, checks={"code":"OLD_VERSION"})

# 5. MISSING_EVIDENCE: DELIVERY 核验 plan #4 (缺 REGISTRATION 证据，会被流转校验卡)
# 注意: verify_pass 需要 VERIFICATION 证据
test("MISSING_EVIDENCE: DELIVERY verify_pass #4 (缺 REG → 实际 state=PENDING_REVIEW, 先查是否能执行)",
     "POST", "/api/plans/4/action", tok_del,
     {"action":"verify_pass","version":1},
     expect_http=400, checks={"code":"MISSING_EVIDENCE"})

# 6. WRONG_ROLE: DIRECTOR 尝试传 REGISTRATION 证据
test("WRONG_ROLE: DIRECTOR upload REG evidence", "POST", "/api/plans/3/evidence", tok_dir,
     {"evidence_type":"REGISTRATION","name":"x.pdf","url":"/x","version":1},
     expect_http=403, checks={"code":"WRONG_ROLE"})

# 7. WRONG_ROLE: 非创建人 CSM csm_li 尝试编辑 csm_wang 的计划单
tok_li = login("csm_li", "123456")
test("WRONG_ROLE: csm_li edit csm_wang's plan #3", "PATCH", "/api/plans/3", tok_li,
     {"title":"hack","version":1},
     expect_http=403, checks={"code":"WRONG_ROLE"})

# 8. WRONG_STATUS: 编辑 PENDING_REVIEW 状态的计划单
test("WRONG_STATUS: CSM edit plan #1 (PENDING_REVIEW)", "PATCH", "/api/plans/1", tok_csm,
     {"title":"hack","version":1},
     expect_http=400, checks={"code":"WRONG_STATUS"})

# ========== 批量操作 ==========
print("\n" + "="*70)
print("📦 批量操作测试（部分成功、失败项保留）")
print("="*70)

# 用 DELIVERY 批量核验: #1(有证据), #4(缺证据) → 部分成功
test("BATCH verify_pass: plans #1+#4+#7+#8 (部分成功)",
     "POST", "/api/batch/action", tok_del,
     {"plan_ids":[1,4,7,8], "action":"verify_pass",
      "comment":"批量测试", "plan_versions":{1:1,4:1,7:1,8:1}},
     checks={"code":0})

print("\n" + "="*70)
print("✅ 测试脚本执行完毕，以上 ✅ 表示 HTTP 状态匹配，❌ 表示测试不通过")
print("="*70)
