import json
from models import db, OrderLog, AppealLog
from config import Config


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


def _format_order_snapshot(order):
    evidence_names = []
    for e in evidence_to_list(order.evidence or ''):
        evidence_names.append(Config.EVIDENCE_NAMES.get(e, e))
    evidence_str = '、'.join(evidence_names) if evidence_names else '(无)'
    status_name = Config.ORDER_STATUS_NAMES.get(order.status, order.status)
    handler_name = Config.ROLE_NAMES.get(order.current_handler_role, order.current_handler_role)
    return f'[状态={status_name} 版本=v{order.version} 证据={evidence_str} 处理岗位={handler_name}]'


def _format_appeal_snapshot(appeal):
    status_name = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
    return f'[状态={status_name} 版本=v{appeal.version}]'


def get_next_handler_role(status):
    mapping = {
        'pending_verification': 'ticket_specialist',
        'verified': 'site_dispatcher',
        'entered': 'scenic_manager',
        'archived': 'scenic_manager',
        'appeal_pending': 'scenic_manager'
    }
    return mapping.get(status, 'ticket_specialist')


def add_order_log(order, action, user, from_status, to_status, remark='', audit_note='', order_snapshot=''):
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
    parts = []
    if remark:
        parts.append(remark)
    if audit_note:
        parts.append(f'审计备注：{audit_note}')
    if order_snapshot:
        parts.append(f'失败前订单快照：{order_snapshot}')
    if parts:
        log.remark = ' | '.join(parts) if len(parts) > 1 else parts[0]
    db.session.add(log)
    return log


class ValidationError(Exception):
    def __init__(self, message, error_code=400, audit_note='', preserve_state=True):
        super().__init__(message)
        self.error_code = error_code
        self.audit_note = audit_note
        self.preserve_state = preserve_state


def validate_version(obj, submitted_version):
    if submitted_version is not None and submitted_version != obj.version:
        raise ValidationError(
            f'版本冲突，数据已被其他人修改，请刷新后重试（当前版本 v{obj.version}，提交版本 v{submitted_version}）',
            error_code=409,
            audit_note=f'版本校验失败：当前版本 v{obj.version}，提交版本 v{submitted_version}，操作被拒绝'
        )


def validate_handler_role(order, user):
    if order.current_handler_role and user.role != order.current_handler_role:
        user_role_name = Config.ROLE_NAMES.get(user.role, user.role)
        handler_role_name = Config.ROLE_NAMES.get(order.current_handler_role, order.current_handler_role)
        raise ValidationError(
            f'当前处理岗位为「{handler_role_name}」，您的角色「{user_role_name}」无权操作此预约单',
            error_code=403,
            audit_note=f'处理岗位校验失败：{user_role_name}({user.name})尝试操作，但当前处理岗位为{handler_role_name}，权限不足'
        )


def validate_role_transition(order, target_status, user):
    validate_handler_role(order, user)

    role = user.role
    transitions = Config.STATUS_TRANSITIONS.get(role, {})
    allowed_targets = transitions.get(order.status, [])

    if target_status not in allowed_targets:
        role_name = Config.ROLE_NAMES.get(role, role)
        from_name = Config.ORDER_STATUS_NAMES.get(order.status, order.status)
        to_name = Config.ORDER_STATUS_NAMES.get(target_status, target_status)
        raise ValidationError(
            f'{role_name}无权从「{from_name}」推进到「{to_name}」',
            error_code=403,
            audit_note=f'角色校验失败：{role_name}({user.name})尝试从「{from_name}」流转到「{to_name}」，权限不足'
        )


def validate_evidence(order, target_status):
    if target_status not in Config.REQUIRED_EVIDENCE:
        return

    required = Config.REQUIRED_EVIDENCE[target_status]
    current_evidence = evidence_to_list(order.evidence)
    missing = [e for e in required if e not in current_evidence]

    if missing:
        missing_names = [Config.EVIDENCE_NAMES.get(e, e) for e in missing]
        raise ValidationError(
            f'缺少必填证据：{", ".join(missing_names)}',
            error_code=400,
            audit_note=f'证据校验失败：目标状态「{Config.ORDER_STATUS_NAMES.get(target_status, target_status)}」缺少证据 {", ".join(missing_names)}'
        )


