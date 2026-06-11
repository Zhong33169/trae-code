#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"

def login(u, p):
    r = requests.post(f"{BASE}/api/auth/login", json={"username":u,"password":p})
    return r.json()['data']['token']

def h(tok): return {"Authorization": f"Bearer {tok}"}

tok_del = login("delivery_zhang", "123456")

# 创建批量操作（两条缺 VER 证据的会失败）
r = requests.post(f"{BASE}/api/batch/action", headers=h(tok_del), json={
    "plan_ids": [4, 8],
    "action": "verify_pass",
    "comment": "测试批次",
    "plan_versions": {4: 1, 8: 1}
}).json()
print(f"批次结果: code={r['code']}")
if r.get('data'):
    print(f"  batch_no={r['data']['batch_no']} succ={r['data']['success_count']} fail={r['data']['failed_count']}")

# 获取 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h(tok_del)).json()
bid = r_list['data']['list'][0]['id']
print(f"  batch_id={bid}")

# 查看批次详情 - 验证新字段
r_detail = requests.get(f"{BASE}/api/batches/{bid}", headers=h(tok_del)).json()
bd = r_detail['data']
print(f"\n批次详情: role_evidence_rules={bd.get('role_evidence_rules')}")
for it in bd['items']:
    print(f"  {it.get('plan_no','?')}: status={it['status']} plan_version={it.get('plan_version')} "
          f"missing={it.get('missing_evidences',[])} labels={it.get('missing_labels',[])} "
          f"uploadable={it.get('uploadable_evidence',[])} next_actions={json.dumps(it.get('next_allowed_actions',[]), ensure_ascii=False)}")
