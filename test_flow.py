#!/usr/bin/env python3
import requests, json
BASE = "http://localhost:8007"
def H(u,r): return {"X-User-Id":u,"X-User-Role":r,"Content-Type":"application/json"}
def P(msg): print(msg)

# ==== 场景：创建草稿 → 补材料提交 → 主管退回 → 补正重交 → 主管通过 → 复核归档 ====
P("Step1: 登记员创建草稿")
reg_h = H("registrar_demo","registrar")
r = requests.post(BASE+"/api/orders", headers=reg_h, json={
  "title":"[测试] 望京店端午补货",
  "store":"北京朝阳望京店","category":"生鲜类","supplier":"双汇发展生鲜事业部",
  "items":[{"name":"猪里脊","spec":"10kg/箱","qty":5,"unit":"箱","price":1200}],
  "materials":["订货清单","门店库存快照"],  # 只填2项
}).json()
assert r["success"], "创建失败"+str(r)
OID = r["data"]["id"]
P(f"  OK: {r['data']['orderNo']} status={r['data']['status']} v{r['data']['version']}")

P("Step2: 进入详情(取锁), 材料缺1项提交应失败")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=reg_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
P(f"  锁={lt[:20]}... v{v} 材料={d['data']['order']['materials']}")
r2 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=reg_h, json={
  "action":"submit","opinion":"长度够不够够够够够够够够够够够123",
  "lockToken":lt,"version":v
}).json()
assert not r2["success"] and "材料" in r2["error"], f"应因材料失败: {r2}"
P(f"  OK: 材料缺失被拒 - {r2['error'][:50]}")

P("Step3: 重新取锁（上一次请求已释放旧锁），补全材料3项，提交应成功")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=reg_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
r3 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=reg_h, json={
  "action":"submit",
  "opinion":"望京店端午客流预计增长15%，按历史数据1.2倍系数补货，材料齐全核对无误。",
  "lockToken":lt,"version":v,
  "materials":["订货清单","门店库存快照","历史订货参考数据"]
}).json()
assert r3["success"], f"提交失败: {r3.get('error','')} {r3.get('errorDetail','')}"
P(f"  OK: status={r3['data']['status']} stage={r3['data']['currentStage']} v{r3['data']['version']}")

P("Step4: 【越权测试】登记员不能审核")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=reg_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
assert d["data"]["allowedActions"] == [], f"登记员在pending_verification下应无权限: {d['data']['allowedActions']}"
r4 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=reg_h, json={
  "action":"approve_verify","opinion":"登记员越权审核测试",
  "lockToken":lt,"version":v
}).json()
assert not r4["success"] and "无权" in r4["error"], "越权测试失败: "+str(r4)
P(f"  OK: 越权被拒 - {r4['error'][:30]}")

P("Step5: 主管核验材料只填1项直接通过应失败")
sup_h = H("supervisor_demo","supervisor")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=sup_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
r5 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=sup_h, json={
  "action":"approve_verify","opinion":"主管只填1项核验材料试试能不能过",
  "lockToken":lt,"version":v,
  "materials":["库存核验报告"]
}).json()
assert not r5["success"] and "材料" in r5["error"], "主管材料不全应失败: "+str(r5)
P(f"  OK: 主管材料不全被拒 - {r5['error'][:40]}")

P("Step6: 主管填退回原因，退回成功（自动解析退回原因）")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=sup_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
r6 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=sup_h, json={
  "action":"reject_verify",
  "opinion":"退回原因1：猪里脊单价较上次高12%未附说明；退回原因2：供应商冷链资质未附扫描件",
  "lockToken":lt,"version":v,
  "materials":["库存核验报告","价格核对记录"]
}).json()
assert r6["success"] and r6["data"]["status"]=="verification_rejected", "退回失败: "+str(r6)
reasons = r6["data"]["stageOpinions"]["过程核验"].get("rejectReasons",[])
P(f"  OK: status={r6['data']['status']} 退回原因{len(reasons)}条: {reasons[:3]}")

P("Step7: 登记员补正重新提交")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=reg_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
assert "correct_submit" in d["data"]["allowedActions"], "补正提交流程缺失"
r7 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=reg_h, json={
  "action":"correct_submit",
  "opinion":"补正：1.猪里脊价格上涨附农业部市场周报截图；2.冷链资质补充上传；3.客流附618营销预测。",
  "lockToken":lt,"version":v,
  "materials":["订货清单","门店库存快照","历史订货参考数据"]
}).json()
assert r7["success"] and r7["data"]["status"]=="pending_verification", "补正失败: "+str(r7)
P(f"  OK: status={r7['data']['status']} v{r7['data']['version']}")

P("Step8: 主管核验3项齐全通过")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=sup_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
r8 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=sup_h, json={
  "action":"approve_verify",
  "opinion":"核验通过：库存报告确认安全水位线；价格3家比价合理；供应商确认5日内送达；材料齐全无异常。",
  "lockToken":lt,"version":v,
  "materials":["库存核验报告","价格核对记录","供应商确认回执"]
}).json()
assert r8["success"] and r8["data"]["status"]=="pending_review", "核验通过失败: "+str(r8)
P(f"  OK: status={r8['data']['status']} stage={r8['data']['currentStage']}")

P("Step9: 复核负责人补齐材料归档")
rev_h = H("reviewer_demo","reviewer")
d = requests.get(f"{BASE}/api/orders/{OID}", headers=rev_h).json()
lt, v = d["data"]["lockToken"], d["data"]["order"]["version"]
r9 = requests.post(f"{BASE}/api/orders/{OID}/action", headers=rev_h, json={
  "action":"approve_review",
  "opinion":"复核归档通过：财务预算核对签字齐全；总部无可调配生鲜；合规检查检疫资质完整；整体符合Q2政策。",
  "lockToken":lt,"version":v,
  "materials":["财务预算核对单","总部库存调配意见","合规检查记录"]
}).json()
assert r9["success"] and r9["data"]["status"]=="archived", "归档失败: "+str(r9)
P(f"  OK: 归档成功 status={r9['data']['status']} 归档时间={r9['data']['archivedAt'][:19]}")

P("Step10: 统计与审计日志一致性验证")
stat = requests.get(f"{BASE}/api/statistics", headers=rev_h).json()["data"]
P(f"  统计：总数{stat['total']} 逾期{stat['overdueCount']} 归档{stat['byStatus'].get('archived',0)}")
logs = requests.get(f"{BASE}/api/audit-logs/order/{OID}", headers=reg_h).json()["data"]["data"]
actions = [l["action"] for l in logs]
expected = {"create","submit","reject_verify","correct_submit","approve_verify","approve_review"}
missing = expected - set(actions)
assert not missing, f"审计动作缺失: {missing}, 实际: {actions}"
P(f"  审计日志{len(logs)}条：动作完整 ✅ 序列={actions}")

P("\n===== 所有业务流程场景测试通过! =====")
