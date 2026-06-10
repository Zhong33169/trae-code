import os
import sys
import json
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from models import db, User, TeamOrder, OrderLog, Appeal, AppealLog


def init_database():
    app = create_app()

    db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f'已删除旧数据库: {db_path}')

    with app.app_context():
        db.create_all()
        print('数据库表创建成功')

        create_users()
        print('用户数据初始化完成')

        orders = create_sample_orders()
        print(f'样例预约单创建完成，共 {len(orders)} 条')

        create_appeals()
        print('申诉样例数据创建完成')

        print('\n===== 初始化完成 =====')
        print('默认账号：')
        print('  票务专员: zhangsan / 123456')
        print('  现场调度: lisi / 123456')
        print('  景区经理: wangwu / 123456')


def create_users():
    users = [
        {'username': 'zhangsan', 'password': '123456', 'name': '张三', 'role': 'ticket_specialist'},
        {'username': 'lisi', 'password': '123456', 'name': '李四', 'role': 'site_dispatcher'},
        {'username': 'wangwu', 'password': '123456', 'name': '王五', 'role': 'scenic_manager'},
    ]
    for u in users:
        user = User(**u)
        db.session.add(user)
    db.session.commit()


def create_order_log(order, action, operator, from_status, to_status, remark=''):
    log = OrderLog(
        order_id=order.id,
        action=action,
        operator_id=operator.id if operator else None,
        operator_name=operator.name if operator else None,
        operator_role=operator.role if operator else None,
        from_status=from_status,
        to_status=to_status,
        remark=remark
    )
    db.session.add(log)


def create_failed_transition_log(order, operator, error_msg, audit_note, snapshot_status, snapshot_version, snapshot_evidence, snapshot_handler):
    evidence_names = []
    evidence_map = {
        'booking_sheet': '预约单',
        'ticket_voucher': '票务凭证',
        'entry_record': '入园记录',
        'settlement_note': '结算单'
    }
    for e in snapshot_evidence:
        evidence_names.append(evidence_map.get(e, e))
    evidence_str = '、'.join(evidence_names) if evidence_names else '(无)'
    role_map = {
        'ticket_specialist': '票务专员',
        'site_dispatcher': '现场调度',
        'scenic_manager': '景区经理'
    }
    status_map = {
        'pending_verification': '待票务核销',
        'verified': '已核销待入园',
        'entered': '已入园待归档',
        'archived': '已归档',
        'appeal_pending': '申诉中'
    }
    snapshot = f'[状态={status_map.get(snapshot_status, snapshot_status)} 版本=v{snapshot_version} 证据={evidence_str} 处理岗位={role_map.get(snapshot_handler, snapshot_handler)}]'
    remark = f'{error_msg} | 审计备注：{audit_note} | 失败前订单快照：{snapshot}'
    log = OrderLog(
        order_id=order.id,
        action='状态流转失败',
        operator_id=operator.id if operator else None,
        operator_name=operator.name if operator else None,
        operator_role=operator.role if operator else None,
        from_status=snapshot_status,
        to_status=snapshot_status,
        remark=remark
    )
    db.session.add(log)


