#!/usr/bin/env python3
import urllib.request
import urllib.parse
import json

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
        return {"ok": False, "code": e.code, "msg": e.read().decode()}

def log(msg): print("  " + msg)

# 1. stats
print("=== 1. stats 接口（应 9 个申请 + 新申请后 10 个） ===")
r = request("GET", "/applications/stats")
print(f"  total={r['data']['total']}, byStatus={[(s['status'], s['n']) for s in r['data']['byStatus'][:3]]}..., archived={r['data']['archived']}, overdue={r['data']['overdue']}, conflict={r['data']['conflict']}")

# 2. login auditor01
print("\n=== 2. login auditor01 ===")
r = request("POST", "/auth/login", {"username":"auditor01","password":"123456"})
print(f"  ok={r['ok']}, name={r['data']['name']}, role={r['data']['role']}")

# 3. 009 详情
print("\n=== 3. 009 重庆星锐(完整闭环) ===")
r = request("GET", "/applications/9")
app = r["data"]["app"]
logs = r["data"]["logs"]
nodes = r["data"]["nodes"]
print(f"  logs={len(logs)}条, nodes={len(nodes)}条, evidence={len(r['data']['evidence'])}条")
print(f"  status={app['status']}, version=V{app['version']}, evidence_status={app['evidence_status']}")
print(f"  prev_handler={app['prev_handler_name']} / {app['prev_result']}")
print(f"  prev_opinion(前60字): {str(app['prev_opinion'])[:60]}...")
print(f"  reject_reason: {str(app.get('reject_reason'))[:80]}")
print("  最近5条日志:")
for l in logs[:5]:
    fail = "❌FAIL " if l["action"].endswith("_fail") else ""
    extra = ""
    if l.get("extra"):
        try: extra = f" extra={json.loads(l['extra'])['reason'][:60] if 'reason' in json.loads(l['extra']) else l['extra'][:60]}"
        except: extra = f" extra={str(l['extra'])[:60]}"
    print(f"    {l['created_at'][:16]} {l['user_name'] or '系统'} {fail}{l['action']} [{l['old_status'] or '-'}→{l['new_status']}] V{l['version_from']}→V{l['version_to']}{extra}")
print("  流程节点:")
for n in nodes:
    print(f"    #{n['node_order']} {n['node_type']:12s} V{n['version']} {n['status']:10s} {n['handler_name'] or '-':4s} result={n['result'] or '-'} {str(n.get('opinion') or '')[:40]}")

# 4. registrar01 创建新申请
print("\n=== 4. registrar01 创建新申请(事务化) ===")
hdrs1 = {"x-user-id":"1", "x-user-role":"registrar"}
r = request("POST", "/applications", {
    "company_name":"天津测试验证科技有限公司",
    "credit_line":"2000000","applicant":"测试用户","contact_phone":"13800000000","business_type":"测试类型"
}, hdrs1)
print(f"  ok={r['ok']}, new_id={r['data']['id'] if r.get('ok') else 'ERROR'}, app_no={r['data']['app_no'] if r.get('ok') else r.get('msg')}")
new_id = r["data"]["id"] if r.get("ok") else None

