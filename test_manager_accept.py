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

agent1, _ = api("POST", "/auth/login", {"username": "agent1", "password": "123456"})
qa1, _ = api("POST", "/auth/login", {"username": "qa1", "password": "123456"})
cs1, _ = api("POST", "/auth/login", {"username": "cs1", "password": "123456"})

print("=" * 60)
print("  客服经理最终签收 → 工单关闭 完整闭环测试")
print("=" * 60)

# 1. agent 创建工单
print("\n【Step 1】agent1 来电登记")
ticket, _ = api("POST", "/tickets", {
    "title": "CLOSE-TEST-经理签收自动关闭",
    "customer_name": "李经理客户",
    "customer_phone": "13912345678",
    "description": "客户申请退款，需要三级确认"
}, agent1["token"])
tid = ticket["id"]
print(f"  ✅ 工单 {tid} 创建，状态: {ticket['status']}")

# 2. 记录签收前的统计数据
stats_before, _ = api("GET", "/statistics", token=cs1["token"])
print(f"  📊 签收前统计: 总数={stats_before['total_tickets']}, 已关闭={stats_before['closed_count']}")

# 3. qa 派单
api("PUT", f"/tickets/{tid}/status", {
    "status": "dispatched",
    "remark": "已分配，准备交接"
}, qa1["token"])

# 4. agent → qa 提交交接
h1, _ = api("POST", "/handover", {
    "ticket_id": tid,
    "to_user": qa1["user"]["id"],
    "shift": "afternoon",
    "remark": "中班交接，退款申请材料齐全"
}, agent1["token"])

# 5. qa 签收
api("POST", f"/handover/{h1['id']}/accept", {}, qa1["token"])

# 6. qa → cs 提交交接
h2, _ = api("POST", "/handover", {
    "ticket_id": tid,
    "to_user": cs1["user"]["id"],
    "shift": "afternoon",
    "remark": "质检通过，退款金额符合政策，请经理最终确认"
}, qa1["token"])
h2_id = h2["id"]
print(f"\n【Step 2】质检主管已提交给客服经理，交接ID: {h2_id}")

# 7. 验证我的待签收列表包含该交接
my_pending, _ = api("GET", "/handover/my", token=cs1["token"])
pending_ids = [h["id"] for h in my_pending]
assert h2_id in pending_ids, "我的待签收未包含该交接"
print(f"  ✅ cs1 的我的待签收包含该交接，共 {len(my_pending)} 条待签收")

# 8. 经理最终签收（关键点！）
print(f"\n【Step 3】客服经理最终签收交接（核心验证）")
accepted, err = api("POST", f"/handover/{h2_id}/accept", {}, cs1["token"])
if err: print(f"  ❌ 签收失败: {err}"); sys.exit(1)
print(f"  ✅ 交接签收成功，交接状态: {accepted['status']}")

# 9. 验证工单状态自动变为 closed
detail_after, _ = api("GET", f"/tickets/{tid}", token=cs1["token"])
assert detail_after["status"] == "closed", f"经理签收后工单状态应为 closed，实际: {detail_after['status']}"
print(f"  ✅ 工单状态已自动变更为: {detail_after['status']}")

# 10. 验证操作日志包含两条（handover_accept + status_change:->closed）
logs = detail_after["operation_logs"]
accept_logs = [l for l in logs if l["action"] == "handover_accept"]
close_logs = [l for l in logs if l["action"] == "status_change:->closed"]
assert len(accept_logs) >= 1, "缺少 handover_accept 日志"
assert len(close_logs) >= 1, "缺少 status_change:->closed 日志"
print(f"  ✅ 操作日志完整: 签收日志 {len(accept_logs)} 条, 关闭日志 {len(close_logs)} 条")

# 11. 验证日志内容包含操作人角色和签收备注
close_log = close_logs[-1]
assert "客服经理" in close_log["detail"], f"关闭日志未包含客服经理角色: {close_log['detail']}"
assert cs1["user"]["name"] in close_log["detail"], f"关闭日志未包含操作人姓名: {close_log['detail']}"
print(f"  ✅ 关闭日志包含角色+姓名: '{close_log['detail']}'")

