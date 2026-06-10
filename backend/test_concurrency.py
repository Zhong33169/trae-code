import requests
import asyncio
import time

BASE_URL = "http://localhost:8012/api"

def login(username, password="123456"):
    res = requests.post(f"{BASE_URL}/auth/login", json={"username": username, "password": password})
    if res.status_code == 200:
        token = res.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    raise Exception(f"登录失败: {res.text}")

def test_concurrent_material_add():
    """测试：两个请求同时添加材料，应该只有一个成功，另一个返回 409"""
    print("=" * 60)
    print("测试1：并发添加材料（乐观锁冲突）")
    print("=" * 60)
    
    registrar_headers = login("registrar1")
    
    # 先创建一个新的草稿服务单
    students = requests.get(f"{BASE_URL}/students", headers=registrar_headers).json()
    courses = requests.get(f"{BASE_URL}/courses", headers=registrar_headers).json()
    
    res = requests.post(f"{BASE_URL}/orders", headers=registrar_headers, json={
        "student_id": students[0]["id"],
        "course_id": courses[0]["id"],
        "service_type": "drop_class",
        "reason": "并发测试"
    })
    order = res.json()
    order_id = order["id"]
    initial_version = order["version"]
    print(f"创建服务单: {order['order_no']}, 初始版本: v{initial_version}")
    
    # 获取当前详情
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    detail = res.json()
    current_version = detail["version"]
    print(f"当前版本: v{current_version}")
    
    # 第一个请求：用旧版本号添加材料（应该失败，因为版本可能变了？不，版本是对的）
    # 我们模拟：两个请求都用同一个 version 去提交
    
    print("\n--- 模拟两个并发请求，使用同一个 version ---")
    
    # 请求A
    res_a = requests.post(
        f"{BASE_URL}/orders/{order_id}/materials", 
        headers=registrar_headers,
        json={"material_type": "application", "material_name": "材料A（并发测试）", "version": current_version}
    )
    
    # 请求B（同样用相同的 version）
    res_b = requests.post(
        f"{BASE_URL}/orders/{order_id}/materials", 
        headers=registrar_headers,
        json={"material_type": "certificate", "material_name": "材料B（并发测试）", "version": current_version}
    )
    
    print(f"请求A状态: {res_a.status_code}")
    if res_a.status_code == 200:
        print(f"  ✅ 成功，版本: v{res_a.json()['version']}")
    else:
        print(f"  ❌ 失败: {res_a.json().get('detail')}")
    
    print(f"请求B状态: {res_b.status_code}")
    if res_b.status_code == 200:
        print(f"  ✅ 成功，版本: v{res_b.json()['version']}")
    else:
        print(f"  ❌ 失败: {res_b.json().get('detail')}")
    
    # 检查最终状态
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    final_detail = res.json()
    material_count = len(final_detail["materials"])
    print(f"\n最终版本: v{final_detail['version']}")
    print(f"材料数量: {material_count}")
    print(f"审计日志: {len(final_detail['audit_logs'])} 条")
    
    success_count = (1 if res_a.status_code == 200 else 0) + (1 if res_b.status_code == 200 else 0)
    if success_count == 1 and material_count == 1 and (res_a.status_code == 409 or res_b.status_code == 409):
        print("\n✅ 并发控制测试通过：只有一个请求成功，另一个返回 409 冲突")
        return True
    else:
        print(f"\n❌ 测试失败：成功了 {success_count} 个请求，材料有 {material_count} 份")
        return False

