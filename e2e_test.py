#!/usr/bin/env python3
"""端到端测试：完整业务流程 + 越权/顺序/证据/并发校验"""
import requests
import json
import sys
import time

BASE = "http://localhost:8007"

def h(uid, role):
    return {"X-User-Id": uid, "X-User-Role": role, "Content-Type": "application/json"}

def jprint(d, prefix=""):
    print(prefix + json.dumps(d, ensure_ascii=False, indent=2))

def check(name, cond, detail=""):
    status = "✅ PASS" if cond else "❌ FAIL"
    print(f"{status} {name} {detail}")
    return cond

all_pass = True

print("="*60)
print("【1】基础接口：health / meta / statistics")
print("="*60)
r = requests.get(f"{BASE}/api/health").json()
all_pass &= check("health", r["success"])

r = requests.get(f"{BASE}/api/meta", headers=h("registrar_demo", "registrar")).json()
all_pass &= check("meta 角色数≥3", len(r["data"]["roles"]) >= 3)
stages = r["data"]["stages"]
required_materials = r["data"]["requiredMaterials"]
action_names = r["data"]["actionNames"]
print(f"  三阶段：{stages}")
print(f"  每阶段必选材料：{json.dumps(required_materials, ensure_ascii=False)}")

r = requests.get(f"{BASE}/api/statistics", headers=h("supervisor_demo", "supervisor")).json()
all_pass &= check("统计总数>0", r["data"]["total"] > 0)
print(f"  统计：总数{r['data']['total']} 逾期{r['data']['overdueCount']} 主管待办{r['data']['myToDo']}")

print("\n" + "="*60)
print("【2】登记员创建草稿 → 提交（含材料校验）")
print("="*60)
headers_reg = h("registrar_demo", "registrar")
payload = {
    "title": "[E2E测试] 望京店6月中旬生鲜补货",
    "store": "北京朝阳望京店",
    "category": "生鲜类",
    "supplier": "双汇发展生鲜事业部",
    "items": [
        {"name": "冷鲜猪里脊", "spec": "10kg/箱", "qty": 10, "unit": "箱", "price": 1350.50},
        {"name": "冰鲜鸡腿", "spec": "20kg/箱", "qty": 5, "unit": "箱", "price": 880},
    ],
    "materials": ["订货清单", "门店库存快照"],
}
r = requests.post(f"{BASE}/api/orders", headers=headers_reg, json=payload).json()
all_pass &= check("创建草稿", r["success"] and r["data"]["status"] == "draft")
order_id = r["data"]["id"]
order_no = r["data"]["orderNo"]
print(f"  创建成功：{order_no} version={r['data']['version']}")

# 尝试提交但缺材料
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_reg).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
allowed = r["data"]["allowedActions"]
all_pass &= check("草稿允许提交/作废操作", "submit" in allowed and "cancel" in allowed)
r2 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_reg,
    json={"action": "submit", "opinion": "只有2项材料，缺少历史订货参考数据，共20字意见",
          "lockToken": lock_token, "version": version}).json()
all_pass &= check("提交但缺材料 → 被拒绝", not r2["success"] and "材料" in r2["error"])
print(f"  拒绝原因: {r2['error']}（详情: {r2.get('errorDetail','')[:60]}）")

# 补齐材料重新获取锁再提交
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_reg).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
r3 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_reg,
    json={"action": "submit",
          "opinion": "望京店端午客流预估增长15%，参考上月订货数据1.15倍系数补货，已核对库存快照和历史参考，材料齐全。",
          "lockToken": lock_token, "version": version,
          "materials": ["订货清单", "门店库存快照", "历史订货参考数据"]}).json()
all_pass &= check("材料齐全提交 → 成功", r3["success"] and r3["data"]["status"] == "pending_verification")
new_stage = r3["data"]["currentStage"]
print(f"  状态: {r3['data']['status']}, 阶段: {new_stage}, version={r3['data']['version']}")

