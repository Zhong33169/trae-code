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
                print(f'    [{l["operationType"]}] {l.get("remark","")[:60]} by {l["userName"]}')
                if l.get('operationType') == 'overdue_record_sync':
                    sync_log_found = True
            check('操作日志有overdue_record_sync类型', sync_log_found)
        except Exception as e:
            print(f'  日志读取异常: {e}')

logout()

print()
print('='*60)
print('PART 3: 超时拦截审计闭环测试')
print('='*60)

# 测试步骤：
# 1. 创建新申请 → 提交审核
# 2. 标记审核节点超时
# 3. 不带超时原因尝试审核 → 应该被拦截 → 检查 operation_logs overdue_blocked + node_timelines.remark + overdue_audits.blocked
# 4. 再次不带超时原因尝试审核 → 再次拦截 → 检查拦截次数累加
# 5. 带超时原因审核 → 成功 → 检查 overdue_audits.supplemented
# 6. 检查列表接口 hasOverdueBlocked 过滤和 overdueBlockedCount 字段
# 7. 检查详情接口 overdueAudits 数组和统计
# 8. 检查统计接口 overdueBlockedCount/overdueSupplementedCount/overdueBlockedByNode

import sqlite3
db_path = '/Users/echo/Desktop/zqzl/zhong33169/trae-code-3/backend/data/app.db'

# 步骤 1: registrar1 创建新申请并提交审核
print('\n--- Step 1: registrar1 创建新申请并提交审核 ---')
login('registrar1', '123456')
audit_app = create_app('审计测试租客')
print(f'  创建审计测试申请: id={audit_app["id"]} no={audit_app["applicationNo"]}')
r = submit_app(audit_app['id'], '提交审计测试')
dump('提交审核', r)
check('提交审核成功', r.status_code == 200)
logout()

# 步骤 2: auditor1 登录，将审核节点标记为超时
print('\n--- Step 2: auditor1 登录，将审核节点标记为超时 ---')
login('auditor1', '123456')
detail = get_app_detail(audit_app['id'])
print(f'  当前状态: {detail["status"]} 节点: {detail["currentNode"]}')
check('状态为 pending_review', detail['status'] == 'pending_review')

conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute('UPDATE node_timelines SET is_overdue = 1 WHERE application_id = ? AND node_type = ?', 
            (audit_app['id'], detail['currentNode']))
print(f'  标记 node_timelines.is_overdue=1, 影响 {cur.rowcount} 行')
conn.commit()
conn.close()

# 步骤 3: 不带超时原因尝试审核 → 应该被拦截
print('\n--- Step 3: 不带超时原因尝试审核 → 拦截，检查三表写入 ---')
r = review_app(audit_app['id'], result='审核通过')  # 不带超时记录
s3 = dump('审核(无超时记录)被拦截', r)
check('第一次拦截成功', s3 == 400)

# 直接查数据库验证三表写入
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# 检查 operation_logs
cur.execute('SELECT operation_type, operation_name, detail FROM operation_logs WHERE application_id = ? AND operation_type = ? ORDER BY id DESC LIMIT 1', 
            (audit_app['id'], 'overdue_blocked'))
log = cur.fetchone()
print(f'  operation_logs.overdue_blocked: {log}')
check('operation_logs 有 overdue_blocked 记录', log is not None)
if log:
    check('operation_logs.operation_name 正确', log[1] == '超时拦截')

# 检查 node_timelines.remark
cur.execute('SELECT remark FROM node_timelines WHERE application_id = ? AND node_type = ?', 
            (audit_app['id'], 'review'))
tl_remark = cur.fetchone()
print(f'  node_timelines.remark: {tl_remark[0][:80] if tl_remark and tl_remark[0] else None}')
check('node_timelines.remark 包含拦截记录', 
      tl_remark and tl_remark[0] and '🚫 [超时拦截' in tl_remark[0])

# 检查 overdue_audits.blocked
cur.execute('SELECT audit_type, blocked_reason, handler_name, old_status, new_status FROM overdue_audits WHERE application_id = ? AND audit_type = ? ORDER BY id DESC LIMIT 1', 
            (audit_app['id'], 'blocked'))
audit_blocked = cur.fetchone()
print(f'  overdue_audits.blocked: {audit_blocked}')
check('overdue_audits 有 blocked 记录', audit_blocked is not None)
if audit_blocked:
    check('audit_type 正确', audit_blocked[0] == 'blocked')
    check('blocked_reason 非空', bool(audit_blocked[1]))
    check('handler_name 正确', audit_blocked[2] == '李审核')
    check('old_status 正确', audit_blocked[3] == 'pending_review')
    check('new_status 正确', audit_blocked[4] == 'pending_review')

# 检查 status_snapshot
cur.execute('SELECT status_snapshot FROM overdue_audits WHERE application_id = ? AND audit_type = ? ORDER BY id DESC LIMIT 1', 
            (audit_app['id'], 'blocked'))
snapshot = cur.fetchone()
print(f'  status_snapshot: {snapshot[0] if snapshot else None}')
check('status_snapshot 包含 isOverdue', snapshot and snapshot[0] and '"isOverdue":true' in snapshot[0])

conn.close()

# 步骤 4: 再次不带超时原因尝试审核 → 再次拦截，检查拦截次数累加
print('\n--- Step 4: 再次尝试审核 → 第二次拦截，检查次数累加 ---')
r = review_app(audit_app['id'], result='审核通过')  # 再次不带超时记录
s4 = dump('第二次审核被拦截', r)
check('第二次拦截成功', s4 == 400)

