from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.contrib.auth.signals import user_logged_in
from .models import BookingApplication, OperationLog, User, RoleChoices


STATUS_FIELD_MAP = {
    'booking_status': '订舱状态',
    'loading_status': '装柜状态',
    'bl_status': '提单状态',
    'offline_booking_status': '离线台账-订舱状态',
    'offline_loading_status': '离线台账-装柜状态',
    'offline_bl_status': '离线台账-提单状态',
}

FIELD_LABEL_MAP = {
    'form_no': '订舱单号',
    'batch_no': '批次号',
    'customer': '客户名称',
    'forwarder': '货代/船公司',
    'port_of_loading': '起运港',
    'port_of_discharge': '目的港',
    'container_type': '柜型',
    'container_qty': '柜量',
    'cargo_desc': '货物描述',
    'weight': '重量',
    'volume': '体积',
    'etd': '预计开船日',
    'eta': '预计到港日',
    'bl_no': '提单号',
    'vessel': '船名航次',
    'so_no': 'SO号',
    'return_reason': '退回原因',
    'audit_remark': '审计备注',
    'result_note': '处理结果说明',
    'deadline': '办理时限',
}
FIELD_LABEL_MAP.update(STATUS_FIELD_MAP)


def log_operation(booking, action, operator=None, role='',
                  from_status='', to_status='', remark='',
                  field_changed='', old_value='', new_value='',
                  ip_address=None):
    log = OperationLog(
        booking=booking,
        action=action,
        operator=operator,
        operator_name=operator.real_name if operator and operator.real_name else (operator.username if operator else ''),
        role=role or (operator.role if operator else ''),
        from_status=from_status,
        to_status=to_status,
        remark=remark,
        field_changed=field_changed,
        old_value=str(old_value) if old_value is not None else '',
        new_value=str(new_value) if new_value is not None else '',
        ip_address=ip_address,
    )
    log.save()
    return log


@receiver(pre_save, sender=BookingApplication)
def capture_old_values(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            instance._old_values = {}
            for fname in STATUS_FIELD_MAP.keys():
                instance._old_values[fname] = getattr(old, fname)
            for fname in FIELD_LABEL_MAP.keys():
                if fname not in instance._old_values:
                    try:
                        instance._old_values[fname] = getattr(old, fname)
                    except Exception:
                        pass
        except sender.DoesNotExist:
            instance._old_values = {}
    else:
        instance._old_values = {}


@receiver(post_save, sender=BookingApplication)
def booking_post_save(sender, instance, created, **kwargs):
    if created:
        return
    old_vals = getattr(instance, '_old_values', {})
    for fname in STATUS_FIELD_MAP:
        old_v = old_vals.get(fname)
        new_v = getattr(instance, fname)
        if old_v and old_v != new_v:
            is_offline = fname.startswith('offline_')
            action = 'offline_fill' if is_offline else 'correct'
            log_operation(
                booking=instance,
                action=action,
                field_changed=STATUS_FIELD_MAP[fname],
                old_value=old_v,
                new_value=new_v,
            )