print("\n" + "="*60)
print("【3】越权测试：登记员不能核验")
print("="*60)
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_reg).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
allowed = r["data"]["allowedActions"]
all_pass &= check("登记员待核验状态下无操作", len(allowed) == 0, f"allowed={allowed}")
r4 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_reg,
    json={"action": "approve_verify", "opinion": "越权测试，登记员尝试核验通过",
          "lockToken": lock_token, "version": version}).json()
all_pass &= check("越权核验 → 被拒绝", not r4["success"] and "无权" in r4["error"])
print(f"  拒绝: {r4['error']} - {r4.get('errorDetail','')[:60]}")

print("\n" + "="*60)
print("【4】主管核验 → 故意退回（附退回原因明细）")
print("="*60)
headers_sup = h("supervisor_demo", "supervisor")
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_sup).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
allowed = r["data"]["allowedActions"]
all_pass &= check("主管允许 approve/reject verify", "approve_verify" in allowed and "reject_verify" in allowed)
r5 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_sup,
    json={"action": "reject_verify",
          "opinion": "退回原因1：猪里脊单价较上次高12%无说明；退回原因2：未附供应商冷链资质扫描件；退回原因3：数量较上月同期超30%需提供客流依据",
          "lockToken": lock_token, "version": version,
          "materials": ["库存核验报告"]}).json()
all_pass &= check("主管退回 → 成功", r5["success"] and r5["data"]["status"] == "verification_rejected")
reasons = r5["data"]["stageOpinions"]["过程核验"].get("rejectReasons", [])
print(f"  新状态: {r5['data']['status']}, 退回原因数={len(reasons)}, 原因: {reasons[:2]}...")

print("\n" + "="*60)
print("【5】登记员补正重新提交 → 主管核验通过 → 总部复核归档")
print("="*60)
# 登记员补正
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_reg).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
allowed = r["data"]["allowedActions"]
all_pass &= check("登记员能补正提交", "correct_submit" in allowed)
r6 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_reg,
    json={"action": "correct_submit",
          "opinion": "补正说明：1.猪里脊随市场行情上浮10%已附市场周报截图；2.供应商冷链资质补充上传；3.客流依据附618营销专案客流预测。",
          "lockToken": lock_token, "version": version,
          "materials": ["订货清单", "门店库存快照", "历史订货参考数据"]}).json()
all_pass &= check("补正提交成功→待核验", r6["success"] and r6["data"]["status"] == "pending_verification")

# 主管核验通过
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_sup).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
r7 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_sup,
    json={"action": "approve_verify",
          "opinion": "补正材料齐全：价格异常说明合理，冷链资质齐全，客流预测与营销专案一致，同意推进至复核。",
          "lockToken": lock_token, "version": version,
          "materials": ["库存核验报告", "价格核对记录", "供应商确认回执"]}).json()
all_pass &= check("主管核验通过→待复核", r7["success"] and r7["data"]["status"] == "pending_review")

# 总部复核归档
headers_rev = h("reviewer_demo", "reviewer")
r = requests.get(f"{BASE}/api/orders/{order_id}", headers=headers_rev).json()
lock_token = r["data"]["lockToken"]
version = r["data"]["order"]["version"]
allowed = r["data"]["allowedActions"]
all_pass &= check("复核负责人能通过/退回", "approve_review" in allowed and "reject_review" in allowed)

r8 = requests.post(f"{BASE}/api/orders/{order_id}/action", headers=headers_rev,
    json={"action": "approve_review",
          "opinion": "最终复核归档通过：财务预算核对签字确认；总部库存无可调配生鲜；检疫资质合规；整体符合Q2采购政策。",
          "lockToken": lock_token, "version": version,
          "materials": ["财务预算核对单", "总部库存调配意见", "合规检查记录"]}).json()
all_pass &= check("复核通过→已归档", r8["success"] and r8["data"]["status"] == "archived")
print(f"  归档完成！时间: {r8['data'].get('archivedAt','')[:19]} 最终版本: v{r8['data']['version']}")

