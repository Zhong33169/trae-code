import requests, json

BASE = "http://localhost:8001/api"
hdrs = {"Content-Type": "application/json"}

def h(u, r):
    return {**hdrs, "X-User-Id": u, "X-User-Role": r, "X-User-Name": u}

sep = "=" * 55
ok = fail = 0

def chk(name, cond, d=""):
    global ok, fail
    if cond: ok += 1; print("OK " + name)
    else: fail += 1; print("XX " + name + " - " + d)
    if d: print("   " + d[:80])

print("\n" + sep)
print("生产工单系统 - 验收测试")
print(sep)

# 1.材料不足
print("\n[1] 材料不足校验")
r = requests.post(BASE+"/workorders/wo3/submit", headers=h("reg001","registrar"),
    json={"materials":["x"], "comment":"测试测试测试", "deadline":"2026-12-31T12:00:00Z"}).json()
chk("1份材料被拒绝", r.get("code")=="MATERIALS_REQUIRED", str(r.get("code")))

# 2.意见过短
print("\n[2] 处理意见校验")
r = requests.post(BASE+"/workorders/wo3/submit", headers=h("reg001","registrar"),
    json={"materials":["a","b","c"], "comment":"短", "deadline":"2026-12-31T12:00:00Z"}).json()
chk("2字符意见被拒绝", r.get("code")=="OPINION_REQUIRED", str(r.get("code")))

# 3.越权
print("\n[3] 越权操作校验")
r = requests.post(BASE+"/workorders/wo3/submit", headers=h("aud001","auditor"),
    json={"materials":["a","b","c"], "comment":"越权越权越权越权", "deadline":"2026-12-31T12:00:00Z"}).json()
chk("非登记员提交被拒", r.get("code")=="PERMISSION_DENIED", str(r.get("code")))

# 4.登记提交
print("\n[4] 登记提交 (draft->pending_audit)")
r = requests.post(BASE+"/workorders/wo3/submit", headers=h("reg001","registrar"),
    json={"materials":["图纸","工艺卡","领料单","质检"],
          "comment":"生产准备完毕材料齐全可核验",
          "deadline":"2026-12-31T12:00:00Z"}).json()
chk("登记提交成功", r.get("success") and r["data"].get("status")=="pending_audit",
    "状态="+r["data"].get("statusName",""))

# 5.核验项不足
print("\n[5] 核验项不足校验")
r = requests.post(BASE+"/workorders/wo3/audit", headers=h("aud001","auditor"),
    json={"action":"pass","checkItems":[{"n":"1","p":True}],
          "comment":"核验核验核验核验"}).json()
chk("1项核验被拒绝", r.get("code")=="CHECK_ITEMS_REQUIRED", str(r.get("code")))

# 6.顺序错误
print("\n[6] 流程顺序校验")
r = requests.post(BASE+"/workorders/wo1/audit", headers=h("aud001","auditor"),
    json={"action":"pass","checkItems":[{"n":"1","p":True},{"n":"2","p":True}],
          "comment":"顺序错误测试顺序"}).json()
chk("已完成再核验被拒", r.get("code")=="INVALID_STATUS", str(r.get("code")))

# 7.核验驳回
print("\n[7] 核验驳回 (pending_audit->rejected)")
r = requests.post(BASE+"/workorders/wo3/audit", headers=h("aud001","auditor"),
    json={"action":"reject",
          "checkItems":[{"name":"尺寸","passed":False},{"name":"外观","passed":False},
                        {"name":"性能","passed":True}],
          "comment":"尺寸和外观不达标需返工补正"}).json()
chk("核验驳回成功", r.get("success") and r["data"].get("status")=="rejected",
    "状态="+r["data"].get("statusName",""))

# 8.驳回补正
print("\n[8] 驳回补正 (rejected->pending_audit)")
r = requests.post(BASE+"/workorders/wo3/submit", headers=h("reg001","registrar"),
    json={"materials":["修正图纸","新工艺","返工单","质检2"],
          "comment":"已返工尺寸和外观全部达标重新申请核验",
          "deadline":"2026-12-31T12:00:00Z"}).json()
chk("驳回补正成功", r.get("success") and r["data"].get("status")=="pending_audit",
    "状态="+r["data"].get("statusName",""))

# 9.核验通过
print("\n[9] 核验通过 (pending_audit->pending_review)")
r = requests.post(BASE+"/workorders/wo3/audit", headers=h("aud001","auditor"),
    json={"action":"pass",
          "checkItems":[{"name":"尺寸","passed":True},{"name":"外观","passed":True},
                        {"name":"性能","passed":True}],
          "comment":"返工后各项指标均符合标准要求"}).json()
