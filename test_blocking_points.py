#!/usr/bin/env python3
import requests
import json

BASE = 'http://localhost:8000/api'

s = requests.Session()

def login(username, password):
    r = s.post(f'{BASE}/login', json={'username': username, 'password': password})
    assert r.status_code == 200, f'login failed {username}: {r.text}'
    body = r.json()
    token = body['data']['token']
    s.headers['Authorization'] = f'Bearer {token}'
    u = body['data']['user']
    return u

def dump(title, r):
    print(f'\n=== {title} ===')
    print(f'Status: {r.status_code}')
    try:
        data = r.json()
        if 'message' in data:
            print(f'Message: {data["message"]}')
        print(json.dumps(data, ensure_ascii=False, indent=2)[:1500])
    except:
        print(r.text[:500])
    return r.status_code

def get_app_list():
    r = s.get(f'{BASE}/applications')
    return r.json()['data']['items']

def get_app_detail(app_id):
    r = s.get(f'{BASE}/applications/{app_id}')
    return r.json()['data']

def upload_att(app_id, filename, category='签约资料', content=b'test content'):
    files = {'file': (filename, content, 'text/plain')}
    data = {'applicationId': str(app_id), 'category': category}
    return s.post(f'{BASE}/attachments/upload', files=files, data=data)

def delete_att(att_id):
    return s.delete(f'{BASE}/attachments/{att_id}')

def submit_app(app_id, remark='', overdue_reason='', follow_up=''):
    body = {}
    if remark: body['remark'] = remark
    if overdue_reason: body['overdueReason'] = overdue_reason
    if follow_up: body['followUpAction'] = follow_up
    return s.post(f'{BASE}/applications/{app_id}/submit', json=body)

def review_app(app_id, action='approve', result='审核通过', overdue_reason='', follow_up=''):
    body = {'action': action, 'reviewResult': result}
    if overdue_reason: body['overdueReason'] = overdue_reason
    if follow_up: body['followUpAction'] = follow_up
    return s.post(f'{BASE}/applications/{app_id}/review', json=body)

def confirm_room(app_id, result='房态正常', overdue_reason='', follow_up=''):
    body = {'action': 'confirm', 'confirmResult': result}
    if overdue_reason: body['overdueReason'] = overdue_reason
    if follow_up: body['followUpAction'] = follow_up
    return s.post(f'{BASE}/applications/{app_id}/room-confirm', json=body)

def handover(app_id, result='已完成交接', overdue_reason='', follow_up=''):
    body = {'action': 'complete', 'handoverResult': result}
    if overdue_reason: body['overdueReason'] = overdue_reason
    if follow_up: body['followUpAction'] = follow_up
    return s.post(f'{BASE}/applications/{app_id}/handover', json=body)

def archive(app_id, remark='', overdue_reason='', follow_up=''):
    body = {'action': 'archive', 'remark': remark}
    if overdue_reason: body['overdueReason'] = overdue_reason
    if follow_up: body['followUpAction'] = follow_up
    return s.post(f'{BASE}/applications/{app_id}/archive', json=body)

def logout():
    s.post(f'{BASE}/logout')

PASS = 0
FAIL = 0
def check(name, cond, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'✅ PASS: {name}')
    else:
        FAIL += 1
        print(f'❌ FAIL: {name} {detail}')

def create_app(tenant='测试租客'):
    import time
    suffix = int(time.time() * 1000) % 1000000
    body = {
        'tenantName': f'{tenant}_{suffix}',
        'tenantIdCard': f'110101199{suffix % 10}0101{suffix % 10000:04d}'[:18],
        'tenantPhone': f'139{10000000+suffix}'[:11],
        'apartmentName': '测试公寓',
        'roomNo': f'T-{suffix}',
        'monthlyRent': 3000 + (suffix % 2000),
        'leaseStartDate': '2026-07-01',
        'leaseEndDate': '2027-06-30',
        'monthlyIncome': 8000,
        'companyName': '某科技公司',
    }
    r = s.post(f'{BASE}/applications', json=body)
    assert r.status_code == 200, f'create app failed: {r.text}'
    return r.json()['data']

print('='*60)
print('PART 0: 创建测试数据')
print('='*60)

# registrar1 登录
u1 = login('registrar1', '123456')
print(f'registrar1: {u1["realName"]} id={u1["id"]}')
my_draft = create_app('本人草稿租客')
print(f'  创建本人草稿: id={my_draft["id"]} no={my_draft["applicationNo"]}')

