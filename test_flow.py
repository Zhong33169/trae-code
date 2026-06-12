#!/usr/bin/env python3
import json, urllib.request, urllib.error

BASE = "http://localhost:18010/api"

def req(method, path, token=None, data=None, debug=False):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except:
            return e.code, {"raw": raw}

def login(u, p):
    s, d = req("POST", "/login", data={"username": u, "password": p})
    assert s == 200, f"登录失败 {u}: {d}"
    return d["token"]

def pprint(tag, d, keys=None):
    if keys:
        print(f"  {tag}: " + ", ".join([f"{k}={d.get(k)}" for k in keys]))
    else:
        print(f"  {tag}: {json.dumps(d, ensure_ascii=False)[:200]}")

print("=" * 60)
print("消防隐患单闭环测试")
print("=" * 60)

print("\n[1] 登录三个账号")
ct = login("clerk01", "123456")
st = login("supervisor01", "123456")
mt = login("chief01", "123456")
print(f"  clerk01 OK, supervisor01 OK, chief01 OK")

print("\n[2] 初始统计（三个视角）")
_, cs = req("GET", "/statistics", token=ct)
_, ss = req("GET", "/statistics", token=st)
_, ms = req("GET", "/statistics", token=mt)
print(f"  clerk 可见: total={cs['summary']['total']}, pending={cs['summary']['pending']}, assigned={cs['summary']['assigned']}, revisited={cs['summary']['revisited']}, timeout={cs['summary']['timeout']}")
print(f"  supervisor 可见: total={ss['summary']['total']}, pending={ss['summary']['pending']}, assigned={ss['summary']['assigned']}, revisited={ss['summary']['revisited']}")
print(f"  chief 可见: total={ms['summary']['total']}, assigned={ms['summary']['assigned']}, revisited={ms['summary']['revisited']}")

print("\n[3] clerk01 创建隐患单")
s, d = req("POST", "/orders", token=ct, data={
    "title": "【测试】消防通道被车辆堵塞",
    "description": "东门消防通道被占",
    "location": "朝阳小区东门",
    "hazard_level": "high",
    "content": "3辆车占消防通道，建议立即处理",
})
print(f"  HTTP={s}, id={d.get('id')}, order_no={d.get('order_no')}, keys={list(d.keys())}")
oid = d["id"]

print("\n[4] 数据一致性 + 权限校验")
s, cl = req("GET", "/orders?page=1&size=5", token=ct)
print(f"  clerk 列表 total={cl['total']}, list len={len(cl['list'])} (期望新增后多1)")
s, cd = req("GET", f"/orders/{oid}", token=ct)
print(f"  clerk 详情 HTTP={s}, status={cd['order']['status']}, node={cd['order']['current_node']}, allowed={cd.get('allowed_actions')}")
denials = cd.get('action_denial_reasons', {})
print(f"  clerk 禁用原因: assign=[{denials.get('assign','')}], rectify=[{denials.get('rectify','')}]")

s, _ = req("GET", f"/orders/{oid}", token=mt)
print(f"  chief 查看 pending 状态单 (期望403): HTTP={s}")

print("\n[5] supervisor01 转办分派")
s, d = req("GET", f"/orders/{oid}", token=st)
print(f"  转办前 supervisor allowed={d.get('allowed_actions')}")
s, d = req("POST", f"/orders/{oid}/assign", token=st, data={
    "days": 3,
    "content": "3日内清场，设隔离桩，处罚物业",
    "remark": "紧急",
})
print(f"  转办 HTTP={s}, keys={list(d.keys())}, status={d.get('status')}, node={d.get('node')}")

s, d = req("GET", f"/orders/{oid}", token=st)
print(f"  转办后 status={d['order']['status']}, node={d['order']['current_node']}")
print(f"  整改通知数={len(d['rectification_notices'])}, 日志数={len(d['operation_logs'])}")
print(f"  最新 allowed={d.get('allowed_actions')}")

