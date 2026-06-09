from dataclasses import dataclass, field
from typing import List, Tuple

from django.utils import timezone

from .models import (
    GlassesOrder,
    SystemUser,
    Role,
    OrderStatus,
    AnomalyType,
    OfflineStatus,
)


@dataclass
class ValidationResult:
    passed: bool
    blocking_errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    info: List[str] = field(default_factory=list)

    @property
    def has_warnings(self):
        return len(self.warnings) > 0

    @property
    def has_errors(self):
        return len(self.blocking_errors) > 0

    @property
    def all_messages(self):
        return self.blocking_errors + self.warnings + self.info

    def to_dict(self):
        return {
            'passed': self.passed,
            'blocking_errors': self.blocking_errors,
            'warnings': self.warnings,
            'info': self.info,
            'all_messages': self.all_messages,
        }


class OrderAuthorizationService:

    @staticmethod
    def authenticate(username: str, role: str) -> Tuple[SystemUser, bool]:
        try:
            user = SystemUser.objects.get(username=username)
        except SystemUser.DoesNotExist:
            return None, False

        if user.role != role:
            return user, False

        return user, True

    @staticmethod
    def can_view_order(user: SystemUser, order: GlassesOrder) -> bool:
        return True

    @staticmethod
    def can_create_order(user: SystemUser) -> bool:
        return user.role in [Role.REGISTRAR, Role.SUPERVISOR]

    @staticmethod
    def can_edit_order(user: SystemUser, order: GlassesOrder) -> bool:
        if user.role not in [Role.REGISTRAR, Role.SUPERVISOR]:
            return False
        return order.status in [OrderStatus.PENDING_REGISTRATION, OrderStatus.RETURNED]

    @staticmethod
    def can_submit_order(user: SystemUser, order: GlassesOrder) -> bool:
        if user.role != Role.REGISTRAR:
            return False
        return order.status in [OrderStatus.PENDING_REGISTRATION, OrderStatus.RETURNED]

    @staticmethod
    def can_review_order(user: SystemUser, order: GlassesOrder) -> bool:
        if user.role != Role.SUPERVISOR:
            return False
        return order.status == OrderStatus.PENDING_REVIEW

    @staticmethod
    def can_finalize_order(user: SystemUser, order: GlassesOrder) -> bool:
        if user.role != Role.REVIEWER:
            return False
        return order.status == OrderStatus.PENDING_FINAL

    @staticmethod
    def can_manage_attachments(user: SystemUser, order: GlassesOrder) -> bool:
        if user.role not in [Role.REGISTRAR, Role.SUPERVISOR]:
            return False
        return order.status not in [OrderStatus.ARCHIVED]


