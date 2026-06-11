#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"
tok_del = requests.post(f"{BASE}/api/auth/login", json={"username":"delivery_zhang","password":"123456"}).json()['data']['token']
h = {"Authorization": f"Bearer {tok_del}"}

# 先创建批次让它有 batch_item_id
r = requests.post(f"{BASE}/api/batch/action", headers=h, json={
    "plan_ids": [4],
    "action": "verify_pass",
    "comment": "test",
    "plan_versions": {4: 1}
}).json()
batch_no = r['data']['batch_no']
print(f"Created batch: {batch_no}")

# 拿 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h).json()
bid = next(b['id'] for b in r_list['data']['list'] if b['batch_no'] == batch_no)
print(f"Batch id: {bid}")

# 直接查批次详情
r_detail = requests.get(f"{BASE}/api/batches/{bid}", headers=h).json()
print(f"\nBatch detail keys: {list(r_detail.keys())}")
if 'err' in r_detail:
    print(f"ERR: {r_detail['err']}")
if 'error' in r_detail:
    print(f"ERROR: {r_detail['error']}")
if 'data' in r_detail:
    print(f"\nBatch items: {len(r_detail['data']['items'])}")
    for it in r_detail['data']['items']:
        print(f"  {it['plan_no']}: status={it['status']} upload_count={it.get('upload_count','MISSING')}")
        if 'upload_count' not in it:
            print(f"  FULL ITEM KEYS: {list(it.keys())}")
