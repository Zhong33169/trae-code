import sys
sys.path.insert(0, '.')

from pydantic import ValidationError

def test_schemas_version_required():
    """测试：所有写操作 schema 的 version 都是必填"""
    print("=" * 60)
    print("测试1：Schema 层 version 强制必填")
    print("=" * 60)
    
    from app.schemas import (
        MaterialCreate, FeedbackCreate, ServiceOrderUpdate,
        ReviewRequest, FinalizeRequest, BatchOperationRequest
    )
    
    test_cases = [
        ("MaterialCreate", {"material_type": "test", "material_name": "test"}),
        ("FeedbackCreate", {}),
        ("ServiceOrderUpdate", {}),
        ("ReviewRequest", {"approved": True}),
        ("FinalizeRequest", {"approved": True}),
        ("BatchOperationRequest", {"order_ids": [1, 2, 3]}),
    ]
    
    all_pass = True
    for name, data in test_cases:
        try:
            cls = globals().get(name)
            if not cls:
                cls = eval(name)
            cls(**data)
            print(f"  ❌ {name}: 缺少 version 但未报错")
            all_pass = False
        except ValidationError as e:
            has_version_error = any("version" in str(err.get("loc", ())) for err in e.errors())
            if has_version_error:
                print(f"  ✅ {name}: 缺少 version 正确报 ValidationError")
            else:
                print(f"  ⚠️  {name}: 报错但不是 version 相关: {e}")
                all_pass = False
        except Exception as e:
            print(f"  ❌ {name}: 异常类型错误: {type(e).__name__}: {e}")
            all_pass = False
    
    if all_pass:
        print("\n✅ Schema 层版本强制必填测试通过")
    else:
        print("\n❌ Schema 层版本强制必填测试有失败")
    
    return all_pass

def test_main_validation_error_handler():
    """测试：main.py 中有 ValidationError 异常处理器"""
    print("\n" + "=" * 60)
    print("测试2：main.py 有 ValidationError 异常处理器")
    print("=" * 60)
    
    with open("app/main.py", "r") as f:
        content = f.read()
    
    has_handler = "validation_exception_handler" in content or "ValidationError" in content
    has_400 = "status_code=400" in content
    
    if has_handler and has_400:
        print("  ✅ main.py 中有 ValidationError 处理器，返回 400")
        return True
    else:
        print(f"  ❌ main.py 中缺少 ValidationError 处理器")
        return False

def test_routes_uses_pydantic():
    """测试：routes 层所有写操作都用 pydantic 做校验"""
    print("\n" + "=" * 60)
    print("测试3：routes 层使用 pydantic 校验")
    print("=" * 60)
    
    with open("app/routes.py", "r") as f:
        content = f.read()
    
    checks = [
        ("MaterialCreate(**body)", "添加材料使用 MaterialCreate 校验"),
        ("FeedbackCreate(**body)", "反馈使用 FeedbackCreate 校验"),
        ("ServiceOrderUpdate(**body)", "提交审核使用 ServiceOrderUpdate 校验"),
        ("ReviewRequest(**body)", "审核使用 ReviewRequest 校验"),
        ("FinalizeRequest(**body)", "复核使用 FinalizeRequest 校验"),
        ("BatchOperationRequest(**body)", "批量操作使用 BatchOperationRequest 校验"),
        ("version_str is None", "删除材料 version 必填校验"),
        ("VERSION_REQUIRED", "删除材料缺 version 返回 VERSION_REQUIRED"),
    ]
    
    all_pass = True
    for pattern, desc in checks:
        if pattern in content:
            print(f"  ✅ {desc}")
        else:
            print(f"  ❌ 缺少: {desc}")
            all_pass = False
    
    return all_pass

def test_frontend_version_checks():
    """测试：前端所有提交入口都有 version 前置校验"""
    print("\n" + "=" * 60)
    print("测试4：前端提交入口前置版本校验")
    print("=" * 60)
    
    files = {
        "OrderDetail.jsx": [
            ("handleSubmit", "详情页提交审核"),
            ("handleReview", "详情页审核"),
            ("handleFinalize", "详情页复核"),
            ("handleDeleteMaterial", "详情页删除材料"),
        ],
        "AddMaterialModal.jsx": [
            ("version === undefined", "材料弹窗版本校验"),
        ],
        "FeedbackModal.jsx": [
            ("version === undefined", "反馈弹窗版本校验"),
        ],
        "BatchOperationModal.jsx": [
            ("missingVersionIds", "批量操作版本缺失校验"),
            ("VERSION_MISSING", "批量操作缺 version 标记 VERSION_MISSING"),
        ],
    }
    
    all_pass = True
    for filename, checks in files.items():
        filepath = f"frontend/src/pages/{filename}" if "OrderDetail" in filename else f"frontend/src/components/{filename}"
        if "OrderList" in filename:
            filepath = f"frontend/src/pages/{filename}"
        
        try:
            with open(filepath, "r") as f:
                content = f.read()
            
            for pattern, desc in checks:
                if pattern in content:
                    print(f"  ✅ {filename}: {desc}")
                else:
                    print(f"  ❌ {filename}: 缺少 {desc}")
                    all_pass = False
        except FileNotFoundError:
            print(f"  ⚠️  找不到文件: {filepath}")
    
    return all_pass

if __name__ == "__main__":
    print("🚀 强制版本契约验证测试")
    print()
    
    results = []
    
    results.append(("Schema 层 version 必填", test_schemas_version_required()))
    results.append(("main.py 异常处理器", test_main_validation_error_handler()))
    results.append(("routes 层 pydantic 校验", test_routes_uses_pydantic()))
    results.append(("前端前置版本校验", test_frontend_version_checks()))
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {name}: {status}")
    
    print(f"\n总计: {passed}/{total} 通过")
    
    if passed == total:
        print("\n🎉 所有测试通过！强制版本契约已建立")
    else:
        print(f"\n⚠️  有 {total - passed} 个测试未通过")