def test_concurrent_submit():
    """测试：并发提交审核"""
    print("\n" + "=" * 60)
    print("测试2：并发提交审核")
    print("=" * 60)
    
    registrar_headers = login("registrar1")
    
    # 创建草稿并补齐材料
    students = requests.get(f"{BASE_URL}/students", headers=registrar_headers).json()
    courses = requests.get(f"{BASE_URL}/courses", headers=registrar_headers).json()
    
    res = requests.post(f"{BASE_URL}/orders", headers=registrar_headers, json={
        "student_id": students[0]["id"],
        "course_id": courses[0]["id"],
        "service_type": "drop_class",
        "reason": "并发提交测试"
    })
    order = res.json()
    order_id = order["id"]
    
    # 补齐退课必需材料：退课申请单、缴费凭证、学员档案
    materials_to_add = [
        {"material_type": "application", "material_name": "退课申请单"},
        {"material_type": "certificate", "material_name": "缴费凭证"},
        {"material_type": "student_file", "material_name": "学员档案"},
    ]
    for mat in materials_to_add:
        requests.post(f"{BASE_URL}/orders/{order_id}/materials", headers=registrar_headers, json=mat)
    
    # 获取当前版本
    res = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
    detail = res.json()
    current_version = detail["version"]
    print(f"服务单版本: v{current_version}, 材料齐全: {detail['material_complete']}")
    
    # 两个并发提交请求
    print("\n--- 两个并发提交请求，使用同一个 version ---")
    
    res_a = requests.post(
        f"{BASE_URL}/orders/{order_id}/submit",
        headers=registrar_headers,
        json={"opinion": "提交A", "version": current_version}
    )
    
    res_b = requests.post(
        f"{BASE_URL}/orders/{order_id}/submit",
        headers=registrar_headers,
        json={"opinion": "提交B", "version": current_version}
    )
    
    print(f"请求A状态: {res_a.status_code}")
    if res_a.status_code == 200:
        print(f"  ✅ 成功，状态: {res_a.json()['status']}, 版本: v{res_a.json()['version']}")
    else:
        print(f"  ❌ 失败: {res_a.json().get('detail')}")
    
    print(f"请求B状态: {res_b.status_code}")
    if res_b.status_code == 200:
        print(f"  ✅ 成功，状态: {res_b.json()['status']}, 版本: v{res_b.json()['version']}")
    else:
        print(f"  ❌ 失败: {res_b.json().get('detail')}")
    
    success_count = (1 if res_a.status_code == 200 else 0) + (1 if res_b.status_code == 200 else 0)
    if success_count == 1 and (res_a.status_code == 409 or res_b.status_code == 409):
        print("\n✅ 并发提交测试通过：只有一个提交成功")
        return True
    else:
        print(f"\n❌ 测试失败：成功了 {success_count} 个请求")
        return False

def test_old_version_fails():
    """测试：用旧版本号提交操作，应该返回 409"""
    print("\n" + "=" * 60)
    print("测试3：使用旧版本号提交应该失败")
    print("=" * 60)
    
    registrar_headers = login("registrar1")
    
    # 创建服务单
    students = requests.get(f"{BASE_URL}/students", headers=registrar_headers).json()
    courses = requests.get(f"{BASE_URL}/courses", headers=registrar_headers).json()
    
    res = requests.post(f"{BASE_URL}/orders", headers=registrar_headers, json={
        "student_id": students[0]["id"],
        "course_id": courses[0]["id"],
        "service_type": "drop_class",
        "reason": "旧版本测试"
    })
    order = res.json()
    order_id = order["id"]
    initial_version = order["version"]
    print(f"创建时版本: v{initial_version}")
    
    # 添加一份材料（版本+1）
    res = requests.post(
        f"{BASE_URL}/orders/{order_id}/materials",
        headers=registrar_headers,
        json={"material_type": "application", "material_name": "申请单1"}
    )
    detail = res.json()
    v_after_add = detail["version"]
    print(f"添加材料后版本: v{v_after_add}")
    
    # 用旧版本号（initial_version）再添加材料，应该失败
    print(f"\n尝试用 v{initial_version} 添加材料（实际版本是 v{v_after_add}）...")
    res = requests.post(
        f"{BASE_URL}/orders/{order_id}/materials",
        headers=registrar_headers,
        json={"material_type": "certificate", "material_name": "应该失败的材料", "version": initial_version}
    )
    
    if res.status_code == 409:
        print(f"✅ 正确返回 409 冲突: {res.json().get('detail')}")
        # 验证材料没有被添加
        res2 = requests.get(f"{BASE_URL}/orders/{order_id}", headers=registrar_headers)
        final = res2.json()
        mat_count = len(final["materials"])
        print(f"材料数量: {mat_count}（应该是1）")
        if mat_count == 1:
            print("✅ 冲突时没有写入材料，数据一致")
            return True
    else:
        print(f"❌ 预期 409，实际返回 {res.status_code}")
        return False
    
    return False

