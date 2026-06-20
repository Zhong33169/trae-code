#!/usr/bin/env python3
import urllib.request, json, sys
BASE = "http://127.0.0.1:8004/api"
PASS = 0; FAIL = 0

def request(method, path, data=None, headers=None):
    url = BASE + path
    hdrs = {"Content-Type": "application/json"}
    if headers: hdrs.update(headers)
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except: return {"ok": False, "msg": str(e)}

def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name} {detail}")

def get_app(id):
    return request("GET", f"/applications/{id}")

R1 = {"x-user-id":"1","x-user-role":"registrar"}
A1 = {"x-user-id":"3","x-user-role":"auditor"}
V1 = {"x-user-id":"5","x-user-role":"reviewer"}

# ========== Test 1: 列表API返回 prev_handler_name ==========
print("\n=== Test 1: 列表API返回 prev_handler_name ===")
r = request("GET", "/applications")
check("列表API成功", r.get("ok"))
items = r.get("data", [])
check("列表非空", len(items) > 0)
has_prev = any(item.get("prev_handler_name") is not None for item in items)
check("列表含 prev_handler_name", has_prev)

# ========== Test 2: 详情API prev_handler_name 正确 ==========
print("\n=== Test 2: 详情API prev_handler_name 正确性 ===")
d = get_app(3)
a = d["data"]["app"]
check("003 prev_handler_name=王强(审核通过)", a["prev_handler_name"] == "王强")
check("003 prev_result=pass", a["prev_result"] == "pass")
check("003 prev_opinion非空", len(a.get("prev_opinion") or "") > 0)

d = get_app(7)
a = d["data"]["app"]
check("007 prev_handler_name=张伟(申诉)", a["prev_handler_name"] == "张伟")
check("007 prev_result=appeal", a["prev_result"] == "appeal")
check("007 reject_reason=null(申诉后清除)", a.get("reject_reason") is None)

# ========== Test 3: 009 archived reject_reason=null ==========
print("\n=== Test 3: 009 archived reject_reason=null ===")
d = get_app(9)
a = d["data"]["app"]
check("009 archived", a["status"] == "archived")
check("009 reject_reason=null", a.get("reject_reason") is None)
check("009 prev_handler_name=陈明", a["prev_handler_name"] == "陈明")
check("009 prev_result=archive", a["prev_result"] == "archive")

# ========== Test 4: action 返回完整详情(app+evidence+nodes+logs) ==========
print("\n=== Test 4: action 返回完整详情格式 ===")
d = get_app(1)
a = d["data"]["app"]
check("001 pending_audit", a["status"] == "pending_audit")
r = request("POST", "/applications/1/action", {"action":"audit_pass","opinion":"审核通过，50万授信","client_version":1}, A1)
check("audit_pass成功", r.get("ok"))
rd = r.get("data", {})
check("action返回含app", "app" in rd)
check("action返回含evidence", "evidence" in rd)
check("action返回含nodes", "nodes" in rd)
check("action返回含logs", "logs" in rd)
check("action返回app.status=pending_review", rd["app"]["status"] == "pending_review")
check("action返回app.prev_handler_name=王强", rd["app"]["prev_handler_name"] == "王强")
check("action返回app.prev_result=pass", rd["app"]["prev_result"] == "pass")
check("action返回app.prev_opinion非空", len(rd["app"].get("prev_opinion") or "") > 0)
check("action返回evidence数量=6", len(rd["evidence"]) == 6)
check("action返回nodes非空", len(rd["nodes"]) >= 2)
check("action返回logs非空", len(rd["logs"]) >= 2)

# ========== Test 5: 002 退回补正完整闭环 ==========
print("\n=== Test 5: 002 退回补正 → 补证据 → 重提 → 审核通过 → 复核归档 ===")
d = get_app(2)
a = d["data"]["app"]
check("002 reject_correction V1", a["status"] == "reject_correction" and a["version"] == 1)
check("002 reject_reason非空", a.get("reject_reason") is not None)

for e in d["data"]["evidence"]:
    if not e["is_submitted"]:
        request("PUT", f"/applications/2/evidence/{e['id']}", {"is_submitted":1,"file_name":f"补_{e['evidence_name']}.pdf","remark":"补正提交"}, R1)

r = request("POST", "/applications/2/action", {"action":"correction_resubmit","opinion":"证据补全，重提审核","client_version":1}, R1)
check("correction_resubmit→pending_audit V2", r["ok"] and r["data"]["app"]["status"]=="pending_audit" and r["data"]["app"]["version"]==2)
check("重提后reject_reason=null", r["data"]["app"].get("reject_reason") is None)
check("重提后prev_handler_name=张伟", r["data"]["app"]["prev_handler_name"] == "张伟")
check("重提后prev_result=submit", r["data"]["app"]["prev_result"] == "submit")