another_draft = create_app('本人草稿租客2')
print(f'  创建本人草稿2: id={another_draft["id"]} no={another_draft["applicationNo"]}')

# 把本人 draft2 提交至审核
r = submit_app(another_draft['id'], '提交测试')
dump('提交草稿2至审核', r)
pending_review = {'id': another_draft['id']}

# 回到 registrar1
login('registrar1', '123456')

# 创建一条用于模拟他人草稿的申请，之后用 SQLite 修改 created_by
simulated_other = create_app('模拟他人租客')
print(f'  创建模拟草稿 (将改归属): id={simulated_other["id"]}')

# 用 SQLite 修改 created_by 模拟他人
import sqlite3
db_path = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/app.db'
conn = sqlite3.connect(db_path)
cur = conn.cursor()
# 把 simulated_other 的 created_by 改成 999（不存在的用户），模拟他人归属
cur.execute('UPDATE lease_applications SET created_by = 999, created_by_name = "其他登记员" WHERE id = ?', (simulated_other['id'],))
print(f'  修改 simulated_other id={simulated_other["id"]} 的 created_by: 1 -> 999, {cur.rowcount} 行受影响')
conn.commit()
conn.close()

others_draft = {'id': simulated_other['id']}

apps = get_app_list()
print(f'\nregistrar1 列表共 {len(apps)} 条:')
for a in apps:
    print(f'  id={a["id"]} no={a["applicationNo"]} status={a["status"]} createdBy={a.get("createdBy")} tenant={a["tenantName"]}')

# 找出各种状态
room_confirmed = None
for a in apps:
    if a['status'] == 'room_confirmed':
        room_confirmed = a
        break

# 从 registrar2 创建的 others_draft 不属于 registrar1
# pending_review 就是 another_draft
# my_draft 是本人 draft
# others_draft 是他人 id=registrar2 创建的

print()
print('='*60)
print('PART 1: 附件权限测试')
print('='*60)

# 场景 1: registrar1 上传本人草稿附件 → 应该成功
print('\n--- Scenario 1: registrar1 上传本人草稿附件 → 成功 ---')
r = upload_att(my_draft['id'], 'contract.pdf')
s1 = dump('上传本人草稿附件', r)
check('上传本人草稿附件成功', s1 == 200, f'status={s1} msg={r.json().get("message","")}')
my_att_id = None
if s1 == 200:
    my_att_id = r.json()['data']['id']
    print(f'  附件 id = {my_att_id}')

# 场景 2: registrar1 删除本人草稿附件 → 应该成功
print('\n--- Scenario 2: registrar1 删除本人草稿附件 → 成功 ---')
if my_att_id:
    r = delete_att(my_att_id)
    s2 = dump('删除本人草稿附件', r)
    check('删除本人草稿附件成功', s2 == 200, f'status={s2} msg={r.json().get("message","")}')

# 场景 3: registrar1 上传他人草稿附件 → 应该失败 (非本人)
print('\n--- Scenario 3: registrar1 上传他人草稿附件 → 失败 ---')
if others_draft:
    r = upload_att(others_draft['id'], 'other.pdf')
    s3 = dump('上传他人草稿附件', r)
    check('上传他人草稿附件失败(403)', s3 == 403, f'status={s3} msg={r.json().get("message","")}')

# 场景 4: registrar1 上传 pending_review 状态 → 应该失败 (状态不允许)
print('\n--- Scenario 4: registrar1 上传待审核状态附件 → 失败 ---')
if pending_review:
    r = upload_att(pending_review['id'], 'pending.pdf')
    s4 = dump('registrar 上传待审核附件', r)
    check('registrar上传待审核附件失败(403)', s4 == 403, f'status={s4} msg={r.json().get("message","")}')

logout()

# 场景 5: auditor1 在 pending_review 状态上传 → 成功
print('\n--- auditor1 登录 (审核主管王五) ---')
u = login('auditor1', '123456')
print(f'User: {u["realName"]} role={u["roleName"]} id={u["id"]}')
apps = get_app_list()
pending_review = None
draft_app = None
room_confirmed = None
for a in apps:
    if a['status'] == 'pending_review' and pending_review is None:
        pending_review = a
    if a['status'] == 'draft' and draft_app is None:
        draft_app = a
    if a['status'] == 'room_confirmed' and room_confirmed is None:
        room_confirmed = a

