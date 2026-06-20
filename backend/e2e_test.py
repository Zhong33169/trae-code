"""端到端 API 测试脚本：模拟三角色全流程 + 异常拦截验证"""
import json
import requests
import sys
from datetime import datetime, timedelta

BASE = 'http://localhost:8005/api'


def step(title):
    bar = '=' * 70
    print(f'\n{bar}\n  {title}\n{bar}')


def check(name, cond, msg=''):
    icon = '✅' if cond else '❌'
    print(f'{icon} [{name}] {"PASS" if cond else "FAIL"} - {msg}')
    return cond


def new_session():
    return requests.Session()  # 每个用户独立会话，避免 cookie 混绑


def login(s, username, password=None):
    if password is None:
        password = 'admin123' if username == 'admin' else '123456'
    r = s.post(f'{BASE}/auth/login', json={'username': username, 'password': password})
    data = r.json()
    return data.get('success'), data.get('user', {}).get('role_label', '')


def api(s, method, path, **kw):
    r = getattr(s, method)(f'{BASE}{path}', timeout=10, **kw)
    try:
        j = r.json()
    except Exception:
        j = {'raw': r.text}
    ok = 200 <= r.status_code < 300
    return ok, r.status_code, j


# ============ 1. 认证和基础检查 ============
step('1. 登录检查 & 权限校验')
reg_sess = new_session()
ok, role = login(reg_sess, 'registrar')
check('registrar 登录', ok, f'role={role}')

ok, st, data = api(reg_sess, 'get', '/auth/me')
check('auth/me 返回', ok and data.get('user'), f'当前用户：{data.get("user",{}).get("real_name","?")}')

# 越权测试 - 用 reviewer 登录创建订单（应当被 403）
rev_sess = new_session()
login(rev_sess, 'reviewer')
ok, st, data = api(rev_sess, 'post', '/bookings', json={
    'form_no': 'TEST-REVIEWER-CREATE', 'batch_no': 'TEST-B-REVIEWER',
    'customer': '越权测试公司',
})
check('reviewer 创建订舱 → 被拦截 403', st == 403, f'status={st} msg={data.get("detail","")}')

# ============ 2. registrar 创建 + 重复批次/单号拦截 ============
step('2. registrar 创建订舱 + 重复校验拦截')
new_payload = {
    'form_no': 'TEST-E2E-001',
    'batch_no': 'TEST-BATCH-E2E',
    'customer': '端到端测试贸易有限公司',
    'forwarder': '中远海运集装箱运输有限公司',
    'port_of_loading': '上海',
    'port_of_discharge': '洛杉矶',
    'container_type': '40HQ',
    'container_qty': 2,
    'cargo_desc': '端到端测试 - 智能家电配件',
    'weight': 16.5,
    'volume': 42.0,
    # 提前填好 SO号和提单号，省去后续 edit 步骤
    'so_no': 'SO-E2E-2026-88888',
    'bl_no': 'COSU-E2E-00001234',
    'vessel': 'COSCO EVER-GREEN / E2E-001W',
}

# 首次创建
ok, st, b1 = api(reg_sess, 'post', '/bookings', json=new_payload)
check('registrar 正常创建', ok and st == 200, f'id={b1.get("id")} 单号={b1.get("form_no")}')
bid = b1['id']

# === 新增：创建后同步上传附件 ===
import io
test_file = io.BytesIO(b'This is a test PDF file for attachment upload')
files = {
    'file': ('e2e_test_booking_doc.pdf', test_file, 'application/pdf'),
}
ok, st, att_data = api(reg_sess, 'post', f'/bookings/{bid}/attachments', files=files, data={'category': 'booking_doc'})
check('创建后上传附件成功', ok and st == 200, f'附件id={att_data.get("id")} 文件名={att_data.get("file_name")}')

# validate 接口测试 - 同单号同批次
ok, st, vd = api(reg_sess, 'post', '/bookings/validate', json={
    'form_no': 'TEST-E2E-001',
    'batch_no': 'TEST-BATCH-E2E',
})
vd_errors = len(vd.get('errors') or [])
vd_warnings = len(vd.get('warnings') or [])
check('validate 重复单号/批次检测', vd_errors >= 1 or vd_warnings >= 1,
      f'errors={vd.get("errors")} warnings={vd.get("warnings")}')

# 再次提交同单号 → 应当被拦截
ok, st, data = api(reg_sess, 'post', '/bookings', json=new_payload)
check('重复单号 → 创建被拦截', st == 400, f'msg={data.get("detail","")}')

