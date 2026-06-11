import requests

BASE = 'http://localhost:8003/api'
H_INITIATOR = {'X-User-Id': '1'}
H_HANDLER = {'X-User-Id': '2'}
H_REVIEWER = {'X-User-Id': '3'}

def print_test(name, r):
    print(f'\n[测试] {name}: {r.status_code}')
    if r.status_code >= 400:
        detail = r.json().get('detail', r.text)
        if isinstance(detail, dict):
            print(f'  错误码: {detail.get("error", "?")}')
            print(f'  消息: {detail.get("message", "?")}')
        else:
            print(f'  错误: {detail}')
    else:
        data = r.json()
        if isinstance(data, dict) and 'status' in data:
            print(f'  状态: {data.get("status")}, 版本: v{data.get("version")}')

r = requests.get(f'{BASE}/orders', headers=H_INITIATOR)
orders = r.json()
print(f'订单总数: {len(orders)}')
for o in orders:
    print(f'  {o["order_no"]} - {o["status"]} - v{o["version"]} - {o["customer"]}')

draft_orders = [o for o in orders if o['status'] == 'draft']
entrusted_orders = [o for o in orders if o['status'] == 'entrusted']
delivered_orders = [o for o in orders if o['status'] == 'delivered']
rejected_orders = [o for o in orders if o['status'] == 'rejected']

print(f'\n状态分布: draft={len(draft_orders)}, entrusted={len(entrusted_orders)}, delivered={len(delivered_orders)}, rejected={len(rejected_orders)}')

if draft_orders:
    oid = draft_orders[0]['id']
    r = requests.post(f'{BASE}/orders/{oid}/evidences', headers=H_HANDLER, json={
        'evidence_type': 'entrustment',
        'file_name': '测试委托单.pdf',
        'file_ref': '/test/test.pdf'
    })
    print_test('办理岗上传委托单（应失败-角色错误）', r)

if draft_orders:
    oid = draft_orders[0]['id']
    r = requests.post(f'{BASE}/orders/{oid}/evidence', headers=H_INITIATOR, json={
        'evidence_type': 'dispatch',
        'file_name': '测试调度单.pdf',
        'file_ref': '/test/dispatch.pdf'
    })
    print_test('发起岗上传调度单（应失败-角色错误）', r)

if entrusted_orders:
    oid = entrusted_orders[0]['id']
    r = requests.post(f'{BASE}/orders/{oid}/evidence', headers=H_INITIATOR, json={
        'evidence_type': 'receipt',
        'file_name': '测试回单.pdf',
        'file_ref': '/test/receipt.pdf'
    })
    print_test('发起岗在已委托状态上传回单（应失败-角色+状态错误）', r)

if draft_orders:
    oid = draft_orders[0]['id']
    r = requests.put(f'{BASE}/orders/{oid}', headers=H_INITIATOR, json={
        'plate_number': '京A88888',
        'driver': '测试司机'
    })
    print_test('发起岗在草稿状态修改车牌/司机（应成功）', r)

if entrusted_orders:
    oid = entrusted_orders[0]['id']
    r = requests.put(f'{BASE}/orders/{oid}', headers=H_INITIATOR, json={
        'plate_number': '京B99999'
    })
    print_test('发起岗在已委托状态修改车牌（应失败-状态不允许）', r)

if delivered_orders:
    oid = delivered_orders[0]['id']
    ver = delivered_orders[0]['version']
    r = requests.post(f'{BASE}/orders/{oid}/transition', headers=H_REVIEWER, json={
        'target_status': 'rejected',
        'expected_version': ver,
        'remark': '测试驳回：回单信息不全，请补充签收人身份证号'
    })
    print_test('复核岗驳回已签收订单（应成功）', r)
    if r.status_code == 200:
        data = r.json()
        print(f'  驳回原因: {data.get("rejected_reason", "无")}')

r2 = requests.get(f'{BASE}/orders', headers=H_INITIATOR)
orders2 = r2.json()
rejected_count = len([o for o in orders2 if o['status'] == 'rejected'])
print(f'\n驳回后，驳回状态订单数: {rejected_count}')

r = requests.get(f'{BASE}/batches', headers=H_HANDLER)
batches = r.json()
print(f'\n批次总数: {len(batches)}')
for b in batches:
    print(f'  {b["batch_no"]} - {b["status"]} - 成功{b["success_count"]}/失败{b["failed_count"]}/共{b["total_count"]}')
    if b.get('items'):
        for item in b['items'][:2]:
            print(f'    - {item["order_no"]}: {item["status"]} {item.get("error_message", "")}')