def test_batch_with_versions():
    """测试：批量操作携带 version，冲突的被标记为失败"""
    print("\n" + "=" * 60)
    print("测试4：批量操作 - 版本冲突的标记为失败")
    print("=" * 60)
    
    registrar_headers = login("registrar1")
    reviewer_headers = login("reviewer1")
    
    students = requests.get(f"{BASE_URL}/students", headers=registrar_headers).json()
    courses = requests.get(f"{BASE_URL}/courses", headers=registrar_headers).json()
    
    # 创建 3 个待审核的服务单
    print("准备 3 个待审核服务单...")
    pending_orders = []
    for i in range(3):
        res = requests.post(f"{BASE_URL}/orders", headers=registrar_headers, json={
            "student_id": students[i % len(students)]["id"],
            "course_id": courses[i % len(courses)]["id"],
            "service_type": "drop_class",
            "reason": f"批量测试-{i+1}"
        })
        order_id = res.json()["id"]
        
        # 补齐材料
        materials_to_add = [
            {"material_type": "application", "material_name": "退课申请单"},
            {"material_type": "certificate", "material_name": "缴费凭证"},
            {"material_type": "student_file", "material_name": "学员档案"},
        ]
        for mat in materials_to_add:
            requests.post(f"{BASE_URL}/orders/{order_id}/materials", 
                         headers=registrar_headers, json=mat)
        
        # 提交审核
        res = requests.post(f"{BASE_URL}/orders/{order_id}/submit",
                           headers=registrar_headers, json={"opinion": "请审核"})
        if res.status_code == 200:
            pending_orders.append(res.json())
            print(f"  - 已创建并提交: {res.json()['order_no']} (v{res.json()['version']})")
    
    if len(pending_orders) < 2:
        print("⚠️  待审核单据不足，跳过批量测试")
        return None
    
    order_ids = [o["id"] for o in pending_orders[:3]]
    versions = {}
    
    # 故意把第一个的 version 改旧（减1），模拟版本冲突
    versions[str(order_ids[0])] = pending_orders[0]["version"] - 1 if pending_orders[0]["version"] > 0 else 0
    versions[str(order_ids[1])] = pending_orders[1]["version"]
    if len(pending_orders) >= 3:
        versions[str(order_ids[2])] = pending_orders[2]["version"]
    
    print(f"\n批量处理 {len(order_ids)} 条服务单")
    print(f"  其中 ID={order_ids[0]} 使用旧版本 v{versions[str(order_ids[0])]}（实际 v{pending_orders[0]['version']}）")
    
    res = requests.post(
        f"{BASE_URL}/orders/batch/review",
        headers=reviewer_headers,
        json={
            "order_ids": order_ids,
            "versions": versions,
            "approved": True,
            "opinion": "批量审核测试"
        }
    )
    
    result = res.json()
    print(f"\n结果:")
    print(f"  成功: {len(result.get('success', []))} 条")
    print(f"  跳过: {len(result.get('skipped', []))} 条")
    print(f"  失败: {len(result.get('failed', []))} 条")
    
    if result.get("failed"):
        for f in result["failed"]:
            print(f"    - ID {f['id']}: {f.get('error_code')} - {f.get('error')[:80]}...")
    
    if result.get("skipped"):
        for s in result["skipped"]:
            print(f"    - ID {s['id']}: {s.get('error')[:50]}...")
    
    # 检查第一个是否因为版本冲突失败
    first_failed = any(f["id"] == order_ids[0] and f.get("error_code") == "VERSION_CONFLICT" 
                       for f in result.get("failed", []))
    
    if first_failed:
        print("\n✅ 批量版本冲突测试通过：版本旧的被标记为 VERSION_CONFLICT 失败")
        return True
    else:
        print("\n❌ 批量版本冲突测试未按预期工作")
        return False

if __name__ == "__main__":
    print("🚀 乐观并发控制全链路测试")
    print()
    
    results = []
    
    try:
        results.append(("并发添加材料", test_concurrent_material_add()))
    except Exception as e:
        print(f"测试出错: {e}")
        results.append(("并发添加材料", False))
        import traceback
        traceback.print_exc()
    
    try:
        results.append(("并发提交审核", test_concurrent_submit()))
    except Exception as e:
        print(f"测试出错: {e}")
        results.append(("并发提交审核", False))
    
    try:
        results.append(("旧版本号失败", test_old_version_fails()))
    except Exception as e:
        print(f"测试出错: {e}")
        results.append(("旧版本号失败", False))
    
    try:
        results.append(("批量版本冲突", test_batch_with_versions()))
    except Exception as e:
        print(f"测试出错: {e}")
        results.append(("批量版本冲突", False))
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        if result is None:
            status = "⚠️  跳过"
        print(f"  {name}: {status}")
    
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！乐观并发控制工作正常")
    else:
        print(f"\n⚠️  有 {total - passed} 个测试未通过")
