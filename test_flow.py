import requests, json

BASE = "http://localhost:8001/api"
hdrs = {"Content-Type": "application/json"}

def h(u, r, n):
    return {**hdrs, "X-User-Id": u, "X-User-Role": r, "X-User-Name": u}

sep = "=" * 60

print(f"\n{sep}\n测试1: 无效码扫码\n{sep}")
r = requests.post(f"{BASE}/workorders/scan", headers=h("reg001","registrar","张登记"), json={"qrCode":"INVALID123"})
res = r.json()
print(f"success={res.get('success')} code={res.get('code')} msg={res.get('message')}")

print(f"\n{sep}\n测试2: 越权扫码(复核人扫待核验)\n{sep}")
r = requests.post(f"{BASE}/workorders/scan", headers=h("rev001","reviewer","陈复核"), json={"qrCode":"WO0002024005"})
res = r.json()
print(f"success={res.get('success')} code={res.get('code')}")
print(f"detail={res.get('detail')}")

print(f"\n{sep}\n测试3: 完整流程-wo1登记提交\n{sep}")
r = requests.post(f"{BASE}/workorders/wo1/submit", 
    headers=h("reg001","registrar","张登记"),
    json={"materials":["图纸","工艺卡","领料单","质检"],
          "comment":"生产准备完毕材料齐全",
          "deadline":"2026-12-31T12:00:00Z"})
res = r.json()
print(f"success={res.get('success')} msg={res.get('message')}")
d = res.get("data",{})
print(f"状态:{d.get('statusName')} 处理:{d.get('currentRoleName')} 登记人:{d.get('registrarName')}")

print(f"\n{sep}\n测试4: 完整流程-wo1核验通过\n{sep}")
r = requests.post(f"{BASE}/workorders/wo1/audit",
    headers=h("aud001","auditor","王审核"),
    json={"action":"pass",
          "checkItems":[{"name":"尺寸","passed":True},{"name":"外观","passed":True},{"name":"性能","passed":True}],
          "comment":"各项指标均符合标准要求"})
res = r.json()
print(f"success={res.get('success')} msg={res.get('message')}")
d = res.get("data",{})
print(f"状态:{d.get('statusName')} 处理:{d.get('currentRoleName')} 核验人:{d.get('auditorName')}")

print(f"\n{sep}\n测试5: 完整流程-wo1复核归档\n{sep}")
r = requests.post(f"{BASE}/workorders/wo1/review",
    headers=h("rev001","reviewer","陈复核"),
    json={"archiveNo":"GD2024DEMO001","comment":"流程合规材料完整归档"})
res = r.json()
print(f"success={res.get('success')} msg={res.get('message')}")
d = res.get("data",{})
print(f"状态:{d.get('statusName')} 归档号:{d.get('review',{}).get('archiveNo')} 复核人:{d.get('reviewerName')}")

print(f"\n{sep}\n测试6: 重复码测试(wo1已归档)\n{sep}")
r = requests.post(f"{BASE}/workorders/scan", headers=h("aud001","auditor","王审核"), json={"qrCode":"WO0002024001"})
res = r.json()
print(f"success={res.get('success')} code={res.get('code')} msg={res.get('message')}")

print(f"\n{sep}\n测试7: 顺序错误(草稿状态直接核验)\n{sep}")
r = requests.post(f"{BASE}/workorders/wo2/audit",
    headers=h("aud001","auditor","王审核"),
    json={"action":"pass","checkItems":[{"n":"1","p":True},{"n":"2","p":True}],"comment":"顺序错误测试"})
res = r.json()
print(f"success={res.get('success')} code={res.get('code')} detail={res.get('detail')}")

print(f"\n{sep}\n测试8: 材料不足提交失败\n{sep}")
r = requests.post(f"{BASE}/workorders/wo2/submit",
    headers=h("reg001","registrar","张登记"),
    json={"materials":["仅1份"],"comment":"材料不足测试","deadline":"2026-12-31T12:00:00Z"})
res = r.json()
print(f"success={res.get('success')} code={res.get('code')} detail={res.get('detail')}")

print(f"\n{sep}\n测试9: wo1审计记录(倒查)\n{sep}")
r = requests.get(f"{BASE}/audit/workorder/wo1", headers=h("rev001","reviewer","陈复核"))
logs = r.json().get("data",{}).get("list",[])
print(f"共 {len(logs)} 条记录:")
for log in logs:
    mark = "✓" if log.get("success") else "✗"
    t = log.get("createdAt","")[11:19]
    name = log.get("actionName","")
    op = log.get("operatorName","")
    cmt = log.get("comment") or log.get("failureReason") or ""
    print(f"  {mark} {t} | {name} | {op} | {cmt[:40]}")

print(f"\n{sep}\n测试10: 统计与队列变化\n{sep}")
sc = requests.get(f"{BASE}/stats/summary").json().get("data",{})
status = sc.get("statusCounts",{})
queue = sc.get("queueCounts",{})
print(f"状态: draft={status['draft']} audit={status['pending_audit']} review={status['pending_review']} done={status['completed']} reject={status['rejected']}")
print(f"队列: 登记员={queue['registrar']}人 审核={queue['auditor']}人 复核={queue['reviewer']}人")
print(f"今日操作: {sc['todayActions']}次 / 异常记录: {sc['failureCount']}次 / 高优先级: {sc['highPriority']}单")

print(f"\n{sep}\n测试11: 失败类型分布\n{sep}")
ft = requests.get(f"{BASE}/audit/failures", headers=h("rev001","reviewer","陈复核")).json().get("data",{})
print(f"失败总数: {ft.get('total')}")
for item in ft.get("failureTypes",[]):
    print(f"  [{item['code']}] {item['name']}: {item['count']}次")

print(f"\n{sep}\n✅ 全部测试完成!\n{sep}")
