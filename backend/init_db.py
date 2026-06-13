from datetime import datetime, timedelta
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine, SessionLocal
from app.models import (
    User, UserRole, MembershipOrder, OrderStatus, RequiredAttachment,
    AttachmentType, Attachment, AuditLog, AuditAction
)


def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        registrar = User(
            username="registrar",
            name="李登记",
            role=UserRole.REGISTRAR
        )
        supervisor = User(
            username="supervisor",
            name="王审核",
            role=UserRole.SUPERVISOR
        )
        reviewer = User(
            username="reviewer",
            name="张复核",
            role=UserRole.REVIEWER
        )
        db.add_all([registrar, supervisor, reviewer])
        db.flush()

        now = datetime.utcnow()

        normal_order = MembershipOrder(
            order_no="HY20250601001",
            member_name="赵小明",
            member_phone="13800000001",
            member_id_no="110101199001011234",
            membership_type="年卡",
            membership_duration=365,
            amount=2880,
            contract_confirmed=True,
            card_activated=True,
            status=OrderStatus.ARCHIVED,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(days=15),
            updated_at=now - timedelta(days=10),
        )
        db.add(normal_order)
        db.flush()

        normal_req_1 = RequiredAttachment(
            order_id=normal_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=True,
        )
        normal_req_2 = RequiredAttachment(
            order_id=normal_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=True,
        )
        normal_req_3 = RequiredAttachment(
            order_id=normal_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=True,
        )
        normal_req_4 = RequiredAttachment(
            order_id=normal_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=True,
        )
        db.add_all([normal_req_1, normal_req_2, normal_req_3, normal_req_4])
        db.flush()

        db.add(Attachment(
            order_id=normal_order.id,
            required_attachment_id=normal_req_1.id,
            file_name="赵小明_身份证.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=102400,
            stored_name="id_normal_001.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=15),
        ))
        db.add(Attachment(
            order_id=normal_order.id,
            required_attachment_id=normal_req_2.id,
            file_name="赵小明_照片.jpg",
            file_type=AttachmentType.PHOTO,
            file_size=204800,
            stored_name="photo_normal_001.jpg",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=15),
        ))
        db.add(Attachment(
            order_id=normal_order.id,
            required_attachment_id=normal_req_3.id,
            file_name="赵小明_健康证明.pdf",
            file_type=AttachmentType.HEALTH_CERT,
            file_size=153600,
            stored_name="health_normal_001.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=15),
        ))
        db.add(Attachment(
            order_id=normal_order.id,
            required_attachment_id=normal_req_4.id,
            file_name="赵小明_入会合同.pdf",
            file_type=AttachmentType.CONTRACT,
            file_size=307200,
            stored_name="contract_normal_001.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=15),
        ))

        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(days=15),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="上传全部4份附件材料",
            created_at=now - timedelta(days=15),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交入会单进入审核",
            created_at=now - timedelta(days=14),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=supervisor.id,
            action=AuditAction.APPROVE,
            from_status=OrderStatus.PENDING_REVIEW,
            to_status=OrderStatus.APPROVED_REVIEW,
            remark="审核主管办理通过，材料齐全",
            created_at=now - timedelta(days=13),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=supervisor.id,
            action=AuditAction.CONFIRM_CONTRACT,
            remark="合同已确认签署",
            created_at=now - timedelta(days=13),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=reviewer.id,
            action=AuditAction.REVIEW,
            from_status=OrderStatus.APPROVED_REVIEW,
            to_status=OrderStatus.REVIEWED,
            remark="复核通过，信息无误",
            created_at=now - timedelta(days=11),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=reviewer.id,
            action=AuditAction.ACTIVATE_CARD,
            remark="会员卡权益已启用",
            created_at=now - timedelta(days=10),
        ))
        db.add(AuditLog(
            order_id=normal_order.id,
            operator_id=reviewer.id,
            action=AuditAction.ARCHIVE,
            from_status=OrderStatus.REVIEWED,
            to_status=OrderStatus.ARCHIVED,
            remark="入会单复核归档完成",
            created_at=now - timedelta(days=10),
        ))

        missing_order = MembershipOrder(
            order_no="HY20250601002",
            member_name="钱小红",
            member_phone="13800000002",
            member_id_no="110101199203034567",
            membership_type="半年卡",
            membership_duration=180,
            amount=1680,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.MATERIALS_MISSING,
            is_overdue=False,
            reject_reason="缺少健康证明，请尽快补正后重新提交",
            created_by=registrar.id,
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(days=2),
        )
        db.add(missing_order)
        db.flush()

        miss_req_1 = RequiredAttachment(
            order_id=missing_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=True,
        )
        miss_req_2 = RequiredAttachment(
            order_id=missing_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=True,
        )
        miss_req_3 = RequiredAttachment(
            order_id=missing_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=False,
            missing_reason="会员表示健康证明需要重新去医院开具",
        )
        miss_req_4 = RequiredAttachment(
            order_id=missing_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=False,
            missing_reason="合同需要双方签字后上传",
        )
        db.add_all([miss_req_1, miss_req_2, miss_req_3, miss_req_4])
        db.flush()

        db.add(Attachment(
            order_id=missing_order.id,
            required_attachment_id=miss_req_1.id,
            file_name="钱小红_身份证.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=102400,
            stored_name="id_missing_002.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=5),
        ))
        db.add(Attachment(
            order_id=missing_order.id,
            required_attachment_id=miss_req_2.id,
            file_name="钱小红_照片.jpg",
            file_type=AttachmentType.PHOTO,
            file_size=204800,
            stored_name="photo_missing_002.jpg",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=5),
        ))

        db.add(AuditLog(
            order_id=missing_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(days=5),
        ))
        db.add(AuditLog(
            order_id=missing_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="上传身份证和照片（缺少健康证明和合同）",
            created_at=now - timedelta(days=5),
        ))
        db.add(AuditLog(
            order_id=missing_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交审核，申请缓交健康证明",
            created_at=now - timedelta(days=4),
        ))
        db.add(AuditLog(
            order_id=missing_order.id,
            operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW,
            to_status=OrderStatus.MATERIALS_MISSING,
            remark="发现缺少健康证明和入会合同，退回补正",
            failure_reason="附件缺失：健康证明、入会合同未提供，不满足审核条件",
            created_at=now - timedelta(days=2),
        ))

        overdue_order = MembershipOrder(
            order_no="HY20250601003",
            member_name="孙小刚",
            member_phone="13800000003",
            member_id_no="110101198808087890",
            membership_type="季卡",
            membership_duration=90,
            amount=980,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.MATERIALS_MISSING,
            is_overdue=True,
            reject_reason="超时未补正附件，请联系会员重新提交申请",
            created_by=registrar.id,
            created_at=now - timedelta(days=25),
            updated_at=now - timedelta(days=3),
        )
        db.add(overdue_order)
        db.flush()

        overdue_req_1 = RequiredAttachment(
            order_id=overdue_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=True,
        )
        overdue_req_2 = RequiredAttachment(
            order_id=overdue_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=False,
            missing_reason="会员照片缺失，已通知超过7天未补正",
        )
        overdue_req_3 = RequiredAttachment(
            order_id=overdue_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=False,
            missing_reason="健康证明缺失，已通知超过7天未补正",
        )
        overdue_req_4 = RequiredAttachment(
            order_id=overdue_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=False,
            missing_reason="合同未签署",
        )
        db.add_all([overdue_req_1, overdue_req_2, overdue_req_3, overdue_req_4])
        db.flush()

        db.add(Attachment(
            order_id=overdue_order.id,
            required_attachment_id=overdue_req_1.id,
            file_name="孙小刚_身份证.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=102400,
            stored_name="id_overdue_003.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=25),
        ))

        db.add(AuditLog(
            order_id=overdue_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(days=25),
        ))
        db.add(AuditLog(
            order_id=overdue_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="仅上传了身份证，缺少照片、健康证明、合同",
            created_at=now - timedelta(days=25),
        ))
        db.add(AuditLog(
            order_id=overdue_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交审核，承诺3日内补齐剩余材料",
            created_at=now - timedelta(days=24),
        ))
        db.add(AuditLog(
            order_id=overdue_order.id,
            operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW,
            to_status=OrderStatus.MATERIALS_MISSING,
            remark="退回补正，请7日内补齐照片、健康证明和合同",
            failure_reason="附件缺失：照片、健康证明、入会合同未提供",
            created_at=now - timedelta(days=22),
        ))
        db.add(AuditLog(
            order_id=overdue_order.id,
            operator_id=supervisor.id,
            action=AuditAction.MARK_OVERDUE,
            from_status=OrderStatus.MATERIALS_MISSING,
            to_status=OrderStatus.MATERIALS_MISSING,
            remark="补正期限已超7天，标记为超时单",
            failure_reason="补正超时：会员超过7天未补齐所需附件材料",
            created_at=now - timedelta(days=3),
        ))

        rejected_order = MembershipOrder(
            order_no="HY20250601004",
            member_name="李小华",
            member_phone="13800000004",
            member_id_no="110101199505051357",
            membership_type="月卡",
            membership_duration=30,
            amount=380,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.REJECTED,
            is_overdue=False,
            reject_reason="健康证明不合格（已过期），身份证复印件模糊不清，请重新提交合格材料",
            created_by=registrar.id,
            created_at=now - timedelta(days=8),
            updated_at=now - timedelta(days=1),
        )
        db.add(rejected_order)
        db.flush()

        reject_req_1 = RequiredAttachment(
            order_id=rejected_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=False,
            reject_reason="身份证复印件扫描模糊，关键信息无法辨认，请重新上传清晰版本",
        )
        reject_req_2 = RequiredAttachment(
            order_id=rejected_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=True,
        )
        reject_req_3 = RequiredAttachment(
            order_id=rejected_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=False,
            reject_reason="健康证明已过期（有效期至2025-05-01），请提供近3个月内的体检报告",
        )
        reject_req_4 = RequiredAttachment(
            order_id=rejected_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=False,
            reject_reason="合同未签字盖章",
        )
        db.add_all([reject_req_1, reject_req_2, reject_req_3, reject_req_4])
        db.flush()

        db.add(Attachment(
            order_id=rejected_order.id,
            required_attachment_id=reject_req_1.id,
            file_name="李小华_身份证_模糊版.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=51200,
            stored_name="id_reject_004.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=8),
        ))
        db.add(Attachment(
            order_id=rejected_order.id,
            required_attachment_id=reject_req_2.id,
            file_name="李小华_照片.jpg",
            file_type=AttachmentType.PHOTO,
            file_size=204800,
            stored_name="photo_reject_004.jpg",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=8),
        ))
        db.add(Attachment(
            order_id=rejected_order.id,
            required_attachment_id=reject_req_3.id,
            file_name="李小华_健康证明_过期.pdf",
            file_type=AttachmentType.HEALTH_CERT,
            file_size=153600,
            stored_name="health_reject_004.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=8),
        ))

        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(days=8),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="上传身份证、照片、健康证明（合同未上传）",
            created_at=now - timedelta(days=8),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交审核",
            created_at=now - timedelta(days=7),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW,
            to_status=OrderStatus.MATERIALS_MISSING,
            remark="材料有问题：身份证模糊、健康证明过期、合同缺失，退回补正",
            failure_reason="附件不合格：身份证扫描件模糊无法辨认；健康证明已过期；入会合同未上传",
            created_at=now - timedelta(days=6),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=registrar.id,
            action=AuditAction.RESUBMIT,
            from_status=OrderStatus.MATERIALS_MISSING,
            to_status=OrderStatus.RESUBMITTED,
            remark="补正后重新提交（未重新上传附件，仅做了说明）",
            created_at=now - timedelta(days=3),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id,
            operator_id=supervisor.id,
            action=AuditAction.REJECT,
            from_status=OrderStatus.RESUBMITTED,
            to_status=OrderStatus.REJECTED,
            remark="二次审核发现材料仍不合格，予以驳回",
            failure_reason="补正不完整：未重新上传清晰的身份证、未更换有效的健康证明、仍未提供签署的合同，不符合入会审核标准",
            created_at=now - timedelta(days=1),
        ))

        pending_order = MembershipOrder(
            order_no="HY20250601005",
            member_name="周小龙",
            member_phone="13800000005",
            member_id_no="110101199303032468",
            membership_type="年卡",
            membership_duration=365,
            amount=2880,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.PENDING_REVIEW,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(hours=6),
            updated_at=now - timedelta(hours=6),
        )
        db.add(pending_order)
        db.flush()

        pending_req_1 = RequiredAttachment(
            order_id=pending_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=True,
        )
        pending_req_2 = RequiredAttachment(
            order_id=pending_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=True,
        )
        pending_req_3 = RequiredAttachment(
            order_id=pending_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=True,
        )
        pending_req_4 = RequiredAttachment(
            order_id=pending_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=True,
        )
        db.add_all([pending_req_1, pending_req_2, pending_req_3, pending_req_4])
        db.flush()

        db.add(Attachment(
            order_id=pending_order.id,
            required_attachment_id=pending_req_1.id,
            file_name="周小龙_身份证.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=102400,
            stored_name="id_pending_005.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(hours=6),
        ))
        db.add(Attachment(
            order_id=pending_order.id,
            required_attachment_id=pending_req_2.id,
            file_name="周小龙_照片.jpg",
            file_type=AttachmentType.PHOTO,
            file_size=204800,
            stored_name="photo_pending_005.jpg",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(hours=6),
        ))
        db.add(Attachment(
            order_id=pending_order.id,
            required_attachment_id=pending_req_3.id,
            file_name="周小龙_健康证明.pdf",
            file_type=AttachmentType.HEALTH_CERT,
            file_size=153600,
            stored_name="health_pending_005.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(hours=6),
        ))
        db.add(Attachment(
            order_id=pending_order.id,
            required_attachment_id=pending_req_4.id,
            file_name="周小龙_入会合同.pdf",
            file_type=AttachmentType.CONTRACT,
            file_size=307200,
            stored_name="contract_pending_005.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(hours=6),
        ))

        db.add(AuditLog(
            order_id=pending_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(hours=6),
        ))
        db.add(AuditLog(
            order_id=pending_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="上传全部4份附件材料",
            created_at=now - timedelta(hours=6),
        ))
        db.add(AuditLog(
            order_id=pending_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交审核，等待审核主管办理",
            created_at=now - timedelta(hours=6),
        ))

        approved_order = MembershipOrder(
            order_no="HY20250601006",
            member_name="吴小芳",
            member_phone="13800000006",
            member_id_no="110101199106061234",
            membership_type="半年卡",
            membership_duration=180,
            amount=1680,
            contract_confirmed=True,
            card_activated=False,
            status=OrderStatus.APPROVED_REVIEW,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(days=4),
            updated_at=now - timedelta(days=2),
        )
        db.add(approved_order)
        db.flush()

        approv_req_1 = RequiredAttachment(
            order_id=approved_order.id,
            attachment_type=AttachmentType.ID_CARD,
            attachment_name="身份证复印件",
            is_provided=True,
        )
        approv_req_2 = RequiredAttachment(
            order_id=approved_order.id,
            attachment_type=AttachmentType.PHOTO,
            attachment_name="一寸免冠照片",
            is_provided=True,
        )
        approv_req_3 = RequiredAttachment(
            order_id=approved_order.id,
            attachment_type=AttachmentType.HEALTH_CERT,
            attachment_name="健康证明",
            is_provided=True,
        )
        approv_req_4 = RequiredAttachment(
            order_id=approved_order.id,
            attachment_type=AttachmentType.CONTRACT,
            attachment_name="入会合同",
            is_provided=True,
        )
        db.add_all([approv_req_1, approv_req_2, approv_req_3, approv_req_4])
        db.flush()

        db.add(Attachment(
            order_id=approved_order.id,
            required_attachment_id=approv_req_1.id,
            file_name="吴小芳_身份证.pdf",
            file_type=AttachmentType.ID_CARD,
            file_size=102400,
            stored_name="id_approv_006.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=4),
        ))
        db.add(Attachment(
            order_id=approved_order.id,
            required_attachment_id=approv_req_2.id,
            file_name="吴小芳_照片.jpg",
            file_type=AttachmentType.PHOTO,
            file_size=204800,
            stored_name="photo_approv_006.jpg",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=4),
        ))
        db.add(Attachment(
            order_id=approved_order.id,
            required_attachment_id=approv_req_3.id,
            file_name="吴小芳_健康证明.pdf",
            file_type=AttachmentType.HEALTH_CERT,
            file_size=153600,
            stored_name="health_approv_006.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=4),
        ))
        db.add(Attachment(
            order_id=approved_order.id,
            required_attachment_id=approv_req_4.id,
            file_name="吴小芳_入会合同.pdf",
            file_type=AttachmentType.CONTRACT,
            file_size=307200,
            stored_name="contract_approv_006.pdf",
            uploaded_by=registrar.id,
            uploaded_at=now - timedelta(days=4),
        ))

        db.add(AuditLog(
            order_id=approved_order.id,
            operator_id=registrar.id,
            action=AuditAction.CREATE,
            to_status=OrderStatus.DRAFT,
            remark="创建会员入会单",
            created_at=now - timedelta(days=4),
        ))
        db.add(AuditLog(
            order_id=approved_order.id,
            operator_id=registrar.id,
            action=AuditAction.UPLOAD_ATTACHMENT,
            remark="上传全部4份附件材料",
            created_at=now - timedelta(days=4),
        ))
        db.add(AuditLog(
            order_id=approved_order.id,
            operator_id=registrar.id,
            action=AuditAction.SUBMIT,
            from_status=OrderStatus.DRAFT,
            to_status=OrderStatus.PENDING_REVIEW,
            remark="提交审核",
            created_at=now - timedelta(days=3),
        ))
        db.add(AuditLog(
            order_id=approved_order.id,
            operator_id=supervisor.id,
            action=AuditAction.APPROVE,
            from_status=OrderStatus.PENDING_REVIEW,
            to_status=OrderStatus.APPROVED_REVIEW,
            remark="审核通过，材料齐全有效",
            created_at=now - timedelta(days=2),
        ))
        db.add(AuditLog(
            order_id=approved_order.id,
            operator_id=supervisor.id,
            action=AuditAction.CONFIRM_CONTRACT,
            remark="合同已确认签署",
            created_at=now - timedelta(days=2),
        ))

        db.commit()
        print("数据库初始化完成！种子数据已加载。")
        print("")
        print("用户账号（登录时可切换角色）：")
        print("  会员入会登记员: registrar / 李登记")
        print("  会员入会审核主管: supervisor / 王审核")
        print("  社区健身房复核负责人: reviewer / 张复核")
        print("")
        print("种子数据包含以下会员入会单：")
        print("  1. HY20250601001 赵小明 - 【正常单】已归档（完整流程）")
        print("  2. HY20250601002 钱小红 - 【缺材料单】附件缺失待补正")
        print("  3. HY20250601003 孙小刚 - 【超时单】补正超时未处理")
        print("  4. HY20250601004 李小华 - 【退回单】二次审核不合格被驳回")
        print("  5. HY20250601005 周小龙 - 【待审核】等待审核主管办理")
        print("  6. HY20250601006 吴小芳 - 【审核通过】等待复核负责人复核")
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