def validate_appeal_submission(order, user):
    validate_handler_role(order, user)

    if order.status == 'appeal_pending':
        raise ValidationError(
            '该预约单已有申诉正在处理中',
            error_code=400,
            audit_note='申诉提交校验失败：订单当前已处于申诉中状态，重复提交被拒绝'
        )

    if order.status == 'archived':
        raise ValidationError(
            '已归档的预约单不能申诉',
            error_code=400,
            audit_note='申诉提交校验失败：订单已归档，不允许申诉'
        )

    allowed_submitter = Config.APPEAL_ALLOWED_SUBMITTERS.get(order.status)
    if allowed_submitter and user.role != allowed_submitter and user.role not in Config.APPEAL_ALLOWED_REVIEWERS:
        role_name = Config.ROLE_NAMES.get(user.role, user.role)
        allowed_name = Config.ROLE_NAMES.get(allowed_submitter, allowed_submitter)
        status_name = Config.ORDER_STATUS_NAMES.get(order.status, order.status)
        raise ValidationError(
            f'{role_name}无权对「{status_name}」状态的预约单提交申诉，应由{allowed_name}提交',
            error_code=403,
            audit_note=f'申诉角色校验失败：{role_name}({user.name})尝试对「{status_name}」订单提交申诉，应由{allowed_name}操作'
        )

    if order.status in Config.REQUIRED_EVIDENCE:
        required = Config.REQUIRED_EVIDENCE[order.status]
        current_evidence = evidence_to_list(order.evidence)
        missing = [e for e in required if e not in current_evidence]
        if missing:
            missing_names = [Config.EVIDENCE_NAMES.get(e, e) for e in missing]
            raise ValidationError(
                f'当前状态「{Config.ORDER_STATUS_NAMES.get(order.status, order.status)}」缺少必填证据：{"、".join(missing_names)}，请先补齐证据再提交申诉',
                error_code=400,
                audit_note=f'申诉提交证据校验失败：当前状态缺少证据 {"、".join(missing_names)}'
            )


def validate_appeal_review(appeal, user, allowed_statuses, action_name):
    if user.role not in Config.APPEAL_ALLOWED_REVIEWERS:
        role_name = Config.ROLE_NAMES.get(user.role, user.role)
        raise ValidationError(
            f'{role_name}无权{action_name}',
            error_code=403,
            audit_note=f'申诉复核角色校验失败：{role_name}({user.name})尝试{action_name}，权限不足'
        )

    if appeal.status not in allowed_statuses:
        status_name = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
        allowed_names = '、'.join(Config.APPEAL_STATUS_NAMES.get(s, s) for s in allowed_statuses)
        raise ValidationError(
            f'当前申诉状态「{status_name}」不能{action_name}，允许的状态：{allowed_names}',
            error_code=400,
            audit_note=f'申诉状态校验失败：当前「{status_name}」不允许{action_name}，允许的状态：{allowed_names}'
        )


def validate_appeal_resubmit(appeal, user):
    if appeal.status not in Config.APPEAL_RESUBMIT_ALLOWED_STATUSES:
        status_name = Config.APPEAL_STATUS_NAMES.get(appeal.status, appeal.status)
        raise ValidationError(
            f'当前申诉状态「{status_name}」不能再次提交',
            error_code=400,
            audit_note=f'申诉再次提交校验失败：当前状态「{status_name}」不允许再次提交'
        )

    if appeal.submitter_role != user.role:
        role_name = Config.ROLE_NAMES.get(user.role, user.role)
        submitter_name = Config.ROLE_NAMES.get(appeal.submitter_role, appeal.submitter_role)
        raise ValidationError(
            f'{role_name}无权再次提交该申诉，应由原提交人角色（{submitter_name}）操作',
            error_code=403,
            audit_note=f'申诉再次提交角色校验失败：{role_name}({user.name})尝试再次提交，原提交角色为{submitter_name}'
        )


def handle_validation_failure(order, user, action, err, appeal=None):
    order_snapshot = _format_order_snapshot(order) if order else ''

    add_order_log(
        order, f'{action}失败', user,
        order.status, order.status,
        remark=str(err),
        audit_note=err.audit_note,
        order_snapshot=order_snapshot
    )

    if appeal:
        appeal_snapshot = _format_appeal_snapshot(appeal)
        _add_appeal_log_with_snapshot(appeal, action, user, err, order_snapshot, appeal_snapshot)

    db.session.commit()


def _add_appeal_log_with_snapshot(appeal, action, user, err, order_snapshot, appeal_snapshot):
    parts = [str(err)]
    if err.audit_note:
        parts.append(f'审计备注：{err.audit_note}')
    if order_snapshot:
        parts.append(f'失败前订单快照：{order_snapshot}')
    if appeal_snapshot:
        parts.append(f'失败前申诉快照：{appeal_snapshot}')

    log = AppealLog(
        appeal_id=appeal.id,
        action=f'{action}失败',
        operator_id=user.id if user else None,
        operator_name=user.name if user else None,
        operator_role=user.role if user else None,
        from_status=appeal.status,
        to_status=appeal.status,
        remark=' | '.join(parts)
    )
    db.session.add(log)
    return log


def validate_order_transition(order, target_status, user, submitted_version):
    validate_version(order, submitted_version)
    validate_role_transition(order, target_status, user)
    validate_evidence(order, target_status)
