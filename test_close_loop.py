#!/usr/bin/env python3
import urllib.request, json
BASE = "http://127.0.0.1:8004/api"

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

def show_app(id, label):
    r = request("GET", f"/applications/{id}")
    a = r["data"]["app"]
    print(f"  [{label}] status={a['status']:20s} V{a['version']} overdue={a['is_overdue']} conflict={a['has_conflict']} handler={a['handler_name']}")
    print(f"     prev={a['prev_handler_name'] or '-'} / {a['prev_result'] or '-'} / {str(a.get('prev_opinion') or '')[:50]}")

def show_logs(id, n=3, label="最近日志"):
    r = request("GET", f"/applications/{id}")
    logs = r["data"]["logs"]
    print(f"  [{label}]: 共{len(logs)}条，最近{n}条:")
    for l in logs[:n]:
        fail = " ❌FAIL" if l["action"].endswith("_fail") else ""
        extra = ""
        if l.get("extra"):
            try:
                e = json.loads(l["extra"])
                if "reason" in e: extra = f" → 失败原因: {e['reason'][:60]}"
            except: pass
        print(f"     {l['created_at'][:16]} {l['user_name'] or '系统'} {l['action']:20s} [{l['old_status'] or '-':15s}→{l['new_status']:15s}] V{l['version_from']}→V{l['version_to']}{fail}{extra}")

R1 = {"x-user-id":"1","x-user-role":"registrar"}
A1 = {"x-user-id":"3","x-user-role":"auditor"}
V1 = {"x-user-id":"5","x-user-role":"reviewer"}

# =========== Test 1: 004 深圳创新（逾期）做 audit_pass 清逾期 ===========
print("\n=== Test1: 004 深圳创新(overdue) → auditor01 audit_pass 清逾期 ===")
show_app(4, "BEFORE")
r = request("POST", "/applications/4/action", {"action":"audit_pass","opinion":"资料补全，逾期标记清除，审核通过","client_version":1}, A1)
print(f"  audit_pass result: ok={r.get('ok')}, msg={r.get('msg','')[:60]}")
show_app(4, "AFTER ")
show_logs(4, 2, "操作日志")

# =========== Test 2: 006 杭州远见（conflict）reviewer01 review_archive 清冲突 ===========
print("\n=== Test2: 006 杭州远见(conflict) → reviewer01 review_archive 归档清冲突 ===")
show_app(6, "BEFORE")
r = request("POST", "/applications/6/action", {"action":"review_archive","opinion":"经核查关联企业授信已结清，冲突解除，归档完成","client_version":2}, V1)
print(f"  review_archive result: ok={r.get('ok')}, msg={r.get('msg','')[:60]}")
show_app(6, "AFTER ")
show_logs(6, 2, "操作日志")

# =========== Test 3: 007 南京中泰(appeal_reviewing V3) → reviewer 用错误版本做操作（验证失败日志） ===========
print("\n=== Test3: 007 南京中泰(appeal_reviewing V3) → reviewer01 用 client_version=1 做 review_reject(应失败: 版本冲突) ===")
show_app(7, "BEFORE (原状态不能变)")
r = request("POST", "/applications/7/action", {"action":"review_reject","opinion":"测试版本冲突","reject_reason":"故意用错误版本号","client_version":1}, V1)
print(f"  review_reject(错误版本) result: ok={r.get('ok')}, msg={r.get('msg','')[:80]}")
show_app(7, "AFTER  (状态/版本 必须保持不变)")
show_logs(7, 3, "操作日志（应有一条 review_reject_fail ❌）")

# =========== Test4: 用 reviewer 角色去做 registrar 的操作（应失败角色不符，状态不变 + 失败日志） ===========
print("\n=== Test4: 007 南京中泰 → reviewer01 去做 appeal_submit（应失败: 角色不符） ===")
r = request("POST", "/applications/7/action", {"action":"appeal_submit","opinion":"越权操作测试","client_version":3}, V1)
print(f"  appeal_submit(角色错) result: ok={r.get('ok')}, msg={r.get('msg','')[:60]}")
show_logs(7, 3, "操作日志（应有一条 appeal_submit_fail ❌，状态保持）")

# =========== Test5: 007 南京中泰 → reviewer01 正常 review_reject（再驳回一次，V3 不变？——按 ACTION_MAP appeal 不 bump version） ===========
print("\n=== Test5: 007 南京中泰(appeal_reviewing V3) → reviewer01 正常 review_reject（再驳回一次） ===")
r = request("POST", "/applications/7/action", {"action":"review_reject","opinion":"再次复核评估：行业风险仍偏高，建议补充新的担保人","reject_reason":"再次复核驳回：化工行业风险评级持续下调，需增加合格担保人","client_version":3}, V1)
print(f"  review_reject(正常) result: ok={r.get('ok')}, status={r.get('data',{}).get('status') if r.get('ok') else r.get('msg')[:40]}, version=V{r.get('data',{}).get('version','-') if r.get('ok') else '-'}")
show_app(7, "AFTER reject (应为 reject_revision，等 registrar 申诉)")
show_logs(7, 2, "操作日志")

# =========== Test6: 007 → registrar01 正常 appeal_submit（V3→V4 版本递增） ===========
print("\n=== Test6: 007 → registrar01 appeal_submit（V3→V4，状态 appeal_reviewing） ===")
r = request("POST", "/applications/7/action", {"action":"appeal_submit","opinion":"已增加大型国企AA级担保人，资料已补充，再次申诉","client_version":3}, R1)
print(f"  appeal_submit result: ok={r.get('ok')}, status={r.get('data',{}).get('status') if r.get('ok') else r.get('msg')[:40]}, version=V{r.get('data',{}).get('version','-') if r.get('ok') else '-'}")
show_app(7, "AFTER appeal")
show_logs(7, 3, "操作日志（V3→V4 递增）")

# =========== 最终验证 007 详情 ===========
print("\n=== Test7: 007 最终详情(节点+日志数量) ===")
d = request("GET", "/applications/7")
print(f"  最终 status={d['data']['app']['status']} V{d['data']['app']['version']}, logs={len(d['data']['logs'])}条, nodes={len(d['data']['nodes'])}条")
print(f"  上一处理人: {d['data']['app']['prev_handler_name']} / {d['data']['app']['prev_result']}")
print(f"  上一意见: {str(d['data']['app'].get('prev_opinion') or '')[:80]}")
print(f"  驳回原因(保留): {str(d['data']['app'].get('reject_reason') or '')[:80]}")
print("\n✅ 验证脚本执行完成")
