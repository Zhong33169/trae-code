import json
import urllib.request

API = "http://localhost:8003/api"

def req(method, path, data=None, user_id=None):
    url = API + path
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if user_id:
        headers["X-User-Id"] = str(user_id)
    r = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def test(name, status, expected_code=None):
    code, data = status
    ok = (expected_code is None and 200 <= code < 300) or code == expected_code
    detail = ""
    if isinstance(data, dict):
        if "detail" in data:
            d = data["detail"]
            if isinstance(d, dict):
                detail = f"[{d.get('code','')}] {d.get('error','')}"
            else:
                detail = str(d)
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name} (HTTP {code})")
    if detail and (not ok or True):
        print(f"         → {detail}")
    return ok

print("=" * 60)
print("后端校验自动化测试")
print("=" * 60)

print("\n[1] 认证与角色权限")
print("-" * 50)
test("未登录请求 → 401", req("GET", "/orders"), 401)
test("办理员创建订单 → 被拒", req("POST", "/orders", {"customer":"X","cargo_name":"Y","cargo_weight":1,"origin":"A","destination":"B"}, 2), 400)
test("复核员创建订单 → 被拒", req("POST", "/orders", {"customer":"X","cargo_name":"Y","cargo_weight":1,"origin":"A","destination":"B"}, 3), 400)
test("发起岗创建订单 → 成功", req("POST", "/orders", {"customer":"演示客户","cargo_name":"演示货物","cargo_weight":3.5,"origin":"北京朝阳","destination":"上海浦东"}, 1))

code, orders = req("GET", "/orders?status=draft", user_id=1)
draft_id = orders[0]["id"] if orders else None
print(f"\n    (使用草稿订单 id={draft_id} 继续测试)")

print("\n[2] 状态机非法跳转")
print("-" * 50)
test("草稿 → 直接归档(非法)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"reviewed","expected_version":1}, 1), 400)
test("草稿 → 直接签收(非法)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":1}, 1), 400)

print("\n[3] 证据缺失校验")
print("-" * 50)
test("无委托单 → 提交委托(被拒)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"entrusted","expected_version":1}, 1), 400)

req("POST", f"/orders/{draft_id}/evidences", {"evidence_type":"entrustment","file_name":"运输委托单_演示.pdf","file_ref":"/ev/demo_entrust.pdf","remark":"客户已签章"}, 1)
code, ord = req("GET", f"/orders/{draft_id}", user_id=1)
v = ord["version"]
test("有委托单 → 提交委托(成功)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"entrusted","expected_version":v}, 1))

code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
test("无调度单 → 调度确认(被拒)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"dispatched","expected_version":v}, 2), 400)

print("\n[4] 业务信息缺失校验")
print("-" * 50)
req("POST", f"/orders/{draft_id}/evidences", {"evidence_type":"dispatch","file_name":"车辆调度单_演示.pdf","file_ref":"/ev/demo_dispatch.pdf"}, 2)
code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
test("未填车牌司机 → 调度(被拒)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"dispatched","expected_version":v}, 2), 400)

req("PUT", f"/orders/{draft_id}", {"plate_number":"京A·TEST1","driver":"演示司机"}, 2)
code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
test("补全车牌司机 → 调度(成功)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"dispatched","expected_version":v}, 2))

code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
req("POST", f"/orders/{draft_id}/transition", {"target_status":"in_transit","expected_version":v}, 2)

req("POST", f"/orders/{draft_id}/evidences", {"evidence_type":"receipt","file_name":"签收回单_演示.jpg","file_ref":"/ev/demo_receipt.jpg"}, 2)
code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
test("未填签收人 → 签收(被拒)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":v}, 2), 400)

print("\n[5] 乐观锁版本冲突")
print("-" * 50)
code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
cur_v = ord["version"]
test("用过时版本号 v=1 → VERSION_CONFLICT", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":1}, 2), 400)

print("\n[6] 角色越权(岗位隔离)")
print("-" * 50)
test("复核岗尝试签收(越权)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":cur_v}, 3), 400)
test("发起岗尝试发车(越权)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":cur_v}, 1), 400)

req("PUT", f"/orders/{draft_id}", {"receiver":"演示签收人"}, 2)
code, ord = req("GET", f"/orders/{draft_id}", user_id=2)
v = ord["version"]
test("补全签收人后 → 签收(成功,办理岗)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"delivered","expected_version":v}, 2))

code, ord = req("GET", f"/orders/{draft_id}", user_id=3)
v = ord["version"]
test("办理员尝试归档(越权,应为复核岗)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"reviewed","expected_version":v}, 2), 400)
test("复核岗归档(成功)", req("POST", f"/orders/{draft_id}/transition", {"target_status":"reviewed","expected_version":v}, 3))

print("\n[7] 批量变更(部分成功 + 失败不吞)")
print("-" * 50)
code, all_orders = req("GET", "/orders", user_id=2)
test_ids = [o["id"] for o in all_orders[:4]]
print(f"    选择订单: {test_ids}")
code, batch = req("POST", "/batches", {"order_ids": test_ids, "target_status": "delivered", "change_type": "status_transition"}, 2)
if 200 <= code < 300:
    print(f"    创建批次: {batch.get('batch_no')}")
    code, result = req("POST", f"/batches/{batch['id']}/execute", user_id=2)
    if 200 <= code < 300:
        test(f"批量执行 → {result.get('status')} (成功:{result.get('success_count')} 失败:{result.get('failed_count')})", (code, result))
        failed_items = [i for i in result.get("items", []) if i.get("status") == "failed"]
        if failed_items:
            print("    失败明细(未被吞掉):")
            for it in failed_items[:3]:
                print(f"      · {it['order_no']}: {it.get('error_message','')}")

print("\n" + "=" * 60)
print("测试全部完成!")
print("=" * 60)