r = request("POST", "/applications/2/action", {"action":"audit_pass","opinion":"补正后审核通过","client_version":2}, A1)
check("audit_pass→pending_review", r["ok"] and r["data"]["app"]["status"]=="pending_review")
check("审核后prev_handler_name=王强", r["data"]["app"]["prev_handler_name"] == "王强")

r = request("POST", "/applications/2/action", {"action":"review_archive","opinion":"复核归档完成","client_version":2}, V1)
check("review_archive→archived", r["ok"] and r["data"]["app"]["status"]=="archived")
check("归档后reject_reason=null", r["data"]["app"].get("reject_reason") is None)
check("归档后所有节点completed", all(n["status"]=="completed" for n in r["data"]["nodes"]))

# ========== Test 6: 校验失败审计日志 ==========
print("\n=== Test 6: 校验失败审计日志 ===")
d = get_app(4)
a = d["data"]["app"]
check("004 overdue V1", a["status"]=="overdue" and a["is_overdue"]==1)
logs_before = len(d["data"]["logs"])

r = request("POST", "/applications/4/action", {"action":"audit_pass","opinion":"证据不全尝试审核","client_version":1}, A1)
check("证据不全→audit_pass失败", not r.get("ok"))

d2 = get_app(4)
check("失败后日志+1", len(d2["data"]["logs"]) == logs_before + 1)
fail_logs = [l for l in d2["data"]["logs"] if l["action"].endswith("_fail")]
check("含audit_pass_fail日志", len(fail_logs) >= 1)
extra = json.loads(fail_logs[0].get("extra") or "{}")
check("失败日志含reason", "reason" in extra)
check("状态保持overdue不变", d2["data"]["app"]["status"] == "overdue")

# 补证据后清除逾期
for e in d2["data"]["evidence"]:
    if not e["is_submitted"]:
        request("PUT", f"/applications/4/evidence/{e['id']}", {"is_submitted":1,"file_name":f"补_{e['evidence_name']}.pdf","remark":"逾期补正"}, R1)
r = request("POST", "/applications/4/action", {"action":"audit_pass","opinion":"逾期补正后审核通过","client_version":1}, A1)
check("逾期补正后audit_pass→pending_review", r["ok"] and r["data"]["app"]["status"]=="pending_review" and r["data"]["app"]["is_overdue"]==0)

r = request("POST", "/applications/4/action", {"action":"review_archive","opinion":"逾期补正后归档","client_version":1}, V1)
check("004归档→archived", r["ok"] and r["data"]["app"]["status"]=="archived")

# 006 conflict 归档清冲突
r = request("POST", "/applications/6/action", {"action":"review_archive","opinion":"冲突已核实，关联企业授信结清，归档","client_version":2}, V1)
check("006 review_archive→archived", r["ok"] and r["data"]["app"]["status"]=="archived" and r["data"]["app"]["has_conflict"]==0)

# ========== Test 7: 007 多轮申诉闭环 ==========
print("\n=== Test 7: 007 两轮申诉 → 第三轮驳回 → 第三轮申诉 → 复核通过 → 归档 ===")
d = get_app(7)
a = d["data"]["app"]
check("007 appeal_reviewing V3", a["status"]=="appeal_reviewing" and a["version"]==3)

r = request("POST", "/applications/7/action", {"action":"review_reject","opinion":"第三轮复核驳回：担保人资质不足","reject_reason":"第三轮驳回：担保人资质不符AA级要求","client_version":3}, V1)
check("review_reject→reject_revision V3", r["ok"] and r["data"]["app"]["status"]=="reject_revision" and r["data"]["app"]["version"]==3)
check("驳回后reject_reason非空", r["data"]["app"].get("reject_reason") is not None)
check("驳回后prev_handler_name=陈明", r["data"]["app"]["prev_handler_name"]=="陈明")
check("驳回后prev_result=reject", r["data"]["app"]["prev_result"]=="reject")

r = request("POST", "/applications/7/action", {"action":"appeal_submit","opinion":"补充审计报告，第三轮申诉","client_version":3}, R1)
check("appeal_submit→appeal_reviewing V4", r["ok"] and r["data"]["app"]["status"]=="appeal_reviewing" and r["data"]["app"]["version"]==4)
check("申诉后reject_reason=null", r["data"]["app"].get("reject_reason") is None)
check("申诉后prev_handler_name=张伟", r["data"]["app"]["prev_handler_name"]=="张伟")
check("申诉后prev_result=appeal", r["data"]["app"]["prev_result"]=="appeal")

