#!/usr/bin/env python3
import requests, json

BASE = "http://localhost:8009"
tok_del = requests.post(f"{BASE}/api/auth/login", json={"username":"delivery_zhang","password":"123456"}).json()['data']['token']
h = {"Authorization": f"Bearer {tok_del}"}

# 先创建一个批次
r = requests.post(f"{BASE}/api/batch/action", headers=h, json={
    "plan_ids": [1],
    "action": "verify_pass",
    "comment": "test",
    "plan_versions": {1: 1}
}).json()
print(f"Batch created: {json.dumps(r, indent=2, ensure_ascii=False)[:500]}")

batch_no = r['data']['batch_no']

# 拿 batch id
r_list = requests.get(f"{BASE}/api/batches", headers=h).json()
print(f"\nBatches list keys: {r_list.keys()}")
print(f"Batches list data: {json.dumps(r_list.get('data', {})[:3], indent=2, ensure_ascii=False)[:500]}")

bid = None
for b in r_list['data']['list']:
    if b['batch_no'] == batch_no:
        bid = b['id']
        print(f"\nFound batch: id={bid} no={b['batch_no']}")
        break

# 查看批次详情
if bid:
    r_detail = requests.get(f"{BASE}/api/batches/{bid}", headers=h).json()
    print(f"\nBatch detail keys: {r_detail.keys()}")
    if 'error' in r_detail:
        print(f"ERROR: {r_detail}")
    if 'err' in r_detail:
        print(f"ERR: {r_detail}")
    if 'data' in r_detail:
        items = r_detail['data']['items']
        print(f"\nItems: {len(items)}")
        for it in items:
            print(f"  item keys: {list(it.keys())[:15]}")
            print(f"  item: status={it['status']} plan_no={it['plan_no']} upload_count={it.get('upload_count','N/A')}")
