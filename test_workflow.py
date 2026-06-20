import json
import urllib.request

BASE = "http://127.0.0.1:8002"

def req(method, path, data=None, params=None):
    url = BASE + path
    if params:
        url += "?" + "&".join(f"{k}={v}" for k, v in params.items())
    headers = {"Content-Type": "application/json"} if data else {}
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())

# Step 0: Reset DB - get order #7 info
print("="*60)
print("STEP 0: Check current state of order #7")
d = req("GET", "/api/inspections/7")
o = d["data"]
print(f"  order_no={o['order_no']} status={o['status']} risk={o['risk_level']} ver={o['version']}")
print(f"  result={o['inspection_result']} checks: appear={o.get('appearance_check')} func={o.get('function_check')}")
print()

# If already handled, test with a different pending one
if o["status"] != "pending_handling":
    print(f"Order #7 is not pending_handling (is {o['status']}), using list to find one")
    d = req("GET", "/api/inspections")
    pending = [x for x in d["data"] if x["status"] == "pending_handling"]
    print(f"  Found {len(pending)} pending_handling orders")
    test_id = pending[0]["id"] if pending else None
else:
    test_id = 7

print(f"Using test_id={test_id}")
print()

# Step 1: Handle
print("="*60)
print(f"STEP 1: HANDLE order #{test_id} (pending_handling -> pending_review)")
cur = req("GET", f"/api/inspections/{test_id}")["data"]
handle_data = {
    "version": cur["version"],
    "handler_opinion": "所有检查项均正常，器械运行良好，建议通过复核",
    "handler_result": "normal",
    "appearance_check": True,
    "appearance_evidence": "photo_ok.jpg",
    "appearance_remark": "外观整洁",
    "function_check": True,
    "function_evidence": "video_ok.mp4",
    "function_remark": "运行平稳",
    "safety_check": True,
    "safety_evidence": "safety_ok.jpg",
    "safety_remark": "安全有效",
    "maintenance_check": True,
    "maintenance_evidence": "maint_ok.pdf",
    "maintenance_remark": "记录完整",
}
d = req("POST", f"/api/inspections/{test_id}/handle", handle_data, {"user_id": 2})
print(f"  success={d['success']} msg={d['message']}")
if d["success"]:
    o = d["data"]
    print(f"  NEW status={o['status']} ver={o['version']} result={o['inspection_result']}")
    print(f"  handler_opinion={o['handler_opinion'][:50]}...")
    ops = o.get("operation_records", [])
    print(f"  op_records={len(ops)}")
    for r in ops[:2]:
        print(f"    OP[{r['id']}]: {r['operation_type']} {r.get('from_status','')}->{r.get('to_status','')} by={r.get('operator_name')} v={r.get('version')}")
review_id = d["data"]["id"] if d["success"] else test_id
print()

# Step 2: Review & Approve
print("="*60)
print(f"STEP 2: REVIEW & APPROVE order #{review_id} (pending_review -> archived)")
cur = req("GET", f"/api/inspections/{review_id}")["data"]
print(f"  Pre-Review: status={cur['status']} ver={cur['version']}")
review_data = {
    "version": cur["version"],
    "reviewer_opinion": "复核通过，办理流程规范，检查完整，证据齐全，同意归档",
    "reviewer_result": "normal",
    "is_approved": True,
}
d = req("POST", f"/api/inspections/{review_id}/review", review_data, {"user_id": 3})
print(f"  success={d['success']} msg={d['message']}")
if d["success"]:
    o = d["data"]
    print(f"  NEW status={o['status']} ver={o['version']} result={o['inspection_result']}")
    print(f"  reviewer_opinion={o['reviewer_opinion'][:50]}...")
    ops = o.get("operation_records", [])
    print(f"  op_records total={len(ops)}")
    for r in ops[:3]:
        print(f"    OP[{r['id']}]: {r['operation_type']} {r.get('from_status','')}->{r.get('to_status','')} by={r.get('operator_name')}")
print()

