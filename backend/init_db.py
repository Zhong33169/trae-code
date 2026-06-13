from datetime import datetime, timedelta
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine, SessionLocal
from app.models import (
    User, UserRole, MembershipOrder, OrderStatus, RequiredAttachment,
    AttachmentType, Attachment, AuditLog, AuditAction
)


def fmt_time(d: datetime) -> str:
    return d.strftime("%Y-%m-%d %H:%M")


def add_reject_reason(req, reason: str, operator_name: str, d: datetime):
    ts = fmt_time(d)
    old = req.reject_reason or ""
    new_line = f"[{ts} 审核主管{operator_name}] {reason}"
    req.reject_reason = f"{new_line}\n{old}" if old else new_line


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

        # ============== 1. 正常单 - 赵小明（完整流程，已归档） ==============
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

        nr1 = RequiredAttachment(order_id=normal_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        nr2 = RequiredAttachment(order_id=normal_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        nr3 = RequiredAttachment(order_id=normal_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        nr4 = RequiredAttachment(order_id=normal_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([nr1, nr2, nr3, nr4])
        db.flush()

        db.add(Attachment(order_id=normal_order.id, required_attachment_id=nr1.id, file_name="赵小明_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_normal_001.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=15)))
        db.add(Attachment(order_id=normal_order.id, required_attachment_id=nr2.id, file_name="赵小明_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_normal_001.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=15)))
        db.add(Attachment(order_id=normal_order.id, required_attachment_id=nr3.id, file_name="赵小明_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_normal_001.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=15)))
        db.add(Attachment(order_id=normal_order.id, required_attachment_id=nr4.id, file_name="赵小明_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_normal_001.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=15)))

        db.add(AuditLog(order_id=normal_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=15)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(days=15)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交入会单进入审核", created_at=now - timedelta(days=14)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=supervisor.id, action=AuditAction.APPROVE, from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.APPROVED_REVIEW, remark=f"审核主管【{supervisor.name}】办理通过，材料齐全有效", created_at=now - timedelta(days=13)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=supervisor.id, action=AuditAction.CONFIRM_CONTRACT, remark=f"审核主管【{supervisor.name}】确认合同已签署", created_at=now - timedelta(days=13)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=reviewer.id, action=AuditAction.REVIEW, from_status=OrderStatus.APPROVED_REVIEW, to_status=OrderStatus.REVIEWED, remark=f"复核负责人【{reviewer.name}】复核通过，信息无误", created_at=now - timedelta(days=11)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=reviewer.id, action=AuditAction.ACTIVATE_CARD, remark=f"复核负责人【{reviewer.name}】启用会员卡权益", created_at=now - timedelta(days=10)))
        db.add(AuditLog(order_id=normal_order.id, operator_id=reviewer.id, action=AuditAction.ARCHIVE, from_status=OrderStatus.REVIEWED, to_status=OrderStatus.ARCHIVED, remark=f"复核负责人【{reviewer.name}】完成入会单归档", created_at=now - timedelta(days=10)))

        # ============== 2. 缺材料单 - 钱小红（一轮退回补正中，每附件有独立原因） ==============
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
            reject_reason=f"审核主管【{supervisor.name}】退回补正（共2项）：健康证明、入会合同。请补正后重新提交。 备注：请尽快补齐，否则会影响入会进度。",
            created_by=registrar.id,
            created_at=now - timedelta(days=5),
            updated_at=now - timedelta(days=2),
        )
        db.add(missing_order)
        db.flush()

        mr1 = RequiredAttachment(order_id=missing_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        mr2 = RequiredAttachment(order_id=missing_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        mr3 = RequiredAttachment(order_id=missing_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=False, missing_reason="会员表示健康证明需要重新去医院开具，约下周才能提供")
        mr4 = RequiredAttachment(order_id=missing_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=False, missing_reason="合同需要双方签字后上传，目前会员还在看合同条款")
        add_reject_reason(mr3, "未提交健康证明，请提供近3个月内的正规医院体检报告", supervisor.name, now - timedelta(days=2))
        add_reject_reason(mr4, "未提供已签署的入会合同，需会员本人签字并加盖公章", supervisor.name, now - timedelta(days=2))
        db.add_all([mr1, mr2, mr3, mr4])
        db.flush()

        db.add(Attachment(order_id=missing_order.id, required_attachment_id=mr1.id, file_name="钱小红_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_missing_002.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=5)))
        db.add(Attachment(order_id=missing_order.id, required_attachment_id=mr2.id, file_name="钱小红_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_missing_002.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=5)))

        db.add(AuditLog(order_id=missing_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=5)))
        db.add(AuditLog(order_id=missing_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传身份证和照片（缺少健康证明和合同）", created_at=now - timedelta(days=5)))
        db.add(AuditLog(order_id=missing_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核，申请缓交健康证明，承诺3日内补齐", created_at=now - timedelta(days=4)))
        db.add(AuditLog(
            order_id=missing_order.id, operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.MATERIALS_MISSING,
            remark=f"审核主管【{supervisor.name}】退回补正，需补充：健康证明、入会合同，备注：请尽快补齐，否则会影响入会进度。",
            failure_reason="共 2 项附件需要补正：健康证明：未提交健康证明，请提供近3个月内的正规医院体检报告；入会合同：未提供已签署的入会合同，需会员本人签字并加盖公章",
            created_at=now - timedelta(days=2),
        ))

        # ============== 3. 超时单 - 孙小刚（一轮退回后超7天未补正，有完整追溯） ==============
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
            reject_reason=f"审核主管【{supervisor.name}】退回补正（共3项）：一寸免冠照片、健康证明、入会合同。请补正后重新提交。 备注：请7日内补齐，否则将作超时处理。",
            created_by=registrar.id,
            created_at=now - timedelta(days=25),
            updated_at=now - timedelta(days=3),
        )
        db.add(overdue_order)
        db.flush()

        or1 = RequiredAttachment(order_id=overdue_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        or2 = RequiredAttachment(order_id=overdue_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=False, missing_reason="会员照片缺失，已通知超过7天未补正")
        or3 = RequiredAttachment(order_id=overdue_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=False, missing_reason="健康证明缺失，已通知超过7天未补正，会员说最近比较忙")
        or4 = RequiredAttachment(order_id=overdue_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=False, missing_reason="合同未签署，会员还在考虑中")
        add_reject_reason(or2, "未提交一寸免冠照片，请提供近期白底免冠证件照", supervisor.name, now - timedelta(days=22))
        add_reject_reason(or3, "健康证明缺失，入会必须提供有效期内的体检报告", supervisor.name, now - timedelta(days=22))
        add_reject_reason(or4, "入会合同未签署，需会员本人签字确认后方可办理", supervisor.name, now - timedelta(days=22))
        db.add_all([or1, or2, or3, or4])
        db.flush()

        db.add(Attachment(order_id=overdue_order.id, required_attachment_id=or1.id, file_name="孙小刚_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_overdue_003.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=25)))

        db.add(AuditLog(order_id=overdue_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=25)))
        db.add(AuditLog(order_id=overdue_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】仅上传了身份证，缺少照片、健康证明、合同", created_at=now - timedelta(days=25)))
        db.add(AuditLog(order_id=overdue_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核，承诺3日内补齐剩余材料", created_at=now - timedelta(days=24)))
        db.add(AuditLog(
            order_id=overdue_order.id, operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.MATERIALS_MISSING,
            remark=f"审核主管【{supervisor.name}】退回补正，请7日内补齐照片、健康证明和合同，备注：请7日内补齐，否则将作超时处理。",
            failure_reason="共 3 项附件需要补正：一寸免冠照片：未提交一寸免冠照片，请提供近期白底免冠证件照；健康证明：健康证明缺失，入会必须提供有效期内的体检报告；入会合同：入会合同未签署，需会员本人签字确认后方可办理",
            created_at=now - timedelta(days=22),
        ))
        db.add(AuditLog(
            order_id=overdue_order.id, operator_id=supervisor.id,
            action=AuditAction.MARK_OVERDUE,
            from_status=OrderStatus.MATERIALS_MISSING, to_status=OrderStatus.MATERIALS_MISSING,
            remark=f"审核主管【{supervisor.name}】标记：补正期限已超7天，标记为超时单",
            failure_reason="补正超时：会员超过7天未补齐所需附件材料（照片、健康证明、合同），已通知多次未回应",
            created_at=now - timedelta(days=3),
        ))

        # ============== 4. 退回单 - 李小华（二轮补正+最终驳回，每附件多次驳回历史） ==============
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
            reject_reason="二次补正后材料仍不合格：身份证扫描件模糊无法辨认、健康证明已过期、入会合同仍未签署。鉴于两次补正均不满足要求，予以驳回，请会员重新提交申请。",
            created_by=registrar.id,
            created_at=now - timedelta(days=14),
            updated_at=now - timedelta(days=1),
        )
        db.add(rejected_order)
        db.flush()

        rr1 = RequiredAttachment(order_id=rejected_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=False, missing_reason="身份证扫描件模糊，关键信息无法辨认")
        rr2 = RequiredAttachment(order_id=rejected_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        rr3 = RequiredAttachment(order_id=rejected_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=False, missing_reason="健康证明已过期，且重新提交的仍然过期")
        rr4 = RequiredAttachment(order_id=rejected_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=False, missing_reason="合同未签字盖章，两次都未提供签署版")

        # 身份证：2次退回历史
        add_reject_reason(rr1, "身份证扫描件模糊，姓名和身份证号无法辨认，请重新上传清晰版本", supervisor.name, now - timedelta(days=11))
        add_reject_reason(rr1, "二次提交的身份证仍然模糊，关键信息（照片、证件号）无法识别，请务必提供高清扫描件或拍照件", supervisor.name, now - timedelta(days=3))
        ts_final = fmt_time(now - timedelta(days=1))
        final_reason = f"[{ts_final} 最终驳回-{supervisor.name}] 整体驳回：二次补正后材料仍不合格，予以驳回"
        old_r1 = rr1.reject_reason or ""
        rr1.reject_reason = f"{final_reason}\n{old_r1}"

        # 健康证明：2次退回历史
        add_reject_reason(rr3, "健康证明已过期（有效期至2025-05-01），请提供近3个月内的体检报告", supervisor.name, now - timedelta(days=11))
        add_reject_reason(rr3, "重新提交的健康证明还是过期的（2025-04-15签发，有效期3个月，2025-07-15到期，但现在是2026年），请提供有效的", supervisor.name, now - timedelta(days=3))
        old_r3 = rr3.reject_reason or ""
        rr3.reject_reason = f"{final_reason}\n{old_r3}"

        # 合同：2次退回历史
        add_reject_reason(rr4, "入会合同未签字盖章，请会员签字并加盖健身房公章后上传", supervisor.name, now - timedelta(days=11))
        add_reject_reason(rr4, "合同还是只有电子版，没有双方签字，不能生效", supervisor.name, now - timedelta(days=3))
        old_r4 = rr4.reject_reason or ""
        rr4.reject_reason = f"{final_reason}\n{old_r4}"

        db.add_all([rr1, rr2, rr3, rr4])
        db.flush()

        db.add(Attachment(order_id=rejected_order.id, required_attachment_id=rr1.id, file_name="李小华_身份证_模糊版v1.pdf", file_type=AttachmentType.ID_CARD, file_size=51200, stored_name="id_reject_v1_004.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=14)))
        db.add(Attachment(order_id=rejected_order.id, required_attachment_id=rr2.id, file_name="李小华_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_reject_004.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=14)))
        db.add(Attachment(order_id=rejected_order.id, required_attachment_id=rr3.id, file_name="李小华_健康证明_过期v1.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_reject_v1_004.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=14)))

        # 第二次提交的不合格附件
        db.add(Attachment(order_id=rejected_order.id, required_attachment_id=rr1.id, file_name="李小华_身份证_模糊版v2.pdf", file_type=AttachmentType.ID_CARD, file_size=48000, stored_name="id_reject_v2_004.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=6)))
        db.add(Attachment(order_id=rejected_order.id, required_attachment_id=rr3.id, file_name="李小华_健康证明_过期v2.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=140000, stored_name="health_reject_v2_004.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=6)))

        db.add(AuditLog(order_id=rejected_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=14)))
        db.add(AuditLog(order_id=rejected_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传身份证、照片、健康证明（合同未上传）", created_at=now - timedelta(days=14)))
        db.add(AuditLog(order_id=rejected_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】第一次提交审核", created_at=now - timedelta(days=13)))
        db.add(AuditLog(
            order_id=rejected_order.id, operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.MATERIALS_MISSING,
            remark=f"审核主管【{supervisor.name}】第一次退回补正：身份证模糊、健康证明过期、合同缺失，备注：请7日内补正后重新提交",
            failure_reason="共 3 项附件需要补正：身份证复印件：身份证扫描件模糊，姓名和身份证号无法辨认，请重新上传清晰版本；健康证明：健康证明已过期（有效期至2025-05-01），请提供近3个月内的体检报告；入会合同：入会合同未签字盖章，请会员签字并加盖健身房公章后上传",
            created_at=now - timedelta(days=11),
        ))
        db.add(AuditLog(order_id=rejected_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】重新上传身份证和健康证明（v2版本）", created_at=now - timedelta(days=6)))
        db.add(AuditLog(
            order_id=rejected_order.id, operator_id=registrar.id,
            action=AuditAction.RESUBMIT,
            from_status=OrderStatus.MATERIALS_MISSING, to_status=OrderStatus.RESUBMITTED,
            remark=f"登记员【{registrar.name}】第一次补正后重新提交，备注：已重新扫描身份证和健康证明，合同还在走流程",
            created_at=now - timedelta(days=5),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id, operator_id=supervisor.id,
            action=AuditAction.REQUEST_SUPPLEMENT,
            from_status=OrderStatus.RESUBMITTED, to_status=OrderStatus.MATERIALS_MISSING,
            remark=f"审核主管【{supervisor.name}】第二次退回补正：身份证仍模糊、健康证明仍过期、合同仍未签，备注：这是第二次退回，请务必认真核对材料",
            failure_reason="共 3 项附件仍需补正：身份证复印件：二次提交的身份证仍然模糊，关键信息（照片、证件号）无法识别，请务必提供高清扫描件或拍照件；健康证明：重新提交的健康证明还是过期的，请提供有效的；入会合同：合同还是只有电子版，没有双方签字，不能生效",
            created_at=now - timedelta(days=3),
        ))
        db.add(AuditLog(
            order_id=rejected_order.id, operator_id=supervisor.id,
            action=AuditAction.REJECT,
            from_status=OrderStatus.RESUBMITTED, to_status=OrderStatus.REJECTED,
            remark=f"审核主管【{supervisor.name}】二次审核发现材料仍不合格，予以驳回，备注：两次补正均不通过，请重新发起申请",
            failure_reason="二次补正后材料仍不合格：身份证扫描件模糊无法辨认、健康证明已过期、入会合同仍未签署。鉴于两次补正均不满足要求，予以驳回，请会员重新提交申请。",
            created_at=now - timedelta(days=1),
        ))

        # ============== 5. 待审核单 - 周小龙（登记员已提交，等待审核主管办理） ==============
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

        pr1 = RequiredAttachment(order_id=pending_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        pr2 = RequiredAttachment(order_id=pending_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        pr3 = RequiredAttachment(order_id=pending_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        pr4 = RequiredAttachment(order_id=pending_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([pr1, pr2, pr3, pr4])
        db.flush()

        db.add(Attachment(order_id=pending_order.id, required_attachment_id=pr1.id, file_name="周小龙_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_pending_005.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=6)))
        db.add(Attachment(order_id=pending_order.id, required_attachment_id=pr2.id, file_name="周小龙_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_pending_005.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=6)))
        db.add(Attachment(order_id=pending_order.id, required_attachment_id=pr3.id, file_name="周小龙_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_pending_005.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=6)))
        db.add(Attachment(order_id=pending_order.id, required_attachment_id=pr4.id, file_name="周小龙_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_pending_005.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=6)))

        db.add(AuditLog(order_id=pending_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(hours=6)))
        db.add(AuditLog(order_id=pending_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(hours=6)))
        db.add(AuditLog(order_id=pending_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核，等待审核主管办理", created_at=now - timedelta(hours=6)))

        # ============== 6. 审核通过待复核 - 吴小芳 ==============
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

        ar1 = RequiredAttachment(order_id=approved_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        ar2 = RequiredAttachment(order_id=approved_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        ar3 = RequiredAttachment(order_id=approved_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        ar4 = RequiredAttachment(order_id=approved_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([ar1, ar2, ar3, ar4])
        db.flush()

        db.add(Attachment(order_id=approved_order.id, required_attachment_id=ar1.id, file_name="吴小芳_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_approv_006.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=4)))
        db.add(Attachment(order_id=approved_order.id, required_attachment_id=ar2.id, file_name="吴小芳_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_approv_006.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=4)))
        db.add(Attachment(order_id=approved_order.id, required_attachment_id=ar3.id, file_name="吴小芳_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_approv_006.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=4)))
        db.add(Attachment(order_id=approved_order.id, required_attachment_id=ar4.id, file_name="吴小芳_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_approv_006.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=4)))

        db.add(AuditLog(order_id=approved_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=4)))
        db.add(AuditLog(order_id=approved_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(days=4)))
        db.add(AuditLog(order_id=approved_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核", created_at=now - timedelta(days=3)))
        db.add(AuditLog(order_id=approved_order.id, operator_id=supervisor.id, action=AuditAction.APPROVE, from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.APPROVED_REVIEW, remark=f"审核主管【{supervisor.name}】办理通过，材料齐全有效", created_at=now - timedelta(days=2)))
        db.add(AuditLog(order_id=approved_order.id, operator_id=supervisor.id, action=AuditAction.CONFIRM_CONTRACT, remark=f"审核主管【{supervisor.name}】确认合同已签署", created_at=now - timedelta(days=2)))

        # ============== 7. 待审核 - 郑小强（批量审核演示用） ==============
        pending2_order = MembershipOrder(
            order_no="HY20250601007",
            member_name="郑小强",
            member_phone="13800000007",
            member_id_no="110101199307071234",
            membership_type="季卡",
            membership_duration=90,
            amount=980,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.PENDING_REVIEW,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(hours=4),
            updated_at=now - timedelta(hours=4),
        )
        db.add(pending2_order)
        db.flush()

        p2r1 = RequiredAttachment(order_id=pending2_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        p2r2 = RequiredAttachment(order_id=pending2_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        p2r3 = RequiredAttachment(order_id=pending2_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        p2r4 = RequiredAttachment(order_id=pending2_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([p2r1, p2r2, p2r3, p2r4])
        db.flush()

        db.add(Attachment(order_id=pending2_order.id, required_attachment_id=p2r1.id, file_name="郑小强_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_pending_007.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=4)))
        db.add(Attachment(order_id=pending2_order.id, required_attachment_id=p2r2.id, file_name="郑小强_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_pending_007.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=4)))
        db.add(Attachment(order_id=pending2_order.id, required_attachment_id=p2r3.id, file_name="郑小强_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_pending_007.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=4)))
        db.add(Attachment(order_id=pending2_order.id, required_attachment_id=p2r4.id, file_name="郑小强_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_pending_007.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=4)))

        db.add(AuditLog(order_id=pending2_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(hours=4)))
        db.add(AuditLog(order_id=pending2_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(hours=4)))
        db.add(AuditLog(order_id=pending2_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核，等待审核主管办理", created_at=now - timedelta(hours=4)))

        # ============== 8. 待审核 - 王美丽（批量退回补正演示用，材料不全） ==============
        pending3_order = MembershipOrder(
            order_no="HY20250601008",
            member_name="王美丽",
            member_phone="13800000008",
            member_id_no="110101199408081234",
            membership_type="月卡",
            membership_duration=30,
            amount=380,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.PENDING_REVIEW,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(hours=2),
            updated_at=now - timedelta(hours=2),
        )
        db.add(pending3_order)
        db.flush()

        p3r1 = RequiredAttachment(order_id=pending3_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        p3r2 = RequiredAttachment(order_id=pending3_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=False, missing_reason="暂未提供照片")
        p3r3 = RequiredAttachment(order_id=pending3_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=False, missing_reason="表示下周去体检")
        p3r4 = RequiredAttachment(order_id=pending3_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([p3r1, p3r2, p3r3, p3r4])
        db.flush()

        db.add(Attachment(order_id=pending3_order.id, required_attachment_id=p3r1.id, file_name="王美丽_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_pending_008.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=2)))
        db.add(Attachment(order_id=pending3_order.id, required_attachment_id=p3r4.id, file_name="王美丽_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_pending_008.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=2)))

        db.add(AuditLog(order_id=pending3_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(hours=2)))
        db.add(AuditLog(order_id=pending3_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传身份证和合同（缺照片、健康证明），申请后补", created_at=now - timedelta(hours=2)))
        db.add(AuditLog(order_id=pending3_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核，申请容缺办理", created_at=now - timedelta(hours=2)))

        # ============== 9. 草稿 - 陈大勇（批量提交演示用） ==============
        draft2_order = MembershipOrder(
            order_no="HY20250601009",
            member_name="陈大勇",
            member_phone="13800000009",
            member_id_no="110101199509091234",
            membership_type="年卡",
            membership_duration=365,
            amount=2880,
            contract_confirmed=False,
            card_activated=False,
            status=OrderStatus.DRAFT,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(hours=1),
            updated_at=now - timedelta(hours=1),
        )
        db.add(draft2_order)
        db.flush()

        d2r1 = RequiredAttachment(order_id=draft2_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        d2r2 = RequiredAttachment(order_id=draft2_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        d2r3 = RequiredAttachment(order_id=draft2_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        d2r4 = RequiredAttachment(order_id=draft2_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([d2r1, d2r2, d2r3, d2r4])
        db.flush()

        db.add(Attachment(order_id=draft2_order.id, required_attachment_id=d2r1.id, file_name="陈大勇_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_draft_009.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=1)))
        db.add(Attachment(order_id=draft2_order.id, required_attachment_id=d2r2.id, file_name="陈大勇_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_draft_009.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=1)))
        db.add(Attachment(order_id=draft2_order.id, required_attachment_id=d2r3.id, file_name="陈大勇_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_draft_009.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=1)))
        db.add(Attachment(order_id=draft2_order.id, required_attachment_id=d2r4.id, file_name="陈大勇_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_draft_009.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(hours=1)))

        db.add(AuditLog(order_id=draft2_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(hours=1)))
        db.add(AuditLog(order_id=draft2_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(hours=1)))

        # ============== 10. 复核通过待归档 - 林小燕（批量归档演示用） ==============
        reviewed2_order = MembershipOrder(
            order_no="HY20250601010",
            member_name="林小燕",
            member_phone="13800000010",
            member_id_no="110101199610101234",
            membership_type="半年卡",
            membership_duration=180,
            amount=1680,
            contract_confirmed=True,
            card_activated=False,
            status=OrderStatus.REVIEWED,
            is_overdue=False,
            created_by=registrar.id,
            created_at=now - timedelta(days=3),
            updated_at=now - timedelta(days=1),
        )
        db.add(reviewed2_order)
        db.flush()

        rv1 = RequiredAttachment(order_id=reviewed2_order.id, attachment_type=AttachmentType.ID_CARD, attachment_name="身份证复印件", is_provided=True)
        rv2 = RequiredAttachment(order_id=reviewed2_order.id, attachment_type=AttachmentType.PHOTO, attachment_name="一寸免冠照片", is_provided=True)
        rv3 = RequiredAttachment(order_id=reviewed2_order.id, attachment_type=AttachmentType.HEALTH_CERT, attachment_name="健康证明", is_provided=True)
        rv4 = RequiredAttachment(order_id=reviewed2_order.id, attachment_type=AttachmentType.CONTRACT, attachment_name="入会合同", is_provided=True)
        db.add_all([rv1, rv2, rv3, rv4])
        db.flush()

        db.add(Attachment(order_id=reviewed2_order.id, required_attachment_id=rv1.id, file_name="林小燕_身份证.pdf", file_type=AttachmentType.ID_CARD, file_size=102400, stored_name="id_review_010.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=3)))
        db.add(Attachment(order_id=reviewed2_order.id, required_attachment_id=rv2.id, file_name="林小燕_照片.jpg", file_type=AttachmentType.PHOTO, file_size=204800, stored_name="photo_review_010.jpg", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=3)))
        db.add(Attachment(order_id=reviewed2_order.id, required_attachment_id=rv3.id, file_name="林小燕_健康证明.pdf", file_type=AttachmentType.HEALTH_CERT, file_size=153600, stored_name="health_review_010.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=3)))
        db.add(Attachment(order_id=reviewed2_order.id, required_attachment_id=rv4.id, file_name="林小燕_入会合同.pdf", file_type=AttachmentType.CONTRACT, file_size=307200, stored_name="contract_review_010.pdf", uploaded_by=registrar.id, uploaded_at=now - timedelta(days=3)))

        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=registrar.id, action=AuditAction.CREATE, to_status=OrderStatus.DRAFT, remark=f"登记员【{registrar.name}】创建会员入会单", created_at=now - timedelta(days=3)))
        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=registrar.id, action=AuditAction.UPLOAD_ATTACHMENT, remark=f"登记员【{registrar.name}】上传全部4份附件材料", created_at=now - timedelta(days=3)))
        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=registrar.id, action=AuditAction.SUBMIT, from_status=OrderStatus.DRAFT, to_status=OrderStatus.PENDING_REVIEW, remark=f"登记员【{registrar.name}】提交审核", created_at=now - timedelta(days=2)))
        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=supervisor.id, action=AuditAction.APPROVE, from_status=OrderStatus.PENDING_REVIEW, to_status=OrderStatus.APPROVED_REVIEW, remark=f"审核主管【{supervisor.name}】办理通过，材料齐全有效", created_at=now - timedelta(days=2)))
        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=supervisor.id, action=AuditAction.CONFIRM_CONTRACT, remark=f"审核主管【{supervisor.name}】确认合同已签署", created_at=now - timedelta(days=2)))
        db.add(AuditLog(order_id=reviewed2_order.id, operator_id=reviewer.id, action=AuditAction.REVIEW, from_status=OrderStatus.APPROVED_REVIEW, to_status=OrderStatus.REVIEWED, remark=f"复核负责人【{reviewer.name}】复核通过，信息核实无误", created_at=now - timedelta(days=1)))

        db.commit()
        print("=" * 60)
        print("数据库初始化完成！种子数据已加载。")
        print("=" * 60)
        print("")
        print("【用户账号（登录时可切换角色）】")
        print(f"  登记员（registrar）     : {registrar.name}")
        print(f"  审核主管（supervisor）  : {supervisor.name}")
        print(f"  复核负责人（reviewer）  : {reviewer.name}")
        print("")
        print("【Seed 样例入会单（共10条）】")
        print("")
        print("  1. HY20250601001  赵小明  【✅ 正常单】已归档")
        print("     → 完整流程：创建→提交→审核通过→复核→归档")
        print("     → 4/4 附件齐全，合同已确认，卡权益已启用")
        print("     → 审计日志包含 3 个角色的完整操作记录")
        print("")
        print("  2. HY20250601002  钱小红  【⚠️ 缺材料单】附件缺失待补正（一轮）")
        print("     → 2/4 附件（缺健康证明、合同），每附件独立退回原因")
        print("     → 登记员可以补正上传后重新提交")
        print("")
        print("  3. HY20250601003  孙小刚  【⏰ 超时单】补正超时未处理")
        print("     → 1/4 附件，超 7 天未补齐")
        print("     → 已标记超时，有独立的超时审计记录和失败原因")
        print("")
        print("  4. HY20250601004  李小华  【❌ 退回单】二次审核不合格被驳回")
        print("     → 两轮退回补正 + 最终驳回，共 3 次审核交互")
        print("     → 每个附件都有 2-3 条驳回历史（带时间+操作人+原因）")
        print("     → 审计日志完整追溯：谁在什么时候因为什么退回/驳回")
        print("")
        print("  5. HY20250601005  周小龙  【📋 待审核】等待审核主管办理")
        print("     → 4/4 附件齐全，登记员已提交")
        print("     → 审核主管可选择：通过 / 退回补正 / 驳回")
        print("")
        print("  6. HY20250601006  吴小芳  【📬 待复核】审核通过等待复核归档")
        print("     → 审核主管已通过并确认合同")
        print("     → 复核负责人可复核通过并归档（自动启用卡权益）")
        print("")
        print("  7. HY20250601007  郑小强  【📋 待审核】批量审核演示（材料齐全）")
        print("     → 4/4 附件齐全，可与周小龙一起批量审核通过")
        print("")
        print("  8. HY20250601008  王美丽  【📋 待审核】批量退回补正演示（材料不全）")
        print("     → 2/4 附件（缺照片、健康证明），申请容缺办理")
        print("     → 可与其他待审核单一起批量退回补正")
        print("")
        print("  9. HY20250601009  陈大勇  【📝 草稿】批量提交演示")
        print("     → 4/4 附件齐全，处于草稿状态")
        print("     → 登记员可批量提交草稿单进入审核")
        print("")
        print("  10. HY20250601010  林小燕  【📦 待归档】批量归档演示")
        print("     → 已复核通过，等待归档")
        print("     → 复核负责人可批量归档并自动启用卡权益")
        print("")
        print("【验收路径建议】")
        print("  ● 正常流程：周小龙 → 审核主管通过 → 复核负责人复核 → 归档")
        print("  ● 补正流程：钱小红 → 登记员补传2个附件 → 重新提交 → 审核主管再处理")
        print("  ● 驳回流程：周小龙 → 审核主管按附件填原因退回 → 登记员重提 → 再退回 → 最终驳回")
        print("  ● 追溯查看：李小华 → 看每附件 2 轮驳回历史 → 看审计日志时间线")
        print("  ● 权限校验：用错误角色操作（如登记员点审核），后端会拒绝并返回原因")
        print("  ● 批量审核：审核主管 → 勾选周小龙+郑小强+王美丽 → 批量通过 → 前2条成功+王美丽失败（材料不全）")
        print("  ● 批量退回补正：审核主管 → 勾选周小龙+王美丽 → 批量退回 → 逐单指定附件和原因")
        print("  ● 批量归档：复核负责人 → 勾选吴小芳+林小燕 → 批量归档 → 自动启用卡权益")

    finally:
        db.close()


if __name__ == "__main__":
    init_db()