class OrderValidationService:

    @classmethod
    def validate_submit(cls, order: GlassesOrder) -> ValidationResult:
        result = ValidationResult(passed=True)

        order.detect_anomalies()
        anomalies = order.anomaly_types or []

        if AnomalyType.MISSING_MATERIALS in anomalies:
            result.blocking_errors.append(
                f'材料缺失：{cls._extract_material_remark(order.anomaly_remark)}'
            )
            result.passed = False

        if AnomalyType.STATUS_MISMATCH in anomalies:
            offline_label = order.get_offline_status_display()
            online_label = order.get_status_display()
            result.blocking_errors.append(
                f'线上线下状态不一致：线上「{online_label}」，线下「{offline_label}」，'
                f'请先核对台账状态再提交'
            )
            result.passed = False

        if AnomalyType.DUPLICATE_BATCH in anomalies:
            duplicate_count = GlassesOrder.objects.filter(
                batch_no=order.batch_no
            ).exclude(id=order.id).count()
            result.warnings.append(
                f'重复批次提示：批次号「{order.batch_no}」下已有 {duplicate_count} 条订单，'
                f'请确认是否为同一批次的不同订单'
            )

        if AnomalyType.OVERDUE in anomalies:
            age_days = (timezone.now() - order.created_at).days
            result.warnings.append(
                f'订单超时提醒：订单创建已 {age_days} 天，超过 3 天处理时限，请尽快处理'
            )

        if not order.patient_name:
            result.blocking_errors.append('缺少患者姓名')
            result.passed = False

        if not order.batch_no:
            result.blocking_errors.append('缺少批次号')
            result.passed = False

        if not order.lens_type and not order.lens_power and not order.frame_model:
            result.warnings.append('配镜信息不完整，建议补充镜片类型、度数和镜架型号')

        return result

    @classmethod
    def validate_review(cls, order: GlassesOrder) -> ValidationResult:
        result = ValidationResult(passed=True)

        order.detect_anomalies()
        anomalies = order.anomaly_types or []

        if AnomalyType.MISSING_MATERIALS in anomalies:
            result.blocking_errors.append(
                f'材料缺失：{cls._extract_material_remark(order.anomaly_remark)}'
            )
            result.passed = False

        if AnomalyType.STATUS_MISMATCH in anomalies:
            offline_label = order.get_offline_status_display()
            result.blocking_errors.append(
                f'线上线下状态不一致：线下台账状态为「{offline_label}」，'
                f'与当前待审核状态不匹配，请先核对线下台账'
            )
            result.passed = False

        if AnomalyType.DUPLICATE_BATCH in anomalies:
            duplicate_count = GlassesOrder.objects.filter(
                batch_no=order.batch_no
            ).exclude(id=order.id).count()
            result.warnings.append(
                f'重复批次提示：批次号「{order.batch_no}」下有 {duplicate_count} 条关联订单，'
                f'请确认该批次配镜信息一致性'
            )

        if AnomalyType.OVERDUE in anomalies:
            age_days = (timezone.now() - order.created_at).days
            result.blocking_errors.append(
                f'订单已超时：创建已 {age_days} 天，超过 3 天处理时限，'
                f'需退回补正并登记超时原因'
            )
            result.passed = False

        if not order.registered_by:
            result.info.append('登记人信息为空')

        return result

    @classmethod
    def validate_finalize(cls, order: GlassesOrder) -> ValidationResult:
        result = ValidationResult(passed=True)

        order.detect_anomalies()
        anomalies = order.anomaly_types or []

        if AnomalyType.MISSING_MATERIALS in anomalies:
            result.blocking_errors.append(
                f'材料缺失：{cls._extract_material_remark(order.anomaly_remark)}'
                f'，归档前必须补齐所有必备材料'
            )
            result.passed = False

        if AnomalyType.STATUS_MISMATCH in anomalies:
            offline_label = order.get_offline_status_display()
            result.blocking_errors.append(
                f'线上线下状态不一致：线下台账状态为「{offline_label}」，'
                f'与当前待复核状态不匹配，归档前必须确保线上线下状态一致'
            )
            result.passed = False

        if AnomalyType.DUPLICATE_BATCH in anomalies:
            duplicate_count = GlassesOrder.objects.filter(
                batch_no=order.batch_no
            ).exclude(id=order.id).count()
            result.warnings.append(
                f'重复批次提示：批次号「{order.batch_no}」下有 {duplicate_count} 条订单，'
                f'请确认是否需并批处理'
            )

        if AnomalyType.OVERDUE in anomalies:
            age_days = (timezone.now() - order.created_at).days
            result.blocking_errors.append(
                f'订单已超时：创建已 {age_days} 天，超过 3 天处理时限，'
                f'需登记超时说明后方可归档'
            )
            result.passed = False

        if not order.reviewed_by:
            result.blocking_errors.append('缺少审核人信息，无法归档')
            result.passed = False

        if not order.reviewed_at:
            result.blocking_errors.append('缺少审核时间，无法归档')
            result.passed = False

        return result

    @staticmethod
    def _extract_material_remark(remark: str) -> str:
        if not remark:
            return '材料不齐全'
        if '缺少' in remark:
            parts = remark.split('缺少')
            if len(parts) > 1:
                return '缺少' + parts[1].split(';')[0].strip()
        return remark


class RoleUserMapping:
    DEFAULT_USERS = {
        Role.REGISTRAR: 'wang_ling',
        Role.SUPERVISOR: 'li_min',
        Role.REVIEWER: 'zhao_fang',
    }

    @classmethod
    def get_default_user_for_role(cls, role: str) -> str:
        return cls.DEFAULT_USERS.get(role, 'wang_ling')

    @classmethod
    def get_users_by_role(cls, role: str) -> List[SystemUser]:
        return list(SystemUser.objects.filter(role=role).order_by('name'))