def create_sample_orders():
    zhangsan = User.query.filter_by(username='zhangsan').first()
    lisi = User.query.filter_by(username='lisi').first()
    wangwu = User.query.filter_by(username='wangwu').first()

    today = datetime.now().date()
    yesterday = today - timedelta(days=1)
    three_days_ago = today - timedelta(days=3)
    week_ago = today - timedelta(days=7)
    two_weeks_ago = today - timedelta(days=14)
    tomorrow = today + timedelta(days=1)
    next_week = today + timedelta(days=7)

    orders = []

    order1 = TeamOrder(
        order_no='TM20260611001',
        team_name='阳光旅行社团建团',
        visitor_count=45,
        visit_date=tomorrow,
        guide_name='赵导',
        guide_phone='13800138001',
        status='pending_verification',
        current_handler_role='ticket_specialist',
        evidence=json.dumps(['booking_sheet'], ensure_ascii=False),
        remark='正常待核销预约单，资料齐全',
        version=1
    )
    db.session.add(order1)
    db.session.flush()
    create_order_log(order1, '创建预约单', zhangsan, None, 'pending_verification', '阳光旅行社提交团队预约')
    orders.append(('正常-待票务核销', order1))

    order2 = TeamOrder(
        order_no='TM20260611002',
        team_name='华夏旅行社老年团',
        visitor_count=32,
        visit_date=today,
        guide_name='钱导',
        guide_phone='13800138002',
        status='verified',
        current_handler_role='site_dispatcher',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher'], ensure_ascii=False),
        remark='已核销待入园，票务凭证齐全',
        version=2
    )
    db.session.add(order2)
    db.session.flush()
    create_order_log(order2, '创建预约单', zhangsan, None, 'pending_verification', '华夏旅行社提交团队预约')
    create_order_log(order2, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核验通过，门票已核销')
    orders.append(('正常-待入园统计', order2))

    order3 = TeamOrder(
        order_no='TM20260611003',
        team_name='锦绣旅行社会议团',
        visitor_count=60,
        visit_date=yesterday,
        guide_name='孙导',
        guide_phone='13800138003',
        status='entered',
        current_handler_role='scenic_manager',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher', 'entry_record'], ensure_ascii=False),
        remark='已入园待归档，入园记录完整',
        version=3
    )
    db.session.add(order3)
    db.session.flush()
    create_order_log(order3, '创建预约单', zhangsan, None, 'pending_verification', '锦绣旅行社会议团预约')
    create_order_log(order3, '票务核销', zhangsan, 'pending_verification', 'verified', '团体票核验通过')
    create_order_log(order3, '入园统计', lisi, 'verified', 'entered', '实到60人，与预约人数一致')
    orders.append(('正常-待归档', order3))

    order4 = TeamOrder(
        order_no='TM20260611004',
        team_name='金桥旅行社亲子团',
        visitor_count=28,
        visit_date=three_days_ago,
        guide_name='周导',
        guide_phone='13800138004',
        status='archived',
        current_handler_role='scenic_manager',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher', 'entry_record', 'settlement_note'], ensure_ascii=False),
        remark='已归档完整样例',
        version=4
    )
    db.session.add(order4)
    db.session.flush()
    create_order_log(order4, '创建预约单', zhangsan, None, 'pending_verification', '金桥旅行社亲子团预约')
    create_order_log(order4, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核销完成')
    create_order_log(order4, '入园统计', lisi, 'verified', 'entered', '实际入园28人')
    create_order_log(order4, '归档', wangwu, 'entered', 'archived', '资料齐全，准予归档')
    orders.append(('正常-已归档', order4))

    order5 = TeamOrder(
        order_no='TM20260611005',
        team_name='众信旅行社团建团',
        visitor_count=36,
        visit_date=tomorrow,
        guide_name='吴导',
        guide_phone='13800138005',
        status='pending_verification',
        current_handler_role='ticket_specialist',
        evidence=json.dumps([], ensure_ascii=False),
        remark='缺证据样例：无预约单凭证，需补充后才能核销',
        version=1
    )
    db.session.add(order5)
    db.session.flush()
    create_order_log(order5, '创建预约单', zhangsan, None, 'pending_verification', '众信旅行社团建团预约，暂未上传预约凭证')
    orders.append(('缺证据-待核销无凭证', order5))

    order6 = TeamOrder(
        order_no='TM20260611006',
        team_name='康辉旅行社夕阳红团',
        visitor_count=25,
        visit_date=week_ago,
        guide_name='郑导',
        guide_phone='13800138006',
        status='verified',
        current_handler_role='site_dispatcher',
        evidence=json.dumps(['booking_sheet'], ensure_ascii=False),
        remark='缺证据样例：票务核销环节只有预约单，缺少票务凭证',
        version=2
    )
    db.session.add(order6)
    db.session.flush()
    create_order_log(order6, '创建预约单', zhangsan, None, 'pending_verification', '康辉旅行社夕阳红团预约')
    create_order_log(order6, '票务核销', zhangsan, 'pending_verification', 'verified', '已核销（先核销后补凭证）')
    create_failed_transition_log(
        order6, lisi,
        '版本冲突，数据已被其他人修改，请刷新后重试（当前版本 v2，提交版本 v1）',
        '版本校验失败：当前版本 v2，提交版本 v1，操作被拒绝。已提交新证据：票务凭证、入园记录',
        'verified', 2, ['booking_sheet'], 'site_dispatcher'
    )
    orders.append(('缺证据-已核销缺票务凭证', order6))

    order7 = TeamOrder(
        order_no='TM20260611007',
        team_name='春秋旅行社研学团',
        visitor_count=50,
        visit_date=two_weeks_ago,
        guide_name='冯导',
        guide_phone='13800138007',
        status='verified',
        current_handler_role='site_dispatcher',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher'], ensure_ascii=False),
        remark='逾期样例：已核销两周未做入园统计，超出正常处理时限',
        version=2
    )
    db.session.add(order7)
    db.session.flush()
    create_order_log(order7, '创建预约单', zhangsan, None, 'pending_verification', '春秋旅行社研学团预约')
    create_order_log(order7, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核销完成，已逾期未入园统计')
    orders.append(('逾期-核销后未入园统计', order7))

    order8 = TeamOrder(
        order_no='TM20260611008',
        team_name='中青旅商务团',
        visitor_count=20,
        visit_date=three_days_ago,
        guide_name='陈导',
        guide_phone='13800138008',
        status='entered',
        current_handler_role='scenic_manager',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher'], ensure_ascii=False),
        remark='逾期样例：已入园三天未归档，且缺少结算单',
        version=3
    )
    db.session.add(order8)
    db.session.flush()
    create_order_log(order8, '创建预约单', zhangsan, None, 'pending_verification', '中青旅商务团预约')
    create_order_log(order8, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核销完成')
    create_order_log(order8, '入园统计', lisi, 'verified', 'entered', '入园统计完成，已逾期未归档')
    orders.append(('逾期-入园后未归档缺结算单', order8))

    order9 = TeamOrder(
        order_no='TM20260611009',
        team_name='光大旅行社考察团',
        visitor_count=18,
        visit_date=yesterday,
        guide_name='褚导',
        guide_phone='13800138009',
        status='appeal_pending',
        current_handler_role='scenic_manager',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher'], ensure_ascii=False),
        remark='退回补正样例：申诉提交后被驳回补正，等待再次提交',
        version=4
    )
    db.session.add(order9)
    db.session.flush()
    create_order_log(order9, '创建预约单', zhangsan, None, 'pending_verification', '光大旅行社考察团预约')
    create_order_log(order9, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核销完成')
    create_order_log(order9, '提交申诉', lisi, 'verified', 'appeal_pending', '申诉理由：入园统计时发现实际人数与预约不符，需复核')
    orders.append(('退回补正-申诉待处理', order9))

    order10 = TeamOrder(
        order_no='TM20260611010',
        team_name='和平旅行社奖励团',
        visitor_count=40,
        visit_date=tomorrow,
        guide_name='卫导',
        guide_phone='13800138010',
        status='pending_verification',
        current_handler_role='ticket_specialist',
        evidence=json.dumps(['booking_sheet'], ensure_ascii=False),
        remark='状态冲突样例：版本号模拟冲突场景，用于测试乐观锁',
        version=5
    )
    db.session.add(order10)
    db.session.flush()
    create_order_log(order10, '创建预约单', zhangsan, None, 'pending_verification', '和平旅行社奖励团预约')
    create_order_log(order10, '状态变更测试', zhangsan, 'pending_verification', 'pending_verification', '版本号递增测试，用于演示版本冲突校验')
    create_order_log(order10, '状态变更测试', zhangsan, 'pending_verification', 'pending_verification', '第二次版本更新')
    create_order_log(order10, '状态变更测试', zhangsan, 'pending_verification', 'pending_verification', '第三次版本更新')
    create_order_log(order10, '状态变更测试', zhangsan, 'pending_verification', 'pending_verification', '第四次版本更新')
    orders.append(('状态冲突-版本号不一致', order10))

    order11 = TeamOrder(
        order_no='TM20260611011',
        team_name='中国旅行社研学团',
        visitor_count=55,
        visit_date=next_week,
        guide_name='蒋导',
        guide_phone='13800138011',
        status='pending_verification',
        current_handler_role='ticket_specialist',
        evidence=json.dumps(['booking_sheet', 'entry_record'], ensure_ascii=False),
        remark='状态冲突样例：未入园却已有入园记录，证据状态异常',
        version=1
    )
    db.session.add(order11)
    db.session.flush()
    create_order_log(order11, '创建预约单', zhangsan, None, 'pending_verification', '中旅研学团预约，证据顺序异常：预约单+入园记录，缺少票务凭证')
    orders.append(('状态冲突-证据与状态不符', order11))

    order12 = TeamOrder(
        order_no='TM20260611012',
        team_name='南湖国旅亲子团',
        visitor_count=30,
        visit_date=today,
        guide_name='沈导',
        guide_phone='13800138012',
        status='appeal_pending',
        current_handler_role='scenic_manager',
        evidence=json.dumps(['booking_sheet', 'ticket_voucher', 'entry_record'], ensure_ascii=False),
        remark='申诉进行中样例：景区经理正在复核的申诉单',
        version=5
    )
    db.session.add(order12)
    db.session.flush()
    create_order_log(order12, '创建预约单', zhangsan, None, 'pending_verification', '南湖国旅亲子团预约')
    create_order_log(order12, '票务核销', zhangsan, 'pending_verification', 'verified', '票务核销完成')
    create_order_log(order12, '入园统计', lisi, 'verified', 'entered', '实际入园28人，与预约30人有差异')
    create_order_log(order12, '提交申诉', lisi, 'entered', 'appeal_pending', '申诉理由：人数差异需复核，是否按实际人数结算')
    orders.append(('申诉中-景区经理待处理', order12))

    db.session.commit()
    return orders


def create_appeals():
    zhangsan = User.query.filter_by(username='zhangsan').first()
    lisi = User.query.filter_by(username='lisi').first()
    wangwu = User.query.filter_by(username='wangwu').first()

    order9 = TeamOrder.query.filter_by(order_no='TM20260611009').first()
    order12 = TeamOrder.query.filter_by(order_no='TM20260611012').first()

    appeal1 = Appeal(
        order_id=order9.id,
        status='rejected_correction',
        submitter_id=lisi.id,
        submitter_name=lisi.name,
        submitter_role=lisi.role,
        reason='入园统计时发现实际入园人数18人与预约18人一致，但票务系统显示核销20张，存在数据差异，需复核原始凭证。',
        review_opinion='情况属实，需要补充原始票务凭证照片和现场签到表。',
        reject_reason='申诉材料不充分，请补充：1. 原始票务凭证扫描件 2. 团队现场签到表 3. 导游情况说明',
        original_status='verified',
        reviewer_id=wangwu.id,
        reviewer_name=wangwu.name,
        version=3,
        resubmit_count=0
    )
    db.session.add(appeal1)
    db.session.flush()

    log1 = AppealLog(
        appeal_id=appeal1.id,
        action='提交申诉',
        operator_id=lisi.id,
        operator_name=lisi.name,
        operator_role=lisi.role,
        from_status=None,
        to_status='submitted',
        remark='申诉理由：入园统计时发现实际入园人数18人与预约18人一致，但票务系统显示核销20张，存在数据差异，需复核原始凭证。'
    )
    db.session.add(log1)

    log2 = AppealLog(
        appeal_id=appeal1.id,
        action='受理申诉',
        operator_id=wangwu.id,
        operator_name=wangwu.name,
        operator_role=wangwu.role,
        from_status='submitted',
        to_status='accepted',
        remark='已受理，正在复核相关凭证。'
    )
    db.session.add(log2)

    log3 = AppealLog(
        appeal_id=appeal1.id,
        action='驳回补正',
        operator_id=wangwu.id,
        operator_name=wangwu.name,
        operator_role=wangwu.role,
        from_status='accepted',
        to_status='rejected_correction',
        remark='驳回原因：申诉材料不充分，请补充：1. 原始票务凭证扫描件 2. 团队现场签到表 3. 导游情况说明'
    )
    db.session.add(log3)

    appeal2 = Appeal(
        order_id=order12.id,
        status='accepted',
        submitter_id=lisi.id,
        submitter_name=lisi.name,
        submitter_role=lisi.role,
        reason='预约30人，实际入园28人，有2人临时取消。现申请按实际入园人数28人结算，附现场签到表和导游说明。',
        review_opinion='已受理申诉，正在核实人数差异原因，待查验现场签到表和取消通知。',
        reject_reason=None,
        original_status='entered',
        reviewer_id=wangwu.id,
        reviewer_name=wangwu.name,
        version=2,
        resubmit_count=0
    )
    db.session.add(appeal2)
    db.session.flush()

    log4 = AppealLog(
        appeal_id=appeal2.id,
        action='提交申诉',
        operator_id=lisi.id,
        operator_name=lisi.name,
        operator_role=lisi.role,
        from_status=None,
        to_status='submitted',
        remark='申诉理由：预约30人，实际入园28人，有2人临时取消。现申请按实际入园人数28人结算，附现场签到表和导游说明。'
    )
    db.session.add(log4)

    log5 = AppealLog(
        appeal_id=appeal2.id,
        action='受理申诉',
        operator_id=wangwu.id,
        operator_name=wangwu.name,
        operator_role=wangwu.role,
        from_status='submitted',
        to_status='accepted',
        remark='已受理，正在核实人数差异，复核意见：待查验现场签到表和取消通知。'
    )
    db.session.add(log5)

    db.session.commit()


if __name__ == '__main__':
    init_database()
