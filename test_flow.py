import requests, json, sys

BASE = "http://localhost:8004/api"
EID = None

def login(u,p):
    r = requests.post(f"{BASE}/auth/login", json={"username":u,"password":p})
    d = r.json()
    assert d.get("token"), f"登录失败: {d}"
    print(f"  ✅ 登录 {u}={d['user']['name']}({d['user']['role']})")
    return d["token"], d["user"]

def h(tok):
    return {"Authorization": f"Bearer {tok}"}

try:
    print("\n🔐 [1] 登录三个账号")
    t_z, u_z = login("zhangsan","123456")
    t_l, u_l = login("lisi","123456")
    t_w, u_w = login("wangwu","123456")

    print("\n📝 [2] 登记员创建不良事件")
    import datetime
    dl = (datetime.datetime.now() + datetime.timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%S")
    r = requests.post(f"{BASE}/events", headers=h(t_z), json={
        "title": "接口测试-门诊跌倒",
        "description": "患者门诊三楼跌倒",
        "event_type": "adverse_event",
        "severity": "moderate",
        "deadline": dl,
        "materials": [{"name":"跌倒记录","material_type":"document","content":"9:30跌倒"}],
    })
    d = r.json()
    assert "event" in d, f"创建失败: {d}"
    EID = d["event"]["id"]
    ev = d["event"]
    print(f"  ✅ 创建 id={EID} code={ev['code']} v={ev['version']} status={ev['status']} token={ev['scan_token'][:8]}...")
    scan_code = f"{ev['code']}:{ev['scan_token']}"

    print("\n🚫 [3] 不携带凭证直接提交（应被拒绝）")
    r = requests.post(f"{BASE}/events/{EID}/submit", headers=h(t_z), json={"version": ev["version"]})
    d = r.json()
    assert "核验凭证" in d.get("error",""), f"应拒绝无凭证: {d}"
    print(f"  ✅ 正确拒绝: {d['error'][:40]}")

    print("\n📷 [4] 登记员扫码（获取凭证）")
    r = requests.post(f"{BASE}/scan", headers=h(t_z), json={"code": scan_code})
    d = r.json()
    assert d["success"], f"扫码失败: {d}"
    rid = d["scan_record_id"]
    print(f"  ✅ 扫码成功 scan_record_id=#{rid}")

    print("\n✅ [5] 携带凭证提交（应成功）")
    r = requests.post(f"{BASE}/events/{EID}/submit", headers=h(t_z), json={"version": ev["version"], "scan_record_id": rid})
    d = r.json()
    assert "event" in d, f"提交失败: {d}"
    ev = d["event"]
    print(f"  ✅ 提交成功 status={ev['status']} v={ev['version']} new_token={ev['scan_token'][:8]}...")

    print("\n🚫 [6] 重复使用已消费凭证（应失败：已消费）")
    r = requests.post(f"{BASE}/events/{EID}/submit", headers=h(t_z), json={"version": 1, "scan_record_id": rid})
    d = r.json()
    assert "凭证" in d.get("error","") or "消费" in d.get("error","") or d.get("error"), f"应拒绝重复消费: {d}"
    print(f"  ✅ 正确拒绝: {d['error'][:50]}")

    print("\n📷 [7] 登录lisi（主管）扫码审核通过")
    scan_code2 = f"{ev['code']}:{ev['scan_token']}"
    r = requests.post(f"{BASE}/scan", headers=h(t_l), json={"code": scan_code2})
    d = r.json()
    assert d["success"], f"主管扫码失败: {d}"
    rid2 = d["scan_record_id"]
    print(f"  ✅ 主管扫码成功 record_id=#{rid2}")

    r = requests.post(f"{BASE}/events/{EID}/review", headers=h(t_l), json={
        "version": ev["version"], "scan_record_id": rid2,
        "opinion": "同意，材料齐全", "result": "pass",
    })
    d = r.json()
    assert "event" in d, f"审核失败: {d}"
    ev = d["event"]
    print(f"  ✅ 审核通过 status={ev['status']} v={ev['version']}")

    print("\n📷 [8] 登录wangwu（复核）扫码归档")
    scan_code3 = f"{ev['code']}:{ev['scan_token']}"
    r = requests.post(f"{BASE}/scan", headers=h(t_w), json={"code": scan_code3})
    d = r.json()
    assert d["success"], f"复核扫码失败: {d}"
    rid3 = d["scan_record_id"]
    print(f"  ✅ 复核扫码成功 record_id=#{rid3}")

    r = requests.post(f"{BASE}/events/{EID}/archive-review", headers=h(t_w), json={
        "version": ev["version"], "scan_record_id": rid3,
        "opinion": "符合归档条件", "result": "archive",
    })
    d = r.json()
    assert "event" in d, f"归档失败: {d}"
    ev = d["event"]
    print(f"  ✅ 归档成功 status={ev['status']} v={ev['version']}")

    print("\n📜 [9] 审计日志验证（凭证ID+版本号）")
    r = requests.get(f"{BASE}/audit-log?event_id={EID}", headers=h(t_z))
    d = r.json()
    logs = d["logs"]
    print(f"  审计日志共 {len(logs)} 条:")
    for log in logs:
        action = log["action"]
        rid = log.get("scan_record_id")
        vb = log.get("version_before")
        va = log.get("version_after")
        s = f"    - [{log['created_at'][11:19]}] {action:<22}"
        if rid is not None: s += f" 凭证=#{rid}"
        if vb is not None and va is not None: s += f" v{vb}→v{va}"
        print(s)
    submit_logs = [l for l in logs if "submit" in l["action"] or "review" in l["action"] or "archive" in l["action"]]
    for sl in submit_logs:
        assert sl.get("scan_record_id") is not None, f"{sl['action']}缺少scan_record_id"
        assert sl.get("version_before") is not None, f"{sl['action']}缺少version_before"
        assert sl.get("version_after") is not None, f"{sl['action']}缺少version_after"
    print("  ✅ 所有状态推进操作均带凭证ID和版本号")

    print("\n📊 [10] 统计接口")
    r = requests.get(f"{BASE}/statistics", headers=h(t_z))
    d = r.json()
    print(f"  ✅ 总数={d['total']} 处理中={d['active']} 已归档={d['archived']}")

    print("\n🎉 全流程接口测试通过！")

except Exception as e:
    print(f"\n❌ 测试失败: {e}", file=sys.stderr)
    import traceback; traceback.print_exc()
    sys.exit(1)
