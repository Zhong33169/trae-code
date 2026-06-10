import requests
import json

BASE_URL = "http://localhost:8011/api"

def login(username, password="123456"):
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    if res.status_code == 200:
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    raise Exception(f"登录失败: {res.text}")

def test_full_flow():
    print("=" * 60)
    print("课程服务单完整链路测试：补正 → 提交 → 审核 → 反馈 → 复核归档")
    print("=" * 60)
    
    # 1. 登记员登录
    print("\n【1/7】登记员登录 (registrar1)")
    registrar_headers = login("registrar1")
    print("✅ 登记员登录成功")
    
    # 2. 获取列表，检查是否有时限和材料状态
    print("\n【2/7】获取服务单列表（检查时限和材料状态字段）")
    res = requests.get(f"{BASE_URL}/orders", headers=registrar_headers, params={"page_size": 5})
    data = res.json()
    print(f"✅ 获取成功，共 {data['total']} 条")
    if data["items"]:
        order = data["items"][0]
        print(f"   服务单: {order['order_no']}")
        print(f"   材料状态: {'齐全' if order.get('material_complete') else '不完整'}")
        print(f"   时限信息: {order.get('time_info', {})}")
    
    # 3. 找一个草稿状态的服务单，或者创建一个新的
    print("\n【3/7】获取草稿状态的服务单详情")
    draft_orders = [o for o in data["items"] if o["status"] == "draft"]
    if not draft_orders:
        print("⚠️  没有草稿，创建一个新服务单...")
        # 获取学员和课程
        students = requests.get(f"{BASE_URL}/students", headers=registrar_headers).json()
        courses = requests.get(f"{BASE_URL}/courses", headers=registrar_headers).json()
        schedules = requests.get(f"{BASE_URL}/schedules", headers=registrar_headers).json()
        
        res = requests.post(f"{BASE_URL}/orders", headers=registrar_headers, json={
            "student_id": students[0]["id"],
            "course_id": courses[0]["id"],
            "schedule_id": schedules[0]["id"] if schedules else None,
            "service_type": "makeup_class",
            "reason": "测试补正流程"
        })
        new_order = res.json()
        order_id = new_order["id"]
        print(f"✅ 创建成功: {new_order['order_no']}")
    else:
        order_id = draft_orders[0]["id"]
        print(f"   使用已有草稿: {draft_orders[0]['order_no']}")
    
    # 4. 获取详情
    print("\n【4/7】获取服务单详情（检查完整字段）")
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    order_detail = res.json()
    print(f"   状态: {order_detail['status']}")
    print(f"   材料齐全: {order_detail.get('material_complete')}")
    print(f"   缺失材料: {order_detail.get('missing_materials', [])}")
    print(f"   时限信息: {order_detail.get('time_info', {})}")
    print(f"   版本号: v{order_detail['version']}")
    
    # 5. 材料补正 - 添加材料
    print("\n【5/7】材料补正 - 添加材料")
    materials_to_add = [
        {"material_type": "application", "material_name": "补课申请单"},
        {"material_type": "certificate", "material_name": "家长签字证明"},
        {"material_type": "schedule", "material_name": "补课排班表"},
    ]
    for mat in materials_to_add:
        res = requests.post(f"{BASE_URL}/orders/{order_id}/materials", headers=registrar_headers, json=mat)
        if res.status_code == 200:
            updated = res.json()
            print(f"   ✅ 添加: {mat['material_name']}")
            print(f"      版本号: v{updated['version']} (递增)")
        else:
            print(f"   ❌ 添加失败: {res.json().get('detail')}")
    
    # 重新获取详情
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    order_detail = res.json()
    print(f"\n   补正后状态:")
    print(f"   - 材料数量: {len(order_detail['materials'])}")
    print(f"   - 材料齐全: {order_detail['material_complete']}")
    print(f"   - 缺失材料: {order_detail.get('missing_materials', [])}")
    
    # 6. 提交审核
    print("\n【6/7】提交审核")
    if not order_detail["material_complete"]:
        print("⚠️  材料不全，尝试提交（应该失败）...")
        res = requests.post(f"{BASE_URL}/orders/{order_id}/submit", headers=registrar_headers, 
                          json={"opinion": "请审核", "materials": []})
        print(f"   结果: {res.status_code} - {res.json().get('detail')}")
    else:
        print("✅ 材料齐全，可以提交")
    
    # 再添加缺失的材料
    if order_detail.get("missing_materials"):
        print("\n   继续补正材料...")
        for missing in order_detail["missing_materials"]:
            type_map = {"申请单": "application", "证明材料": "certificate", 
                       "排班信息": "schedule", "记录凭证": "record", "其他材料": "other"}
            mat_type = "other"
            for k, v in type_map.items():
                if k in missing:
                    mat_type = v
                    break
            res = requests.post(f"{BASE_URL}/orders/{order_id}/materials", headers=registrar_headers, 
                              json={"material_type": mat_type, "material_name": missing})
            if res.status_code == 200:
                print(f"   ✅ 补正: {missing}")
    
    # 再次检查
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    order_detail = res.json()
    print(f"\n   最终材料状态: 齐全={order_detail['material_complete']}")
    
    if order_detail["material_complete"]:
        print("\n   提交审核...")
        res = requests.post(f"{BASE_URL}/orders/{order_id}/submit", headers=registrar_headers,
                          json={"opinion": "材料已补正完成，请审核", "materials": []})
        if res.status_code == 200:
            submitted = res.json()
            print(f"   ✅ 提交成功，状态: {submitted['status']}")
            print(f"      版本号: v{submitted['version']}")
        else:
            print(f"   ❌ 提交失败: {res.status_code} - {res.json().get('detail')}")
    
    # 7. 审核员审核
    print("\n【7/7】审核员审核")
    reviewer_headers = login("reviewer1")
    print("   ✅ 审核员登录成功")
    
    # 获取待审核列表
    res = requests.get(f"{BASE_URL}/orders", headers=reviewer_headers, params={"status": "pending_review"})
    pending = res.json()
    print(f"   待审核数量: {pending['total']}")
    
    # 审核通过
    print(f"\n   审核服务单 #{order_id}...")
    res = requests.post(f"{BASE_URL}/orders/{order_id}/review", headers=reviewer_headers,
                       json={"approved": True, "opinion": "材料齐全，同意审核通过"})
    if res.status_code == 200:
        reviewed = res.json()
        print(f"   ✅ 审核通过，状态: {reviewed['status']}")
        print(f"      版本号: v{reviewed['version']}")
    else:
        print(f"   ❌ 审核失败: {res.status_code} - {res.json().get('detail')}")
    
    # 8. 添加课后反馈（补课类型需要）
    print("\n【8/7】添加课后反馈")
    if reviewed["status"] == "pending_finalize":
        finalizer_headers = login("finalizer1")
        
        res = requests.post(f"{BASE_URL}/orders/{order_id}/feedback", headers=finalizer_headers, json={
            "attendance": "attended",
            "performance": "课堂表现良好，积极参与互动",
            "homework": "按时完成作业，质量较高",
            "teacher_comment": "学生学习态度认真，建议继续保持"
        })
        if res.status_code == 200:
            feedback_order = res.json()
            print("   ✅ 反馈提交成功")
            print(f"      反馈人: {feedback_order['feedback']['feedback_by']}")
            print(f"      出勤: {feedback_order['feedback']['attendance']}")
        else:
            print(f"   ❌ 反馈失败: {res.status_code} - {res.json().get('detail')}")
    
    # 9. 复核归档
    print("\n【9/7】复核归档")
    finalizer_headers = login("finalizer1")
    
    res = requests.post(f"{BASE_URL}/orders/{order_id}/finalize", headers=finalizer_headers,
                       json={"approved": True, "opinion": "符合要求，同意归档"})
    if res.status_code == 200:
        finalized = res.json()
        print(f"   ✅ 复核归档成功，状态: {finalized['status']}")
        print(f"      版本号: v{finalized['version']}")
        print(f"      归档人: {finalized['finalizer_by']}")
    else:
        print(f"   ❌ 复核失败: {res.status_code} - {res.json().get('detail')}")
    
    # 10. 验证最终状态
    print("\n【10/7】验证最终状态")
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=finalizer_headers)
    final_order = res.json()
    print(f"   服务单: {final_order['order_no']}")
    print(f"   最终状态: {final_order['status']}")
    print(f"   材料数: {len(final_order['materials'])}")
    print(f"   有反馈: {final_order.get('feedback') is not None}")
    print(f"   审计日志: {len(final_order['audit_logs'])} 条")
    print(f"   最终版本: v{final_order['version']}")
    
    print("\n" + "=" * 60)
    if final_order["status"] == "completed":
        print("🎉 完整业务链路测试通过！")
    else:
        print("⚠️  测试部分完成，请检查状态")
    print("=" * 60)
    
    # 打印审计日志
    print("\n📜 审计日志时间线:")
    for log in final_order["audit_logs"]:
        print(f"   [{log['created_at']}] {log['action']} - {log['operator']} ({log['operator_role']})")
        if log.get("remark"):
            print(f"      备注: {log['remark']}")

if __name__ == "__main__":
    try:
        test_full_flow()
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
