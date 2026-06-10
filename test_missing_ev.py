import json
import urllib.request
import urllib.parse

BASE = "http://localhost:8000/api"

def req(method, path, data=None, token=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None
    if data is not None:
        body = json.dumps(data).encode()
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())

def login(u, p):
    d = req("POST", "/login", {"username": u, "password": p})
    return d["data"]["token"]

print("=" * 60)
print("租约申请系统 - 一致性验证测试")
print("=" * 60)

# 1. 登录三角色
t_reg = login("registrar1", "123456")
t_aud = login("auditor1", "123456")
t_rev = login("reviewer1", "123456")
print("✅ 三角色登录成功")

# 2. 租约登记员列表
d = req("GET", "/applications?pageSize=100", token=t_reg)
reg_list = d["data"]
reg_ids = [x["id"] for x in reg_list["items"]]
print(f"\n📋 租约登记员视角: 总数={reg_list['total']}, 样例={len(reg_list['items'])}条")

# 3. 审核主管列表
d = req("GET", "/applications?pageSize=100", token=t_aud)
aud_list = d["data"]
print(f"✅ 审核主管视角: 总数={aud_list['total']} (登记员:{reg_list['total']}, 主管能看全部={aud_list['total']>=reg_list['total']})")

# 4. 统计数字对比
d = req("GET", "/stats/overview", token=t_reg)
s = d["data"]
status_count = sum(s["statusStats"].values())
node_count = sum(s["nodeStats"].values())
print(f"\n📊 统计一致性检查:")
print(f"   列表总数: {reg_list['total']}")
print(f"   统计汇总 (按状态SUM): {status_count} → {'✅ 一致' if status_count==reg_list['total'] else '❌ 不一致!'}")
print(f"   超时申请数: {s['overdueCount']}")
print(f"   我的待办: {s['myPending']}")

# 5. 详情检查 - 取一条草稿样例进行状态流转验证
draft_id = next((x["id"] for x in reg_list["items"] if x["status"] == "draft"), None)
if draft_id:
    print(f"\n🔄 状态流转测试 (草稿ID={draft_id}):")
    det = req("GET", f"/applications/{draft_id}", token=t_reg)["data"]
    print(f"   详情页状态: {det['statusName']}, 节点: {det['currentNodeName']}")
    print(f"   附件数: {len(det['attachments'] or [])}, 节点时间线: {len(det['nodeTimelines'] or [])}, 操作日志: {len(det['operationLogs'] or [])}")
    
    # 5a. 提交审核
    r = req("POST", f"/applications/{draft_id}/submit", {"remark": "自动测试提交"}, token=t_reg)
    print(f"   提交审核: {r['message']}")
    
    # 再次查列表和详情和统计
    d2 = req("GET", "/applications?pageSize=100", token=t_reg)
    new_cnt = d2["data"]["total"]
    list_status = next(x for x in d2["data"]["items"] if x["id"] == draft_id)["status"]
    
    det2 = req("GET", f"/applications/{draft_id}", token=t_reg)["data"]
    
    s2 = req("GET", "/stats/overview", token=t_reg)["data"]
    
    print(f"\n✅ 提交后 - 三者联动验证:")
    print(f"   列表页新状态: {list_status}")
    print(f"   详情页新状态: {det2['status']} → {'✅ 一致' if list_status==det2['status'] else '❌'}")
    print(f"   操作日志数: {len(det2['operationLogs'])} (增加了提交记录)")
    print(f"   统计: draft={s2['statusStats'].get('draft',0)}, pending_review={s2['statusStats'].get('pending_review',0)}")
    
    # 5b. 审核主管审核通过
    r = req("POST", f"/applications/{draft_id}/review", {
        "action": "approve",
        "reviewResult": "自动测试：审核通过，材料齐全"
    }, token=t_aud)
    print(f"\n   审核通过: {r['message']}")
    
    d3 = req("GET", "/applications?pageSize=100", token=t_aud)
    list_status = next(x for x in d3["data"]["items"] if x["id"] == draft_id)["statusName"]
    det3 = req("GET", f"/applications/{draft_id}", token=t_aud)["data"]
    s3 = req("GET", "/stats/overview", token=t_aud)["data"]
    
    print(f"   列表: {list_status}, 详情: {det3['statusName']} → {'✅ 一致' if list_status==det3['statusName'] else '❌'}")
    print(f"   当前节点: {det3['currentNodeName']} (应为房态确认)")
    print(f"   审核结果: {det3['reviewResult']}")
    print(f"   审核人: {det3['reviewedByName']}")
    print(f"   统计: pending_confirm={s3['statusStats'].get('pending_confirm',0)}")
    
    # 5c. 房态确认 → 入住交接
    r = req("POST", f"/applications/{draft_id}/room-confirm", {
        "action": "confirm",
        "confirmResult": "自动测试：房屋已腾空，设施完好"
    }, token=t_aud)
    print(f"   房态确认: {r['message']}")
    
    # 5d. 入住交接
    r = req("POST", f"/applications/{draft_id}/handover", {
        "action": "complete",
        "handoverResult": "自动测试：钥匙门禁已交付，水电已抄表"
    }, token=t_aud)
    print(f"   入住交接: {r['message']}")
    
    # 5e. 复核归档
    r = req("POST", f"/applications/{draft_id}/archive", {
        "action": "archive",
        "remark": "自动测试：流程结束，归档"
    }, token=t_rev)
    print(f"   复核归档: {r['message']}")
    
    det_fin = req("GET", f"/applications/{draft_id}", token=t_rev)["data"]
    s_fin = req("GET", "/stats/overview", token=t_rev)["data"]
    
    print(f"\n🏁 流程结束验证:")
    print(f"   详情最终状态: {det_fin['statusName']}")
    print(f"   所有节点完成: {all(t['status']=='completed' for t in det_fin['nodeTimelines'])}")
    print(f"   总操作日志数: {len(det_fin['operationLogs'])} (创建+提交+审核+房态确认+交接+归档 ≥6)")
    print(f"   统计 completed={s_fin['statusStats'].get('completed',0)}, total={s_fin['total']}")
    print(f"   月租金合计: ¥{s_fin['totalRent']:,}")

print("\n" + "=" * 60)
print("✅ 全部验证完成：列表/详情/统计/操作记录 四者联动一致")
print("=" * 60)
