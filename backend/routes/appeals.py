from flask import Blueprint, request, jsonify, session
from models import db, Appeal, AppealLog, TeamOrder, User
from config import Config
from validators import (
    validate_version, validate_appeal_submission,
    validate_appeal_review, validate_appeal_resubmit,
    handle_validation_failure, ValidationError,
    add_order_log, get_next_handler_role, validate_handler_role
)

appeals_bp = Blueprint('appeals', __name__, url_prefix='/api/appeals')


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)


def add_appeal_log(appeal, action, user, from_status, to_status, remark='', audit_note=''):
    log = AppealLog(
        appeal_id=appeal.id,
        action=action,
        operator_id=user.id if user else None,
        operator_name=user.name if user else None,
        operator_role=user.role if user else None,
        from_status=from_status,
        to_status=to_status,
        remark=remark
    )
    if audit_note:
        log.remark = f'{remark} | 审计备注：{audit_note}' if remark else f'审计备注：{audit_note}'
    db.session.add(log)
    return log


@appeals_bp.route('', methods=['POST'])
def submit_appeal():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    data = request.get_json() or {}
    order_id = data.get('order_id')
    reason = data.get('reason', '')
    version = data.get('version')

    if not order_id:
        return jsonify({'error': '请指定预约单ID'}), 400

    if not reason:
        return jsonify({'error': '请填写申诉理由'}), 400

    order = TeamOrder.query.get(order_id)
    if not order:
        return jsonify({'error': '预约单不存在'}), 404

    try:
        validate_version(order, version)
        validate_appeal_submission(order, user)
    except ValidationError as err:
        handle_validation_failure(order, user, '申诉提交', err)
        return jsonify({'error': str(err), 'current_version': order.version}), err.error_code

    original_status = order.status
    order.status = 'appeal_pending'
    order.current_handler_role = 'scenic_manager'
    order.version += 1

    appeal = Appeal(
        order_id=order.id,
        status='submitted',
        submitter_id=user.id,
        submitter_name=user.name,
        submitter_role=user.role,
        reason=reason,
        original_status=original_status
    )

    db.session.add(appeal)
    db.session.flush()

    add_order_log(
        order, '提交申诉', user,
        original_status, 'appeal_pending',
        f'申诉理由：{reason}'
    )

    add_appeal_log(
        appeal, '提交申诉', user,
        None, 'submitted',
        f'申诉理由：{reason}'
    )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(),
        'order': order.to_dict(),
        'message': '申诉提交成功'
    }), 201


@appeals_bp.route('/<int:appeal_id>', methods=['GET'])
def appeal_detail(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    data = appeal.to_dict(include_logs=True)
    data['status_name'] = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
    data['original_status_name'] = Config.ORDER_STATUS_NAMES.get(appeal.original_status, appeal.original_status)

    order = TeamOrder.query.get(appeal.order_id)
    if order:
        data['order'] = {
            'id': order.id,
            'order_no': order.order_no,
            'team_name': order.team_name,
            'status': order.status,
            'status_name': Config.ORDER_STATUS_NAMES.get(order.status, order.status)
        }

    return jsonify(data)


@appeals_bp.route('/<int:appeal_id>/accept', methods=['POST'])
def accept_appeal(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    order = TeamOrder.query.get(appeal.order_id)

    data = request.get_json() or {}
    review_opinion = data.get('review_opinion', '')
    version = data.get('version')

    try:
        validate_version(appeal, version)
        if order:
            validate_handler_role(order, user)
        validate_appeal_review(appeal, user, ['submitted', 'resubmitted'], '受理申诉')
    except ValidationError as err:
        if order:
            handle_validation_failure(order, user, '申诉受理', err, appeal=appeal)
        return jsonify({'error': str(err), 'current_version': appeal.version}), err.error_code

    from_status = appeal.status
    appeal.status = 'accepted'
    appeal.review_opinion = review_opinion
    appeal.reviewer_id = user.id
    appeal.reviewer_name = user.name
    appeal.version += 1

    add_appeal_log(
        appeal, '受理申诉', user,
        from_status, 'accepted',
        f'复核意见：{review_opinion}' if review_opinion else ''
    )

    if order:
        add_order_log(
            order, '申诉已受理', user,
            order.status, order.status,
            f'复核人：{user.name}，复核意见：{review_opinion}' if review_opinion else f'复核人：{user.name}'
        )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(include_logs=True),
        'message': '申诉已受理'
    })


