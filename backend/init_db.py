import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import Base, engine, SessionLocal
from app.database import (
    User, Patient, Appointment, Visit, FollowUpVisit,
    FollowUpRecord,
)
from app.config import (
    ROLE_TRIAGE_NURSE, ROLE_GP_DOCTOR, ROLE_MEDICAL_DIRECTOR,
    STATUS_DRAFT, STATUS_PENDING_DOCTOR, STATUS_PENDING_DIRECTOR,
    STATUS_CONFIRMED,
)


def init_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seed_users(db)
        seed_patients(db)
        seed_appointments(db)
        seed_visits(db)
        seed_follow_up_visits(db)
        seed_follow_up_records(db)
        db.commit()
        print("数据库初始化完成！")
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


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
    print("用户数据已加载")


def seed_patients(db: Session):
    patients = [
        Patient(name="赵建国", id_card="110101195501011234", phone="13800138001"),
        Patient(name="钱美丽", id_card="110101196002022345", phone="13800138002"),
        Patient(name="孙志强", id_card="110101197003033456", phone="13800138003"),
        Patient(name="李小华", id_card="110101198004044567", phone="13800138004"),
        Patient(name="周大伟", id_card="110101199005055678", phone="13800138005"),
        Patient(name="吴小芳", id_card="110101200006066789", phone="13800138006"),
    ]
    db.add_all(patients)
    db.flush()
    print("患者数据已加载")


def seed_appointments(db: Session):
    patients = db.query(Patient).all()
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
    ]
    db.add_all(appointments)
    db.flush()
    print("预约登记数据已加载")


def seed_visits(db: Session):
    patients = db.query(Patient).all()
    appointments = db.query(Appointment).all()
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
    ]
    db.add_all(visits)
    db.flush()
    print("就诊分诊数据已加载")


def seed_follow_up_visits(db: Session):
    patients = db.query(Patient).all()
    visits = db.query(Visit).all()
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
    ]
    db.add_all(follow_ups)
    db.flush()
    print("随访回访数据已加载")


def seed_follow_up_records(db: Session):
    patients = db.query(Patient).all()
    appointments = db.query(Appointment).all()
    visits = db.query(Visit).all()
    follow_ups = db.query(FollowUpVisit).all()

    base_date = datetime.now() - timedelta(days=15)

    records = [
        {
            "record_no": "FUR20250101001",
            "patient_id": patients[0].id,
            "appointment_id": appointments[0].id,
            "visit_id": visits[0].id,
            "follow_up_visit_id": follow_ups[0].id,
            "status": STATUS_DRAFT,
            "follow_up_type": "高血压随访",
            "content": "血压监测记录，需要医生确认",
            "result": "",
            "remarks": "草稿状态，证据齐全",
            "created_by": "李护士",
            "version": 1,
        },
        {
            "record_no": "FUR20250101002",
            "patient_id": patients[1].id,
            "appointment_id": appointments[1].id,
            "visit_id": visits[1].id,
            "follow_up_visit_id": follow_ups[1].id,
            "status": STATUS_PENDING_DOCTOR,
            "follow_up_type": "糖尿病随访",
            "content": "糖尿病随访记录，待医生处理",
            "result": "血糖控制一般，建议调整用药",
            "remarks": "待医生处理，证据齐全",
            "created_by": "李护士",
            "version": 2,
        },
        {
            "record_no": "FUR20250101003",
            "patient_id": patients[2].id,
            "appointment_id": appointments[2].id,
            "visit_id": visits[2].id,
            "follow_up_visit_id": follow_ups[2].id,
            "status": STATUS_PENDING_DIRECTOR,
            "follow_up_type": "冠心病随访",
            "content": "冠心病术后随访",
            "result": "恢复良好，继续观察",
            "remarks": "医生已确认，待主任审核",
            "created_by": "王护士",
            "version": 3,
            "doctor_verified": True,
            "doctor_verified_at": base_date + timedelta(days=3),
            "doctor_opinion": "符合随访标准，建议确认",
        },
        {
            "record_no": "FUR20250101004",
            "patient_id": patients[3].id,
            "appointment_id": appointments[3].id,
            "visit_id": visits[3].id,
            "follow_up_visit_id": follow_ups[3].id,
            "status": STATUS_CONFIRMED,
            "follow_up_type": "慢病随访",
            "content": "慢性支气管炎随访",
            "result": "病情稳定，继续当前治疗方案",
            "remarks": "已确认的记录，用于测试覆盖拦截",
            "created_by": "李护士",
            "version": 4,
            "doctor_verified": True,
            "doctor_verified_at": base_date + timedelta(days=5),
            "doctor_opinion": "符合标准",
            "director_verified": True,
            "director_verified_at": base_date + timedelta(days=6),
            "director_opinion": "确认通过",
        },
        {
            "record_no": "FUR20250101005",
            "patient_id": patients[0].id,
            "appointment_id": appointments[0].id,
            "visit_id": visits[0].id,
            "follow_up_visit_id": follow_ups[0].id,
            "status": STATUS_PENDING_DOCTOR,
            "follow_up_type": "高血压随访",
            "content": "重复随访记录测试 - 与第一条同类型",
            "result": "血压正常",
            "remarks": "用于测试重复补录拦截（同患者同类型）",
            "created_by": "王护士",
            "version": 2,
        },
        {
            "record_no": "FUR20250101006",
            "patient_id": patients[4].id,
            "appointment_id": None,
            "visit_id": None,
            "follow_up_visit_id": None,
            "status": STATUS_DRAFT,
            "follow_up_type": "健康咨询",
            "content": "缺少证据的记录",
            "result": "",
            "remarks": "缺证据测试：无预约、无就诊、无随访回访",
            "created_by": "李护士",
            "version": 1,
        },
        {
            "record_no": "FUR20250101007",
            "patient_id": patients[4].id,
            "appointment_id": appointments[4].id,
            "visit_id": None,
            "follow_up_visit_id": None,
            "status": STATUS_DRAFT,
            "follow_up_type": "常规体检",
            "content": "只有预约，缺少就诊和随访",
            "result": "",
            "remarks": "部分证据缺失，用于测试提交时拦截",
            "created_by": "王护士",
            "version": 1,
        },
        {
            "record_no": "FUR20250101008",
            "patient_id": patients[5].id,
            "appointment_id": None,
            "visit_id": None,
            "follow_up_visit_id": None,
            "status": STATUS_PENDING_DOCTOR,
            "follow_up_type": "疫苗接种",
            "content": "异常状态记录 - 缺证据却到了医生待处理",
            "result": "接种完成",
            "remarks": "用于测试旧版本/错状态拦截",
            "created_by": "李护士",
            "version": 2,
        },
    ]

    for r in records:
        record = FollowUpRecord(**r)
        db.add(record)

    db.flush()
    print("随访记录数据已加载")
    print(f"  - 草稿状态: {len([r for r in records if r['status'] == STATUS_DRAFT])} 条")
    print(f"  - 待医生处理: {len([r for r in records if r['status'] == STATUS_PENDING_DOCTOR])} 条")
    print(f"  - 待主任确认: {len([r for r in records if r['status'] == STATUS_PENDING_DIRECTOR])} 条")
    print(f"  - 已确认: {len([r for r in records if r['status'] == STATUS_CONFIRMED])} 条")


if __name__ == "__main__":
    init_db()