print("\n[6] supervisor01 提交整改")
s, d = req("POST", f"/orders/{oid}/rectify", token=st, data={
    "content": "1.拖走3车 2.设隔离桩4根 3.禁停公告 4.罚款2000 实测宽4.5米",
    "remark": "整改良好",
})
print(f"  整改 HTTP={s}, status={d.get('status')}, node={d.get('current_node')}")
s, d = req("GET", f"/orders/{oid}", token=st)
print(f"  整改后 status={d['order']['status']}, node={d['order']['current_node']}")
print(f"  整改记录数={len(d['rectification_records'])}, allowed={d.get('allowed_actions')}")

s, d = req("GET", f"/orders/{oid}", token=mt)
print(f"  chief 此时 allowed={d.get('allowed_actions')}")

print("\n[7] chief01 复查回访")
s, d = req("POST", f"/orders/{oid}/recheck", token=mt, data={
    "result": "pass",
    "content": "4根桩完好，通道宽4.6米，保安2小时巡逻一次，复查通过",
    "remark": "跟踪1月",
})
print(f"  复查 HTTP={s}, status={d.get('status')}, node={d.get('node')}")
s, d = req("GET", f"/orders/{oid}", token=mt)
print(f"  复查后 status={d['order']['status']}, node={d['order']['current_node']}")
print(f"  复查记录数={len(d['recheck_records'])}, allowed={d.get('allowed_actions')}")

print("\n[8] chief01 确认完成")
s, d = req("POST", f"/orders/{oid}/confirm", token=mt, data={"remark": "确认闭环"})
print(f"  确认 HTTP={s}, keys={list(d.keys())}")

print("\n[9] 最终一致性验证：列表=批量=详情=统计")
s, cl2 = req("GET", "/orders?page=1&size=50", token=ct)
list_total = cl2["total"]
s, cs2 = req("GET", "/statistics", token=ct)
stat_total = cs2["summary"]["total"]
stat_rev = cs2["summary"]["revisited"]
ids = [o["id"] for o in cl2["list"]]
s, br = req("POST", "/orders/batch-status", token=ct, data={"ids": ids})
batch_count = len(br["items"])

s, fd = req("GET", f"/orders/{oid}", token=ct)
f_status = fd["order"]["status"]
f_notice = len(fd["rectification_notices"])
f_rect = len(fd["rectification_records"])
f_rech = len(fd["recheck_records"])
f_logs = len(fd["operation_logs"])
f_timeout = len(fd["timeout_records"])
f_allowed = fd.get("allowed_actions") or []

print(f"  clerk 列表总数={list_total}, 统计总数={stat_total} → 一致: {list_total == stat_total}")
print(f"  批量查询数量={batch_count}, 与列表一致: {batch_count == list_total}")
print(f"  统计已回访数={stat_rev} (期望≥1)")
print(f"  最终详情: status={f_status}, 通知={f_notice}, 整改={f_rect}, 复查={f_rech}, 超时={f_timeout}, 日志={f_logs}")
print(f"  最终 allowed_actions={f_allowed} (期望空)")

print("\n[10] 检查各岗位看到的列表数量和统计是否一致")
s, sl = req("GET", "/orders?page=1&size=50", token=st)
s, ss2 = req("GET", "/statistics", token=st)
sup_ok = sl["total"] == ss2["summary"]["total"]
print(f"  supervisor 列表={sl['total']}, 统计={ss2['summary']['total']}, 一致={sup_ok}")

s, ml = req("GET", "/orders?page=1&size=50", token=mt)
s, ms2 = req("GET", "/statistics", token=mt)
chief_ok = ml["total"] == ms2["summary"]["total"]
print(f"  chief 列表={ml['total']}, 统计={ms2['summary']['total']}, 一致={chief_ok}")

print("\n" + "=" * 60)
all_ok = list_total == stat_total == batch_count and len(f_allowed) == 0 and sup_ok and chief_ok
print(f"测试总结: {'全部通过 ✓' if all_ok else '存在问题 ✗'}")
print("=" * 60)
