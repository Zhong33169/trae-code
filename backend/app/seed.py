import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, SessionLocal, Base
from app.models import (
    User, RoleEnum, ExhibitorApplication, ApplicationStatusEnum,
    ApplicationMaterial, MaterialTypeEnum, AuditActionEnum
)
from app.services.application_service import add_audit_log, generate_application_no
from app.utils.auth import hash_password


def seed_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()

    try:
        print("创建用户账号...")
        users = [
            {"username": "registrar1", "password": "123456", "full_name": "张登记", "role": RoleEnum.REGISTRAR},
            {"username": "registrar2", "password": "123456", "full_name": "李登记", "role": RoleEnum.REGISTRAR},
            {"username": "auditor1", "password": "123456", "full_name": "王审核", "role": RoleEnum.AUDIT_SUPERVISOR},
            {"username": "auditor2", "password": "123456", "full_name": "赵审核", "role": RoleEnum.AUDIT_SUPERVISOR},
            {"username": "reviewer1", "password": "123456", "full_name": "陈复核", "role": RoleEnum.REVIEW_LEADER},
        ]

        created_users = {}
        for u in users:
            user = User(
                username=u["username"],
                full_name=u["full_name"],
                role=u["role"],
                hashed_password=hash_password(u["password"]),
            )
            db.add(user)
            db.flush()
            created_users[u["username"]] = user
        db.commit()
        print(f"  创建了 {len(users)} 个用户")

        print("创建展商申请演示数据...")
        now = datetime.utcnow()

        demo_applications = [
            {
                "company": "北京科技创新有限公司",
                "contact": "张明",
                "phone": "13800138001",
                "email": "zhangming@tech.com",
                "status": ApplicationStatusEnum.DRAFT,
                "booth_type": "标准展位",
                "booth_size": "3m×3m",
                "area": 9.0,
                "industry": "电子科技",
                "desc": "主营智能穿戴设备",
                "registrar": "registrar1",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf"},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品目录.pdf"},
                ],
                "hours_ago": 2,
            },
            {
                "company": "上海智造科技股份有限公司",
                "contact": "李华",
                "phone": "13900139002",
                "email": "lihua@smart.com",
                "status": ApplicationStatusEnum.SUBMITTED,
                "booth_type": "光地展位",
                "booth_size": "6m×6m",
                "area": 36.0,
                "industry": "智能制造",
                "desc": "工业机器人和自动化解决方案",
                "registrar": "registrar1",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf"},
                    {"type": MaterialTypeEnum.TAX_CERTIFICATE, "name": "税务登记证.pdf"},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品手册.pdf"},
                ],
                "hours_ago": 5,
            },
            {
                "company": "广州新材料科技有限公司",
                "contact": "王芳",
                "phone": "13700137003",
                "email": "wangfang@material.com",
                "status": ApplicationStatusEnum.UNDER_REVIEW,
                "booth_type": "标准展位",
                "booth_size": "3m×6m",
                "area": 18.0,
                "industry": "新材料",
                "desc": "新型环保包装材料",
                "registrar": "registrar2",
                "auditor": "auditor1",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品介绍.pdf"},
                ],
                "hours_ago": 10,
            },
            {
                "company": "深圳智联电子有限公司",
                "contact": "刘强",
                "phone": "13600136004",
                "email": "liuqiang@zlink.com",
                "status": ApplicationStatusEnum.CORRECTION_REQUESTED,
                "booth_type": "光地展位",
                "booth_size": "9m×6m",
                "area": 54.0,
                "industry": "电子元器件",
                "desc": "集成电路和传感器",
                "registrar": "registrar1",
                "auditor": "auditor2",
                "correction": "请补充产品检测报告和展位设计图",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品目录.pdf", "approved": False, "comment": "信息不完整"},
                ],
                "hours_ago": 30,
            },
            {
                "company": "杭州数字科技有限公司",
                "contact": "陈静",
                "phone": "13500135005",
                "email": "chenjing@digital.com",
                "status": ApplicationStatusEnum.CORRECTED,
                "booth_type": "标准展位",
                "booth_size": "3m×3m",
                "area": 9.0,
                "industry": "数字服务",
                "desc": "数字化转型咨询服务",
                "registrar": "registrar2",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "服务介绍.pdf"},
                ],
                "hours_ago": 3,
            },
            {
                "company": "成都智能制造装备有限公司",
                "contact": "周磊",
                "phone": "13400134006",
                "email": "zhoulei@cz.com",
                "status": ApplicationStatusEnum.AUDIT_PASSED,
                "booth_type": "光地展位",
                "booth_size": "12m×9m",
                "area": 108.0,
                "industry": "智能制造",
                "desc": "数控机床和智能装备",
                "registrar": "registrar1",
                "auditor": "auditor1",
                "audit_opinion": "材料齐全，资质符合要求，建议通过",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.TAX_CERTIFICATE, "name": "税务登记证.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品目录.pdf", "approved": True},
                    {"type": MaterialTypeEnum.BOOTH_DESIGN, "name": "展位设计图.pdf", "approved": True},
                ],
                "hours_ago": 8,
            },
            {
                "company": "武汉光电科技有限公司",
                "contact": "吴敏",
                "phone": "13300133007",
                "email": "wumin@opto.com",
                "status": ApplicationStatusEnum.REJECTED,
                "booth_type": "标准展位",
                "booth_size": "3m×3m",
                "area": 9.0,
                "industry": "光电技术",
                "desc": "LED照明产品",
                "registrar": "registrar2",
                "auditor": "auditor2",
                "audit_opinion": "产品与展会主题不符，且资质材料不全",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf"},
                ],
                "hours_ago": 48,
            },
            {
                "company": "南京软件科技有限公司",
                "contact": "郑飞",
                "phone": "13200132008",
                "email": "zhengfei@soft.com",
                "status": ApplicationStatusEnum.REVIEW_PASSED,
                "booth_type": "光地展位",
                "booth_size": "6m×9m",
                "area": 54.0,
                "industry": "软件服务",
                "desc": "企业管理软件和SaaS服务",
                "registrar": "registrar1",
                "auditor": "auditor1",
                "reviewer": "reviewer1",
                "audit_opinion": "材料齐全，符合要求",
                "review_opinion": "同意参展",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品介绍.pdf", "approved": True},
                ],
                "hours_ago": 12,
            },
            {
                "company": "西安仪器仪表有限公司",
                "contact": "孙涛",
                "phone": "13100131009",
                "email": "suntao@instrument.com",
                "status": ApplicationStatusEnum.ARCHIVED,
                "booth_type": "标准展位",
                "booth_size": "3m×6m",
                "area": 18.0,
                "industry": "仪器仪表",
                "desc": "精密测量仪器",
                "registrar": "registrar2",
                "auditor": "auditor2",
                "reviewer": "reviewer1",
                "audit_opinion": "资质齐全，符合参展要求",
                "review_opinion": "同意归档",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.TAX_CERTIFICATE, "name": "税务登记证.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品目录.pdf", "approved": True},
                ],
                "hours_ago": 72,
            },
            {
                "company": "重庆自动化设备有限公司",
                "contact": "黄强",
                "phone": "13000130010",
                "email": "huangqiang@auto.com",
                "status": ApplicationStatusEnum.SUBMITTED,
                "booth_type": "光地展位",
                "booth_size": "12m×12m",
                "area": 144.0,
                "industry": "自动化",
                "desc": "工业自动化生产线",
                "registrar": "registrar1",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf"},
                    {"type": MaterialTypeEnum.TAX_CERTIFICATE, "name": "税务登记证.pdf"},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品手册.pdf"},
                ],
                "hours_ago": 36,
            },
            {
                "company": "天津环保科技有限公司",
                "contact": "赵丽",
                "phone": "13900139011",
                "email": "zhaoli@green.com",
                "status": ApplicationStatusEnum.CORRECTION_REQUESTED,
                "booth_type": "标准展位",
                "booth_size": "3m×3m",
                "area": 9.0,
                "industry": "环保技术",
                "desc": "污水处理设备",
                "registrar": "registrar2",
                "auditor": "auditor1",
                "correction": "请补充环境影响评价报告",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品介绍.pdf", "approved": True},
                ],
                "hours_ago": 80,
            },
            {
                "company": "青岛海洋科技有限公司",
                "contact": "马军",
                "phone": "13800138012",
                "email": "majun@ocean.com",
                "status": ApplicationStatusEnum.AUDIT_PASSED,
                "booth_type": "光地展位",
                "booth_size": "6m×6m",
                "area": 36.0,
                "industry": "海洋科技",
                "desc": "海洋监测设备",
                "registrar": "registrar1",
                "auditor": "auditor2",
                "audit_opinion": "符合展会海洋科技主题",
                "materials": [
                    {"type": MaterialTypeEnum.BUSINESS_LICENSE, "name": "营业执照.pdf", "approved": True},
                    {"type": MaterialTypeEnum.PRODUCT_CATALOG, "name": "产品目录.pdf", "approved": True},
                ],
                "hours_ago": 60,
            },
        ]

        for i, demo in enumerate(demo_applications):
            app = ExhibitorApplication(
                application_no=generate_application_no(db),
                company_name=demo["company"],
                contact_person=demo["contact"],
                contact_phone=demo["phone"],
                contact_email=demo["email"],
                booth_type=demo["booth_type"],
                booth_size=demo["booth_size"],
                expected_area=demo["area"],
                industry=demo["industry"],
                product_description=demo["desc"],
                status=demo["status"],
                registrar_id=created_users[demo["registrar"]].id,
            )

            hours_ago = demo["hours_ago"]
            created_time = now - timedelta(hours=hours_ago)
            app.created_at = created_time
            app.updated_at = created_time
            app.status_changed_at = created_time
            app.calculate_deadline()

            if "auditor" in demo:
                app.audit_supervisor_id = created_users[demo["auditor"]].id
            if "reviewer" in demo:
                app.review_leader_id = created_users[demo["reviewer"]].id
            if "audit_opinion" in demo:
                app.audit_opinion = demo["audit_opinion"]
            if "review_opinion" in demo:
                app.review_opinion = demo["review_opinion"]
            if "correction" in demo:
                app.correction_request = demo["correction"]

            db.add(app)
            db.flush()

            for mat in demo.get("materials", []):
                material = ApplicationMaterial(
                    application_id=app.id,
                    material_type=mat["type"],
                    material_name=mat["name"],
                    file_path=f"/uploads/{app.id}/{mat['name']}",
                    is_approved=mat.get("approved"),
                    review_comment=mat.get("comment"),
                )
                material.uploaded_at = created_time
                db.add(material)

            db.flush()

            user = created_users[demo["registrar"]]
            add_audit_log(db, app.id, user.id, AuditActionEnum.CREATE, "创建申请",
                          None, ApplicationStatusEnum.DRAFT, "登记员创建申请")

            if demo["status"] != ApplicationStatusEnum.DRAFT:
                add_audit_log(db, app.id, user.id, AuditActionEnum.SUBMIT, "提交申请",
                              ApplicationStatusEnum.DRAFT, ApplicationStatusEnum.SUBMITTED,
                              "登记员提交申请")

            if demo["status"] in [
                ApplicationStatusEnum.UNDER_REVIEW,
                ApplicationStatusEnum.CORRECTION_REQUESTED,
                ApplicationStatusEnum.CORRECTED,
                ApplicationStatusEnum.AUDIT_PASSED,
                ApplicationStatusEnum.REJECTED,
                ApplicationStatusEnum.REVIEW_PASSED,
                ApplicationStatusEnum.ARCHIVED,
            ]:
                auditor = created_users.get(demo.get("auditor", "auditor1"))
                add_audit_log(db, app.id, auditor.id, AuditActionEnum.START_AUDIT, "开始审核",
                              ApplicationStatusEnum.SUBMITTED, ApplicationStatusEnum.UNDER_REVIEW,
                              "审核主管开始审核")

            if demo["status"] == ApplicationStatusEnum.CORRECTION_REQUESTED:
                auditor = created_users.get(demo.get("auditor", "auditor1"))
                add_audit_log(db, app.id, auditor.id, AuditActionEnum.REQUEST_CORRECTION, "要求补正",
                              ApplicationStatusEnum.UNDER_REVIEW, ApplicationStatusEnum.CORRECTION_REQUESTED,
                              demo.get("correction", "需要补正材料"))

            if demo["status"] == ApplicationStatusEnum.CORRECTED:
                add_audit_log(db, app.id, user.id, AuditActionEnum.CORRECT, "补正提交",
                              ApplicationStatusEnum.CORRECTION_REQUESTED, ApplicationStatusEnum.CORRECTED,
                              "登记员补正后重新提交")

            if demo["status"] in [
                ApplicationStatusEnum.AUDIT_PASSED,
                ApplicationStatusEnum.REJECTED,
                ApplicationStatusEnum.REVIEW_PASSED,
                ApplicationStatusEnum.ARCHIVED,
            ]:
                auditor = created_users.get(demo.get("auditor", "auditor1"))
                if demo["status"] == ApplicationStatusEnum.REJECTED:
                    add_audit_log(db, app.id, auditor.id, AuditActionEnum.REJECT, "审核拒绝",
                                  ApplicationStatusEnum.UNDER_REVIEW, ApplicationStatusEnum.REJECTED,
                                  demo.get("audit_opinion", "审核未通过"))
                else:
                    add_audit_log(db, app.id, auditor.id, AuditActionEnum.AUDIT_PASS, "审核通过",
                                  ApplicationStatusEnum.UNDER_REVIEW, ApplicationStatusEnum.AUDIT_PASSED,
                                  demo.get("audit_opinion", "审核通过"))

            if demo["status"] in [
                ApplicationStatusEnum.REVIEW_PASSED,
                ApplicationStatusEnum.ARCHIVED,
            ]:
                reviewer = created_users.get(demo.get("reviewer", "reviewer1"))
                add_audit_log(db, app.id, reviewer.id, AuditActionEnum.REVIEW_PASS, "复核通过",
                              ApplicationStatusEnum.AUDIT_PASSED, ApplicationStatusEnum.REVIEW_PASSED,
                              demo.get("review_opinion", "复核通过"))

            if demo["status"] == ApplicationStatusEnum.ARCHIVED:
                reviewer = created_users.get(demo.get("reviewer", "reviewer1"))
                add_audit_log(db, app.id, reviewer.id, AuditActionEnum.ARCHIVE, "归档",
                              ApplicationStatusEnum.REVIEW_PASSED, ApplicationStatusEnum.ARCHIVED,
                              "已归档")

            app.check_overdue()

        db.commit()
        print(f"  创建了 {len(demo_applications)} 条展商申请")

        overdue_count = db.query(ExhibitorApplication).filter(
            ExhibitorApplication.is_overdue == True
        ).count()
        print(f"  其中逾期申请：{overdue_count} 条")

        print("\n演示账号：")
        print("  展商登记员: registrar1 / 123456")
        print("  展商登记员: registrar2 / 123456")
        print("  展商审核主管: auditor1 / 123456")
        print("  展商审核主管: auditor2 / 123456")
        print("  展会主办方复核负责人: reviewer1 / 123456")
        print("\n种子数据初始化完成！")

    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
