#!/usr/bin/env python3
import urllib.request, json, sys

BASE = "http://localhost:8009/api"

def api(method, path, data=None, token=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("token", token)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        return None, err.get('message', str(e))

# 登录
agent1, _ = api("POST", "/auth/login", {"username": "agent1", "password": "123456"})
qa1, _ = api("POST", "/auth/login", {"username": "qa1", "password": "123456"})
cs1, _ = api("POST", "/auth/login", {"username": "cs1", "password": "123456"})

print("=" * 60)
print("  完整办理链路测试：3岗 × 6操作")
print("=" * 60)

# ========== 操作1：来电登记（agent） ==========
print("\n【操作1】来电登记（客服坐席）")
ticket, err = api("POST", "/tickets", {
    "title": "E2E-套餐升级咨询",
    "customer_name": "王小明",
    "customer_phone": "13700001111",
    "description": "客户想从99元套餐升级到199元套餐"
}, agent1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
tid = ticket["id"]
print(f"  ✅ 工单创建: {tid}")
print(f"     状态: {ticket['status']} (期望: incoming)")

# 验证统计
stats1, _ = api("GET", "/statistics", token=agent1["token"])
print(f"     统计: 总数={stats1['total_tickets']}, 来电={stats1['incoming_count']}")

# 验证列表
list1, _ = api("GET", f"/tickets", token=agent1["token"])
item = next(i for i in list1["items"] if i["id"] == tid)
assert item["status"] == "incoming", f"列表状态不一致: {item['status']}"
print(f"     列表一致 ✅")

# ========== 操作2：问题派单（qa_manager） ==========
print("\n【操作2】问题派单（质检主管）")
t, err = api("PUT", f"/tickets/{tid}/status", {
    "status": "dispatched",
    "remark": "分配给班组A跟进"
}, qa1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
print(f"  ✅ 派单成功，状态: {t['status']} (期望: dispatched)")

# 验证详情
detail1, _ = api("GET", f"/tickets/{tid}", token=qa1["token"])
assert detail1["status"] == "dispatched", "详情状态不一致"
last_log = detail1["operation_logs"][0]
assert "质检主管" in last_log["detail"], f"日志未含操作人角色: {last_log['detail']}"
print(f"     详情一致 ✅, 日志含操作人角色 ✅")
print(f"     日志: {last_log['detail']}")

# ========== 操作3：提交交接（agent→qa） ==========
print("\n【操作3】提交交接（坐席→质检主管）")
h1, err = api("POST", "/handover", {
    "ticket_id": tid,
    "to_user": qa1["user"]["id"],
    "shift": "morning",
    "remark": "早班交接，客户资料已齐全"
}, agent1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
h1_id = h1["id"]
print(f"  ✅ 交接提交: {h1_id}, 状态: {h1['status']} (期望: pending)")

# 验证详情中交接记录
detail2, _ = api("GET", f"/tickets/{tid}", token=qa1["token"])
hr = detail2["handover_records"][0]
assert hr["from_role"] == "agent", f"from_role错误: {hr['from_role']}"
assert hr["to_role"] == "qa_manager", f"to_role错误: {hr['to_role']}"
print(f"     交接含岗位信息 ✅: {hr['from_user_name']}({hr['from_role']}) → {hr['to_user_name']}({hr['to_role']})")

# 验证列表最新交接
list2, _ = api("GET", f"/tickets", token=qa1["token"])
item2 = next(i for i in list2["items"] if i["id"] == tid)
assert item2["latest_handover_status"] == "pending", f"列表交接状态不一致: {item2['latest_handover_status']}"
print(f"     列表交接状态一致 ✅")

# ========== 操作4：签收完成（qa签收agent的） ==========
print("\n【操作4】签收完成（质检主管签收）")
acc, err = api("POST", f"/handover/{h1_id}/accept", {}, qa1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
print(f"  ✅ 签收成功，交接状态: {acc['status']} (期望: accepted)")

# 验证操作日志
detail3, _ = api("GET", f"/tickets/{tid}", token=qa1["token"])
log4 = [l for l in detail3["operation_logs"] if l["action"] == "handover_accept"][0]
assert "质检主管" in log4["detail"], "日志未含操作人角色"
assert "早班" in log4["detail"], "日志未含班次"
print(f"     操作日志 ✅: {log4['detail']}")

# ========== 操作5：再次提交交接（qa→cs） ==========
print("\n【操作5】提交交接（质检→经理）")
h2, err = api("POST", "/handover", {
    "ticket_id": tid,
    "to_user": cs1["user"]["id"],
    "shift": "morning",
    "remark": "质检通过，提交经理最终确认"
}, qa1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
h2_id = h2["id"]
print(f"  ✅ 交接提交: {h2_id}, 状态: {h2['status']} (期望: pending)")

# ========== 操作6：异常回传（经理回传） ==========
print("\n【操作6】异常回传（客服经理回传）")
rej, err = api("POST", f"/handover/{h2_id}/reject", {
    "remark": "缺少客户签字确认文件"
}, cs1["token"])
if err: print(f"  ❌ 失败: {err}"); sys.exit(1)
print(f"  ✅ 回传成功，交接状态: {rej['status']} (期望: rejected)")

# 验证工单状态变为 exception
detail4, _ = api("GET", f"/tickets/{tid}", token=cs1["token"])
assert detail4["status"] == "exception", f"异常回传后工单状态不一致: {detail4['status']}"
print(f"     工单状态变为 exception ✅")

# 验证列表状态同步
stats2, _ = api("GET", "/statistics", token=cs1["token"])
print(f"     统计: 异常={stats2['exception_count']}")
list3, _ = api("GET", f"/tickets", token=cs1["token"])
item3 = next(i for i in list3["items"] if i["id"] == tid)
assert item3["status"] == "exception", "列表异常状态不一致"
assert item3["latest_handover_status"] == "rejected", "列表交接状态不一致"
print(f"     列表状态和交接状态一致 ✅")

# 验证异常回传日志
log6 = [l for l in detail4["operation_logs"] if l["action"] == "handover_reject"][0]
assert "缺少客户签字" in log6["detail"], "日志未含异常原因"
assert "客服经理" in log6["detail"], "日志未含操作人角色"
print(f"     异常回传日志 ✅: {log6['detail']}")

# ========== 最终一致性验证 ==========
print("\n" + "=" * 60)
print("  数据复用一致性验证")
print("=" * 60)

# 刷新后重拉
detail_final, _ = api("GET", f"/tickets/{tid}", token=cs1["token"])
list_final, _ = api("GET", f"/tickets", token=cs1["token"])
stats_final, _ = api("GET", "/statistics", token=cs1["token"])

item_final = next(i for i in list_final["items"] if i["id"] == tid)

# 1. 详情状态 vs 列表状态
assert detail_final["status"] == item_final["status"], "详情vs列表状态不一致"
print(f"  ✅ 详情状态 == 列表状态: {detail_final['status']}")

# 2. 日志数量 vs 轨迹
logs = detail_final["operation_logs"]
hos = detail_final["handover_records"]
print(f"  ✅ 操作日志数: {len(logs)}, 交接记录数: {len(hos)}")

# 3. 统计数字和列表一致
total_from_list = list_final["total"]
assert total_from_list == stats_final["total_tickets"], f"总数不一致: 列表={total_from_list}, 统计={stats_final['total_tickets']}"
print(f"  ✅ 列表总数 == 统计总数: {total_from_list}")

# 4. 操作日志中所有 action 都有操作人角色和姓名
for log in logs:
    assert log["user_name"], f"日志缺少操作人姓名: {log}"
    d = log.get("detail") or ""
    assert any(k in d for k in ["客服坐席", "质检主管", "客服经理"]), f"日志缺少操作人角色: {d}"
print("  ✅ 所有操作日志都包含操作人角色和姓名")

# 5. 交接记录都包含岗位
for ho in hos:
    assert ho.get("from_role"), f"交接缺少from_role: {ho}"
    assert ho.get("to_role"), f"交接缺少to_role: {ho}"
print("  ✅ 所有交接记录都包含岗位信息")

print("\n" + "=" * 60)
print("  🎉  3岗×6操作 完整办理链路 全部通过！")
print("=" * 60)
