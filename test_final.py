import requests, json

BASE = "http://localhost:8001/api"
hdrs = {"Content-Type": "application/json"}

def h(u, r):
    return {**hdrs, "X-User-Id": u, "X-User-Role": r, "X-User-Name": u}

sep = "=" * 60
ok = 0
fail = 0

def check(name, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"✅ {name}")
    else:
        fail += 1
        print(f"❌ {name} - {detail}")
    if detail:
        print(f"   ℹ️  {detail}")

print(f"\n{sep}")
print("制造工厂-生产工单系统 验收测试")
print(f"{sep}")

# === 1. 材料不足提交失败 ===
print(f"\n📋 场景1: 证据缺失校验（材料不足）")
r = requests.post(f"{BASE}/workorders/wo2/submit",
    headers=h("reg001","registrar"),
    json={"materials":["仅一份材料"], "comment":"测试材料不足",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
check("材料不足1份提交被拒绝",
      res.get("success") == False and res.get("code") == "MATERIALS_REQUIRED",
      f"code={res.get('code')} detail={res.get('detail','')[:50]}")

# === 2. 意见过短 ===
print(f"\n📋 场景2: 处理意见校验")
r = requests.post(f"{BASE}/workorders/wo2/submit",
    headers=h("reg001","registrar"),
    json={"materials":["A","B","C"], "comment":"短",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
check("意见过短(2字符)被拒绝",
      res.get("success") == False and res.get("code") == "OPINION_REQUIRED",
      f"code={res.get('code')}")

# === 3. 越权操作 ===
print(f"\n📋 场景3: 越权操作校验")
r = requests.post(f"{BASE}/workorders/wo2/submit",
    headers=h("aud001","auditor"),  # 审核主管越权提交
    json={"materials":["A","B","C"], "comment":"越权测试越权测试",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
check("非登记员提交被拒绝",
      res.get("success") == False and res.get("code") == "PERMISSION_DENIED",
      f"code={res.get('code')} msg={res.get('message','')}")

# === 4. 完整流程 - wo2提交 ===
print(f"\n📋 场景4: 工单闭环 - 登记→核验→复核")
r = requests.post(f"{BASE}/workorders/wo2/submit",
    headers=h("reg001","registrar"),
    json={"materials":["生产图纸","工艺卡","领料单","质检报告"],
          "comment":"生产准备完毕材料齐全可核验",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
d = res.get("data",{})
check("登记提交成功(draft→pending_audit)",
      res.get("success") and d.get("status") == "pending_audit",
      f"状态={d.get('statusName')} 处理人={d.get('currentRoleName')}")

# === 5. 核验 - 顺序错误(用已完成的wo1尝试再核验) ===
print(f"\n📋 场景5: 流程顺序校验")
r = requests.post(f"{BASE}/workorders/wo1/audit",
    headers=h("aud001","auditor"),
    json={"action":"pass",
          "checkItems":[{"name":"A","passed":True},{"name":"B","passed":True}],
          "comment":"顺序错误测试顺序错误"})
res = r.json()
check("已完成状态再核验被拒绝",
      res.get("success") == False and res.get("code") == "INVALID_STATUS",
      f"code={res.get('code')}")

# === 6. 核验 - 核验项不足 ===
print(f"\n📋 场景6: 核验项校验")
r = requests.post(f"{BASE}/workorders/wo2/audit",
    headers=h("aud001","auditor"),
    json={"action":"pass",
          "checkItems":[{"name":"仅一项","passed":True}],
          "comment":"核验项不足测试核验"})
res = r.json()
check("仅1项核验被拒绝",
      res.get("success") == False and res.get("code") == "CHECK_ITEMS_REQUIRED",
      f"code={res.get('code')}")

# === 7. 核验通过 ===
print(f"\n📋 场景7: 核验通过(pending_audit→pending_review)")
r = requests.post(f"{BASE}/workorders/wo2/audit",
    headers=h("aud001","auditor"),
    json={"action":"pass",
          "checkItems":[{"name":"尺寸检验","passed":True},
                       {"name":"外观检查","passed":True},
                       {"name":"性能测试","passed":True}],
          "comment":"各项指标均符合生产工艺标准要求"})
res = r.json()
d = res.get("data",{})
check("核验通过(pending_audit→pending_review)",
      res.get("success") and d.get("status") == "pending_review",
      f"状态={d.get('statusName')} 核验人={d.get('auditorName')}")

# === 8. 批量核验 - 校验参数 ===
print(f"\n📋 场景8: 批量处理校验")
r = requests.post(f"{BASE}/workorders/batch/audit",
    headers=h("aud001","auditor"),
    json={"ids":["wo3","wo4"], "action":"pass",
          "checkItems":[{"name":"A","passed":True}],  # 核验项不足
          "comment":"批量测试批量测试"})
res = r.json()
check("批量核验-核验项不足被拒绝",
      res.get("success") == False and res.get("code") == "CHECK_ITEMS_REQUIRED",
      f"code={res.get('code')}")

# === 9. 批量核验通过 ===
print(f"\n📋 场景9: 批量核验通过")
r = requests.post(f"{BASE}/workorders/batch/audit",
    headers=h("aud002","auditor"),
    json={"ids":["wo3","wo4"], "action":"pass",
          "checkItems":[{"name":"尺寸","passed":True},{"name":"外观","passed":True},
                       {"name":"工艺","passed":True},{"name":"质检","passed":True}],
          "comment":"批量核验各项指标均符合标准要求"})
res = r.json()
dt = res.get("data",{})
check(f"批量核验通过(wo3,wo4)",
      res.get("success") and dt.get("successCount") >= 1,
      f"成功={dt.get('successCount')} 失败={dt.get('failCount')} 总计={dt.get('total')}")

# === 10. 复核归档 - wo2 ===
print(f"\n📋 场景10: 复核归档(pending_review→completed)")
r = requests.post(f"{BASE}/workorders/wo2/review",
    headers=h("rev001","reviewer"),
    json={"archiveNo":"GD2024-YANSHOU-002",
          "comment":"所有材料完整流程合规同意归档"})
res = r.json()
d = res.get("data",{})
check("复核归档成功",
      res.get("success") and d.get("status") == "completed",
      f"状态={d.get('statusName')} 归档号={d.get('review',{}).get('archiveNo')}")

# === 11. 重复码 - wo2已归档再扫 ===
print(f"\n📋 场景11: 重复码/已归档校验")
r = requests.post(f"{BASE}/workorders/scan",
    headers=h("aud001","auditor"),
    json={"qrCode":"WO0002024002"})
res = r.json()
check("已归档工单扫码被拒绝",
      res.get("success") == False and res.get("code") == "ALREADY_COMPLETED",
      f"code={res.get('code')} msg={res.get('message')}")

# === 12. 无效码 ===
print(f"\n📋 场景12: 无效码校验")
r = requests.post(f"{BASE}/workorders/scan",
    headers=h("reg001","registrar"),
    json":{"qrCode":"NOT-A-VALID-CODE-123456"})
res = r.json()
check("无效码扫码被拒绝",
      res.get("success") == False and res.get("code") == "INVALID_QR",
      f"code={res.get('code')} msg={res.get('message')}")

# === 13. 非当前处理人 ===
print(f"\n📋 场景13: 非当前处理人校验")
r = requests.post(f"{BASE}/workorders/scan",
    headers=h("reg001","registrar"),  # 登记员扫复核岗
    json={"qrCode":"WO0002024008"})
res = r.json()
check("非处理人扫码被拒绝",
      res.get("success") == False and res.get("code") == "WRONG_ROLE",
      f"code={res.get('code')} msg={res.get('message','')[:40]}")

# === 14. 核验驳回 ===
print(f"\n📋 场景14: 核验驳回(pending_audit→rejected)")
r = requests.post(f"{BASE}/workorders/wo6/audit",
    headers=h("aud001","auditor"),
    json={"action":"reject",
          "checkItems":[{"name":"尺寸","passed":False},
                       {"name":"外观","passed":True}],  # 驳回时核验项1项也不行，让我改
          "comment":"尺寸超差严重需要返工重新生产"})
res = r.json()
d = res.get("data",{})
# 驳回时也需要至少2项核验
check("核验-驳回核验项不足被拒绝",
      res.get("success") == False,  # 应该是checkItems不足(只有1项不合格的)
      f"success={res.get('success')} code={res.get('code')}")

# 重新发起-带2项核验
r = requests.post(f"{BASE}/workorders/wo6/audit",
    headers=h("aud001","auditor"),
    json={"action":"reject",
          "checkItems":[{"name":"尺寸","passed":False},
                       {"name":"外观","passed":False},
                       {"name":"性能","passed":True}],
          "comment":"尺寸和外观均不达标需返工补正"})
res = r.json()
d = res.get("data",{})
check("核验驳回成功(pending_audit→rejected)",
      res.get("success") and d.get("status") == "rejected",
      f"状态={d.get('statusName')} 回退至={d.get('currentRoleName')}")

# === 15. 驳回补正 ===
print(f"\n📋 场景15: 驳回补正(rejected→pending_audit)")
r = requests.post(f"{BASE}/workorders/wo6/submit",
    headers=h("reg001","registrar"),
    json={"materials":["修正图纸","新工艺卡","重检领料单","返工质检单"],
          "comment":"已按要求返工尺寸外观全部达标重新申请核验",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
d = res.get("data",{})
check("驳回补正成功(rejected→pending_audit)",
      res.get("success") and d.get("status") == "pending_audit",
      f"状态={d.get('statusName')} 处理人={d.get('currentRoleName')}")

# === 16. 审计倒查 - wo2 ===
print(f"\n📋 场景16: 审计倒查(按单据)")
r = requests.get(f"{BASE}/audit/workorder/wo2",
    headers=h("rev001","reviewer"))
logs = r.json().get("data",{}).get("list",[])
check(f"wo2审计记录完整(共{len(logs)}条)",
      len(logs) >= 4,  # 创建+提交+核验+复核
      f"记录={[l['actionName'] for l in logs]}")

# === 17. 统计数据一致性 ===
print(f"\n📋 场景17: 统计与队列一致性")
sc = requests.get(f"{BASE}/stats/summary").json().get("data",{})
status_sum = sum([sc['statusCounts']['draft'], sc['statusCounts']['pending_audit'],
                  sc['statusCounts']['pending_review'], sc['statusCounts']['completed'],
                  sc['statusCounts']['rejected']])
check("状态统计之和=总工单数(15)",
      status_sum == 15,
      f"各状态之和={status_sum}")
queue_sum = sum(sc['queueCounts'].values())
check("队列之和=未归档工单数",
      queue_sum == (15 - sc['statusCounts']['completed']),
      f"队列总数={queue_sum} 未完成={15 - sc['statusCounts']['completed']}")
check(f"审计记录总数({sc['todayActions']})≥提交+核验+复核次数",
      sc['todayActions'] >= 20,
      f"今日操作={sc['todayActions']} 异常记录={sc['failureCount']}")

# === 18. 失败类型分布 ===
print(f"\n📋 场景18: 失败类型分布渲染数据")
ft = requests.get(f"{BASE}/audit/failures",
    headers=h("rev001","reviewer")).json().get("data",{})
types = ft.get("failureTypes",[])
check("失败类型覆盖5+异常场景",
      len(types) >= 6,
      f"失败类型数={len(types)} 总数={ft.get('total')}")
print(f"   类型清单: {[t['code']+':'+str(t['count'])+'次' for t in types]}")

# === 汇总 ===
print(f"\n{sep}")
print(f"🎯 测试结果: ✅ 通过 {ok} 项  /  ❌ 失败 {fail} 项")
print(f"{sep}")
if fail == 0:
    print("🎉 全部验收场景通过！生产工单办理闭环验证完成")
else:
    print("⚠️  存在失败项，需进一步检查")
print(f"{sep}\n")