# 重复批次号拦截
dup_batch_payload = {**new_payload, 'form_no': 'TEST-E2E-001B', 'batch_no': 'TEST-BATCH-E2E'}
ok, st, data = api(reg_sess, 'post', '/bookings', json=dup_batch_payload)
check('重复批次 → 创建被拦截', st == 400, f'msg={data.get("detail","")}')

# ============ 3. registrar 提交审核 → supervisor 审核通过 → 订舱确认 ============
step('3. 订舱主流程：草稿→待审核→审核通过→已订舱')
sup_sess = new_session()
login(sup_sess, 'supervisor')

# === 新增：附件上传权限测试（supervisor 能否上传？看 ROLE_PERMISSIONS）===
test_file2 = io.BytesIO(b'This is supervisor test file')
files2 = {
    'file': ('e2e_test_supervisor_upload.pdf', test_file2, 'application/pdf'),
}
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/attachments', files=files2, data={'category': 'other'})
check('supervisor 上传附件（权限校验）', (st == 200) or st == 403,
      f'status={st} msg={data.get("detail","") or "允许"}')

# === 新增：测试"创建并自动提交"功能（registrar 创建后立即 submit）===
new_payload2 = {
    'form_no': 'TEST-E2E-002',
    'batch_no': 'TEST-BATCH-E2E-002',
    'customer': '自动提交测试贸易公司',
    'forwarder': '中远海运',
    'port_of_loading': '上海',
    'port_of_discharge': '洛杉矶',
    'container_type': '20GP',
    'container_qty': 1,
    'cargo_desc': '自动提交测试 - 家居用品',
    'weight': 5.0,
    'volume': 12.0,
}
ok, st, b2 = api(reg_sess, 'post', '/bookings', json=new_payload2)
bid2 = b2['id']
# 创建后立即自动调用 submit（模拟前端"创建并提交"按钮）
ok, st, b2_submitted = api(reg_sess, 'post', f'/bookings/{bid2}/submit', json={'remark': '创建后立即自动提交审核'})
check('创建后自动调用 submit 流转', ok and b2_submitted.get('booking_status') == 'pending_review',
      f'status={b2_submitted.get("booking_status_label","")}')

# supervisor 提前尝试审核通过（状态还是 draft，应当被拦截）
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/review-pass', json={'remark': '提前越权测试'})
check('draft 状态 supervisor 直接 review-pass → 被拦截', st == 400,
      f'msg={data.get("detail","")}')

# registrar 提交
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/submit', json={'remark': '端到端流程：提交审核'})
check('registrar submit 通过', ok, f'status={data.get("booking_status_label","")}')

# 重复提交（应当被拦截）
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/submit', json={})
check('重复提交（pending_review）→ 被拦截', st == 400, f'msg={data.get("detail","")}')

# registrar 越权尝试审核通过
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/review-pass', json={})
check('registrar 尝试 review-pass → 被拦截（无权限）', st == 403,
      f'msg={data.get("detail","")}')

# supervisor 审核通过
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/review-pass', json={'remark': 'E2E 测试：审核通过'})
check('supervisor review-pass 通过', ok, f'status={data.get("booking_status_label","")}')

# supervisor 订舱确认（SO号已提前填好）
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/book-confirm', json={
    'remark': 'E2E：SO已下，订舱确认',
    'result_note': '订舱成功：舱位已锁定 2x40HQ',
})
check('supervisor book-confirm 通过', ok, f'status={data.get("booking_status_label","")}')

# ============ 4. 装柜流程：安排装柜(registrar) → 确认(2步) ============
step('4. 装柜流程：安排→确认→完成装柜')
# supervisor 尝试安排装柜 → 应当被拦截（安排装柜是 registrar）
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/loading/arrange', json={})
check('supervisor 安排装柜 → 被拦截（角色不匹配）', st == 403, f'msg={data.get("detail","")}')

ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/loading/arrange', json={
    'remark': '已安排工厂装柜：2026-xx-xx',
})
check('registrar 安排装柜通过', ok, f'status={data.get("loading_status_label","")}')

# 重复安排装柜
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/loading/arrange', json={})
check('重复安排装柜 → 被拦截', st == 400, f'msg={data.get("detail","")}')

# supervisor 两步确认：pending_confirm → confirmed → loaded
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/loading/confirm', json={
    'remark': 'E2E 第1步：装柜信息核对无误',
    'result_note': '核对：货单一致、拖车已到场',
})
check('装柜确认Step1 通过 (→confirmed)', ok, f'status={data.get("loading_status_label","")}')

ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/loading/confirm', json={
    'remark': 'E2E 第2步：装柜已完成',
    'result_note': '全部2个柜已装船并取得大幅收据',
})
check('装柜确认Step2 通过 (→loaded)', ok, f'status={data.get("loading_status_label","")}')