chk("核验通过成功", r.get("success") and r["data"].get("status")=="pending_review",
    "状态="+r["data"].get("statusName",""))

# 10.批量核验
print("\n[10] 批量核验通过")
r = requests.post(BASE+"/workorders/batch/audit", headers=h("aud002","auditor"),
    json={"ids":["wo4","wo5"], "action":"pass",
          "checkItems":[{"n":"A","p":True},{"n":"B","p":True},{"n":"C","p":True}],
          "comment":"批量核验各项指标均符合要求标准"}).json()
chk("批量核验成功", r.get("success") and r["data"].get("successCount")>=1,
    "成功="+str(r["data"].get("successCount"))+" 失败="+str(r["data"].get("failCount")))

# 11.复核归档
print("\n[11] 复核归档 (pending_review->completed)")
r = requests.post(BASE+"/workorders/wo3/review", headers=h("rev001","reviewer"),
    json={"archiveNo":"GD2024-YANSHOU-003",
          "comment":"流程合规材料完整同意归档完成"}).json()
chk("复核归档成功", r.get("success") and r["data"].get("status")=="completed",
    "归档号="+r["data"].get("review",{}).get("archiveNo",""))

# 12.批量复核
print("\n[12] 批量复核归档")
r = requests.post(BASE+"/workorders/batch/review", headers=h("rev002","reviewer"),
    json={"ids":["wo7","wo8","wo9"], "action":"pass",
          "comment":"批量复核流程合规所有材料完整归档"}).json()
chk("批量复核成功", r.get("success") and r["data"].get("successCount")>=1,
    "成功="+str(r["data"].get("successCount"))+" 失败="+str(r["data"].get("failCount")))

# 13.重复码
print("\n[13] 已归档扫码 (重复码)")
r = requests.post(BASE+"/workorders/scan", headers=h("aud001","auditor"),
    json={"qrCode":"WO0002024003"}).json()
chk("已归档再扫被拒", r.get("code")=="ALREADY_COMPLETED", str(r.get("code")))

# 14.无效码
print("\n[14] 无效码校验")
r = requests.post(BASE+"/workorders/scan", headers=h("reg001","registrar"),
    json={"qrCode":"XXXXX-BAD-CODE-12345"}).json()
chk("无效码被拒绝", r.get("code")=="INVALID_QR", str(r.get("code")))

# 15.越权扫码
print("\n[15] 非当前处理人扫码")
r = requests.post(BASE+"/workorders/scan", headers=h("reg001","registrar"),
    json={"qrCode":"WO0002024006"}).json()
chk("非处理人扫码被拒", r.get("code")=="WRONG_ROLE", str(r.get("code")))

# 16.审计倒查
print("\n[16] 审计倒查 (按单据wo3)")
r = requests.get(BASE+"/audit/workorder/wo3", headers=h("rev001","reviewer")).json()
logs = r["data"].get("list",[])
chk("wo3审计记录>=5条", len(logs)>=5, "共"+str(len(logs))+"条: "+",".join([l["actionName"] for l in logs]))

# 17.统计一致性
print("\n[17] 统计与队列一致性")
sc = requests.get(BASE+"/stats/summary").json()["data"]
s = sc["statusCounts"]
total = s["draft"]+s["pending_audit"]+s["pending_review"]+s["completed"]+s["rejected"]
chk("状态合计=15", total==15, "合计="+str(total))
chk("队列数=未完成数", sum(sc["queueCounts"].values())==15-s["completed"],
    "队列="+str(sum(sc["queueCounts"].values()))+" 未完成="+str(15-s["completed"]))
chk("今日操作>=30次", sc["todayActions"]>=30, "操作="+str(sc["todayActions"])+" 异常="+str(sc["failureCount"]))

# 18.失败类型分布
print("\n[18] 失败类型分布")
ft = requests.get(BASE+"/audit/failures", headers=h("rev001","reviewer")).json()["data"]
types = ft.get("failureTypes",[])
chk("失败类型>=6种", len(types)>=6, "类型数="+str(len(types))+" 失败总数="+str(ft.get("total")))
for t in types[:8]: print("   - [%s] %s: %d次" % (t["code"], t["name"][:18], t["count"]))

# === Summary ===
print("\n" + sep)
print("RESULT: PASS %d  /  FAIL %d" % (ok, fail))
print(sep)
print("ALL TESTS PASSED!" if fail==0 else "SOME TESTS FAILED!")
print(sep + "\n")
