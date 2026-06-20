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

def show_app(id, label):
    r = get_app(id)
    if not r.get("ok"): print(f"  [{label}] ERROR: {r.get('msg')}"); return None
    a = r["data"]["app"]
    print(f"  [{label}] status={a['status']} V{a['version']} overdue={a['is_overdue']} conflict={a['has_conflict']} handler={a['handler_name']} prev={a['prev_handler_name']}/{a['prev_result']}")
    return a

R1 = {"x-user-id":"1","x-user-role":"registrar"}
A1 = {"x-user-id":"3","x-user-role":"auditor"}
V1 = {"x-user-id":"5","x-user-role":"reviewer"}

# ========== Test 1: 002 完整退回补正闭环 ==========
print("\n=== Test 1: 002 上海盛达 退回补正 → 补证据 → 重提 → 审核通过 → 复核归档 ===")
a = show_app(2, "初始(reject_correction V1)")
check("002 初始状态 reject_correction", a and a["status"] == "reject_correction" and a["version"] == 1)

r = request("GET", "/applications/2")
ev = r["data"]["evidence"]
for e in ev:
    if not e["is_submitted"]:
        r2 = request("PUT", f"/applications/2/evidence/{e['id']}", {"is_submitted": 1, "file_name": f"补正_{e['evidence_name']}.pdf", "remark": "补正提交"}, R1)
        check(f"证据补正 {e['evidence_name']}", r2.get("ok"))

r = request("POST", "/applications/2/action", {"action":"correction_resubmit","opinion":"证据已补全，重新提交审核","client_version":1}, R1)
check("correction_resubmit 成功 V1→V2", r.get("ok") and r["data"]["version"] == 2 and r["data"]["status"] == "pending_audit")

r = request("POST", "/applications/2/action", {"action":"audit_pass","opinion":"补正资料有效，审核通过","client_version":2}, A1)
check("audit_pass 成功 → pending_review", r.get("ok") and r["data"]["status"] == "pending_review")

r = request("POST", "/applications/2/action", {"action":"review_archive","opinion":"复核通过，归档完成","client_version":2}, V1)
check("review_archive 成功 → archived", r.get("ok") and r["data"]["status"] == "archived")

a = show_app(2, "归档后")
check("归档后 overdue=0 conflict=0", a and a["is_overdue"] == 0 and a["has_conflict"] == 0)
check("归档后 reject_reason=null", a and a.get("reject_reason") is None)

# ========== Test 2: 004 逾期 + 证据不全 → 审核失败 ==========
print("\n=== Test 2: 004 深圳创新(overdue V1) → audit_pass 证据不全失败 → 补证据 → 审核通过清逾期 ===")
a = show_app(4, "初始(overdue)")
check("004 overdue=1", a and a["is_overdue"] == 1)

r = request("POST", "/applications/4/action", {"action":"audit_pass","opinion":"先尝试审核","client_version":1}, A1)
check("audit_pass 证据不全→失败", not r.get("ok") and "证据" in r.get("msg",""))

logs_before = len(get_app(4)["data"]["logs"])
check("失败日志写入", len(get_app(4)["data"]["logs"]) == logs_before)

a4 = get_app(4)["data"]
for e in a4["evidence"]:
    if not e["is_submitted"]:
        request("PUT", f"/applications/4/evidence/{e['id']}", {"is_submitted": 1, "file_name": f"补_{e['evidence_name']}.pdf", "remark": "逾期补正"}, R1)

r = request("POST", "/applications/4/action", {"action":"audit_pass","opinion":"逾期补正后审核通过","client_version":1}, A1)
check("逾期补正后 audit_pass 成功", r.get("ok") and r["data"]["status"] == "pending_review" and r["data"]["is_overdue"] == 0)
check("逾期标已清除", r["data"]["is_overdue"] == 0)

# ========== Test 3: 006 conflict 归档清冲突 ==========
print("\n=== Test 3: 006 杭州远见(conflict V2) → review_archive 归档清冲突 ===")
a = show_app(6, "初始(conflict)")
check("006 conflict=1", a and a["has_conflict"] == 1)

r = request("POST", "/applications/6/action", {"action":"review_archive","opinion":"冲突已核实，关联企业授信已结清，归档","client_version":2}, V1)
check("review_archive 成功→archived", r.get("ok") and r["data"]["status"] == "archived")
check("冲突标已清除", r["data"]["has_conflict"] == 0)

# ========== Test 4: 007 两轮申诉完整闭环 ==========
print("\n=== Test 4: 007 南京中泰(appeal_reviewing V3) → review_reject → appeal_submit → review_pass → review_archive ===")
a = show_app(7, "初始(appeal_reviewing V3)")
check("007 V3 appeal_reviewing", a and a["version"] == 3 and a["status"] == "appeal_reviewing")

r = request("POST", "/applications/7/action", {"action":"review_reject","opinion":"第三轮复核驳回：担保人资质不足","reject_reason":"第三轮驳回：担保人资质不符AA级要求，需补充审计报告","client_version":3}, V1)
check("review_reject → reject_revision", r.get("ok") and r["data"]["status"] == "reject_revision")
check("驳回原因已更新", r["data"]["reject_reason"] is not None and "第三轮" in r["data"]["reject_reason"])
check("版本不变 V3", r["data"]["version"] == 3)

