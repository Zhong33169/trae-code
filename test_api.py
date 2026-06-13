import json
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8107/api"
SUPERVISOR_TOKEN = "mock_token_2_1781283009"
REGISTRAR_TOKEN = "mock_token_1_1781283009"
REVIEWER_TOKEN = "mock_token_3_1781283009"


def api_call(method, path, token=None, data=None):
    url = BASE_URL + path
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))


def test_supplement_v2():
    print("=" * 60)
    print("测试1: 退回补正 V2 - 按附件填写退回原因")
    print("=" * 60)
    
    status, data = api_call(
        'POST', '/orders/5/request-supplement',
        token=SUPERVISOR_TOKEN,
        data={
            "items": [
                {"required_attachment_id": 17, "reject_reason": "身份证扫描件模糊，姓名和身份证号无法辨认"},
                {"required_attachment_id": 19, "reject_reason": "健康证明已过期，请提供近3个月内的体检报告"}
            ],
            "remark": "请认真核对材料后重新提交"
        }
    )
    
    print(f"状态码: {status}")
    if status == 201 or status == 200:
        print(f"订单状态: {data.get('status')}")
        print(f"整体退回原因: {data.get('reject_reason')}")
        print()
        print("必需附件详情:")
        for req in data.get('required_attachments', []):
            print(f"  - {req['attachment_name']}: 已提供={req['is_provided']}")
            if req.get('reject_reason'):
                lines = [l for l in req['reject_reason'].split('\n') if l.strip()]
                print(f"    退回历史 ({len(lines)} 条):")
                for line in lines:
                    print(f"      {line}")
        print()
        print("审计日志 (最后2条):")
        for log in data.get('audit_logs', [])[-2:]:
            print(f"  - [{log['action']}] {log.get('operator_name')} ({log.get('operator_role')})")
            if log.get('remark'):
                print(f"    备注: {log['remark'][:60]}")
            if log.get('failure_reason'):
                print(f"    失败原因: {log['failure_reason'][:80]}")
    else:
        print(f"错误: {data}")
    print()


def test_permission_denied():
    print("=" * 60)
    print("测试2: 权限校验 - 登记员尝试审核通过（应该拒绝）")
    print("=" * 60)
    
    status, data = api_call(
        'POST', '/orders/6/approve',
        token=REGISTRAR_TOKEN,
        data={"remark": "测试"}
    )
    
    print(f"状态码: {status}")
    print(f"返回: {data.get('detail', data)}")
    print()


def test_status_validation():
    print("=" * 60)
    print("测试3: 状态机校验 - 已归档订单不能再审核（应该拒绝）")
    print("=" * 60)
    
    status, data = api_call(
        'POST', '/orders/1/approve',
        token=SUPERVISOR_TOKEN,
        data={"remark": "测试"}
    )
    
    print(f"状态码: {status}")
    print(f"返回: {data.get('detail', data)}")
    print()


def test_complete_flow():
    print("=" * 60)
    print("测试4: 完整端到端流程（钱小红补正重提→审核→再退回）")
    print("=" * 60)
    
    print("步骤1: 登记员上传健康证明")
    status, data = api_call(
        'POST', '/orders/2/attachments',
        token=REGISTRAR_TOKEN,
        data={
            "required_attachment_id": 7,
            "file_type": "health_cert",
            "file_name": "钱小红_健康证明_补正.pdf",
            "file_size": 200000
        }
    )
    print(f"  状态码: {status}")
    if status == 200 or status == 201:
        print(f"  附件上传成功")
    else:
        print(f"  错误: {data.get('detail', data)}")
        return
    
    print()
    print("步骤2: 登记员上传合同")
    status, data = api_call(
        'POST', '/orders/2/attachments',
        token=REGISTRAR_TOKEN,
        data={
            "required_attachment_id": 8,
            "file_type": "contract",
            "file_name": "钱小红_入会合同_补正.pdf",
            "file_size": 400000
        }
    )
    print(f"  状态码: {status}")
    order_data = data.get('order', data) if isinstance(data, dict) else None
    if status == 200 or status == 201:
        print(f"  附件上传成功")
    else:
        print(f"  错误: {data.get('detail', data)}")
        return
    
    print()
    print("步骤3: 登记员重新提交审核")
    status, data = api_call(
        'POST', '/orders/2/submit',
        token=REGISTRAR_TOKEN,
        data={"remark": "已补正全部附件，请重新审核"}
    )
    print(f"  状态码: {status}")
    if status == 200 or status == 201:
        print(f"  新状态: {data.get('status')}")
    else:
        print(f"  错误: {data.get('detail', data)}")
        return
    
    print()
    print("步骤4: 审核主管再次退回补正（按附件填原因，第2轮）")
    reqs = data.get('required_attachments', [])
    items = []
    for req in reqs:
        if not req['is_provided'] or req.get('reject_reason'):
            items.append({
                "required_attachment_id": req['id'],
                "reject_reason": f"第2次退回：{req['attachment_name']}仍需完善"
            })
    
    status, data = api_call(
        'POST', '/orders/2/request-supplement',
        token=SUPERVISOR_TOKEN,
        data={
            "items": items[:2],
            "remark": "第二次退回，请确保材料完整有效"
        }
    )
    print(f"  状态码: {status}")
    if status == 200 or status == 201:
        print(f"  新状态: {data.get('status')}")
        print()
        print("  附件退回历史累加结果:")
        for req in data.get('required_attachments', []):
            if req.get('reject_reason'):
                lines = [l for l in req['reject_reason'].split('\n') if l.strip()]
                print(f"    - {req['attachment_name']} ({len(lines)} 条历史):")
                for line in lines:
                    print(f"      {line}")
    else:
        print(f"  错误: {data.get('detail', data)}")
    
    print()


if __name__ == "__main__":
    test_supplement_v2()
    test_permission_denied()
    test_status_validation()
    test_complete_flow()
    print("=" * 60)
    print("所有测试完成！")
    print("=" * 60)
