from flask import Blueprint, request, jsonify, session
from datetime import datetime
from models import db, TeamOrder, OrderLog, User
from config import Config
import json

orders_bp = Blueprint('orders', __name__, url_prefix='/api/orders')


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)


def get_role_queue_status(role):
    if role == 'ticket_specialist':
        return ['pending_verification']
    elif role == 'site_dispatcher':
        return ['verified']
    elif role == 'scenic_manager':
        return ['entered', 'appeal_pending']
    return []


def evidence_to_list(evidence_str):
    if not evidence_str:
        return []
    try:
        return json.loads(evidence_str)
    except (json.JSONDecodeError, TypeError):
        return [evidence_str]


def list_to_evidence(evidence_list):
    if not evidence_list:
        return ''
    return json.dumps(evidence_list, ensure_ascii=False)


def validate_status_transition(order, target_status, user):
    role = user.role
    transitions = Config.STATUS_TRANSITIONS.get(role, {})
    allowed_targets = transitions.get(order.status, [])

    if target_status not in allowed_targets:
        return False, f'{Config.ROLE_NAMES.get(role, role)}无权从「{Config.ORDER_STATUS_NAMES.get(order.status, order.status)}」推进到「{Config.ORDER_STATUS_NAMES.get(target_status, target_status)}」'

    return True, None


def validate_evidence(order, target_status):
    if target_status not in Config.REQUIRED_EVIDENCE:
        return True, None

    required = Config.REQUIRED_EVIDENCE[target_status]
    current_evidence = evidence_to_list(order.evidence)
    missing = [e for e in required if e not in current_evidence]

    if missing:
        evidence_names = {
            'booking_sheet': '预约单',
            'ticket_voucher': '票务凭证',
            'entry_record': '入园记录',
            'settlement_note': '结算单'
        }
        missing_names = [evidence_names.get(e, e) for e in missing]
        return False, f'缺少必填证据：{", ".join(missing_names)}'

    return True, None


def get_next_handler_role(status):
    if status == 'pending_verification':
        return 'ticket_specialist'
    elif status == 'verified':
        return 'site_dispatcher'
    elif status == 'entered':
        return 'scenic_manager'
    elif status == 'archived':
        return 'scenic_manager'
    elif status == 'appeal_pending':
        return 'scenic_manager'
    return 'ticket_specialist'


def add_order_log(order, action, user, from_status, to_status, remark=''):
    log = OrderLog(
        order_id=order.id,
        action=action,
        operator_id=user.id if user else None,
        operator_name=user.name if user else None,
        operator_role=user.role if user else None,
        from_status=from_status,
        to_status=to_status,
        remark=remark
    )
    db.session.add(log)


@orders_bp.route('/queue', methods=['GET'])
def queue():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    status_list = get_role_queue_status(user.role)
    orders = TeamOrder.query.filter(TeamOrder.status.in_(status_list)) \
        .order_by(TeamOrder.created_at.desc()).all()

    stats = {
        'total': len(orders),
        'by_status': {}
    }
    for s in status_list:
        count = TeamOrder.query.filter_by(status=s).count()
        stats['by_status'][s] = {
            'count': count,
            'name': Config.ORDER_STATUS_NAMES.get(s, s)
        }

    return jsonify({
        'orders': [o.to_dict() for o in orders],
        'stats': stats,
        'role': user.role,
        'role_name': Config.ROLE_NAMES.get(user.role, user.role)
    })


@orders_bp.route('/all', methods=['GET'])
def all_orders():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    status_filter = request.args.get('status')
    query = TeamOrder.query
    if status_filter:
        query = query.filter_by(status=status_filter)

    orders = query.order_by(TeamOrder.created_at.desc()).all()

    all_stats = {}
    for s in Config.ORDER_STATUS:
        count = TeamOrder.query.filter_by(status=s).count()
        all_stats[s] = {
            'count': count,
            'name': Config.ORDER_STATUS_NAMES.get(s, s)
        }

    return jsonify({
        'orders': [o.to_dict() for o in orders],
        'all_stats': all_stats
    })