if pending_review:
    print(f'\n--- Scenario 5: auditor1 在 pending_review 状态上传附件 → 成功 ---')
    r = upload_att(pending_review['id'], 'review-doc.pdf')
    s5 = dump('auditor上传待审核附件', r)
    check('auditor在待审核状态上传成功', s5 == 200, f'status={s5} msg={r.json().get("message","")}')
    aud_att_id = None
    if s5 == 200:
        aud_att_id = r.json()['data']['id']

    if aud_att_id:
        r = delete_att(aud_att_id)
        s5d = dump('auditor删除待审核附件', r)
        check('auditor删除待审核附件成功', s5d == 200, f'status={s5d} msg={r.json().get("message","")}')

# 场景 6: auditor1 在 draft 状态上传 → 应该失败 (状态不允许)
if draft_app:
    print(f'\n--- Scenario 6: auditor1 在 draft 状态上传 → 失败 ---')
    r = upload_att(draft_app['id'], 'draft-for-auditor.pdf')
    s6 = dump('auditor 上传草稿状态附件', r)
    check('auditor上传草稿附件失败(403)', s6 == 403, f'status={s6} msg={r.json().get("message","")}')

logout()

# 场景 7: reviewer1 在 room_confirmed 状态上传 → 成功
print('\n--- reviewer1 登录 (复核负责人赵七) ---')
u = login('reviewer1', '123456')
print(f'User: {u["realName"]} role={u["roleName"]} id={u["id"]}')

if room_confirmed:
    print(f'\n--- Scenario 7: reviewer1 在 room_confirmed 状态上传 → 成功 ---')
    r = upload_att(room_confirmed['id'], 'archive-supplement.pdf')
    s7 = dump('reviewer上传待复核附件', r)
    check('reviewer上传待复核附件成功', s7 == 200, f'status={s7} msg={r.json().get("message","")}')
    rev_att_id = None
    if s7 == 200:
        rev_att_id = r.json()['data']['id']
    if rev_att_id:
        r = delete_att(rev_att_id)
        check('reviewer删除待复核附件成功', r.status_code == 200, f'status={r.status_code} msg={r.json().get("message","")}')

# 场景 8: reviewer1 在 pending_review 状态上传 → 失败
if pending_review:
    print(f'\n--- Scenario 8: reviewer1 在 pending_review 上传 → 失败 ---')
    r = upload_att(pending_review['id'], 'wrong-state.pdf')
    s8 = dump('reviewer上传待审核附件', r)
    check('reviewer上传待审核附件失败(403)', s8 == 403, f'status={s8} msg={r.json().get("message","")}')

logout()

print(f'\n📊 附件权限测试结果: PASS={PASS} FAIL={FAIL}')

print()
print('='*60)
print('PART 2: 超时推进拦截 & 补录测试')
print('='*60)

# 需要先把某节点标记为 is_overdue=1，然后测试
# 为了不破坏现有数据，使用 registrar1 创建一个全新申请，提交到审核，然后直接在数据库改状态
# 或者：直接找到一个 pending_review 申请，在 node_timelines 把 review 节点标为超时
# 为了简单，我们直接用现有的接口配合数据库修改

# 用 auditor1 账号找一个 pending_review 申请
login('auditor1', '123456')
apps = get_app_list()
test_app = None
for a in apps:
    if a['status'] == 'pending_review':
        test_app = a
        break

if not test_app:
    # 没有就找一个 draft 然后提交
    login('registrar1', '123456')
    apps = get_app_list()
    for a in apps:
        if a['status'] == 'draft' and a['createdBy'] == u['id']:
            test_app = a
            break
    if test_app:
        r = submit_app(test_app['id'], '测试超时')
        dump('提交测试申请', r)
        logout()
        login('auditor1', '123456')
        apps = get_app_list()
        for a in apps:
            if a['id'] == test_app['id']:
                test_app = a

print(f'\n测试申请: id={test_app["id"] if test_app else None} status={test_app["status"] if test_app else None}')