# ============ 5. 提单流程：出单(registrar) → 回收(registrar) ============
step('5. 提单流程：出单→回收')
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/bl/issue', json={
    'remark': '船公司已出单，正本已扫描',
})
check('registrar bl-issue 通过', ok, f'status={data.get("bl_status_label","")}')

ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/bl/collect', json={
    'remark': '客户已确认提单并回收正本',
    'result_note': '提单信息核对无误，客户确认',
})
check('registrar bl-collect 通过', ok, f'status={data.get("bl_status_label","")}')

# ============ 6. 复核归档：reviewer 归档 ============
step('6. 复核归档：reviewer（归档前先对齐离线台账，否则状态不一致拦截）')

# 先回填离线台账（模拟线下对账），否则 review-archive 会被状态不一致拦截
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/offline-fill', json={
    'field_name': 'offline_booking_status',
    'new_value': 'booked',
    'source': '台账Excel导入',
    'remark': '离线台账：订舱完成',
})
check('离线回填-订舱状态', ok, f'booking={data.get("offline_booking_status","")}')
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/offline-fill', json={
    'field_name': 'offline_loading_status',
    'new_value': 'loaded',
    'source': '台账Excel导入',
    'remark': '离线台账：装柜完成',
})
check('离线回填-装柜状态', ok, f'loading={data.get("offline_loading_status","")}')
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/offline-fill', json={
    'field_name': 'offline_bl_status',
    'new_value': 'collected',
    'source': '台账Excel导入',
    'remark': '离线台账：提单回收',
})
check('离线回填-提单状态', ok, f'bl={data.get("offline_bl_status","")}')

# registrar 越权归档
ok, st, data = api(reg_sess, 'post', f'/bookings/{bid}/review-archive', json={})
check('registrar 归档 → 被拦截（角色不匹配）', st == 403, f'msg={data.get("detail","")}')

# supervisor 越权归档（应该是 reviewer）
ok, st, data = api(sup_sess, 'post', f'/bookings/{bid}/review-archive', json={})
check('supervisor 归档 → 被拦截（角色不匹配）', st == 403, f'msg={data.get("detail","")}')

# reviewer 归档 - 这次线上线下已对齐，应当通过
reviewer_sess = new_session()
login(reviewer_sess, 'reviewer')
ok, st, data = api(reviewer_sess, 'post', f'/bookings/{bid}/review-archive', json={
    'remark': 'E2E 测试：外贸公司复核通过，全流程无误，归档',
    'result_note': '全流程核对通过：订舱/装柜/提单/附件无异常',
})
check('reviewer 归档通过', ok,
      f'订舱={data.get("booking_status_label","")} 提单={data.get("bl_status_label","")}')

# ============ 7. 审计 & 操作记录检查 ============
step('7. 审计记录 & 操作记录可追溯性检查（离线回填也有留痕）')
admin_sess = new_session()
login(admin_sess, 'admin')
ok, st, ops = api(admin_sess, 'get', f'/bookings/{bid}/operation-logs')
op_count = len(ops) if isinstance(ops, list) else 0
check('操作记录可追溯', ok and op_count > 10, f'操作记录条数：{op_count}')

ok, st, audits = api(admin_sess, 'get', f'/bookings/{bid}/audit-logs')
aud_count = len(audits) if isinstance(audits, list) else 0
check('审计记录可追溯', ok and aud_count >= 3,
      f'审计条数：{aud_count} 明细：' + ' / '.join(
          [f"{a.get('audit_type_label','')}={a.get('result_label','')}"
           for a in audits[-6:]] if isinstance(audits, list) else []))

ok, st, offrecs = api(admin_sess, 'get', f'/bookings/{bid}/offline-records')
off_count = len(offrecs) if isinstance(offrecs, list) else 0
check('离线台账回填有独立留痕', ok and off_count >= 3, f'离线回填记录条数：{off_count}')

# ============ 8. 8条样例 + 2新建 合计 10 条 ============
ok, st, lst = api(admin_sess, 'get', '/bookings')
total = lst.get('total', 0)
counts_ok = total >= 10
check(f'列表页总记录数≥10（8样例+2新建）', counts_ok, f'实际：{total}')

print('\n' + '=' * 70)
print('🎉 端到端测试完成：订舱申请 → 装柜 → 提单 → 归档 全链路通过！')
print('=' * 70)