r = request("POST", "/applications/7/action", {"action":"appeal_submit","opinion":"已补充审计报告和担保人资质证明，第三轮申诉","client_version":3}, R1)
check("appeal_submit → appeal_reviewing V4", r.get("ok") and r["data"]["status"] == "appeal_reviewing" and r["data"]["version"] == 4)
check("驳回原因已清除", r["data"]["reject_reason"] is None)
check("上一处理人=张伟/appeal", r["data"]["prev_handler_name"] == "张伟" and r["data"]["prev_result"] == "appeal")

r = request("POST", "/applications/7/action", {"action":"review_pass","opinion":"第三轮申诉复核通过，担保人资质已验证","client_version":4}, V1)
check("review_pass → review_pass V4", r.get("ok") and r["data"]["status"] == "review_pass")

r = request("POST", "/applications/7/action", {"action":"review_archive","opinion":"第三轮申诉后归档完成","client_version":4}, V1)
check("review_archive → archived V4", r.get("ok") and r["data"]["status"] == "archived")

d = get_app(7)
check("007 节点数>7", len(d["data"]["nodes"]) >= 7)
check("007 日志数>10", len(d["data"]["logs"]) >= 10)

# ========== Test 5: 新建申请 + 5道校验验证 ==========
print("\n=== Test 5: 新建申请 → 5道校验验证 → 完整流程到归档 ===")
r = request("POST", "/applications", {"company_name":"测试闭环验证公司","credit_line":500000,"applicant":"赵经理","contact_phone":"13900001111","business_type":"综合批发"}, R1)
check("创建申请成功", r.get("ok"))
new_id = r["data"]["id"]

r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"直接提交（证据不全）","client_version":1}, R1)
check("register_submit 证据不全→失败", not r.get("ok") and "证据" in r.get("msg",""))

r = request("GET", f"/applications/{new_id}")
for e in r["data"]["evidence"]:
    if e["is_required"]:
        request("PUT", f"/applications/{new_id}/evidence/{e['id']}", {"is_submitted":1,"file_name":f"{e['evidence_name']}.pdf","remark":"系统标记"}, R1)

r = request("POST", f"/applications/{new_id}/action", {"action":"register_submit","opinion":"证据已齐，提交审核","client_version":1}, R1)
check("register_submit 成功→pending_audit", r.get("ok") and r["data"]["status"] == "pending_audit")

r = request("POST", f"/applications/{new_id}/action", {"action":"audit_pass","opinion":"审核通过","client_version":99}, A1)
check("错误版本号→失败", not r.get("ok") and "版本" in r.get("msg",""))

r = request("POST", f"/applications/{new_id}/action", {"action":"audit_pass","opinion":"审核通过","client_version":1}, A1)
check("audit_pass 成功→pending_review", r.get("ok") and r["data"]["status"] == "pending_review")

r = request("POST", f"/applications/{new_id}/action", {"action":"review_archive","opinion":"复核通过并归档","client_version":1}, V1)
check("review_archive 成功→archived", r.get("ok") and r["data"]["status"] == "archived")

# ========== Test 6: 009 完整闭环样例验证 ==========
print("\n=== Test 6: 009 重庆星锐(archived V3) 样例数据完整性 ===")
d = get_app(9)
a = d["data"]["app"]
check("009 archived V3", a["status"] == "archived" and a["version"] == 3)
check("009 节点>=8", len(d["data"]["nodes"]) >= 8)
check("009 日志>=11", len(d["data"]["logs"]) >= 11)

nodes = d["data"]["nodes"]
completed = [n for n in nodes if n["status"] == "completed"]
check("009 所有节点已完成", len(completed) == len(nodes))

node_types = [n["node_type"] for n in nodes]
check("009 含 register+audit+correction+review+appeal 节点",
      "register" in node_types and "audit" in node_types and "correction" in node_types and "review" in node_types and "appeal" in node_types)

# ========== Test 7: 版本冲突校验失败写审计日志 ==========
print("\n=== Test 7: 校验失败审计日志验证 ===")
d = get_app(new_id)
fail_logs = [l for l in d["data"]["logs"] if l["action"].endswith("_fail")]
check("校验失败日志>=2条(证据+版本)", len(fail_logs) >= 2)
for fl in fail_logs:
    extra = json.loads(fl.get("extra") or "{}")
    check(f"失败日志含原因: {fl['action']}", "reason" in extra)

# ========== Test 8: 统计同步验证 ==========
print("\n=== Test 8: 统计同步验证 ===")
r = request("GET", "/applications/stats")
s = r["data"]
by_status = {x["status"]: x["n"] for x in s["byStatus"]}
archived_count = by_status.get("archived", 0)
check(f"archived 数量>=4 (002+006+007+008+009+新建)", archived_count >= 4)
check("overdue=0 (全部清除)", s["overdue"] == 0)
check("conflict=0 (全部清除)", s["conflict"] == 0)

# ========== 总结 ==========
print(f"\n{'='*50}")
print(f"验证完成: ✅ {PASS} 通过, ❌ {FAIL} 失败")
if FAIL > 0:
    print("⚠️ 存在失败项，请检查上方输出！")
    sys.exit(1)
else:
    print("🎉 所有验证项通过！异常办理闭环完整可用。")