if new_id:
    # 5. 标记所有证据
    print("\n=== 5. 登记员标记6项证据 ===")
    detail_pre = request("GET", f"/applications/{new_id}")
    ev_ids = [e["id"] for e in detail_pre["data"]["evidence"]]
    print(f"  evidence IDs: {ev_ids}")
    for eid in ev_ids:
        r = request("PUT", f"/applications/{new_id}/evidence/{eid}", {"is_submitted":1}, hdrs1)
    ev = request("GET", f"/applications/{new_id}")
    submitted_count = sum(1 for e in ev['data']['evidence'] if e['is_submitted'])
    print(f"  evidence_status={ev['data']['app']['evidence_status']}, submitted_count={submitted_count}/{len(ev['data']['evidence'])}")

    # 6. register_submit
    print("\n=== 6. 登记员 register_submit ===")
    r = request("POST", f"/applications/{new_id}/action",
        {"action":"register_submit","opinion":"测试提交，资料完整","client_version":1}, hdrs1)
    ok = r.get("ok"); d = r.get("data", {})
    print(f"  ok={ok}, status={d.get('status') or r.get('msg')}, version=V{d.get('version','-')}, next_handler={d.get('handler_name','-')}")
    print(f"  prev_handler={d.get('prev_handler_name','-')} / {d.get('prev_result','-')}")

    # 7. auditor 错误版本号校验失败（测试保留原状态 + *_fail 日志）
    print("\n=== 7. 审核主管 故意用错误版本号调用(应失败) ===")
    hdrs3 = {"x-user-id":"3","x-user-role":"auditor"}
    r = request("POST", f"/applications/{new_id}/action",
        {"action":"audit_pass","opinion":"错误版本号","client_version":999}, hdrs3)
    print(f"  ok={r.get('ok')}, msg={r.get('msg','')[:80]}")

    # 8. auditor 正确 audit_pass
    print("\n=== 8. 审核主管 audit_pass ===")
    r = request("POST", f"/applications/{new_id}/action",
        {"action":"audit_pass","opinion":"测试审核通过，风控评分达标","client_version":1}, hdrs3)
    ok = r.get("ok"); d = r.get("data", {})
    print(f"  ok={ok}, status={d.get('status') or r.get('msg')}, version=V{d.get('version','-')}, next_handler={d.get('handler_name','-')}")
    print(f"  prev_handler={d.get('prev_handler_name','-')} / {d.get('prev_result','-')} / opinion={str(d.get('prev_opinion',''))[:40]}")

    # 9. reviewer review_archive
    print("\n=== 9. B2B复核负责人 review_archive ===")
    hdrs5 = {"x-user-id":"5","x-user-role":"reviewer"}
    r = request("POST", f"/applications/{new_id}/action",
        {"action":"review_archive","opinion":"测试复核通过并归档，资料完整","client_version":1}, hdrs5)
    ok = r.get("ok"); d = r.get("data", {})
    print(f"  ok={ok}, status={d.get('status') or r.get('msg')}, version=V{d.get('version','-')}, archived={d.get('status') == 'archived'}")

    # 10. 最终状态 + 全量日志
    print(f"\n=== 10. 新申请 id={new_id} 最终状态 ===")
    detail = request("GET", f"/applications/{new_id}")
    app = detail["data"]["app"]; logs = detail["data"]["logs"]; nodes = detail["data"]["nodes"]
    print(f"  final status={app['status']}, version=V{app['version']}, prev={app['prev_handler_name']}/{app['prev_result']}, archived={app['status']=='archived'}")
    print(f"  nodes={len(nodes)}条, logs={len(logs)}条")
    print("  全量 logs:")
    for l in logs:
        fail = "❌FAIL " if l["action"].endswith("_fail") else ""
        extra = ""
        if l.get("extra"):
            try:
                e = json.loads(l["extra"])
                if "reason" in e: extra = f" reason={e['reason'][:60]}"
                elif "next_handler" in e: extra = f" next={e['next_handler']}"
                elif "evidence_name" in e: extra = f" {e['evidence_name']}:{'已提交' if e['is_submitted'] else '未提交'}"
                else: extra = str(l["extra"])[:60]
            except: extra = str(l["extra"])[:60]
        rej = f" 原因={l['reject_reason'][:40]}" if l.get("reject_reason") else ""
        print(f"    {l['created_at'][:16]} {l['user_name'] or '系统':4s} {fail}{l['action']:24s} [{l['old_status'] or '-':16s}→{l['new_status']:16s}] V{l['version_from']}→V{l['version_to']}{rej}{extra}")
    print("  流程节点:")
    for n in nodes:
        dur = f" 用时{int(n['duration_seconds']/60)}分" if n.get("duration_seconds") else ""
        print(f"    #{n['node_order']} {n['node_type']:12s} V{n['version']} {n['status']:10s} handler={n['handler_name'] or '-':4s} result={n['result'] or '-':8s}{dur} 意见={str(n.get('opinion') or '')[:50]}")

print("\n✅ 端到端测试完成")
