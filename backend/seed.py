from app import create_app
from models import db, User, ImmunizationPlan, VaccinationRecord, Attachment, AbnormalRecheck, AuditLog, RoleEnum, RecordStatus, AttachmentType, RecheckStatus
from datetime import datetime, timedelta

app = create_app()

with app.app_context():
    db.drop_all()
    db.create_all()

    breeder1 = User(username="liwei", display_name="李伟", role=RoleEnum.breeder)
    breeder2 = User(username="zhangmei", display_name="张美", role=RoleEnum.breeder)
    vet_sup = User(username="wangqiang", display_name="王强", role=RoleEnum.vet_supervisor)
    farm_mgr = User(username="zhaoming", display_name="赵明", role=RoleEnum.farm_manager)
    db.session.add_all([breeder1, breeder2, vet_sup, farm_mgr])
    db.session.commit()

    plan1 = ImmunizationPlan(
        plan_code="IMM-2026-001",
        plan_name="春季口蹄疫免疫计划",
        vaccine_type="口蹄疫O型灭活疫苗",
        target_species="牛",
        target_count=200,
        start_date=datetime(2026, 3, 1).date(),
        end_date=datetime(2026, 3, 31).date(),
        status=RecordStatus.approved,
        created_by=breeder1.id,
        description="2026年春季口蹄疫集中免疫，覆盖全场牛群",
    )
    plan2 = ImmunizationPlan(
        plan_code="IMM-2026-002",
        plan_name="禽流感强化免疫",
        vaccine_type="H5N1禽流感灭活疫苗",
        target_species="鸡",
        target_count=5000,
        start_date=datetime(2026, 4, 1).date(),
        end_date=datetime(2026, 4, 15).date(),
        status=RecordStatus.submitted,
        created_by=breeder2.id,
        description="禽流感高发季节强化免疫",
    )
    db.session.add_all([plan1, plan2])
    db.session.commit()

    now = datetime.utcnow()

    rec_normal = VaccinationRecord(
        record_code="VAC-2026-001",
        plan_id=plan1.id,
        animal_id="CATTLE-001",
        animal_tag="黄牛-A001",
        species="牛",
        status=RecordStatus.approved,
        vaccinated_at=now - timedelta(days=5),
        vaccine_batch="FT2026001",
        dosage="2ml",
        result="normal",
        created_by=breeder1.id,
        reviewed_by=vet_sup.id,
        approved_by=farm_mgr.id,
        created_at=now - timedelta(days=6),
        reviewed_at=now - timedelta(days=4),
        approved_at=now - timedelta(days=3),
        deadline_at=now + timedelta(days=1),
    )
    rec_normal.attachments = [
        Attachment(file_name="接种证明_001.pdf", file_path="/uploads/vac001/proof.pdf", attachment_type=AttachmentType.required, label="接种证明", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=6)),
        Attachment(file_name="疫苗标签_001.jpg", file_path="/uploads/vac001/label.jpg", attachment_type=AttachmentType.required, label="疫苗标签照片", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=6)),
        Attachment(file_name="现场照片_001.jpg", file_path="/uploads/vac001/scene.jpg", attachment_type=AttachmentType.supplementary, label="现场照片", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=5)),
    ]

    rec_missing = VaccinationRecord(
        record_code="VAC-2026-002",
        plan_id=plan1.id,
        animal_id="CATTLE-002",
        animal_tag="黄牛-A002",
        species="牛",
        status=RecordStatus.draft,
        created_by=breeder1.id,
        created_at=now - timedelta(days=3),
        deadline_at=now - timedelta(days=1),
    )
    rec_missing.attachments = [
        Attachment(file_name=None, file_path=None, attachment_type=AttachmentType.required, label="接种证明"),
        Attachment(file_name="疫苗标签_002.jpg", file_path="/uploads/vac002/label.jpg", attachment_type=AttachmentType.required, label="疫苗标签照片", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=3)),
        Attachment(file_name=None, file_path=None, attachment_type=AttachmentType.supplementary, label="现场照片"),
    ]

    rec_timeout = VaccinationRecord(
        record_code="VAC-2026-003",
        plan_id=plan1.id,
        animal_id="CATTLE-003",
        animal_tag="黄牛-A003",
        species="牛",
        status=RecordStatus.submitted,
        created_by=breeder2.id,
        reviewed_by=None,
        created_at=now - timedelta(days=10),
        deadline_at=now - timedelta(days=3),
    )
    rec_timeout.attachments = [
        Attachment(file_name="接种证明_003.pdf", file_path="/uploads/vac003/proof.pdf", attachment_type=AttachmentType.required, label="接种证明", uploaded_by=breeder2.id, uploaded_at=now - timedelta(days=10)),
        Attachment(file_name="疫苗标签_003.jpg", file_path="/uploads/vac003/label.jpg", attachment_type=AttachmentType.required, label="疫苗标签照片", uploaded_by=breeder2.id, uploaded_at=now - timedelta(days=10)),
    ]

    rec_returned = VaccinationRecord(
        record_code="VAC-2026-004",
        plan_id=plan1.id,
        animal_id="CATTLE-004",
        animal_tag="黄牛-A004",
        species="牛",
        status=RecordStatus.returned,
        created_by=breeder1.id,
        reviewed_by=vet_sup.id,
        reviewed_at=now - timedelta(days=2),
        return_reason="接种证明照片模糊，无法辨认批号，请重新拍照上传",
        created_at=now - timedelta(days=5),
        deadline_at=now + timedelta(days=2),
    )
    rec_returned.attachments = [
        Attachment(file_name="接种证明_004_blur.pdf", file_path="/uploads/vac004/proof_blur.pdf", attachment_type=AttachmentType.rejected, label="接种证明", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=5), rejection_reason="照片模糊，无法辨认批号", rejected_at=now - timedelta(days=2)),
        Attachment(file_name="疫苗标签_004.jpg", file_path="/uploads/vac004/label.jpg", attachment_type=AttachmentType.required, label="疫苗标签照片", uploaded_by=breeder1.id, uploaded_at=now - timedelta(days=5)),
    ]

    rec_abnormal = VaccinationRecord(
        record_code="VAC-2026-005",
        plan_id=plan1.id,
        animal_id="CATTLE-005",
        animal_tag="黄牛-A005",
        species="牛",
        status=RecordStatus.under_review,
        created_by=breeder2.id,
        reviewed_by=vet_sup.id,
        reviewed_at=now - timedelta(days=1),
        result="adverse_reaction",
        vaccine_batch="FT2026002",
        dosage="2ml",
        audit_note="接种后出现局部红肿，需复查",
        created_at=now - timedelta(days=4),
        deadline_at=now + timedelta(days=3),
    )
    rec_abnormal.attachments = [
        Attachment(file_name="接种证明_005.pdf", file_path="/uploads/vac005/proof.pdf", attachment_type=AttachmentType.required, label="接种证明", uploaded_by=breeder2.id, uploaded_at=now - timedelta(days=4)),
        Attachment(file_name="疫苗标签_005.jpg", file_path="/uploads/vac005/label.jpg", attachment_type=AttachmentType.required, label="疫苗标签照片", uploaded_by=breeder2.id, uploaded_at=now - timedelta(days=4)),
        Attachment(file_name="异常反应照片_005.jpg", file_path="/uploads/vac005/reaction.jpg", attachment_type=AttachmentType.supplementary, label="异常反应照片", uploaded_by=vet_sup.id, uploaded_at=now - timedelta(days=1)),
    ]

    rec_draft2 = VaccinationRecord(
        record_code="VAC-2026-006",
        plan_id=plan2.id,
        animal_id="POULTRY-001",
        animal_tag="鸡群-B001",
        species="鸡",
        status=RecordStatus.draft,
        created_by=breeder2.id,
        created_at=now - timedelta(days=1),
        deadline_at=now + timedelta(days=6),
    )
    rec_draft2.attachments = [
        Attachment(file_name=None, file_path=None, attachment_type=AttachmentType.required, label="接种证明"),
        Attachment(file_name=None, file_path=None, attachment_type=AttachmentType.required, label="疫苗标签照片"),
    ]

    db.session.add_all([rec_normal, rec_missing, rec_timeout, rec_returned, rec_abnormal, rec_draft2])
    db.session.commit()

    recheck1 = AbnormalRecheck(
        record_id=rec_abnormal.id,
        abnormal_type="adverse_reaction",
        description="接种口蹄疫疫苗后出现局部红肿，疑似过敏反应",
        status=RecheckStatus.pending,
        created_by=vet_sup.id,
        created_at=now - timedelta(days=1),
        deadline_at=now + timedelta(days=2),
    )
    db.session.add(recheck1)
    db.session.commit()

    audit_logs = [
        AuditLog(record_id=rec_normal.id, action="create_record", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"饲养员 李伟 创建免疫记录 VAC-2026-001"),
        AuditLog(record_id=rec_normal.id, action="submit_record", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"饲养员 李伟 提交免疫记录 VAC-2026-001"),
        AuditLog(record_id=rec_normal.id, action="review_record", actor_id=vet_sup.id, actor_role=RoleEnum.vet_supervisor, detail=f"兽医主管 王强 审核免疫记录 VAC-2026-001，结果: normal"),
        AuditLog(record_id=rec_normal.id, action="approve_record", actor_id=farm_mgr.id, actor_role=RoleEnum.farm_manager, detail=f"场长 赵明 批准免疫记录 VAC-2026-001"),
        AuditLog(record_id=rec_missing.id, action="create_record", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"饲养员 李伟 创建免疫记录 VAC-2026-002"),
        AuditLog(record_id=rec_missing.id, action="submit_record_failed", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"提交免疫记录 VAC-2026-002 失败，缺少必传附件", failure_reason="缺少必传附件: 接种证明", next_step_suggestion="请上传所有必传附件后重新提交"),
        AuditLog(record_id=rec_timeout.id, action="create_record", actor_id=breeder2.id, actor_role=RoleEnum.breeder, detail=f"饲养员 张美 创建免疫记录 VAC-2026-003"),
        AuditLog(record_id=rec_timeout.id, action="submit_record", actor_id=breeder2.id, actor_role=RoleEnum.breeder, detail=f"饲养员 张美 提交免疫记录 VAC-2026-003"),
        AuditLog(record_id=rec_returned.id, action="create_record", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"饲养员 李伟 创建免疫记录 VAC-2026-004"),
        AuditLog(record_id=rec_returned.id, action="submit_record", actor_id=breeder1.id, actor_role=RoleEnum.breeder, detail=f"饲养员 李伟 提交免疫记录 VAC-2026-004"),
        AuditLog(record_id=rec_returned.id, action="return_record", actor_id=vet_sup.id, actor_role=RoleEnum.vet_supervisor, detail=f"兽医主管 王强 退回免疫记录 VAC-2026-004，原因: 接种证明照片模糊", failure_reason="照片模糊，无法辨认批号", next_step_suggestion="请重新拍照上传接种证明"),
        AuditLog(record_id=rec_abnormal.id, action="create_record", actor_id=breeder2.id, actor_role=RoleEnum.breeder, detail=f"饲养员 张美 创建免疫记录 VAC-2026-005"),
        AuditLog(record_id=rec_abnormal.id, action="submit_record", actor_id=breeder2.id, actor_role=RoleEnum.breeder, detail=f"饲养员 张美 提交免疫记录 VAC-2026-005"),
        AuditLog(record_id=rec_abnormal.id, action="review_record", actor_id=vet_sup.id, actor_role=RoleEnum.vet_supervisor, detail=f"兽医主管 王强 审核免疫记录 VAC-2026-005，标记异常: adverse_reaction"),
        AuditLog(recheck_id=recheck1.id, record_id=rec_abnormal.id, action="create_recheck", actor_id=vet_sup.id, actor_role=RoleEnum.vet_supervisor, detail=f"创建异常复查: 接种口蹄疫疫苗后出现局部红肿"),
    ]
    db.session.add_all(audit_logs)
    db.session.commit()

    print("✅ 种子数据初始化完成！")
    print(f"  用户: {User.query.count()} 条")
    print(f"  免疫计划: {ImmunizationPlan.query.count()} 条")
    print(f"  免疫记录: {VaccinationRecord.query.count()} 条")
    print(f"  附件: {Attachment.query.count()} 条")
    print(f"  异常复查: {AbnormalRecheck.query.count()} 条")
    print(f"  审计日志: {AuditLog.query.count()} 条")
    print()
    print("📋 样例说明:")
    print("  VAC-2026-001: 正常单 — 已完成全部审批流程")
    print("  VAC-2026-002: 缺材料单 — 草稿状态，缺少必传附件，已超期")
    print("  VAC-2026-003: 超时单 — 已提交但审核超时")
    print("  VAC-2026-004: 退回单 — 接种证明被驳回，需要补传")
    print("  VAC-2026-005: 异常单 — 接种后不良反应，待复查")
    print("  VAC-2026-006: 草稿单 — 禽流感计划，全部附件缺失")