print("\n" + "="*60)
print("【6】并发测试：重复提交同一 lockToken 的旧版本")
print("="*60)
# 创建一个新草稿
r = requests.post(f"{BASE}/api/orders", headers=headers_reg, json={
    **payload, "title": "[并发测试] 重复提交冲突验证单",
    "materials": ["订货清单", "门店库存快照", "历史订货参考数据"],
}).json()
c_order_id = r["data"]["id"]
# 打开两次详情（获取两个锁）
rA = requests.get(f"{BASE}/api/orders/{c_order_id}", headers=headers_reg).json()
lockA, verA = rA["data"]["lockToken"], rA["data"]["order"]["version"]
rB = requests.get(f"{BASE}/api/orders/{c_order_id}", headers=headers_reg).json()
lockB, verB = rB["data"]["lockToken"], rB["data"]["order"]["version"]
all_pass &= check("前后两把锁不同", lockA != lockB, f"锁A!=锁B: {lockA!=lockB}")
print(f"  锁A(前): {lockA[:16]}... 版本v{verA}")
print(f"  锁B(后): {lockB[:16]}... 版本v{verB}")

# 用锁A提交（会成功）
opinion_a = "并发测试A提交：客流增长15%，库存安全。共30字符测试a"
rA_submit = requests.post(f"{BASE}/api/orders/{c_order_id}/action", headers=headers_reg,
    json={"action": "submit", "opinion": opinion_a, "lockToken": lockA, "version": verA,
          "materials": ["订货清单", "门店库存快照", "历史订货参考数据"]}).json()
all_pass &= check("A提交成功（版本+锁匹配）", rA_submit["success"], f"{rA_submit.get('error','')}")

# 再用旧锁B+旧版本提交（应失败）
opinion_b = "并发测试B提交：版本和锁已过期，应该失败"
rB_submit = requests.post(f"{BASE}/api/orders/{c_order_id}/action", headers=headers_reg,
    json={"action": "submit", "opinion": opinion_b, "lockToken": lockB, "version": verB}).json()
all_pass &= check("B重复提交→被拒绝（并发锁）", not rB_submit["success"] and (rB_submit.get("concurrencyError") or rB_submit.get("versionError")))
print(f"  B提交被拒：{rB_submit['error'][:40]}")

print("\n" + "="*60)
print("【7】审计日志一致性：归档单据的日志应含创建→提交→退回→补正→核验→复核共6+条")
print("="*60)
r_logs = requests.get(f"{BASE}/api/audit-logs/order/{order_id}", headers=headers_reg).json()
logs = r_logs["data"]["data"]
all_pass &= check("审计日志≥6条", len(logs) >= 6)
actions_seen = [l["action"] for l in logs]
expected = {"create", "submit", "reject_verify", "correct_submit", "approve_verify", "approve_review"}
missing = expected - set(actions_seen)
all_pass &= check("审计动作完整", len(missing) == 0, f"缺失: {missing}")
print(f"  日志条数: {len(logs)}, 动作序列: {actions_seen}")

print("\n" + "="*60)
print("【8】统计刷新验证：重新拉统计 & 按角色过滤列表")
print("="*60)
stats_after = requests.get(f"{BASE}/api/statistics", headers=h("reviewer_demo", "reviewer")).json()["data"]
archived_count = stats_after["byStatus"].get("archived", 0)
all_pass &= check("归档数增加", archived_count >= 2, f"归档单≥2: {archived_count}")

# 复核负责人只能看到 pending_review/review_rejected/archived
list_rev = requests.get(f"{BASE}/api/orders", headers=headers_rev).json()["data"]
statuses = set(o["status"] for o in list_rev["data"])
allowed_rev = {"pending_review", "review_rejected", "archived"}
all_pass &= check("复核列表权限正确", statuses.issubset(allowed_rev), f"实际:{statuses} 允许:{allowed_rev}")
print(f"  复核角色可见状态: {statuses}")

print("\n" + "="*60)
print(f"{'全部通过! 🎉' if all_pass else '存在失败项 ❌'}  最终结果: {'PASS' if all_pass else 'FAIL'}")
print("="*60)
sys.exit(0 if all_pass else 1)