# 查详情接口验证拦截统计
detail2 = get_app_detail(audit_app['id'])
print(f'  详情 overdueBlockedCount={detail2.get("overdueBlockedCount")}')
print(f'  详情 overdueSupplementedCount={detail2.get("overdueSupplementedCount")}')
print(f'  详情 overdueAudits 数量={len(detail2.get("overdueAudits", []))}')
check('详情 overdueBlockedCount=2', detail2.get('overdueBlockedCount') == 2)
check('详情 hasOverdueBlocked=true', detail2.get('hasOverdueBlocked') == True)

# 检查 overdueAudits 数组内容
audits = detail2.get('overdueAudits', [])
blocked_audits = [a for a in audits if a['auditType'] == 'blocked']
check('overdueAudits 有 2 条 blocked 记录', len(blocked_audits) == 2)
if blocked_audits:
    check('blocked_audit.nodeType 正确', blocked_audits[0]['nodeType'] == 'review')
    check('blocked_audit.proceedAction 正确', blocked_audits[0]['proceedAction'] == '审核操作')
    check('blocked_audit.handlerRole 正确', blocked_audits[0]['handlerRole'] == 'auditor')

# 步骤 5: 带超时原因审核 → 成功，检查 supplemented 记录
print('\n--- Step 5: 带超时原因审核 → 成功，检查 supplemented 记录 ---')
r = review_app(audit_app['id'], result='审核通过',
               overdue_reason='审计测试：租客外出旅游，资料延迟提交',
               follow_up='已联系租客，资料已补齐，优先审核通过')
s5 = dump('审核(带超时补录)成功', r)
check('带补录审核成功', s5 == 200)

# 检查数据库 supplemented 记录
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute('SELECT audit_type, overdue_reason, follow_up_action, handler_name, old_status, new_status FROM overdue_audits WHERE application_id = ? AND audit_type = ? ORDER BY id DESC LIMIT 1', 
            (audit_app['id'], 'supplemented'))
audit_supp = cur.fetchone()
print(f'  overdue_audits.supplemented: {audit_supp}')
check('overdue_audits 有 supplemented 记录', audit_supp is not None)
if audit_supp:
    check('audit_type 正确', audit_supp[0] == 'supplemented')
    check('overdue_reason 正确', '审计测试' in audit_supp[1])
    check('follow_up_action 正确', '已联系租客' in audit_supp[2])
    check('old_status 正确', audit_supp[4] == 'pending_review')
    check('new_status 正确', audit_supp[5] == 'pending_confirm')

# 验证详情接口 supplemented 统计
detail3 = get_app_detail(audit_app['id'])
print(f'  详情 overdueBlockedCount={detail3.get("overdueBlockedCount")} overdueSupplementedCount={detail3.get("overdueSupplementedCount")}')
check('详情 overdueSupplementedCount=1', detail3.get('overdueSupplementedCount') == 1)

conn.close()

# 步骤 6: 检查列表接口 hasOverdueBlocked 过滤和审计字段
print('\n--- Step 6: 检查列表接口 hasOverdueBlocked 过滤 ---')
# 无过滤
apps_all = get_app_list()
print(f'  无过滤列表 {len(apps_all)} 条')
# 过滤 hasOverdueBlocked=true
r = s.get(f'{BASE}/applications?hasOverdueBlocked=true')
apps_blocked = r.json()['data']['items']
print(f'  hasOverdueBlocked=true 列表 {len(apps_blocked)} 条')
check('hasOverdueBlocked 过滤有效', len(apps_blocked) > 0 and len(apps_blocked) <= len(apps_all))

# 检查列表项审计字段
test_app_in_list = next((a for a in apps_blocked if a['id'] == audit_app['id']), None)
if test_app_in_list:
    print(f'  列表项 overdueBlockedCount={test_app_in_list.get("overdueBlockedCount")}')
    print(f'  列表项 overdueSupplementedCount={test_app_in_list.get("overdueSupplementedCount")}')
    check('列表项 hasOverdueBlocked=true', test_app_in_list.get('hasOverdueBlocked') == True)
    check('列表项 overdueBlockedCount 存在', test_app_in_list.get('overdueBlockedCount') is not None)

# 步骤 7: 检查统计接口审计数据
print('\n--- Step 7: 检查统计接口审计数据 ---')
r = s.get(f'{BASE}/stats/overview')
stats = r.json()['data']
print(f'  统计 overdueBlockedCount={stats.get("overdueBlockedCount")}')
print(f'  统计 overdueSupplementedCount={stats.get("overdueSupplementedCount")}')
print(f'  统计 overdueBlockedByNode={stats.get("overdueBlockedByNode")}')
check('统计 overdueBlockedCount >= 2', stats.get('overdueBlockedCount', 0) >= 2)
check('统计 overdueSupplementedCount >= 1', stats.get('overdueSupplementedCount', 0) >= 1)
check('统计 overdueBlockedByNode 是数组', isinstance(stats.get('overdueBlockedByNode'), list))
if stats.get('overdueBlockedByNode'):
    review_blocked = next((n for n in stats['overdueBlockedByNode'] if n['nodeType'] == 'review'), None)
    check('review 节点拦截统计存在', review_blocked is not None)
    if review_blocked:
        check('review 节点拦截数 >= 2', review_blocked.get('blocked', 0) >= 2)
        check('review 节点名称正确', review_blocked.get('nodeName') == '租约审核')

logout()

print()
print('='*60)
print(f'总结: ✅ PASS = {PASS}   ❌ FAIL = {FAIL}')
print('='*60)