@appeals_bp.route('/<int:appeal_id>/reject', methods=['POST'])
def reject_appeal(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    order = TeamOrder.query.get(appeal.order_id)

    data = request.get_json() or {}
    reject_reason = data.get('reject_reason', '')
    version = data.get('version')

    if not reject_reason:
        return jsonify({'error': '请填写驳回原因'}), 400

    try:
        validate_version(appeal, version)
        if order:
            validate_handler_role(order, user)
        validate_appeal_review(appeal, user, ['submitted', 'accepted', 'resubmitted'], '驳回补正')
    except ValidationError as err:
        if order:
            handle_validation_failure(order, user, '申诉驳回补正', err, appeal=appeal)
        return jsonify({'error': str(err), 'current_version': appeal.version}), err.error_code

    from_status = appeal.status
    appeal.status = 'rejected_correction'
    appeal.reject_reason = reject_reason
    appeal.reviewer_id = user.id
    appeal.reviewer_name = user.name
    appeal.version += 1

    add_appeal_log(
        appeal, '驳回补正', user,
        from_status, 'rejected_correction',
        f'驳回原因：{reject_reason}'
    )

    if order:
        add_order_log(
            order, '申诉驳回补正', user,
            order.status, order.status,
            f'驳回原因：{reject_reason}'
        )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(include_logs=True),
        'message': '申诉已驳回补正'
    })


@appeals_bp.route('/<int:appeal_id>/resubmit', methods=['POST'])
def resubmit_appeal(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    order = TeamOrder.query.get(appeal.order_id)

    data = request.get_json() or {}
    reason = data.get('reason', '')
    version = data.get('version')

    if not reason:
        return jsonify({'error': '请填写补充申诉理由'}), 400

    try:
        validate_version(appeal, version)
        if order:
            validate_handler_role(order, user)
        validate_appeal_resubmit(appeal, user)
    except ValidationError as err:
        if order:
            handle_validation_failure(order, user, '申诉再次提交', err, appeal=appeal)
        return jsonify({'error': str(err), 'current_version': appeal.version}), err.error_code

    from_status = appeal.status
    appeal.status = 'resubmitted'
    appeal.reason = reason
    appeal.resubmit_count = (appeal.resubmit_count or 0) + 1
    appeal.version += 1

    add_appeal_log(
        appeal, '再次提交申诉', user,
        from_status, 'resubmitted',
        f'补充理由：{reason}'
    )

    if order:
        add_order_log(
            order, '申诉再次提交', user,
            order.status, order.status,
            f'第 {appeal.resubmit_count} 次补充提交，补充理由：{reason}'
        )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(include_logs=True),
        'message': '申诉再次提交成功'
    })


