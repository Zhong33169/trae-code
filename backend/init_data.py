import os
import sys
import django
from datetime import date, datetime, timedelta
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from django.utils import timezone
from django.contrib.auth.hashers import make_password
from app.booking.models import (
    User, RoleChoices, BookingApplication, BookingStatusChoices,
    LoadingStatusChoices, BlStatusChoices, ExceptionTypeChoices,
    ActionChoices, OperationLog, AuditLog, Attachment,
    OfflineLedgerRecord,
)
from app.booking.signals import log_operation


def run():
    print('========== 开始初始化演示数据 ==========')
    if User.objects.exists():
        print('检测到已有数据，跳过初始化。如需重新初始化请删除 db.sqlite3 后再次运行。')
        return

    print('1. 创建用户账号')
    registrar = User.objects.create_user(
        username='registrar', password='123456',
        real_name='王登记', role=RoleChoices.REGISTRAR, phone='13800000001',
        is_staff=True,
    )
    supervisor = User.objects.create_user(
        username='supervisor', password='123456',
        real_name='李主管', role=RoleChoices.SUPERVISOR, phone='13800000002',
        is_staff=True,
    )
    reviewer = User.objects.create_user(
        username='reviewer', password='123456',
        real_name='赵复核', role=RoleChoices.REVIEWER, phone='13800000003',
        is_staff=True,
    )
    admin = User.objects.create_superuser(
        username='admin', password='admin123',
        real_name='管理员', role=RoleChoices.SUPERVISOR,
    )
    print('   账号创建完成：')
    print('   - 订舱登记员: registrar / 123456 (王登记)')
    print('   - 订舱审核主管: supervisor / 123456 (李主管)')
    print('   - 外贸公司复核负责人: reviewer / 123456 (赵复核)')
    print('   - 超级管理员: admin / admin123')

    today = date.today()
    now = timezone.now()

    def make_booking(**kwargs):
        return BookingApplication.objects.create(**kwargs)

    print()
    print('2. 创建订舱申请样例')

    # ============ 样例1：正常流程单（已归档） ============
    print('   [样例1] PK-2026-001 正常单（已归档完成）')
    b1 = make_booking(
        form_no='PK-2026-001', batch_no='BATCH-2026-001',
        customer='上海华盛进出口贸易有限公司', forwarder='中远海运集装箱运输有限公司',
        port_of_loading='上海', port_of_discharge='洛杉矶',
        container_type='40HQ', container_qty=2,
        cargo_desc='电子产品 - 智能手机配件', weight=18.5, volume=45.0,
        etd=today + timedelta(days=5), eta=today + timedelta(days=25),
        bl_no='COSU6287654321', vessel='COSCO SHIPPING / 045E',
        so_no='SO-SHA-2026-88901',
        booking_status=BookingStatusChoices.ARCHIVED,
        loading_status=LoadingStatusChoices.LOADED,
        bl_status=BlStatusChoices.ARCHIVED,
        is_exception=False, exception_type=ExceptionTypeChoices.NONE,
        deadline=now + timedelta(days=3),
        submitter=registrar, reviewer=supervisor, archivist=reviewer,
        submitted_at=now - timedelta(days=12), reviewed_at=now - timedelta(days=11),
        archived_at=now - timedelta(days=2),
        offline_booking_status=BookingStatusChoices.ARCHIVED,
        offline_loading_status=LoadingStatusChoices.LOADED,
        offline_bl_status=BlStatusChoices.ARCHIVED,
    )
    log_operation(b1, ActionChoices.CREATE, operator=registrar,
                  to_status=b1.booking_status, remark='订舱登记员发起申请')
    log_operation(b1, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW, remark='提交审核')
    log_operation(b1, ActionChoices.REVIEW_PASS, operator=supervisor,
                  to_status=BookingStatusChoices.REVIEW_PASSED, remark='审核通过')
    log_operation(b1, ActionChoices.BOOK_CONFIRM, operator=supervisor,
                  to_status=BookingStatusChoices.BOOKED, remark='订舱确认成功，SO号已下')
    log_operation(b1, ActionChoices.LOAD_ARRANGE, operator=registrar,
                  to_status=LoadingStatusChoices.PENDING_CONFIRM, remark='安排装柜')
    log_operation(b1, ActionChoices.LOAD_CONFIRM, operator=supervisor,
                  to_status=LoadingStatusChoices.LOADED, remark='装柜完成')
    log_operation(b1, ActionChoices.BL_ISSUE, operator=registrar,
                  to_status=BlStatusChoices.PENDING_COLLECT, remark='提单出单')
    log_operation(b1, ActionChoices.BL_COLLECT, operator=registrar,
                  to_status=BlStatusChoices.COLLECTED, remark='提单回收')
    log_operation(b1, ActionChoices.REVIEW_ARCHIVE, operator=reviewer,
                  to_status=BookingStatusChoices.ARCHIVED, remark='复核归档通过')
    AuditLog.objects.create(
        booking=b1, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS, remark='审核通过，资料齐全',
    )
    AuditLog.objects.create(
        booking=b1, audit_type=AuditLog.AuditTypeChoices.LOADING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS, remark='装柜完成，货单一致',
    )
    AuditLog.objects.create(
        booking=b1, audit_type=AuditLog.AuditTypeChoices.BL,
        auditor=registrar, auditor_name=registrar.real_name,
        result=AuditLog.ResultChoices.PASS, remark='提单信息核对无误',
    )
    AuditLog.objects.create(
        booking=b1, audit_type=AuditLog.AuditTypeChoices.FINAL,
        auditor=reviewer, auditor_name=reviewer.real_name,
        result=AuditLog.ResultChoices.PASS, remark='全流程核对通过，归档完成',
    )
    # === 附件演示：正常单的完整附件 ===
    Attachment.objects.create(
        booking=b1, category='booking_doc', file_name='订舱委托书-PK2026001.pdf',
        file_size=245678, uploader=registrar,

    )
    Attachment.objects.create(
        booking=b1, category='packing_list', file_name='装箱单-PK2026001.xlsx',
        file_size=18932, uploader=registrar,

    )
    Attachment.objects.create(
        booking=b1, category='invoice', file_name='商业发票-PK2026001.pdf',
        file_size=35621, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b1, category='bl_doc', file_name='提单正本-COSU6287654321.pdf',
        file_size=512048, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b1, category='loading_doc', file_name='装柜照片-20260615.zip',
        file_size=2845678, uploader=registrar,
    )
    log_operation(b1, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书、装箱单、商业发票')
    log_operation(b1, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：提单正本、装柜照片')

    # ============ 样例2：缺材料单（待审核） ============
    print('   [样例2] PK-2026-002 缺材料单（待审核，异常标记：缺材料）')
    b2 = make_booking(
        form_no='PK-2026-002', batch_no='BATCH-2026-002',
        customer='广州汇通外贸有限公司', forwarder='马士基航运',
        port_of_loading='深圳', port_of_discharge='汉堡',
        container_type='20GP', container_qty=5,
        cargo_desc='服装纺织品 - 冬季羽绒服', weight=12.0, volume=60.0,
        etd=today + timedelta(days=10),
        booking_status=BookingStatusChoices.PENDING_REVIEW,
        loading_status=LoadingStatusChoices.NOT_ARRANGED,
        bl_status=BlStatusChoices.NOT_ISSUED,
        is_exception=True, exception_type=ExceptionTypeChoices.MISSING_MATERIALS,
        exception_note='缺失：商业发票、装箱单电子签章版本',
        deadline=now + timedelta(hours=36),
        submitter=registrar,
        submitted_at=now - timedelta(days=1),
        offline_booking_status=BookingStatusChoices.PENDING_REVIEW,
    )
    log_operation(b2, ActionChoices.CREATE, operator=registrar,
                  to_status=b2.booking_status, remark='发起订舱申请')
    log_operation(b2, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW, remark='提交审核（待补发票、装箱单）')
    AuditLog.objects.create(
        booking=b2, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.FAIL,
        fail_reason='缺失商业发票和装箱单的电子签章版本，审核暂不通过，请订舱登记员补充后重新提交',
        remark='已提醒登记员补材料',
    )
    # === 附件演示：缺材料单有部分附件，明确缺哪些 ===
    Attachment.objects.create(
        booking=b2, category='booking_doc', file_name='订舱委托书-PK2026002.pdf',
        file_size=198765, uploader=registrar,
    )
    # 缺：packing_list（有但未签章）、invoice（有但未签章）- 体现在 exception_note
    log_operation(b2, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书（装箱单和商业发票仅扫描件，缺电子签章）')

    # ============ 样例3：超时单（订舱失败） ============
    print('   [样例3] PK-2026-003 超时单（订舱失败，办理时限已超期）')
    b3 = make_booking(
        form_no='PK-2026-003', batch_no='BATCH-2026-003',
        customer='北京新丝路国际贸易有限公司', forwarder='地中海航运 MSC',
        port_of_loading='天津', port_of_discharge='新加坡',
        container_type='40GP', container_qty=1,
        cargo_desc='机械设备 - 精密车床部件', weight=8.0, volume=15.0,
        etd=today - timedelta(days=3),
        booking_status=BookingStatusChoices.BOOKING_FAILED,
        loading_status=LoadingStatusChoices.NOT_ARRANGED,
        bl_status=BlStatusChoices.NOT_ISSUED,
        is_exception=True, exception_type=ExceptionTypeChoices.TIMEOUT,
        exception_note='订舱失败：航线爆舱缺柜；办理时限已超期',
        deadline=now - timedelta(days=1, hours=6),
        submitter=registrar, reviewer=supervisor,
        submitted_at=now - timedelta(days=6), reviewed_at=now - timedelta(days=5),
        result_note='订舱失败：该航线近两周爆舱严重，船公司无可用空柜，客户已同意改走散货。',
        offline_booking_status=BookingStatusChoices.BOOKING_FAILED,
    )
    log_operation(b3, ActionChoices.CREATE, operator=registrar, remark='发起申请')
    log_operation(b3, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW, remark='提交审核')
    log_operation(b3, ActionChoices.REVIEW_PASS, operator=supervisor,
                  to_status=BookingStatusChoices.REVIEW_PASSED, remark='审核通过，急单优先')
    log_operation(b3, ActionChoices.BOOK_FAIL, operator=supervisor,
                  to_status=BookingStatusChoices.BOOKING_FAILED,
                  remark='失败原因：航线爆舱缺柜')
    AuditLog.objects.create(
        booking=b3, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.FAIL,
        fail_reason='航线爆舱缺柜：MSC 天津-新加坡航线近两周严重爆舱，船公司未分配空柜，已与客户沟通改走散货拼箱方案。',
        remark='超时 + 订舱失败，已记录审计',
        created_at=now - timedelta(days=2),
    )

    # ============ 样例4：退回单（已退回） ============
    print('   [样例4] PK-2026-004 退回单（审核退回，补正中）')
    b4 = make_booking(
        form_no='PK-2026-004', batch_no='BATCH-2026-004',
        customer='宁波东方海运代理有限公司', forwarder='赫伯罗特 Hapag-Lloyd',
        port_of_loading='宁波', port_of_discharge='鹿特丹',
        container_type='40HQ', container_qty=3,
        cargo_desc='化工品 - 环保涂料（非危）', weight=25.5, volume=68.0,
        etd=today + timedelta(days=15),
        booking_status=BookingStatusChoices.CORRECTING,
        loading_status=LoadingStatusChoices.NOT_ARRANGED,
        bl_status=BlStatusChoices.NOT_ISSUED,
        is_exception=True, exception_type=ExceptionTypeChoices.REJECTED,
        exception_note='审核退回：1) 缺少非危鉴定书；2) 起运港应为"宁波梅山"而非"宁波"',
        deadline=now + timedelta(days=5),
        submitter=registrar, reviewer=supervisor,
        submitted_at=now - timedelta(days=3), reviewed_at=now - timedelta(days=2),
        return_reason='1) 缺少《货物运输条件鉴定书》（非危证明），化工品出运必须提供；\n'
                      '2) 起运港填写不准确：应具体到"宁波梅山港"而非仅"宁波"；\n'
                      '3) 柜量3个但未注明是否需要预提空柜及预提天数。',
        offline_booking_status=BookingStatusChoices.RETURNED,
    )
    log_operation(b4, ActionChoices.CREATE, operator=registrar, remark='发起订舱申请')
    log_operation(b4, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW, remark='提交审核')
    log_operation(b4, ActionChoices.REVIEW_REJECT, operator=supervisor,
                  from_status=BookingStatusChoices.PENDING_REVIEW,
                  to_status=BookingStatusChoices.RETURNED,
                  remark='退回原因详见退回原因字段')
    log_operation(b4, ActionChoices.CORRECT, operator=registrar,
                  from_status=BookingStatusChoices.RETURNED,
                  to_status=BookingStatusChoices.CORRECTING,
                  remark='登记员正在补：非危鉴定书 + 修正起运港')
    AuditLog.objects.create(
        booking=b4, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.RETURN,
        fail_reason='退回：① 缺少非危鉴定书；② 起运港不具体；③ 柜量未注明是否预提。',
        remark='退回单，登记员补正中',
    )
    # === 附件演示：退回单（有订舱委托书，缺非危鉴定书） ===
    Attachment.objects.create(
        booking=b4, category='booking_doc', file_name='订舱委托书-PK2026004.pdf',
        file_size=215678, uploader=registrar,
    )
    # 缺：非危鉴定书（化工品必需）
    log_operation(b4, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书（缺非危鉴定书）')

    # ============ 样例5：重复批次测试用 ============
    print('   [样例5] PK-2026-005 / PK-2026-006 重复批次测试（同一批次号）')
    b5 = make_booking(
        form_no='PK-2026-005', batch_no='BATCH-DUP-2026-999',
        customer='苏州智造科技股份有限公司', forwarder='阳明海运 YML',
        port_of_loading='上海', port_of_discharge='高雄',
        container_type='20GP', container_qty=2,
        cargo_desc='五金零件 - 精密螺丝', weight=5.0, volume=8.0,
        booking_status=BookingStatusChoices.DRAFT,
        is_exception=False, exception_type=ExceptionTypeChoices.NONE,
        submitter=registrar,
        offline_booking_status=BookingStatusChoices.DRAFT,
    )
    b5b = make_booking(
        form_no='PK-2026-006', batch_no='BATCH-DUP-2026-999',
        customer='苏州智造科技股份有限公司', forwarder='阳明海运 YML',
        port_of_loading='上海', port_of_discharge='高雄',
        container_type='20GP', container_qty=2,
        cargo_desc='五金零件 - 精密螺丝（同批次重复录入）', weight=5.0, volume=8.0,
        booking_status=BookingStatusChoices.DRAFT,
        is_exception=True, exception_type=ExceptionTypeChoices.DUPLICATE_BATCH,
        exception_note='与 PK-2026-005 批次号相同，疑似重复录入，请核对。',
        submitter=registrar,
        offline_booking_status=BookingStatusChoices.DRAFT,
    )
    log_operation(b5, ActionChoices.CREATE, operator=registrar, remark='首次录入')
    log_operation(b5b, ActionChoices.CREATE, operator=registrar, remark='重复录入（测试用）')
    # === 重复批次完整审计追溯：b5 正常提交，b5b 尝试提交被系统拦截 ===
    log_operation(b5, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW,
                  remark='首次提交，批次号 BATCH-DUP-2026-999，系统正常受理')
    # b5b 尝试提交时，后端统一校验 check_duplicate_batch 发现重复，强制拦截
    log_operation(b5b, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.DRAFT,  # 状态未变，被拦截
                  remark='尝试提交时被系统自动拦截：检测到重复批次号')
    # 重复批次样例审计：b5b 尝试提交时被系统拦截，留下失败原因可追溯
    AuditLog.objects.create(
        booking=b5b, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.FAIL,
        fail_reason='重复批次拦截：批次号 BATCH-DUP-2026-999 已在 PK-2026-005 中使用。'
                    '请确认：(1) 是否同一客户重复下同一批货；(2) 是否不同批次但误写同批次号；'
                    '(3) 是否前一单有误需要作废后再创建。',
        remark='系统提交时自动拦截，登记员需核对后处理。',
    )
    # b5 正常通过审核（作为对比）
    AuditLog.objects.create(
        booking=b5, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS,
        remark='首次录入，批次号唯一，审核通过。',
    )
    # === 附件：b5 正常有附件，b5b 重复单也上传了附件 ===
    Attachment.objects.create(
        booking=b5, category='booking_doc', file_name='订舱委托书-PK2026005.pdf',
        file_size=167890, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b5b, category='booking_doc', file_name='订舱委托书-PK2026006（重复）.pdf',
        file_size=167890, uploader=registrar,
    )
    log_operation(b5, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书（首次录入）')
    log_operation(b5b, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书（重复录入，被拦截）')

    # ============ 样例6：状态不一致测试 ============
    print('   [样例6] PK-2026-007 状态不一致单（线上vs离线台账不一致）')
    b6 = make_booking(
        form_no='PK-2026-007', batch_no='BATCH-2026-007',
        customer='青岛海洋之星进出口有限公司', forwarder='达飞轮船 CMA CGM',
        port_of_loading='青岛', port_of_discharge='马赛',
        container_type='40HQ', container_qty=4,
        cargo_desc='食品 - 冷冻调理包（冷藏柜）', weight=10.0, volume=40.0,
        booking_status=BookingStatusChoices.REVIEW_PASSED,
        loading_status=LoadingStatusChoices.CONFIRMED,
        bl_status=BlStatusChoices.NOT_ISSUED,
        is_exception=True, exception_type=ExceptionTypeChoices.STATUS_MISMATCH,
        exception_note='线上/离线状态不一致，请核对台账后修正',
        deadline=now + timedelta(days=2),
        submitter=registrar, reviewer=supervisor,
        submitted_at=now - timedelta(days=4), reviewed_at=now - timedelta(days=3),
        offline_booking_status=BookingStatusChoices.BOOKED,
        offline_loading_status=LoadingStatusChoices.LOADED,
        offline_bl_status=BlStatusChoices.PENDING_COLLECT,
        so_no='SO-TSN-2026-77521',
    )
    log_operation(b6, ActionChoices.CREATE, operator=registrar, remark='发起')
    log_operation(b6, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW)
    log_operation(b6, ActionChoices.REVIEW_PASS, operator=supervisor,
                  to_status=BookingStatusChoices.REVIEW_PASSED)
    OfflineLedgerRecord.objects.create(
        booking=b6, field_name='offline_booking_status', field_label='离线台账-订舱状态',
        old_value='review_passed', new_value='booked', source='离线台账Excel回填',
        operator=registrar, operator_name=registrar.real_name,
        remark='台账已更新为订舱成功，但线上未同步（模拟不一致）',
    )
    OfflineLedgerRecord.objects.create(
        booking=b6, field_name='offline_loading_status', field_label='离线台账-装柜状态',
        old_value='not_arranged', new_value='loaded', source='离线台账Excel回填',
        operator=registrar, operator_name=registrar.real_name,
        remark='台账显示已装柜（模拟不一致）',
    )
    # === 附件：状态不一致单 ===
    Attachment.objects.create(
        booking=b6, category='booking_doc', file_name='订舱委托书-PK2026007.pdf',
        file_size=234567, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b6, category='packing_list', file_name='装箱单-PK2026007.xlsx',
        file_size=21345, uploader=registrar,
    )
    log_operation(b6, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='上传附件：订舱委托书、装箱单（线上线下状态不一致，待对账）')

    # ============ 样例7：在途正常单（装柜中，待提单） ============
    print('   [样例7] PK-2026-008 在途正常单（订舱成功，待装柜确认）')
    b7 = make_booking(
        form_no='PK-2026-008', batch_no='BATCH-2026-008',
        customer='成都熊猫跨境电商有限公司', forwarder='长荣海运 EMC',
        port_of_loading='上海', port_of_discharge='长滩',
        container_type='40HQ', container_qty=3,
        cargo_desc='家居用品 - 记忆棉枕头套装', weight=9.6, volume=52.0,
        etd=today + timedelta(days=8), eta=today + timedelta(days=28),
        so_no='SO-SHA-2026-55667',
        booking_status=BookingStatusChoices.BOOKED,
        loading_status=LoadingStatusChoices.PENDING_CONFIRM,
        bl_status=BlStatusChoices.PENDING_COLLECT,
        bl_no='EGLV1234567890', vessel='EVER ACE / 1234-008W',
        is_exception=False, exception_type=ExceptionTypeChoices.NONE,
        deadline=now + timedelta(days=6),
        submitter=registrar, reviewer=supervisor,
        submitted_at=now - timedelta(days=8), reviewed_at=now - timedelta(days=7),
        offline_booking_status=BookingStatusChoices.BOOKED,
        offline_loading_status=LoadingStatusChoices.PENDING_CONFIRM,
        offline_bl_status=BlStatusChoices.PENDING_COLLECT,
    )
    log_operation(b7, ActionChoices.CREATE, operator=registrar, remark='发起')
    log_operation(b7, ActionChoices.SUBMIT, operator=registrar,
                  to_status=BookingStatusChoices.PENDING_REVIEW, remark='提交审核')
    log_operation(b7, ActionChoices.REVIEW_PASS, operator=supervisor,
                  to_status=BookingStatusChoices.REVIEW_PASSED, remark='审核通过')
    log_operation(b7, ActionChoices.BOOK_CONFIRM, operator=supervisor,
                  to_status=BookingStatusChoices.BOOKED, remark=f'订舱确认 SO:{b7.so_no}')
    log_operation(b7, ActionChoices.LOAD_ARRANGE, operator=registrar,
                  to_status=LoadingStatusChoices.PENDING_CONFIRM, remark='已安排工厂装柜')
    log_operation(b7, ActionChoices.BL_ISSUE, operator=registrar,
                  to_status=BlStatusChoices.PENDING_COLLECT, remark=f'提单已出：{b7.bl_no}')
    AuditLog.objects.create(
        booking=b7, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS, remark='订舱审核通过，SO已下',
    )
    # === 完整新建提交+审计追溯：b7 的端到端操作留痕 ===
    log_operation(b7, ActionChoices.UPLOAD_ATTACH, operator=registrar,
                  remark='创建时同步上传附件：订舱委托书、装箱单、商业发票')
    # === 附件：在途单 ===
    Attachment.objects.create(
        booking=b7, category='booking_doc', file_name='订舱委托书-PK2026008.pdf',
        file_size=278901, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b7, category='packing_list', file_name='装箱单-PK2026008.xlsx',
        file_size=24567, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b7, category='invoice', file_name='商业发票-PK2026008.pdf',
        file_size=42345, uploader=registrar,
    )
    Attachment.objects.create(
        booking=b7, category='bl_doc', file_name='提单副本-EGLV1234567890.pdf',
        file_size=456789, uploader=registrar,
    )
    # === 完整审计链：订舱+装柜+提单三轮审核 ===
    AuditLog.objects.create(
        booking=b7, audit_type=AuditLog.AuditTypeChoices.BOOKING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS, remark='订舱审核：资料齐全，SO已确认',
    )
    AuditLog.objects.create(
        booking=b7, audit_type=AuditLog.AuditTypeChoices.LOADING,
        auditor=supervisor, auditor_name=supervisor.real_name,
        result=AuditLog.ResultChoices.PASS, remark='装柜审核：已安排工厂装柜，待确认',
    )
    AuditLog.objects.create(
        booking=b7, audit_type=AuditLog.AuditTypeChoices.BL,
        auditor=registrar, auditor_name=registrar.real_name,
        result=AuditLog.ResultChoices.PASS, remark='提单审核：提单已出，信息核对无误',
    )

    print()
    print('========== 初始化完成 ==========')
    print(f'共创建 {BookingApplication.objects.count()} 条订舱申请：')
    for b in BookingApplication.objects.all().order_by('form_no'):
        tag = '【异常】' if b.is_exception else ''
        print(f'  - {b.form_no} {b.batch_no} | 订舱:{b.booking_status_label} '
              f'装柜:{b.loading_status_label} 提单:{b.bl_status_label} {tag}')
    print()
    print('下一步：')
    print('  1. 后端：cd backend && python manage.py runserver 0.0.0.0:8005')
    print('  2. 前端：cd frontend && npm run dev (端口 3005)')
    print('  3. API 文档：http://localhost:8005/api/docs')
    print('  4. Django 管理后台：http://localhost:8005/admin  (admin / admin123)')


if __name__ == '__main__':
    run()