# Step 3: Test statistics & queue updated
print("="*60)
print("STEP 3: Verify Statistics & Queue update")
stats = req("GET", "/api/statistics")["data"]
print(f"  Stats: total={stats['total']} pending={stats['pending_handling']} reviewing={stats['pending_review']} archived={stats['archived']} high={stats['high_risk']} overdue={stats['overdue']}")
q = req("GET", "/api/queue", None, {"user_id": 2, "role": "handler"})["data"]
print(f"  Handler queue: {len(q)} items")
for qi in q[:3]:
    print(f"    Q: {qi['order_no']} {qi['status']} {qi['equipment_name']} action={qi['action_required']}")
print()

# Step 4: Test fault report
print("="*60)
print("STEP 4: Test FAULT REPORT on a pending order")
d = req("GET", "/api/inspections")
pending_list = [x for x in d["data"] if x["status"] in ("pending_handling","in_progress")]
if not pending_list:
    print("  No pending orders to test fault on, skipping")
else:
    fid = pending_list[0]["id"]
    cur = req("GET", f"/api/inspections/{fid}")["data"]
    print(f"  Testing fault on order #{fid} (current risk={cur['risk_level']})")
    fault_data = {
        "inspection_order_id": fid,
        "fault_description": "跑步机电机异响，皮带磨损严重，存在安全隐患",
        "fault_level": "high",
        "version": cur["version"],
    }
    d = req("POST", "/api/fault-reports", fault_data, {"user_id": 2})
    print(f"  success={d['success']} msg={d['message']}")
    if d["success"]:
        after = req("GET", f"/api/inspections/{fid}")["data"]
        print(f"  BEFORE risk={cur['risk_level']} AFTER risk={after['risk_level']}")
        print(f"  fault_reports count={len(after.get('fault_reports',[]))}")
        for fr in after.get("fault_reports",[]):
            print(f"    FR: desc={fr['fault_description'][:40]} level={fr['fault_level']} resolved={fr['is_resolved']}")
print()

# Step 5: Test version conflict
print("="*60)
print("STEP 5: Test VERSION CONFLICT (validation)")
d = req("GET", "/api/inspections")
reviewing_list = [x for x in d["data"] if x["status"] == "pending_review"]
if not reviewing_list:
    print("  No pending_review orders, creating one via handle...")
    pending_list2 = [x for x in d["data"] if x["status"] == "pending_handling"]
    if pending_list2:
        cid = pending_list2[0]["id"]
        cur2 = req("GET", f"/api/inspections/{cid}")["data"]
        hd2 = dict(handle_data); hd2["version"] = cur2["version"]
        req("POST", f"/api/inspections/{cid}/handle", hd2, {"user_id": 2})
        reviewing_list = [req("GET", f"/api/inspections/{cid}")["data"]]
if reviewing_list:
    rid = reviewing_list[0]["id"] if isinstance(reviewing_list[0], dict) else reviewing_list[0]
    if isinstance(rid, int):
        cur3 = req("GET", f"/api/inspections/{rid}")["data"]
    else:
        cur3 = reviewing_list[0]; rid = cur3["id"]
    print(f"  Testing on order #{rid} ver={cur3['version']}")
    bad_review = {
        "version": cur3["version"] - 1,  # wrong version
        "reviewer_opinion": "bad version test",
        "reviewer_result": "normal",
        "is_approved": True,
    }
    d = req("POST", f"/api/inspections/{rid}/review", bad_review, {"user_id": 3})
    print(f"  Wrong version: success={d['success']} msg={d['message'][:80]}")
    after_v = req("GET", f"/api/inspections/{rid}")["data"]
    print(f"  State unchanged: status={after_v['status']} ver={after_v['version']} (should still be pending_review)")
    ops = after_v.get("operation_records", [])
    valid_fail = [r for r in ops if "validation_failed" in str(r.get("operation_type","")).lower() or "失败" in str(r.get("remark",""))]
    if valid_fail:
        r = valid_fail[0]
        print(f"  ✅ Validation record written: OP={r['operation_type']} remark={str(r.get('remark',''))[:60]}")
print()

print("="*60)
print("WORKFLOW TEST COMPLETE")
