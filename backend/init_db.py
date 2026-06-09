import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app.database import (
    User, Patient, Appointment, Visit, FollowUpVisit,
    FollowUpRecord, AuditLog,
)
from app.config import (
    ROLE_TRIAGE_NURSE, ROLE_GP_DOCTOR, ROLE_MEDICAL_DIRECTOR,
    STATUS_DRAFT, STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR,
    STATUS_CONFIRMED, STATUS_REJECTED,
)
from app.validators import create_audit_log, generate_record_no


def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_users(db)
        patients = seed_patients(db)
        appointments = seed_appointments(db, patients)
        visits = seed_visits(db, patients, appointments)
        follow_up_visits = seed_follow_up_visits(db, patients, visits)
        seed_follow_up_records(db, patients, appointments, visits, follow_up_visits)
        db.commit()
        print("✓ 数据库初始化完成！")
        print()
        print_summary(db)
    except Exception as e:
        db.rollback()
        print(f"✗ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


def print_summary(db: Session):
    print("=" * 50)
    print("数据统计:")
    print(f"  用户: {db.query(User).count()} 个")
    print(f"  患者: {db.query(Patient).count()} 个")
    print(f"  预约登记: {db.query(Appointment).count()} 条")
    print(f"  就诊分诊: {db.query(Visit).count()} 条")
    print(f"  随访回访: {db.query(FollowUpVisit).count()} 条")
    print(f"  随访记录: {db.query(FollowUpRecord).count()} 条")
    print(f"  审计日志: {db.query(AuditLog).count()} 条")
    print()

    status_counts = {
        STATUS_DRAFT: "草稿",
        STATUS_PENDING_DOCTOR: "待医生处理",
        STATUS_PENDING_DIRECTOR: "待主任确认",
        STATUS_CONFIRMED: "已确认",
        STATUS_REJECTED: "已驳回",
    }
    print("随访记录状态分布:")
    for status, name in status_counts.items():
        count = db.query(FollowUpRecord).filter(FollowUpRecord.status == status).count()
        if count > 0:
            print(f"  {name}: {count} 条")
    print()


def seed_users(db: Session):
    users = [
        User(username="nurse1", name="李护士", role=ROLE_TRIAGE_NURSE),
        User(username="nurse2", name="王护士", role=ROLE_TRIAGE_NURSE),
        User(username="doctor1", name="张医生", role=ROLE_GP_DOCTOR),
        User(username="doctor2", name="刘医生", role=ROLE_GP_DOCTOR),
        User(username="director1", name="陈主任", role=ROLE_MEDICAL_DIRECTOR),
    ]
    db.add_all(users)
    db.flush()
    print("✓ 用户数据已加载")
    return users


def seed_patients(db: Session):
    patients = [
        Patient(name="赵建国", id_card="110101195501011234", phone="13800138001"),
        Patient(name="钱美丽", id_card="110101196002022345", phone="13800138002"),
        Patient(name="孙志强", id_card="110101197003033456", phone="13800138003"),
        Patient(name="李小华", id_card="110101198004044567", phone="13800138004"),
        Patient(name="周大伟", id_card="110101199005055678", phone="13800138005"),
        Patient(name="吴小芳", id_card="110101200006066789", phone="13800138006"),
        Patient(name="郑光明", id_card="110101195807077890", phone="13800138007"),
        Patient(name="王秀英", id_card="110101196508088901", phone="13800138008"),
    ]
    db.add_all(patients)
    db.flush()
    print("✓ 患者数据已加载")
    return patients


def seed_appointments(db: Session, patients):
    base_date = datetime.now() - timedelta(days=30)

    appointments = [
        Appointment(patient_id=patients[0].id, appointment_date=base_date + timedelta(days=1),
                    department="全科门诊", doctor_name="张医生", status="confirmed"),
        Appointment(patient_id=patients[1].id, appointment_date=base_date + timedelta(days=2),
                    department="全科门诊", doctor_name="刘医生", status="confirmed"),
        Appointment(patient_id=patients[2].id, appointment_date=base_date + timedelta(days=3),
                    department="全科门诊", doctor_name="张医生", status="confirmed"),
        Appointment(patient_id=patients[3].id, appointment_date=base_date + timedelta(days=5),
                    department="内科", doctor_name="王医生", status="confirmed"),
        Appointment(patient_id=patients[4].id, appointment_date=base_date + timedelta(days=7),
                    department="全科门诊", doctor_name="刘医生", status="confirmed"),
        Appointment(patient_id=patients[6].id, appointment_date=base_date + timedelta(days=10),
                    department="全科门诊", doctor_name="张医生", status="confirmed"),
        Appointment(patient_id=patients[7].id, appointment_date=base_date + timedelta(days=12),
                    department="全科门诊", doctor_name="刘医生", status="confirmed"),
        Appointment(patient_id=patients[0].id, appointment_date=base_date + timedelta(days=15),
                    department="全科门诊", doctor_name="张医生", status="confirmed"),
    ]
    db.add_all(appointments)
    db.flush()
    print("✓ 预约登记数据已加载")
    return appointments


def seed_visits(db: Session, patients, appointments):
    base_date = datetime.now() - timedelta(days=30)

    visits = [
        Visit(patient_id=patients[0].id, appointment_id=appointments[0].id,
              visit_date=base_date + timedelta(days=1), triage_nurse="李护士",
              department="全科门诊", diagnosis="高血压，需要定期随访"),
        Visit(patient_id=patients[1].id, appointment_id=appointments[1].id,
              visit_date=base_date + timedelta(days=2), triage_nurse="李护士",
              department="全科门诊", diagnosis="糖尿病，血糖控制不佳"),
        Visit(patient_id=patients[2].id, appointment_id=appointments[2].id,
              visit_date=base_date + timedelta(days=3), triage_nurse="王护士",
              department="全科门诊", diagnosis="冠心病，术后恢复"),
        Visit(patient_id=patients[3].id, appointment_id=appointments[3].id,
              visit_date=base_date + timedelta(days=5), triage_nurse="王护士",
              department="内科", diagnosis="慢性支气管炎"),
        Visit(patient_id=patients[4].id, appointment_id=appointments[4].id,
              visit_date=base_date + timedelta(days=7), triage_nurse="李护士",
              department="全科门诊", diagnosis="常规体检"),
        Visit(patient_id=patients[6].id, appointment_id=appointments[5].id,
              visit_date=base_date + timedelta(days=10), triage_nurse="王护士",
              department="全科门诊", diagnosis="高血压复诊"),
        Visit(patient_id=patients[7].id, appointment_id=appointments[6].id,
              visit_date=base_date + timedelta(days=12), triage_nurse="李护士",
              department="全科门诊", diagnosis="糖尿病随访"),
        Visit(patient_id=patients[0].id, appointment_id=appointments[7].id,
              visit_date=base_date + timedelta(days=15), triage_nurse="王护士",
              department="全科门诊", diagnosis="高血压复诊"),
    ]
    db.add_all(visits)
    db.flush()
    print("✓ 就诊分诊数据已加载")
    return visits


def seed_follow_up_visits(db: Session, patients, visits):
    base_date = datetime.now() - timedelta(days=20)

    follow_ups = [
        FollowUpVisit(patient_id=patients[0].id, visit_id=visits[0].id,
                      follow_up_date=base_date + timedelta(days=1),
                      follow_up_type="高血压随访",
                      content="血压145/90mmHg，服药依从性好",
                      operator="李护士"),
        FollowUpVisit(patient_id=patients[1].id, visit_id=visits[1].id,
                      follow_up_date=base_date + timedelta(days=2),
                      follow_up_type="糖尿病随访",
                      content="空腹血糖8.2mmol/L，饮食控制不佳",
                      operator="王护士"),
        FollowUpVisit(patient_id=patients[2].id, visit_id=visits[2].id,
                      follow_up_date=base_date + timedelta(days=3),
                      follow_up_type="冠心病随访",
                      content="胸痛偶发，按时服药",
                      operator="李护士"),
        FollowUpVisit(patient_id=patients[3].id, visit_id=visits[3].id,
                      follow_up_date=base_date + timedelta(days=5),
                      follow_up_type="慢病随访",
                      content="咳嗽减轻，继续服药",
                      operator="王护士"),
        FollowUpVisit(patient_id=patients[6].id, visit_id=visits[5].id,
                      follow_up_date=base_date + timedelta(days=8),
                      follow_up_type="高血压随访",
                      content="血压138/85mmHg，控制良好",
                      operator="李护士"),
        FollowUpVisit(patient_id=patients[7].id, visit_id=visits[6].id,
                      follow_up_date=base_date + timedelta(days=10),
                      follow_up_type="糖尿病随访",
                      content="血糖偏高，建议加强饮食控制",
                      operator="王护士"),
        FollowUpVisit(patient_id=patients[0].id, visit_id=visits[7].id,
                      follow_up_date=base_date + timedelta(days=12),
                      follow_up_type="高血压随访",
                      content="血压150/95mmHg，需要调整用药",
                      operator="李护士"),
    ]
    db.add_all(follow_ups)
    db.flush()
    print("✓ 随访回访数据已加载")
    return follow_ups


def seed_follow_up_records(db: Session, patients, appointments, visits, follow_ups):
    base_date = datetime.now() - timedelta(days=15)
    records = []

    # === 测试场景1: 正常草稿，证据齐全（待护士提交） ===
    r1 = FollowUpRecord(
        record_no="FURTEST001",
        patient_id=patients[0].id,
        appointment_id=appointments[0].id,
        visit_id=visits[0].id,
        follow_up_visit_id=follow_ups[0].id,
        status=STATUS_DRAFT,
        follow_up_type="高血压随访",
        content="血压监测记录，需医生确认",
        result="",
        remarks="【测试1】正常草稿，证据齐全",
        created_by="李护士",
        updated_by="李护士",
        version=1,
        created_at=base_date,
        updated_at=base_date,
    )
    records.append(r1)

    # === 测试场景2: 待医生处理，证据齐全 ===
    r2 = FollowUpRecord(
        record_no="FURTEST002",
        patient_id=patients[1].id,
        appointment_id=appointments[1].id,
        visit_id=visits[1].id,
        follow_up_visit_id=follow_ups[1].id,
        status=STATUS_PENDING_DOCTOR,
        follow_up_type="糖尿病随访",
        content="糖尿病随访记录，待医生处理",
        result="血糖控制一般，建议调整用药",
        remarks="【测试2】待医生处理，证据齐全",
        created_by="李护士",
        updated_by="李护士",
        version=2,
        created_at=base_date - timedelta(days=1),
        updated_at=base_date,
    )
    records.append(r2)

    # === 测试场景3: 待主任确认 ===
    r3 = FollowUpRecord(
        record_no="FURTEST003",
        patient_id=patients[2].id,
        appointment_id=appointments[2].id,
        visit_id=visits[2].id,
        follow_up_visit_id=follow_ups[2].id,
        status=STATUS_PENDING_DIRECTOR,
        follow_up_type="冠心病随访",
        content="冠心病术后随访",
        result="恢复良好，继续观察",
        remarks="【测试3】医生已确认，待主任审核",
        created_by="王护士",
        updated_by="张医生",
        version=3,
        doctor_verified=True,
        doctor_verified_at=base_date + timedelta(days=1),
        doctor_opinion="符合随访标准，建议确认",
        created_at=base_date - timedelta(days=2),
        updated_at=base_date + timedelta(days=1),
    )
    records.append(r3)

    # === 测试场景4: 已确认 ===
    r4 = FollowUpRecord(
        record_no="FURTEST004",
        patient_id=patients[3].id,
        appointment_id=appointments[3].id,
        visit_id=visits[3].id,
        follow_up_visit_id=follow_ups[3].id,
        status=STATUS_CONFIRMED,
        follow_up_type="慢病随访",
        content="慢性支气管炎随访",
        result="病情稳定，继续当前治疗方案",
        remarks="【测试4】已确认记录，测试覆盖拦截",
        created_by="李护士",
        updated_by="陈主任",
        version=4,
        doctor_verified=True,
        doctor_verified_at=base_date + timedelta(days=1),
        doctor_opinion="符合标准",
        director_verified=True,
        director_verified_at=base_date + timedelta(days=2),
        director_opinion="确认通过",
        created_at=base_date - timedelta(days=3),
        updated_at=base_date + timedelta(days=2),
    )
    records.append(r4)

    # === 测试场景5: 重复补录（与r1同患者同类型，待医生状态） ===
    r5 = FollowUpRecord(
        record_no="FURTEST005",
        patient_id=patients[0].id,
        appointment_id=appointments[7].id,
        visit_id=visits[7].id,
        follow_up_visit_id=follow_ups[6].id,
        status=STATUS_PENDING_DOCTOR,
        follow_up_type="高血压随访",
        content="重复随访记录测试 - 与FURTEST001同患者同类型",
        result="血压正常",
        remarks="【测试5】重复补录测试 - 同患者同类型",
        created_by="王护士",
        updated_by="王护士",
        version=2,
        created_at=base_date - timedelta(days=4),
        updated_at=base_date - timedelta(days=3),
    )
    records.append(r5)

    # === 测试场景6: 草稿 - 完全缺证据 ===
    r6 = FollowUpRecord(
        record_no="FURTEST006",
        patient_id=patients[4].id,
        appointment_id=None,
        visit_id=None,
        follow_up_visit_id=None,
        status=STATUS_DRAFT,
        follow_up_type="健康咨询",
        content="完全缺证据的记录",
        result="",
        remarks="【测试6】缺证据 - 无预约、无就诊、无随访",
        created_by="李护士",
        updated_by="李护士",
        version=1,
        created_at=base_date - timedelta(days=5),
        updated_at=base_date - timedelta(days=5),
    )
    records.append(r6)

    # === 测试场景7: 草稿 - 部分缺证据（只有预约） ===
    r7 = FollowUpRecord(
        record_no="FURTEST007",
        patient_id=patients[4].id,
        appointment_id=appointments[4].id,
        visit_id=None,
        follow_up_visit_id=None,
        status=STATUS_DRAFT,
        follow_up_type="常规体检",
        content="只有预约，缺少就诊和随访",
        result="",
        remarks="【测试7】部分缺证据 - 只有预约登记",
        created_by="王护士",
        updated_by="王护士",
        version=1,
        created_at=base_date - timedelta(days=6),
        updated_at=base_date - timedelta(days=6),
    )
    records.append(r7)

    # === 测试场景8: 待医生处理 - 但缺证据（异常状态，测试办理时拦截） ===
    r8 = FollowUpRecord(
        record_no="FURTEST008",
        patient_id=patients[5].id,
        appointment_id=None,
        visit_id=None,
        follow_up_visit_id=None,
        status=STATUS_PENDING_DOCTOR,
        follow_up_type="疫苗接种",
        content="异常状态 - 缺证据却到了医生待处理",
        result="接种完成",
        remarks="【测试8】异常状态 - 缺证据但在待医生环节",
        created_by="李护士",
        updated_by="李护士",
        version=2,
        created_at=base_date - timedelta(days=7),
        updated_at=base_date - timedelta(days=6),
    )
    records.append(r8)

    # === 测试场景9: 草稿 - 可补证据（只有预约+就诊） ===
    r9 = FollowUpRecord(
        record_no="FURTEST009",
        patient_id=patients[6].id,
        appointment_id=appointments[5].id,
        visit_id=visits[5].id,
        follow_up_visit_id=None,
        status=STATUS_DRAFT,
        follow_up_type="高血压随访",
        content="有预约有就诊，缺少随访回访",
        result="",
        remarks="【测试9】可补证据 - 缺随访回访",
        created_by="李护士",
        updated_by="李护士",
        version=1,
        created_at=base_date - timedelta(days=8),
        updated_at=base_date - timedelta(days=8),
    )
    records.append(r9)

    # === 测试场景10: 已驳回 ===
    r10 = FollowUpRecord(
        record_no="FURTEST010",
        patient_id=patients[7].id,
        appointment_id=appointments[6].id,
        visit_id=visits[6].id,
        follow_up_visit_id=follow_ups[5].id,
        status=STATUS_REJECTED,
        follow_up_type="糖尿病随访",
        content="被驳回的随访记录",
        result="",
        remarks="【测试10】已驳回记录",
        created_by="王护士",
        updated_by="张医生",
        version=2,
        doctor_opinion="随访内容不完整，需要补充",
        created_at=base_date - timedelta(days=9),
        updated_at=base_date - timedelta(days=8),
    )
    records.append(r10)

    # === 测试场景11: 草稿 - 只有随访回访 ===
    r11 = FollowUpRecord(
        record_no="FURTEST011",
        patient_id=patients[6].id,
        appointment_id=None,
        visit_id=None,
        follow_up_visit_id=follow_ups[4].id,
        status=STATUS_DRAFT,
        follow_up_type="高血压随访",
        content="只有随访回访，缺少预约和就诊",
        result="",
        remarks="【测试11】部分缺证据 - 只有随访回访",
        created_by="李护士",
        updated_by="李护士",
        version=1,
        created_at=base_date - timedelta(days=10),
        updated_at=base_date - timedelta(days=10),
    )
    records.append(r11)

    # === 测试场景12: 待主任确认 - 第二条，测试批量 ===
    r12 = FollowUpRecord(
        record_no="FURTEST012",
        patient_id=patients[6].id,
        appointment_id=appointments[5].id,
        visit_id=visits[5].id,
        follow_up_visit_id=follow_ups[4].id,
        status=STATUS_PENDING_DIRECTOR,
        follow_up_type="高血压随访",
        content="高血压随访记录",
        result="血压控制良好",
        remarks="【测试12】待主任确认，测试批量",
        created_by="李护士",
        updated_by="刘医生",
        version=3,
        doctor_verified=True,
        doctor_verified_at=base_date + timedelta(days=2),
        doctor_opinion="符合标准，建议确认",
        created_at=base_date - timedelta(days=10),
        updated_at=base_date + timedelta(days=2),
    )
    records.append(r12)

    for r in records:
        db.add(r)

    db.flush()
    print("✓ 随访记录数据已加载")

    # === 生成审计日志样例 ===
    seed_audit_logs(db, records, base_date)

    return records


def seed_audit_logs(db: Session, records, base_date):
    # 记录1：创建日志
    create_audit_log(db, records[0].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")

    # 记录2：创建 + 提交
    create_audit_log(db, records[1].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[1].id, "submit", "李护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")

    # 记录3：创建 + 提交 + 医生办理
    create_audit_log(db, records[2].id, "create", "王护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[2].id, "submit", "王护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")
    create_audit_log(db, records[2].id, "process", "张医生", ROLE_GP_DOCTOR,
                     STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR, "符合随访标准，建议确认")

    # 记录4：完整流程
    create_audit_log(db, records[3].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[3].id, "submit", "李护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")
    create_audit_log(db, records[3].id, "process", "张医生", ROLE_GP_DOCTOR,
                     STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR, "符合标准")
    create_audit_log(db, records[3].id, "process", "陈主任", ROLE_MEDICAL_DIRECTOR,
                     STATUS_PENDING_DIRECTOR, STATUS_CONFIRMED, "确认通过")

    # 记录5：创建 + 提交
    create_audit_log(db, records[4].id, "create", "王护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[4].id, "submit", "王护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")

    # 记录6：创建
    create_audit_log(db, records[5].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录（无证据）")

    # 记录7：创建
    create_audit_log(db, records[6].id, "create", "王护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录（部分证据）")

    # 记录8：创建 + 提交（异常）
    create_audit_log(db, records[7].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[7].id, "submit", "李护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核（证据不全）")

    # 记录9：创建 + 更新（补充证据）
    create_audit_log(db, records[8].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录（无证据）")
    create_audit_log(db, records[8].id, "update", "李护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_DRAFT, "补充预约和就诊证据")

    # 记录10：创建 + 提交 + 驳回
    create_audit_log(db, records[9].id, "create", "王护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[9].id, "submit", "王护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")
    create_audit_log(db, records[9].id, "reject", "张医生", ROLE_GP_DOCTOR,
                     STATUS_PENDING_DOCTOR, STATUS_REJECTED, "随访内容不完整，需要补充")

    # 记录11：创建
    create_audit_log(db, records[10].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录（只有随访）")

    # 记录12：完整流程到主任待办
    create_audit_log(db, records[11].id, "create", "李护士", ROLE_TRIAGE_NURSE,
                     "", STATUS_DRAFT, "创建随访记录")
    create_audit_log(db, records[11].id, "submit", "李护士", ROLE_TRIAGE_NURSE,
                     STATUS_DRAFT, STATUS_PENDING_DOCTOR, "提交审核")
    create_audit_log(db, records[11].id, "process", "刘医生", ROLE_GP_DOCTOR,
                     STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR, "符合标准，建议确认")

    print("✓ 审计日志样例已生成")


if __name__ == "__main__":
    init_db()
