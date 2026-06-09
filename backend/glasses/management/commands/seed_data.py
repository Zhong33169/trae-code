import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from glasses.models import (
    GlassesOrder,
    OrderAttachment,
    AuditLog,
    SystemUser,
    OrderStatus,
    Role,
    OfflineStatus,
    AnomalyType,
)


class Command(BaseCommand):
    help = '初始化配镜订单系统测试数据'

    def handle(self, *args, **options):
        self.stdout.write('开始初始化数据...')

        SystemUser.objects.all().delete()
        AuditLog.objects.all().delete()
        OrderAttachment.objects.all().delete()
        GlassesOrder.objects.all().delete()

        users = [
            SystemUser(username='wang_ling', name='王玲', role=Role.REGISTRAR),
            SystemUser(username='zhang_wei', name='张伟', role=Role.REGISTRAR),
            SystemUser(username='li_min', name='李敏', role=Role.SUPERVISOR),
            SystemUser(username='chen_hao', name='陈昊', role=Role.SUPERVISOR),
            SystemUser(username='zhao_fang', name='赵芳', role=Role.REVIEWER),
        ]
        SystemUser.objects.bulk_create(users)
        users = {u.username: u for u in SystemUser.objects.all()}

        wang = users['wang_ling']
        zhang = users['zhang_wei']
        li = users['li_min']
        zhao = users['zhao_fang']

        now = timezone.now()

        orders_data = [
            {
                'order_no': 'GZ20260601A001',
                'batch_no': 'BATCH-2026-0601',
                'patient_name': '刘建国',
                'patient_id_card': '310101198001011234',
                'lens_type': '渐进多焦点',
                'lens_power': '右：-3.00DS/-0.50DC 左：-2.75DS/-0.75DC',
                'frame_model': '雷朋 RB5154',
                'prescription_no': 'CF20260528001',
                'has_prescription': True,
                'has_insurance': True,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.ARCHIVED,
                'offline_status': OfflineStatus.ARCHIVED,
                'registered_by': wang.name,
                'registered_at': now - timedelta(days=10),
                'reviewed_by': li.name,
                'reviewed_at': now - timedelta(days=9),
                'finalized_by': zhao.name,
                'finalized_at': now - timedelta(days=8),
                'result_remark': '配镜完成，患者已取镜，视力矫正良好',
                'is_overdue': False,
                'anomaly_types': [],
                'anomaly_remark': '',
                'created_at': now - timedelta(days=10),
            },
            {
                'order_no': 'GZ20260601A002',
                'batch_no': 'BATCH-2026-0601',
                'patient_name': '陈小美',
                'patient_id_card': '310101199505152345',
                'lens_type': '防蓝光单光',
                'lens_power': '右：-4.00DS 左：-3.75DS',
                'frame_model': '暴龙 BJ6035',
                'prescription_no': 'CF20260529003',
                'has_prescription': True,
                'has_insurance': False,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.PENDING_FINAL,
                'offline_status': OfflineStatus.REVIEWED,
                'registered_by': zhang.name,
                'registered_at': now - timedelta(days=2),
                'reviewed_by': li.name,
                'reviewed_at': now - timedelta(days=1),
                'result_remark': '审核通过，参数符合处方要求',
                'is_overdue': False,
                'anomaly_types': [],
                'anomaly_remark': '',
                'created_at': now - timedelta(days=2),
            },
            {
                'order_no': 'GZ20260602A003',
                'batch_no': 'BATCH-2026-0602',
                'patient_name': '周海涛',
                'patient_id_card': '320102198803203456',
                'lens_type': '',
                'lens_power': '',
                'frame_model': '',
                'prescription_no': '',
                'has_prescription': False,
                'has_insurance': True,
                'has_id_copy': False,
                'has_receipt': False,
                'status': OrderStatus.PENDING_REGISTRATION,
                'offline_status': OfflineStatus.NOT_RECORDED,
                'registered_by': '',
                'registered_at': None,
                'reviewed_by': '',
                'reviewed_at': None,
                'result_remark': '',
                'is_overdue': False,
                'anomaly_types': [AnomalyType.MISSING_MATERIALS],
                'anomaly_remark': '缺少处方单',
                'created_at': now - timedelta(hours=2),
            },
            {
                'order_no': 'GZ20260602A004',
                'batch_no': 'BATCH-2026-0602',
                'patient_name': '吴秀兰',
                'patient_id_card': '330106195212124567',
                'lens_type': '老花渐进片',
                'lens_power': '右：+2.50DS 左：+2.75DS',
                'frame_model': '精工 HT1001',
                'prescription_no': 'CF20260530007',
                'has_prescription': True,
                'has_insurance': True,
                'has_id_copy': True,
                'has_receipt': False,
                'status': OrderStatus.RETURNED,
                'offline_status': OfflineStatus.REGISTERED,
                'registered_by': wang.name,
                'registered_at': now - timedelta(days=5),
                'reviewed_by': li.name,
                'reviewed_at': now - timedelta(days=4),
                'return_reason': '缺少收费凭证，需补充后重新提交',
                'return_by': li.name,
                'return_at': now - timedelta(days=4),
                'result_remark': '',
                'is_overdue': True,
                'anomaly_types': [AnomalyType.MISSING_MATERIALS, AnomalyType.OVERDUE],
                'anomaly_remark': '缺少收费凭证; 订单创建已 5 天，超过 3 天处理时限',
                'created_at': now - timedelta(days=5),
            },
            {
                'order_no': 'GZ20260603A005',
                'batch_no': 'BATCH-2026-0603',
                'patient_name': '孙志强',
                'patient_id_card': '340103197908085678',
                'lens_type': '变色镜片',
                'lens_power': '右：-5.00DS/-1.00DC 左：-4.75DS/-1.25DC',
                'frame_model': 'Oakley OX8100',
                'prescription_no': 'CF20260601012',
                'has_prescription': True,
                'has_insurance': False,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.PENDING_REVIEW,
                'offline_status': OfflineStatus.REGISTERED,
                'registered_by': zhang.name,
                'registered_at': now - timedelta(hours=5),
                'reviewed_by': '',
                'reviewed_at': None,
                'result_remark': '',
                'is_overdue': False,
                'anomaly_types': [],
                'anomaly_remark': '',
                'created_at': now - timedelta(hours=6),
            },
            {
                'order_no': 'GZ20260603A006',
                'batch_no': 'BATCH-2026-0603',
                'patient_name': '马晓燕',
                'patient_id_card': '350104199204046789',
                'lens_type': '防蓝光单光',
                'lens_power': '右：-3.50DS 左：-3.25DS',
                'frame_model': '陌森 MJ6088',
                'prescription_no': 'CF20260602015',
                'has_prescription': True,
                'has_insurance': True,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.PENDING_REVIEW,
                'offline_status': OfflineStatus.REGISTERED,
                'registered_by': wang.name,
                'registered_at': now - timedelta(hours=3),
                'reviewed_by': '',
                'reviewed_at': None,
                'result_remark': '',
                'is_overdue': False,
                'anomaly_types': [],
                'anomaly_remark': '',
                'created_at': now - timedelta(hours=4),
            },
            {
                'order_no': 'GZ20260528A007',
                'batch_no': 'BATCH-2026-0528',
                'patient_name': '黄伟国',
                'patient_id_card': '360105196511117890',
                'lens_type': '双光镜片',
                'lens_power': '右：+1.50DS/-0.50DC 左：+1.75DS/-0.75DC',
                'frame_model': '保时捷 P8012',
                'prescription_no': 'CF20260525004',
                'has_prescription': True,
                'has_insurance': True,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.PENDING_REVIEW,
                'offline_status': OfflineStatus.REVIEWED,
                'registered_by': zhang.name,
                'registered_at': now - timedelta(days=12),
                'reviewed_by': '',
                'reviewed_at': None,
                'return_reason': '',
                'result_remark': '',
                'is_overdue': True,
                'anomaly_types': [AnomalyType.STATUS_MISMATCH, AnomalyType.OVERDUE],
                'anomaly_remark': '线上状态「待审核」与线下状态「线下已审核」不一致; 订单创建已 12 天，超过 3 天处理时限',
                'created_at': now - timedelta(days=12),
            },
            {
                'order_no': 'GZ20260604A008',
                'batch_no': 'BATCH-2026-0604',
                'patient_name': '林雅琪',
                'patient_id_card': '370106199807078901',
                'lens_type': '日抛隐形眼镜',
                'lens_power': '右：-2.75DS 左：-2.50DS',
                'frame_model': '',
                'prescription_no': 'CF20260603020',
                'has_prescription': True,
                'has_insurance': False,
                'has_id_copy': False,
                'has_receipt': True,
                'status': OrderStatus.PENDING_REGISTRATION,
                'offline_status': OfflineStatus.NOT_RECORDED,
                'registered_by': '',
                'registered_at': None,
                'reviewed_by': '',
                'reviewed_at': None,
                'result_remark': '',
                'is_overdue': False,
                'anomaly_types': [],
                'anomaly_remark': '',
                'created_at': now - timedelta(hours=30),
            },
            {
                'order_no': 'GZ20260604A009',
                'batch_no': 'BATCH-2026-0604',
                'patient_name': '高文博',
                'patient_id_card': '310115199002029012',
                'lens_type': '抗疲劳镜片',
                'lens_power': '右：-2.00DS 左：-1.75DS',
                'frame_model': '雷朋 RX6355',
                'prescription_no': 'CF20260603025',
                'has_prescription': False,
                'has_insurance': False,
                'has_id_copy': True,
                'has_receipt': False,
                'status': OrderStatus.PENDING_REGISTRATION,
                'offline_status': OfflineStatus.REGISTERED,
                'registered_by': wang.name,
                'registered_at': now - timedelta(days=1),
                'reviewed_by': '',
                'reviewed_at': None,
                'result_remark': '',
                'is_overdue': False,
                'anomaly_types': [AnomalyType.STATUS_MISMATCH],
                'anomaly_remark': '线上状态「待登记」与线下状态「线下已登记」不一致',
                'created_at': now - timedelta(days=1),
            },
            {
                'order_no': 'GZ20260601A010',
                'batch_no': 'BATCH-2026-0601',
                'patient_name': '郑红梅',
                'patient_id_card': '320104197209090123',
                'lens_type': '渐进多焦点',
                'lens_power': '右：+1.00DS/-0.75DC 左：+1.25DS/-0.50DC',
                'frame_model': '夏蒙 CH10921',
                'prescription_no': 'CF20260528008',
                'has_prescription': True,
                'has_insurance': True,
                'has_id_copy': True,
                'has_receipt': True,
                'status': OrderStatus.PENDING_FINAL,
                'offline_status': OfflineStatus.REVIEWED,
                'registered_by': zhang.name,
                'registered_at': now - timedelta(days=3),
                'reviewed_by': li.name,
                'reviewed_at': now - timedelta(days=2),
                'result_remark': '审核通过，参数符合要求，等待复核',
                'is_overdue': False,
                'anomaly_types': [AnomalyType.DUPLICATE_BATCH],
                'anomaly_remark': '批次号 BATCH-2026-0601 存在 2 条重复记录',
                'created_at': now - timedelta(days=3),
            },
        ]

        for data in orders_data:
            created_at = data.pop('created_at', now)
            order = GlassesOrder(**data)
            order.save()
            order.created_at = created_at
            order.save()

        orders = list(GlassesOrder.objects.all())
        self.stdout.write(f'已创建 {len(orders)} 条配镜订单')

        attachments_data = [
            {'order_idx': 0, 'file_name': '处方单_CF20260528001.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 0, 'file_name': '身份证复印件.jpg', 'file_type': 'image', 'remark': '患者身份证'},
            {'order_idx': 0, 'file_name': '医保结算单.pdf', 'file_type': 'pdf', 'remark': '医保报销凭证'},
            {'order_idx': 0, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
            {'order_idx': 1, 'file_name': '处方单_CF20260529003.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 1, 'file_name': '身份证复印件.jpg', 'file_type': 'image', 'remark': '患者身份证'},
            {'order_idx': 1, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
            {'order_idx': 3, 'file_name': '处方单_CF20260530007.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 3, 'file_name': '医保结算单.pdf', 'file_type': 'pdf', 'remark': '医保报销凭证'},
            {'order_idx': 3, 'file_name': '身份证复印件.jpg', 'file_type': 'image', 'remark': '患者身份证'},
            {'order_idx': 4, 'file_name': '处方单_CF20260601012.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 4, 'file_name': '身份证复印件.jpg', 'file_type': 'image', 'remark': '患者身份证'},
            {'order_idx': 4, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
            {'order_idx': 5, 'file_name': '处方单_CF20260602015.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 5, 'file_name': '医保结算单.pdf', 'file_type': 'pdf', 'remark': '医保报销凭证'},
            {'order_idx': 5, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
            {'order_idx': 6, 'file_name': '处方单_CF20260525004.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 7, 'file_name': '处方单_CF20260603020.pdf', 'file_type': 'pdf', 'remark': '隐形眼镜验配处方'},
            {'order_idx': 7, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
            {'order_idx': 9, 'file_name': '处方单_CF20260528008.pdf', 'file_type': 'pdf', 'remark': '验光处方单'},
            {'order_idx': 9, 'file_name': '医保结算单.pdf', 'file_type': 'pdf', 'remark': '医保报销凭证'},
            {'order_idx': 9, 'file_name': '身份证复印件.jpg', 'file_type': 'image', 'remark': '患者身份证'},
            {'order_idx': 9, 'file_name': '收费凭证.jpg', 'file_type': 'image', 'remark': '缴费收据'},
        ]

        attachment_objs = []
        for att_data in attachments_data:
            order = orders[att_data['order_idx']]
            attachment_objs.append(OrderAttachment(
                order=order,
                file_name=att_data['file_name'],
                file_type=att_data['file_type'],
                file_size=random.randint(50000, 500000),
                file_url=f'/attachments/{order.id}/{att_data["file_name"]}',
                uploaded_by=order.registered_by or wang.name,
                remark=att_data['remark'],
            ))
        OrderAttachment.objects.bulk_create(attachment_objs)
        self.stdout.write(f'已创建 {len(attachment_objs)} 条附件记录')

        all_orders = list(GlassesOrder.objects.all())
        for order in all_orders:
            order.detect_anomalies()
            order.save()

        dup_count = sum(1 for o in all_orders if AnomalyType.DUPLICATE_BATCH in (o.anomaly_types or []))
        mismatch_count = sum(1 for o in all_orders if AnomalyType.STATUS_MISMATCH in (o.anomaly_types or []))
        missing_count = sum(1 for o in all_orders if AnomalyType.MISSING_MATERIALS in (o.anomaly_types or []))
        overdue_count = sum(1 for o in all_orders if o.is_overdue)

        self.stdout.write(self.style.SUCCESS('数据初始化完成！'))
        self.stdout.write('')
        self.stdout.write('=== 数据统计 ===')
        self.stdout.write(f'订单总数: {len(all_orders)}')
        self.stdout.write(f'  - 待登记: {sum(1 for o in all_orders if o.status == OrderStatus.PENDING_REGISTRATION)}')
        self.stdout.write(f'  - 待审核: {sum(1 for o in all_orders if o.status == OrderStatus.PENDING_REVIEW)}')
        self.stdout.write(f'  - 待复核: {sum(1 for o in all_orders if o.status == OrderStatus.PENDING_FINAL)}')
        self.stdout.write(f'  - 已退回: {sum(1 for o in all_orders if o.status == OrderStatus.RETURNED)}')
        self.stdout.write(f'  - 已归档: {sum(1 for o in all_orders if o.status == OrderStatus.ARCHIVED)}')
        self.stdout.write(f'  - 超时订单: {overdue_count}')
        self.stdout.write(f'  - 重复批次订单: {dup_count}')
        self.stdout.write(f'  - 状态不一致订单: {mismatch_count}')
        self.stdout.write(f'  - 材料缺失订单: {missing_count}')
        self.stdout.write(f'用户总数: {SystemUser.objects.count()}')
        self.stdout.write(f'附件总数: {OrderAttachment.objects.count()}')
