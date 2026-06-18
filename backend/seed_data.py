import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine, SessionLocal
from app.models import (
    User, TrainingProject, Evidence, OperationLog, AppealRecord,
    Role, Stage, Status, EvidenceType, ActionType, AppealResult
)
from app import schemas, crud, services


def _expect_conflict(label: str, fn, *args, **kwargs):
    """调用一个预期会校验失败的业务操作，冲突记录已由 services 写入操作记录。

    用于在样例数据中演示「保留原状态 + 写 STATE_CONFLICT 操作记录」的校验闭环。
    """
    try:
        fn(*args, **kwargs)
    except services.BusinessError as e:
        print(f"  [预期冲突·{label}] {e.error_type}: {e.message}")
        return None
    return None


def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print("创建用户...")
        registrar = crud.create_user(db, schemas.UserCreate(
            name="张明",
            role=Role.REGISTRAR,
            department="培训项目登记部"
        ))
        registrar2 = crud.create_user(db, schemas.UserCreate(
            name="李华",
            role=Role.REGISTRAR,
            department="培训项目登记部"
        ))
        supervisor = crud.create_user(db, schemas.UserCreate(
            name="王芳",
            role=Role.SUPERVISOR,
            department="培训项目审核部"
        ))
        supervisor2 = crud.create_user(db, schemas.UserCreate(
            name="赵强",
            role=Role.SUPERVISOR,
            department="培训项目审核部"
        ))
        reviewer = crud.create_user(db, schemas.UserCreate(
            name="刘总",
            role=Role.REVIEWER,
            department="企业培训公司复核部"
        ))
        print(f"  - 登记员: {registrar.name} (ID: {registrar.id})")
        print(f"  - 登记员: {registrar2.name} (ID: {registrar2.id})")
        print(f"  - 审核主管: {supervisor.name} (ID: {supervisor.id})")
        print(f"  - 审核主管: {supervisor2.name} (ID: {supervisor2.id})")
        print(f"  - 复核负责人: {reviewer.name} (ID: {reviewer.id})")

        print("\n创建示例项目...")

        project1 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="新员工入职技能培训项目",
            client_company="北京科技有限公司",
            stage=Stage.CONTRACT,
            description="为期两周的新员工入职技能培训，涵盖公司文化、业务流程和专业技能。",
            budget=150000.0,
            deadline=datetime.utcnow() + timedelta(days=30),
            created_by_id=registrar.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="培训需求确认书.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="客户签字确认的培训需求文档",
            uploaded_by_id=registrar.id,
        ), project1.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="方案报价单.xlsx",
            evidence_type=EvidenceType.QUOTATION_SHEET,
            description="包含讲师费用、场地费用、教材费用的详细报价",
            uploaded_by_id=registrar.id,
        ), project1.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="培训服务合同.pdf",
            evidence_type=EvidenceType.CONTRACT,
            description="双方签字盖章的正式合同",
            uploaded_by_id=registrar.id,
        ), project1.id)
        services.submit_project(db, project1.id, schemas.SubmitData(
            current_user_id=registrar.id,
            comment="需求、报价、合同材料齐全，申请审核"
        ))
        services.process_incoming_project(db, project1.id, supervisor.id)
        services.review_project(
            db, project1.id,
            schemas.ReviewData(
                current_user_id=supervisor.id,
                opinion="材料完整，流程规范，建议复核通过",
            ),
            approve=True
        )
        services.process_incoming_project(db, project1.id, reviewer.id)
        services.review_project(
            db, project1.id,
            schemas.ReviewData(
                current_user_id=reviewer.id,
                opinion="项目合规，批准通过",
            ),
            approve=True
        )
        services.archive_project(db, project1.id, reviewer.id)
        print(f"  [正常通过] {project1.project_no} - {project1.project_name}")

        project2 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="中层管理能力提升培训",
            client_company="上海贸易集团",
            stage=Stage.QUOTATION,
            description="针对公司中层管理人员的领导力和管理能力提升培训。",
            budget=280000.0,
            deadline=datetime.utcnow() + timedelta(days=15),
            created_by_id=registrar.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="中层管理培训需求.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="客户提供的培训需求说明",
            uploaded_by_id=registrar.id,
        ), project2.id)
        print(f"  [缺证据] {project2.project_no} - {project2.project_name} (处于报价阶段但缺少报价单)")
        # 演示：登记员在缺报价单时尝试提交，后端校验失败保留草稿并写状态冲突记录
        _expect_conflict(
            "缺证据提交",
            services.submit_project,
            db, project2.id,
            schemas.SubmitData(current_user_id=registrar.id, comment="材料好像齐了，提交试试"),
        )

        project3 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="销售人员业绩冲刺培训",
            client_company="深圳销售有限公司",
            stage=Stage.NEED,
            description="提升销售团队业绩的专项培训，包含销售技巧和客户心理。",
            budget=95000.0,
            deadline=datetime.utcnow() - timedelta(days=5),
            created_by_id=registrar2.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="销售培训需求v1.docx",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="初步需求文档",
            uploaded_by_id=registrar2.id,
        ), project3.id)
        services.submit_project(db, project3.id, schemas.SubmitData(
            current_user_id=registrar2.id,
            comment="需求文档已准备好，请审核"
        ))
        services.process_incoming_project(db, project3.id, supervisor.id)
        services.mark_overdue(db, project3.id, supervisor.id)
        print(f"  [逾期] {project3.project_no} - {project3.project_name}")

        project4 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="客户服务礼仪标准培训",
            client_company="广州服务集团",
            stage=Stage.NEED,
            description="全员客户服务礼仪标准化培训。",
            budget=60000.0,
            deadline=datetime.utcnow() + timedelta(days=20),
            created_by_id=registrar2.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="服务礼仪培训需求.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="服务礼仪培训需求说明",
            uploaded_by_id=registrar2.id,
        ), project4.id)
        services.submit_project(db, project4.id, schemas.SubmitData(
            current_user_id=registrar2.id,
            comment="请审核需求文档"
        ))
        services.process_incoming_project(db, project4.id, supervisor.id)
        services.return_for_correction(
            db, project4.id,
            schemas.ReturnForCorrectionData(
                current_user_id=supervisor.id,
                reject_reason="需求描述不够详细，缺少培训对象人数、具体时间安排等关键信息。请补充完整后重新提交。",
                opinion="需求文档需完善"
            )
        )
        print(f"  [退回补正] {project4.project_no} - {project4.project_name}")

        project5 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="安全生产法规培训",
            client_company="成都制造有限公司",
            stage=Stage.CONTRACT,
            description="安全生产法规与操作规范全员培训。",
            budget=180000.0,
            deadline=datetime.utcnow() + timedelta(days=10),
            created_by_id=registrar.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="安全生产培训需求.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="安全生产培训需求文档",
            uploaded_by_id=registrar.id,
        ), project5.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="安全培训报价单.xlsx",
            evidence_type=EvidenceType.QUOTATION_SHEET,
            description="安全生产培训项目报价",
            uploaded_by_id=registrar.id,
        ), project5.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="安全培训合同草案.pdf",
            evidence_type=EvidenceType.CONTRACT,
            description="合同草案版本",
            uploaded_by_id=registrar.id,
        ), project5.id)
        services.submit_project(db, project5.id, schemas.SubmitData(
            current_user_id=registrar.id,
            comment="材料齐全，请审核"
        ))
        services.process_incoming_project(db, project5.id, supervisor.id)
        services.review_project(
            db, project5.id,
            schemas.ReviewData(
                current_user_id=supervisor.id,
                opinion="材料完整，提交复核",
            ),
            approve=True
        )
        services.process_incoming_project(db, project5.id, reviewer.id)
        services.review_project(
            db, project5.id,
            schemas.ReviewData(
                current_user_id=reviewer.id,
                opinion="合同条款第5条付款方式需要与客户进一步确认，目前版本不予通过。",
                reject_reason="合同付款条款存在争议，需要重新协商确认"
            ),
            approve=False
        )
        services.submit_appeal(
            db, project5.id,
            schemas.AppealSubmitData(
                current_user_id=registrar.id,
                appeal_reason="我们已与客户电话沟通确认，付款方式按照客户要求设置，客户表示无异议。该条款是客户明确要求的，请复核。",
                submitter_opinion="合同条款合规，客户已确认，请求复核通过"
            )
        )
        print(f"  [状态冲突/申诉中] {project5.project_no} - {project5.project_name}")

        project6 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="技术研发人员技能升级培训",
            client_company="杭州互联网科技",
            stage=Stage.DRAFT if False else Stage.NEED,
            description="研发团队最新技术栈升级培训。",
            budget=350000.0,
            deadline=datetime.utcnow() + timedelta(days=45),
            created_by_id=registrar.id,
        ))
        print(f"  [草稿] {project6.project_no} - {project6.project_name}")
        # 演示：用过期版本号提交，触发版本冲突，保留草稿并写状态冲突记录
        _expect_conflict(
            "版本冲突提交",
            services.submit_project,
            db, project6.id,
            schemas.SubmitData(current_user_id=registrar.id, comment="基于旧版本提交"),
            expected_version=999,
        )

        project7 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="品牌营销策划培训",
            client_company="南京品牌管理公司",
            stage=Stage.QUOTATION,
            description="品牌营销团队策划能力提升培训。",
            budget=220000.0,
            deadline=datetime.utcnow() + timedelta(days=25),
            created_by_id=registrar2.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="品牌营销培训需求.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="品牌营销培训需求",
            uploaded_by_id=registrar2.id,
        ), project7.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="品牌营销报价单.xlsx",
            evidence_type=EvidenceType.QUOTATION_SHEET,
            description="品牌营销培训报价单",
            uploaded_by_id=registrar2.id,
        ), project7.id)
        services.submit_project(db, project7.id, schemas.SubmitData(
            current_user_id=registrar2.id,
            comment="进入合同阶段审核"
        ))
        services.process_incoming_project(db, project7.id, supervisor.id)
        print(f"  [审核中] {project7.project_no} - {project7.project_name}")

        # 再次提交示例：申诉通过 → 转回补正 → 登记员补正后再次提交
        project8 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="数字化转型管理培训",
            client_company="武汉数字科技股份",
            stage=Stage.CONTRACT,
            description="面向中高管的数字化转型方法论培训，含咨询辅导。",
            budget=320000.0,
            deadline=datetime.utcnow() + timedelta(days=40),
            created_by_id=registrar.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="数字化转型需求确认书.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="客户确认的数字化转型培训需求",
            uploaded_by_id=registrar.id,
        ), project8.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="数字化转型报价单.xlsx",
            evidence_type=EvidenceType.QUOTATION_SHEET,
            description="含讲师费、咨询费、材料费的报价",
            uploaded_by_id=registrar.id,
        ), project8.id)
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="数字化转型服务合同.pdf",
            evidence_type=EvidenceType.CONTRACT,
            description="合同初版，付款条款待复核确认",
            uploaded_by_id=registrar.id,
        ), project8.id)
        services.submit_project(db, project8.id, schemas.SubmitData(
            current_user_id=registrar.id,
            comment="合同材料齐全，申请审核"
        ))
        services.process_incoming_project(db, project8.id, supervisor.id)
        services.review_project(db, project8.id, schemas.ReviewData(
            current_user_id=supervisor.id,
            opinion="材料完整，提交复核负责人确认",
        ), approve=True)
        # 复核负责人驳回（合同阶段），进入 rejected
        services.review_project(db, project8.id, schemas.ReviewData(
            current_user_id=reviewer.id,
            opinion="合同第8条违约责任表述需调整，暂不通过。",
            reject_reason="合同违约责任条款需重新拟定"
        ), approve=False)
        # 登记员提交申诉
        services.submit_appeal(db, project8.id, schemas.AppealSubmitData(
            current_user_id=registrar.id,
            appeal_reason="已与法务沟通调整违约责任条款，客户认可，请求复核放行以便按新条款补正后再次提交。",
            submitter_opinion="条款可补正，请给予再次提交机会"
        ))
        # 复核负责人申诉通过 → 转回 RETURNED，处理人交还登记员
        services.review_appeal(db, project8.id, schemas.AppealReviewData(
            current_user_id=reviewer.id,
            reviewer_opinion="申诉理由成立，转回补正，请按调整后的条款补正后再次提交。",
            result=AppealResult.APPROVED,
        ))
        # 登记员补正后再次提交（再次提交闭环）
        services.correct_project(db, project8.id, schemas.CorrectData(
            current_user_id=registrar.id,
            comment="已按法务意见修正合同违约条款并补充说明，再次提交"
        ))
        print(f"  [再次提交] {project8.project_no} - {project8.project_name} (申诉通过→补正→再次提交)")

        # 冲突恢复示例：缺证据提交失败 → 补齐证据 → 冲突恢复提交 → 已提交
        project9 = crud.create_project(db, schemas.TrainingProjectCreate(
            project_name="团队协作效能提升培训",
            client_company="西安创新科技",
            stage=Stage.QUOTATION,
            description="提升团队协作效率与沟通能力的全员培训项目。",
            budget=120000.0,
            deadline=datetime.utcnow() + timedelta(days=28),
            created_by_id=registrar2.id,
        ))
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="团队协作培训需求.pdf",
            evidence_type=EvidenceType.NEED_DOCUMENT,
            description="客户提供的团队协作培训需求",
            uploaded_by_id=registrar2.id,
        ), project9.id)
        print(f"  [冲突恢复] {project9.project_no} - {project9.project_name} (缺证据冲突→补齐→恢复提交)")
        # 步骤1：缺证据提交 → state_conflict（缺报价单）
        _expect_conflict(
            "缺证据-冲突前",
            services.submit_project,
            db, project9.id,
            schemas.SubmitData(current_user_id=registrar2.id, comment="以为齐了，先提交看看"),
        )
        # 步骤2：登记员补齐证据
        crud.add_evidence(db, schemas.EvidenceCreate(
            name="团队协作报价单-修订版.xlsx",
            evidence_type=EvidenceType.QUOTATION_SHEET,
            description="补充了讲师与场地费用的详细报价",
            uploaded_by_id=registrar2.id,
        ), project9.id)
        # 步骤3：冲突恢复提交（audit_note 记录审计备注）
        services.recover_from_conflict(db, project9.id, schemas.ConflictRecoveryData(
            current_user_id=registrar2.id,
            comment="已补齐报价单，执行冲突恢复提交",
            audit_note="审计：缺证据冲突恢复，补全报价单后重新提交，版本v2",
        ))

        print("\n初始化完成！")
        stats = crud.get_statistics(db)
        print(f"\n项目统计:")
        print(f"  总计: {stats['total']}")
        print(f"  草稿: {stats['draft']}")
        print(f"  已提交: {stats['submitted']}")
        print(f"  审核中: {stats['under_review']}")
        print(f"  退回补正: {stats['returned']}")
        print(f"  通过: {stats['approved']}")
        print(f"  驳回: {stats['rejected']}")
        print(f"  申诉中: {stats['appeal_under_review']}")
        print(f"  申诉通过: {stats['appeal_approved']}")
        print(f"  申诉驳回: {stats['appeal_rejected']}")
        print(f"  逾期: {stats['overdue']}")
        print(f"  已归档: {stats['archived']}")
        print(f"  待补救（冲突）: {stats['pending_conflict']}")
        print(f"  已恢复（冲突）: {stats['conflict_recovered']}")

    finally:
        db.close()


if __name__ == "__main__":
    init_db()