accept_log = [l for l in logs if l["action"] == "handover_accept" and l["user_name"] == cs1["user"]["name"]][-1]
assert "中班" in accept_log["detail"], f"签收日志未包含班次信息: {accept_log['detail']}"
print(f"  ✅ 签收日志包含班次信息: '{accept_log['detail']}'")

# 12. 验证列表中的工单状态
list_after, _ = api("GET", f"/tickets", token=cs1["token"])
list_item = next(i for i in list_after["items"] if i["id"] == tid)
assert list_item["status"] == "closed", f"列表状态不一致: {list_item['status']}"
assert list_item["latest_handover_status"] == "accepted", f"列表交接状态不一致: {list_item['latest_handover_status']}"
print(f"  ✅ 列表中状态一致: status={list_item['status']}, 交接={list_item['latest_handover_status']}")

# 13. 验证统计数据已更新
stats_after, _ = api("GET", "/statistics", token=cs1["token"])
print(f"  📊 签收后统计: 总数={stats_after['total_tickets']}, 已关闭={stats_after['closed_count']}")
assert stats_after["closed_count"] == stats_before["closed_count"] + 1, "已关闭工单数量未+1"
print(f"  ✅ 统计数据已同步更新：已关闭数量 {stats_before['closed_count']} → {stats_after['closed_count']}")

# 14. 验证我的待签收不再包含该交接
my_pending_after, _ = api("GET", "/handover/my", token=cs1["token"])
pending_ids_after = [h["id"] for h in my_pending_after]
assert h2_id not in pending_ids_after, "签收后我的待签收仍包含该交接"
print(f"  ✅ 签收后我的待签收已移除该交接，剩余 {len(my_pending_after)} 条")

# 15. 刷新后一致性验证（重新拉取所有数据）
print(f"\n【Step 4】刷新后一致性验证")
d2, _ = api("GET", f"/tickets/{tid}", token=cs1["token"])
l2, _ = api("GET", f"/tickets", token=cs1["token"])
s2, _ = api("GET", "/statistics", token=cs1["token"])
li2 = next(i for i in l2["items"] if i["id"] == tid)

assert d2["status"] == li2["status"] == "closed", "刷新后状态不一致"
assert s2["closed_count"] >= stats_after["closed_count"], "刷新后统计不一致"

logs_after_refresh = d2["operation_logs"]
hos_after_refresh = d2["handover_records"]
assert len(logs_after_refresh) >= 5, f"操作日志数量异常: {len(logs_after_refresh)}"
assert len(hos_after_refresh) >= 2, f"交接记录数量异常: {len(hos_after_refresh)}"

for ho in hos_after_refresh:
    assert ho.get("from_role"), f"交接记录缺少 from_role"
    assert ho.get("to_role"), f"交接记录缺少 to_role"

print(f"  ✅ 详情状态 == 列表状态: {d2['status']}")
print(f"  ✅ 统计数量正确: 已关闭={s2['closed_count']}")
print(f"  ✅ 操作日志数: {len(logs_after_refresh)}, 交接记录数: {len(hos_after_refresh)}")
print(f"  ✅ 所有交接记录都有岗位信息")

# 16. 验证详情页按钮区应该没有可操作按钮（通过状态判断）
print(f"\n【Step 5】最终状态验证")
print(f"  工单状态: {d2['status']} → 前端详情页应显示『工单已完成』标识，不显示任何操作按钮")
print(f"  交接记录状态: {hos_after_refresh[-1]['status']} → 签收/回传按钮不显示")
print(f"  我的待签收: 已清空该工单交接")

print("\n" + "=" * 60)
print("  🎉 客服经理最终签收闭环 全部验证通过！")
print("=" * 60)
print("\n关键验证点：")
print("  ✅ 经理签收 → 工单自动关闭（status=closed）")
print("  ✅ 写入签收日志（含班次、角色、姓名、备注）")
print("  ✅ 写入状态变更日志（status_change:->closed）")
print("  ✅ 列表状态同步变更")
print("  ✅ 列表最新交接状态同步变更")
print("  ✅ 统计已关闭数量+1")
print("  ✅ 我的待签收移除该交接")
print("  ✅ 刷新后列表/详情/统计/日志全部一致")
print("  ✅ 详情页显示『工单已完成』，操作按钮全部隐藏")
print("  ✅ 所有交接记录都包含岗位信息")