@orders_bp.route('/<int:order_id>', methods=['GET'])
def order_detail(order_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    order = TeamOrder.query.get(order_id)
    if not order:
        return jsonify({'error': '预约单不存在'}), 404

    data = order.to_dict(include_logs=True, include_appeals=True)
    data['status_name'] = Config.ORDER_STATUS_NAMES.get(order.status, order.status)
    data['current_handler_role_name'] = Config.ROLE_NAMES.get(order.current_handler_role, order.current_handler_role)

    appeal_list = []
    for appeal in order.appeals:
        ad = appeal.to_dict(include_logs=True)
        ad['status_name'] = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
        ad['original_status_name'] = Config.ORDER_STATUS_NAMES.get(appeal.original_status, appeal.original_status)
        appeal_list.append(ad)
    data['appeals'] = appeal_list

    return jsonify(data)


@orders_bp.route('/<int:order_id>/transition', methods=['POST'])
def transition(order_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    order = TeamOrder.query.get(order_id)
    if not order:
        return jsonify({'error': '预约单不存在'}), 404

    data = request.get_json() or {}
    target_status = data.get('target_status')
    version = data.get('version')
    evidence = data.get('evidence', [])
    remark = data.get('remark', '')

    if not target_status:
        return jsonify({'error': '请指定目标状态'}), 400

    if version is not None and version != order.version:
        add_order_log(
            order, '版本冲突', user,
            order.status, order.status,
            f'操作失败：当前版本为 {order.version}，提交版本为 {version}'
        )
        db.session.commit()
        return jsonify({
            'error': '版本冲突，数据已被其他人修改，请刷新后重试',
            'current_version': order.version
        }), 409

    valid, err_msg = validate_status_transition(order, target_status, user)
    if not valid:
        add_order_log(order, '状态流转失败', user, order.status, order.status, err_msg)
        db.session.commit()
        return jsonify({'error': err_msg}), 403

    if evidence:
        order.evidence = list_to_evidence(evidence)

    ev_valid, ev_err = validate_evidence(order, target_status)
    if not ev_valid:
        add_order_log(order, '证据校验失败', user, order.status, order.status, ev_err)
        db.session.commit()
        return jsonify({'error': ev_err}), 400

    from_status = order.status
    order.status = target_status
    order.current_handler_role = get_next_handler_role(target_status)
    order.version += 1

    action_map = {
        ('pending_verification', 'verified'): '票务核销',
        ('verified', 'entered'): '入园统计',
        ('entered', 'archived'): '归档',
        ('pending_verification', 'appeal_pending'): '提交申诉',
        ('verified', 'appeal_pending'): '提交申诉',
        ('entered', 'appeal_pending'): '提交申诉'
    }
    action = action_map.get((from_status, target_status), '状态变更')

    add_order_log(order, action, user, from_status, target_status, remark)

    db.session.commit()

    return jsonify({
        'order': order.to_dict(include_logs=True),
        'message': f'{action}成功'
    })


@orders_bp.route('', methods=['POST'])
def create_order():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}

    required_fields = ['order_no', 'team_name', 'visitor_count', 'visit_date']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'缺少必填字段：{field}'}), 400

    if TeamOrder.query.filter_by(order_no=data['order_no']).first():
        return jsonify({'error': '预约单号已存在'}), 400

    try:
        visit_date = datetime.strptime(data['visit_date'], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return jsonify({'error': '访问日期格式错误'}), 400

    evidence = data.get('evidence', [])
    order = TeamOrder(
        order_no=data['order_no'],
        team_name=data['team_name'],
        visitor_count=int(data['visitor_count']),
        visit_date=visit_date,
        guide_name=data.get('guide_name'),
        guide_phone=data.get('guide_phone'),
        status='pending_verification',
        current_handler_role='ticket_specialist',
        evidence=list_to_evidence(evidence) if evidence else '',
        remark=data.get('remark', '')
    )

    db.session.add(order)
    db.session.flush()

    log = OrderLog(
        order_id=order.id,
        action='创建预约单',
        operator_id=user.id,
        operator_name=user.name,
        operator_role=user.role,
        from_status=None,
        to_status='pending_verification',
        remark='团队预约单创建成功'
    )
    db.session.add(log)

    db.session.commit()

    return jsonify({
        'order': order.to_dict(),
        'message': '预约单创建成功'
    }), 201


@orders_bp.route('/status-config', methods=['GET'])
def status_config():
    return jsonify({
        'order_status': Config.ORDER_STATUS_NAMES,
        'appeal_status': Config.APPEAL_STATUS_NAMES,
        'roles': Config.ROLE_NAMES,
        'required_evidence': Config.REQUIRED_EVIDENCE
    })


@orders_bp.route('/stats', methods=['GET'])
def stats():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    total_orders = TeamOrder.query.count()
    total_visitors = db.session.query(db.func.sum(TeamOrder.visitor_count)).scalar() or 0

    status_stats = {}
    for s in Config.ORDER_STATUS:
        count = TeamOrder.query.filter_by(status=s).count()
        status_stats[s] = {
            'count': count,
            'name': Config.ORDER_STATUS_NAMES.get(s, s)
        }

    role_stats = {}
    for r in Config.ROLES:
        count = TeamOrder.query.filter_by(current_handler_role=r).count()
        role_stats[r] = {
            'count': count,
            'name': Config.ROLE_NAMES.get(r, r)
        }

    return jsonify({
        'total_orders': total_orders,
        'total_visitors': total_visitors,
        'by_status': status_stats,
        'by_role': role_stats
    })