if test_app:
    # 查看详情拿到节点 timeline
    detail = get_app_detail(test_app['id'])
    print(f'申请详情: currentNode={detail["currentNode"]} currentNodeName={detail["currentNodeName"]} isOverdue={detail.get("isOverdue")}')
    for tl in detail.get('nodeTimelines', []):
        print(f'  tl: node={tl["nodeType"]} name={tl["nodeName"]} isOverdue={tl.get("isOverdue")} status={tl["status"]} overdueReason={tl.get("overdueReason")}')

    # 现在需要把当前节点的 is_overdue 在 SQLite 改成 1
    import subprocess, sqlite3
    db_path = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/app.db'
    print(f'\n--- 直接修改 SQLite，把节点 {detail["currentNode"]} 的 is_overdue 标记为 1 ---')
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute('''
            UPDATE node_timelines 
            SET is_overdue = 1 
            WHERE application_id = ? AND node_type = ?
        ''', (test_app['id'], detail['currentNode']))
        affected = cur.rowcount
        conn.commit()
        conn.close()
        print(f'  修改了 {affected} 条 node_timelines 记录')
    except Exception as e:
        print(f'  修改数据库失败: {e}')

    # 重新拉取详情确认已超时
    detail = get_app_detail(test_app['id'])
    current_tl = next((tl for tl in detail.get('nodeTimelines', []) if tl['nodeType'] == detail['currentNode']), None)
    print(f'  当前节点 isOverdue={current_tl.get("isOverdue") if current_tl else None}')

    # 场景 9: 推进不带超时原因 → 应该被拦截
    print(f'\n--- Scenario 9: 审核操作不带超时原因 → 被拦截 ---')
    if detail['status'] == 'pending_review':
        r = review_app(test_app['id'], result='审核通过')  # 不带 overdueReason/followUpAction
        s9 = dump('审核(无超时记录)被拦截', r)
        # 预期：400 错误，提示需要超时原因
        check('超时节点无记录推进被拦截', s9 == 400, f'status={s9} msg={r.json().get("message","")}')
        msg = r.json().get('message', '')
        check('错误提示包含「超时原因」或「后续处理」', 
              '超时' in msg or '原因' in msg or '后续' in msg, f'msg={msg}')

    # 场景 10: 推进同时携带超时原因 → 应该成功推进+补录
    print(f'\n--- Scenario 10: 审核操作同时携带超时原因/后续处理 → 成功推进+补录 ---')
    # 先刷新详情
    detail = get_app_detail(test_app['id'])
    if detail['status'] == 'pending_review':
        r = review_app(test_app['id'], result='审核通过', 
                       overdue_reason='模拟超时：租客资料缺失晚到3天',
                       follow_up='已联系租客，资料已补齐，优先审核完成')
        s10 = dump('审核(带超时记录补录)成功', r)
        check('超时节点带记录推进成功', s10 == 200, f'status={s10} msg={r.json().get("message","")}')
        
        # 查看新的节点时间线和操作日志
        detail2 = get_app_detail(test_app['id'])
        print(f'  推进后新状态: {detail2["status"]} currentNode={detail2["currentNode"]}')
        print(f'  app.overdueReason={detail2.get("overdueReason")}')
        print(f'  app.followUpAction={detail2.get("followUpAction")}')
        for tl in detail2.get('nodeTimelines', []):
            if tl['nodeType'] == 'review':
                print(f'  review节点: isOverdue={tl.get("isOverdue")} overdueReason={tl.get("overdueReason")} followUp={tl.get("followUpAction")}')
        
        check('节点时间线补录了overdueReason', 
              any(tl.get('overdueReason') for tl in detail2.get('nodeTimelines',[]) if tl['nodeType']=='review'))
        check('主表补录了overdueReason', bool(detail2.get('overdueReason')))

        # 查看操作日志中是否有 overdue_record_sync
        logs_r = s.get(f'{BASE}/stats/logs?page=1&pageSize=20')
        try:
            logs_data = logs_r.json()['data']
            logs = logs_data.get('list', logs_data.get('items', []))
            print(f'\n  最近 {len(logs)} 条操作日志:')
            sync_log_found = False
            for l in logs[:5]:
                print(f'    [{l["operationType"]}] {l.get("remark","")[:60]} by {l["operatorName"]}')
                if l.get('operationType') == 'overdue_record_sync':
                    sync_log_found = True
            check('操作日志有overdue_record_sync类型', sync_log_found)
        except Exception as e:
            print(f'  日志读取异常: {e}')

logout()

print()
print('='*60)
print(f'总结: ✅ PASS = {PASS}   ❌ FAIL = {FAIL}')
print('='*60)