r = request("POST", "/applications/7/action", {"action":"review_pass","opinion":"第三轮申诉复核通过","client_version":4}, V1)
check("review_pass→review_pass", r["ok"] and r["data"]["app"]["status"]=="review_pass")
check("复核后prev_handler_name=陈明", r["data"]["app"]["prev_handler_name"]=="陈明")
check("复核后prev_result=pass", r["data"]["app"]["prev_result"]=="pass")

r = request("POST", "/applications/7/action", {"action":"review_archive","opinion":"第三轮申诉后归档","client_version":4}, V1)
check("review_archive→archived", r["ok"] and r["data"]["app"]["status"]=="archived")
check("归档后所有节点completed", all(n["status"]=="completed" for n in r["data"]["nodes"]))
check("归档后reject_reason=null", r["data"]["app"].get("reject_reason") is None)

# ========== Test 8: 新建+5道校验+完整流程 ==========
print("\n=== Test 8: 新建申请 + 5道校验 + 完整流程到归档 ===")
r = request("POST", "/applications", {"company_name":"API验证闭环测试公司","credit_line":300000,"applicant":"测试员","contact_phone":"13900009999","business_type":"综合批发"}, R1)
check("创建成功", r.get("ok"))
new_id = r["data"]["id"]

r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"直接提交","client_version":1}, R1)
check("证据不全→register_submit失败", not r.get("ok") and "证据" in r.get("msg",""))

r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"越权测试","client_version":1}, A1)
check("非当前处理人→失败", not r.get("ok"))

d = request("GET", f"/applications/{new_id}")
for e in d["data"]["evidence"]:
    if e["is_required"]:
        request("PUT", f"/applications/{new_id}/evidence/{e['id']}", {"is_submitted":1,"file_name":f"{e['evidence_name']}.pdf","remark":"必填"}, R1)

r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"证据已齐提交审核","client_version":99}, R1)
check("版本冲突→失败", not r.get("ok") and "版本" in r.get("msg",""))

d2 = request("GET", f"/applications/{new_id}")
v = d2["data"]["app"]["version"]
r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"证据已齐提交审核","client_version":v}, R1)
check("register_submit成功→pending_audit", r.get("ok") and r["data"]["app"]["status"]=="pending_audit")

r = request("POST", f"/applications/{new_id}/action", {"action":"audit_pass","opinion":"审核通过","client_version":v}, A1)
check("audit_pass→pending_review", r.get("ok") and r["data"]["app"]["status"]=="pending_review")

r = request("POST", f"/applications/{new_id}/action", {"action":"review_archive","opinion":"复核归档","client_version":v}, V1)
check("review_archive→archived", r.get("ok") and r["data"]["app"]["status"]=="archived")

# ========== Test 9: 审计日志完整性 ==========
print("\n=== Test 9: 审计日志完整性 ===")
d = get_app(9)
logs = d["data"]["logs"]
check("009 日志>=11条", len(logs) >= 11)
fail_logs = [l for l in logs if l["action"].endswith("_fail")]
version_jumps = [l for l in logs if l["version_from"] != l["version_to"]]
check("009 版本跳变>=2次(V1→V2, V2→V3)", len(version_jumps) >= 2)

# 新建申请的失败日志
d = get_app(new_id)
fail_logs = [l for l in d["data"]["logs"] if l["action"].endswith("_fail")]
check("新建申请含校验失败日志>=2条", len(fail_logs) >= 2)
for fl in fail_logs:
    extra = json.loads(fl.get("extra") or "{}")
    check(f"失败日志{fl['action']}含reason", "reason" in extra)

# ========== Test 10: 统计同步验证 ==========
print("\n=== Test 10: 统计同步验证 ===")
r = request("GET", "/applications/stats")
s = r["data"]
by_status = {x["status"]: x["n"] for x in s["byStatus"]}
check("archived>=5(002+006+007+008+009+新建)", by_status.get("archived",0) >= 5)
check("overdue=0(全部处理)", s["overdue"] == 0)
check("conflict=0(全部处理)", s["conflict"] == 0)

# ========== Test 11: 列表API prev_handler_name 值正确 ==========
print("\n=== Test 11: 列表API prev_handler_name值验证 ===")
r = request("GET", "/applications")
items = r.get("data", [])
archived_with_prev = [i for i in items if i["status"]=="archived" and i.get("prev_handler_name")]
check("归档申请有prev_handler_name", len(archived_with_prev) >= 1)
for item in items:
    if item["id"] == 9:
        check("009列表prev_handler_name=陈明", item.get("prev_handler_name") == "陈明")
        break

# ========== 总结 ==========
print(f"\n{'='*50}")
print(f"验证完成: ✅ {PASS} 通过, ❌ {FAIL} 失败")
if FAIL > 0:
    print("⚠️ 存在失败项，请检查上方输出！")
    sys.exit(1)
else:
    print("🎉 所有验证项通过！异常办理闭环完整可用。")