@appeals_bp.route('/<int:appeal_id>/approve', methods=['POST'])
def approve_appeal(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    order = TeamOrder.query.get(appeal.order_id)

    data = request.get_json() or {}
    review_opinion = data.get('review_opinion', '')
    target_order_status = data.get('target_order_status')
    version = data.get('version')

    if not target_order_status:
        return jsonify({'error': '请指定申诉通过后预约单的目标状态'}), 400

    valid_targets = ['pending_verification', 'verified', 'entered', 'archived']
    if target_order_status not in valid_targets:
        return jsonify({'error': '无效的目标状态'}), 400

    try:
        validate_version(appeal, version)
        if order:
            validate_handler_role(order, user)
        validate_appeal_review(appeal, user, ['submitted', 'accepted', 'resubmitted'], '审批通过申诉')
    except ValidationError as err:
        if order:
            handle_validation_failure(order, user, '申诉审批', err, appeal=appeal)
        return jsonify({'error': str(err), 'current_version': appeal.version}), err.error_code

    from_status = appeal.status
    appeal.status = 'approved'
    appeal.review_opinion = review_opinion
    appeal.reviewer_id = user.id
    appeal.reviewer_name = user.name
    appeal.version += 1

    add_appeal_log(
        appeal, '申诉通过', user,
        from_status, 'approved',
        f'复核意见：{review_opinion}，预约单回到：{Config.ORDER_STATUS_NAMES.get(target_order_status, target_order_status)}'
    )

    if order:
        order_from = order.status
        order.status = target_order_status
        order.current_handler_role = get_next_handler_role(target_order_status)
        order.version += 1

        add_order_log(
            order, '申诉通过', user,
            order_from, target_order_status,
            f'申诉复核通过，预约单回到「{Config.ORDER_STATUS_NAMES.get(target_order_status, target_order_status)}」。复核意见：{review_opinion}'
        )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(include_logs=True),
        'order': order.to_dict() if order else None,
        'message': '申诉已通过'
    })


@appeals_bp.route('/<int:appeal_id>/deny', methods=['POST'])
def deny_appeal(appeal_id):
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    appeal = Appeal.query.get(appeal_id)
    if not appeal:
        return jsonify({'error': '申诉不存在'}), 404

    order = TeamOrder.query.get(appeal.order_id)

    data = request.get_json() or {}
    reject_reason = data.get('reject_reason', '')
    version = data.get('version')

    if not reject_reason:
        return jsonify({'error': '请填写驳回原因'}), 400

    try:
        validate_version(appeal, version)
        if order:
            validate_handler_role(order, user)
        validate_appeal_review(appeal, user, ['submitted', 'accepted', 'resubmitted'], '驳回申诉')
    except ValidationError as err:
        if order:
            handle_validation_failure(order, user, '申诉驳回', err, appeal=appeal)
        return jsonify({'error': str(err), 'current_version': appeal.version}), err.error_code

    from_status = appeal.status
    appeal.status = 'denied'
    appeal.reject_reason = reject_reason
    appeal.reviewer_id = user.id
    appeal.reviewer_name = user.name
    appeal.version += 1

    add_appeal_log(
        appeal, '申诉驳回', user,
        from_status, 'denied',
        f'驳回原因：{reject_reason}'
    )

    if order:
        order_from = order.status
        order.status = appeal.original_status
        order.current_handler_role = get_next_handler_role(appeal.original_status)
        order.version += 1

        add_order_log(
            order, '申诉驳回', user,
            order_from, appeal.original_status,
            f'申诉被驳回，预约单回到原状态「{Config.ORDER_STATUS_NAMES.get(appeal.original_status, appeal.original_status)}」。驳回原因：{reject_reason}'
        )

    db.session.commit()

    return jsonify({
        'appeal': appeal.to_dict(include_logs=True),
        'order': order.to_dict() if order else None,
        'message': '申诉已驳回'
    })


@appeals_bp.route('/list', methods=['GET'])
def list_appeals():
    user = get_current_user()
    if not user:
        return jsonify({'error': '未登录'}), 401

    status_filter = request.args.get('status')
    order_id = request.args.get('order_id')

    query = Appeal.query
    if status_filter:
        query = query.filter_by(status=status_filter)
    if order_id:
        query = query.filter_by(order_id=order_id)

    appeals = query.order_by(Appeal.created_at.desc()).all()

    result = []
    for appeal in appeals:
        ad = appeal.to_dict()
        ad['status_name'] = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
        order = TeamOrder.query.get(appeal.order_id)
        if order:
            ad['order_no'] = order.order_no
            ad['team_name'] = order.team_name
        result.append(ad)

    return jsonify(result)
