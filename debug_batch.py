#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    return r.json()['data']['token']

def h(tok): return {"Authorization": f"Bearer {tok}"}

tok_del = login("delivery_zhang", "123456")
tok_csm = login("csm_wang", "123456")

# 先看 #1 有没有 VER 证据
r = requests.get(f"{BASE}/api/plans/1", headers=h(tok_del)).json()
print(f"Plan #1 evidences: {len(r['data'].get('evidences', []))}")
for e in r['data']['evidences']:
    print(f"  - {e['evidence_type']}: {e['name']}")

# 先看 #4 有没有 VER 证据
r = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
print(f"\nPlan #4 evidences: {len(r['data'].get('evidences', []))}")
for e in r['data']['evidences']:
    print(f"  - {e['evidence_type']}: {e['name']}")
print(f"  version: {r['data']['version']}")

# 创建批量：#1(有REG缺VER) #4(有REG缺VER) → 都应该失败
r_batch = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [1, 4],
    "action": "verify_pass",
    "comment": "测试批量",
    "plan_versions": {1: 1, 4: 1}
}).json()
print(f"\n批量结果: code={r_batch['code']}")
print(f"  total={r_batch['data']['total']}, success={r_batch['data']['success_count']}, failed={r_batch['data']['failed_count']}")
for it in r_batch['data']['items']:
    print(f"  - {it['plan_no']}: {it['result']} err={it.get('error_code')}")

batch_id = r_batch['data'].get('id')  # 注意：返回的 data 里可能没有 id
print(f"\nbatch data keys: {r_batch['data'].keys()}")
batch_no = r_batch['data']['batch_no']

# 用列表接口拿 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
for b in r_list['data']['list'][:3]:
    print(f"  batch {b['id']} {b['batch_no']} succ={b['success_count']} fail={b['failed_count']}")
    if b['batch_no'] == batch_no:
        bid = b['id']

# 先给 #4 上传 VER 证据
r_up = requests.post(f"{BASE}/api/plans/4/evidence", headers=h(tok_del), json={
    "evidence_type": "VERIFICATION",
    "name": "核验报告_补传.pdf",
    "url": "/ev/004_v2.pdf",
    "version": 1
}).json()
print(f"\n上传 #4 VER 证据: code={r_up['code']}")
if r_up.get('data'):
    print(f"  新 version: {r_up['data']['version']}")

# 再查 #4
r4 = requests.get(f"{BASE}/api/plans/4", headers=h(tok_del)).json()
print(f"#4 新状态: {r4['data']['status']}, version: {r4['data']['version']}")

# 现在重试
r_retry = requests.post(f"{BASE}/api/batch/{bid}/retry", headers=h(tok_del), json={
    "comment": "补证据后重试"
}).json()
print(f"\n重试结果: code={r_retry.get('code')}")
if r_retry.get('data'):
    print(f"  retry_success={r_retry['data']['retry_success']}")
    print(f"  retry_failed={r_retry['data']['retry_failed']}")
    print(f"  total_success={r_retry['data']['total_success']}")
    print(f"  total_failed={r_retry['data']['total_failed']}")
    for it in r_retry['data'].get('items', []):
        print(f"  - {it['plan_no']}: {it['result']} err={it.get('error_code')}")

# 查批次详情确认
r_detail = requests.get(f"{BASE}/api/batches/{bid}", headers=h(tok_del)).json()
bd = r_detail['data']
print(f"\n批次详情: succ={bd['success_count']} fail={bd['failed_count']}")
for it in bd['items']:
    print(f"  - {it['plan_no']}: {it['status']} retry={it['retry_count']} err={it.get('error_code')}")
