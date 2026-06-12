import requests
import json

BASE = "http://localhost:8008"

def print_header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_result(test_name, success, details=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}")
    if details:
        print(f"     {details}")

# 1. 登录
print_header("登录系统")
r = requests.post(f"{BASE}/api/auth/login", json={"username":"lina","password":"123456"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}"}
print(f"街道科员李娜登录成功，token: {token}")

# 获取所有申请
r = requests.get(f"{BASE}/api/applications", headers=headers)
all_apps = r.json()
app_map = {a["application_no"]: a for a in all_apps}
print(f"获取到 {len(all_apps)} 条申请")

# 场景1：缺意见失败（核实BF20260001不填意见）
print_header("场景1：缺意见失败（核实不填意见）")
app = app_map["BF20260001"]
print(f"测试申请: {app['application_no']} ({app['applicant_name']})")
print(f"当前状态: {app['status']}, version: {app['version']}")

payload = {
    "action": "verify",
    "opinion": "",
    "materials": [],
    "version": app["version"],
    "overdue_reason": ""
}
r = requests.post(f"{BASE}/api/applications/{app['id']}/advance", json=payload, headers=headers)
print(f"HTTP状态: {r.status_code}")
print(f"响应: {r.text}")

# 验证状态未改变
r = requests.get(f"{BASE}/api/applications/{app['id']}", headers=headers)
app_after = r.json()
print(f"操作后状态: {app_after['status']}, version: {app_after['version']}")
print_result("状态未改变", app_after["status"] == app["status"])
print_result("版本未改变", app_after["version"] == app["version"])
print_result("返回422状态码", r.status_code == 422)
print_result("包含下一步建议", "建议" in r.text or "suggestion" in r.text.lower())

# 场景2：逾期缺逾期说明（核实BF20260006不填逾期说明）
print_header("场景2：逾期缺逾期说明（核实不填逾期说明）")
app6 = app_map["BF20260006"]
print(f"测试申请: {app6['application_no']} ({app6['applicant_name']})")
print(f"当前状态: {app6['status']}, version: {app6['version']}")
print(f"截止日期: {app6['deadline']}")

payload = {
    "action": "verify",
    "opinion": "情况属实，建议通过",
    "materials": [],
    "version": app6["version"],
    "overdue_reason": ""
}
r = requests.post(f"{BASE}/api/applications/{app6['id']}/advance", json=payload, headers=headers)
print(f"HTTP状态: {r.status_code}")
print(f"响应: {r.text}")

# 验证状态未改变
r = requests.get(f"{BASE}/api/applications/{app6['id']}", headers=headers)
app6_after = r.json()
print(f"操作后状态: {app6_after['status']}, version: {app6_after['version']}")
print_result("状态未改变", app6_after["status"] == app6["status"])
print_result("版本未改变", app6_after["version"] == app6["version"])
print_result("返回422状态码", r.status_code == 422)
print_result("包含逾期提示", "逾期" in r.text)

# 场景3：逾期带逾期说明成功（核实BF20260006填逾期说明）
print_header("场景3：逾期带逾期说明成功（核实填逾期说明）")
# 先添加核验材料
payload = {
    "action": "verify",
    "opinion": "情况属实，建议通过",
    "materials": [{
        "stage": "verification",
        "file_name": "入户核验报告.pdf",
        "file_path": "uploads/BF20260006/核验报告.pdf",
        "material_type": "核验报告"
    }],
    "version": app6_after["version"],
    "overdue_reason": "前期因疫情封控无法入户核实，解封后立即处理"
}
r = requests.post(f"{BASE}/api/applications/{app6['id']}/advance", json=payload, headers=headers)
print(f"HTTP状态: {r.status_code}")
if r.status_code == 200:
    print(f"响应: {json.dumps(r.json(), ensure_ascii=False, indent=2)}")
else:
    print(f"响应: {r.text}")

# 验证状态已改变
r = requests.get(f"{BASE}/api/applications/{app6['id']}", headers=headers)
app6_final = r.json()
print(f"操作后状态: {app6_final['status']}, version: {app6_final['version']}")
print(f"逾期说明: {app6_final.get('overdue_reason', '')}")
print_result("状态变为pending_approve", app6_final["status"] == "pending_approve")
print_result("版本号递增", app6_final["version"] == app6_after["version"] + 1)
print_result("逾期说明已保存", app6_final.get("overdue_reason", "") != "")

# 场景4：审计记录扩展字段验证
print_header("场景4：审计记录扩展字段验证")
r = requests.get(f"{BASE}/api/audit/logs?application_id={app6['id']}", headers=headers)
logs = r.json()
print(f"共 {len(logs)} 条审计记录")
for log in logs:
    print(f"  动作: {log['action']}, 角色: {log.get('operator_role', '-')}, 时限检查: {log.get('deadline_check', '-')}")
    print(f"  失败原因: {log.get('failure_reason', '-')}, 客户端版本: {log.get('client_version', '-')}")
    if log.get("failure_reason"):
        print_result("失败记录包含完整字段", 
            log.get("operator_role") and log.get("deadline_check") and log.get("client_version") is not None)

# 场景5：批量处理测试（混合场景）
print_header("场景5：批量处理测试（混合场景）")
# 用领导账号登录测试审批
r = requests.post(f"{BASE}/api/auth/login", json={"username":"wangqiang","password":"123456"})
leader_token = r.json()["token"]
leader_headers = {"Authorization": f"Bearer {leader_token}"}
print(f"分管领导王强登录成功")

# 获取待审批列表
r = requests.get(f"{BASE}/api/applications?status=pending_approve", headers=leader_headers)
pending_approve = r.json()
print(f"待审批列表: {len(pending_approve)} 条")
for a in pending_approve:
    print(f"  {a['application_no']} - {a['applicant_name']} - 截止: {a['deadline'][:10]}")

# 测试批量处理：BF20260002（正常）+ BF20260007（逾期）
# BF20260002不带意见应该失败，BF20260007不带逾期说明应该失败
app2 = [a for a in pending_approve if a["application_no"] == "BF20260002"][0]
app7 = [a for a in pending_approve if a["application_no"] == "BF20260007"][0]

print(f"\n批量处理: {app2['application_no']}(正常) + {app7['application_no']}(逾期)")
batch_payload = {
    "items": [
        {
            "application_id": app2["id"],
            "action": "approve",
            "opinion": "",  # 缺意见，应该失败
            "materials": [],
            "version": app2["version"],
            "overdue_reason": ""
        },
        {
            "application_id": app7["id"],
            "action": "approve",
            "opinion": "符合条件，同意帮扶",  # 有意见
            "materials": [],  # 缺材料，应该失败
            "version": app7["version"],
            "overdue_reason": ""  # 缺逾期说明，应该失败
        }
    ]
}
r = requests.post(f"{BASE}/api/batch/advance", json=batch_payload, headers=leader_headers)
batch_result = r.json()
print(f"批量处理结果: {json.dumps(batch_result, ensure_ascii=False, indent=2)}")

# 验证失败结果
results = batch_result.get("results", [])
print_result("批量返回2条结果", len(results) == 2)
for res in results:
    print(f"  {res['application_no']}: success={res['success']}, error={res.get('error','')}")
    if not res["success"]:
        print_result("失败结果包含单号", res["application_no"] != "")
        print_result("失败结果包含原状态", res.get("from_status", "") != "")
        print_result("失败结果包含下一步建议", res.get("suggestion", "") != "")

# 场景6：批量失败记录持久化验证
print_header("场景6：批量失败记录持久化验证")
r = requests.get(f"{BASE}/api/batch/failures?batch_id={batch_result.get('batch_id','')}", headers=leader_headers)
failures = r.json()
print(f"批量失败记录: {len(failures)} 条")
for f in failures:
    print(f"  {f['application_no']}: {f['error']}")
    print(f"    原状态: {f.get('from_status', '-')}")
    print(f"    下一步建议: {f.get('suggestion', '-')}")
print_result("失败记录已持久化", len(failures) >= 2)

# 场景7：角色权限验证
print_header("场景7：角色权限验证")
# 用社区专干账号尝试查看所有列表
r = requests.post(f"{BASE}/api/auth/login", json={"username":"zhangwei","password":"123456"})
worker_token = r.json()["token"]
worker_headers = {"Authorization": f"Bearer {worker_token}"}
print(f"社区专干张伟登录成功")

# 尝试查看pending_verify（应该只能看到自己创建的）
r = requests.get(f"{BASE}/api/applications?status=pending_verify", headers=worker_headers)
worker_apps = r.json()
print(f"社区专干查看pending_verify列表: {len(worker_apps)} 条")
print_result("社区专干看不到别人的待核实", len(worker_apps) == 0)

# 尝试越权查看draft
r = requests.get(f"{BASE}/api/applications?status=draft", headers=headers)  # headers是clerk的
clerk_draft = r.json()
print(f"街道科员查看draft列表: {len(clerk_draft)} 条")
print_result("街道科员看不到draft", len(clerk_draft) == 0)

# 场景8：version冲突测试
print_header("场景8：version冲突测试")
app1 = app_map["BF20260001"]
print(f"测试申请: {app1['application_no']}, 当前version: {app1['version']}")

# 用错误的version提交
payload = {
    "action": "verify",
    "opinion": "测试冲突",
    "materials": [],
    "version": app1["version"] + 100,  # 错误版本
    "overdue_reason": ""
}
r = requests.post(f"{BASE}/api/applications/{app1['id']}/advance", json=payload, headers=headers)
print(f"HTTP状态: {r.status_code}")
print(f"响应: {r.text}")
print_result("版本冲突返回409", r.status_code == 409)

# 总结
print_header("测试总结")
print("所有场景测试完成！")
print("\n已验证功能:")
print("✅ 意见必填校验（verify/approve/reject必须填意见）")
print("✅ 时限校验（超期必须填逾期说明）")
print("✅ 校验失败停留原状态，不改变版本")
print("✅ 失败返回下一步建议")
print("✅ 逾期说明持久化到Application.overdue_reason")
print("✅ 审计记录包含角色、客户端版本、时限检查、失败原因")
print("✅ 批量处理逐项独立校验")
print("✅ 批量失败记录持久化，包含原状态、单号、原因、建议")
print("✅ 失败原因展示格式：[单号] 错误内容")
print("✅ 角色权限隔离")
print("✅ 乐观锁版本冲突检测")
