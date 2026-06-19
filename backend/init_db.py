import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import User, RoleEnum, ReleaseApplication, ReleaseStatusEnum
from crud import create_user, create_release_application
from auth import get_user
from schemas import ReleaseApplicationCreate
from datetime import datetime, timedelta


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        users = [
            {"username": "registrar1", "full_name": "张登记", "password": "123456", "role": RoleEnum.REGISTRAR},
            {"username": "registrar2", "full_name": "李登记", "password": "123456", "role": RoleEnum.REGISTRAR},
            {"username": "supervisor1", "full_name": "王主管", "password": "123456", "role": RoleEnum.SUPERVISOR},
            {"username": "supervisor2", "full_name": "赵主管", "password": "123456", "role": RoleEnum.SUPERVISOR},
            {"username": "reviewer1", "full_name": "陈复核", "password": "123456", "role": RoleEnum.REVIEWER},
            {"username": "reviewer2", "full_name": "刘复核", "password": "123456", "role": RoleEnum.REVIEWER},
        ]

        created_users = {}
        for u in users:
            existing = get_user(db, u["username"])
            if not existing:
                user = create_user(db, u["username"], u["full_name"], u["password"], u["role"])
                created_users[u["username"]] = user
                print(f"创建用户: {u['username']} ({u['full_name']}) - {u['role'].value}")
            else:
                created_users[u["username"]] = existing
                print(f"用户已存在: {u['username']}")

        sample_apps = [
            {
                "title": "用户管理模块V2.0发布",
                "project_name": "智慧政务平台",
                "version": "v2.0.0",
                "description": "用户管理模块全面升级，支持批量导入导出",
                "release_content": "1. 用户列表分页优化\n2. 新增批量导入功能\n3. 权限管理重构",
                "impact_scope": "用户中心、权限管理模块",
                "status": ReleaseStatusEnum.DRAFT
            },
            {
                "title": "支付网关安全升级",
                "project_name": "电商平台",
                "version": "v1.5.2",
                "description": "支付网关安全加固，符合等保三级要求",
                "release_content": "1. SSL证书更新\n2. 加密算法升级\n3. 新增风控规则",
                "impact_scope": "支付模块全部接口",
                "status": ReleaseStatusEnum.PENDING_REVIEW
            },
            {
                "title": "首页性能优化发布",
                "project_name": "企业官网",
                "version": "v3.1.0",
                "description": "首页加载速度优化，LCP从3.2s降至1.5s",
                "release_content": "1. 图片懒加载\n2. 代码分割\n3. CDN缓存策略优化",
                "impact_scope": "首页及相关静态资源",
                "status": ReleaseStatusEnum.PUBLISHED
            },
            {
                "title": "报表模块bug修复",
                "project_name": "数据分析平台",
                "version": "v1.2.3",
                "description": "修复报表导出乱码、数据统计错误等问题",
                "release_content": "1. 修复Excel导出乱码\n2. 修复统计公式错误\n3. 优化大数据量查询",
                "impact_scope": "报表模块",
                "status": ReleaseStatusEnum.REVIEW_APPROVED
            },
            {
                "title": "消息推送服务重构",
                "project_name": "移动APP后端",
                "version": "v2.1.0",
                "description": "消息推送服务性能重构，支持百万级并发",
                "release_content": "1. 推送队列优化\n2. 新增失败重试机制\n3. 推送统计报表",
                "impact_scope": "消息推送服务",
                "status": ReleaseStatusEnum.PENDING_RECHECK
            },
            {
                "title": "登录模块安全加固",
                "project_name": "智慧政务平台",
                "version": "v1.8.0",
                "description": "登录模块增加图形验证码、滑块验证等安全措施",
                "release_content": "1. 图形验证码接入\n2. 滑块验证接入\n3. 登录失败锁定策略",
                "impact_scope": "登录模块",
                "status": ReleaseStatusEnum.REVIEWED_POST_LAUNCH
            },
        ]

        app_count = db.query(ReleaseApplication).count()
        if app_count == 0:
            registrar_id = created_users["registrar1"].id
            for i, app_data in enumerate(sample_apps):
                app_create = ReleaseApplicationCreate(
                    title=app_data["title"],
                    project_name=app_data["project_name"],
                    version=app_data["version"],
                    description=app_data["description"],
                    release_content=app_data["release_content"],
                    impact_scope=app_data["impact_scope"],
                    planned_release_time=datetime.utcnow() + timedelta(days=i + 1)
                )
                app = create_release_application(db, app_create, registrar_id)
                if app_data["status"] != ReleaseStatusEnum.DRAFT:
                    from crud import submit_for_review, review_approve, submit_for_recheck, recheck_approve, publish_release
                    if app_data["status"] == ReleaseStatusEnum.PENDING_REVIEW:
                        submit_for_review(db, app.id, registrar_id)
                    elif app_data["status"] == ReleaseStatusEnum.REVIEW_APPROVED:
                        submit_for_review(db, app.id, registrar_id)
                        review_approve(db, app.id, created_users["supervisor1"].id, "审核通过，方案可行")
                    elif app_data["status"] == ReleaseStatusEnum.PENDING_RECHECK:
                        submit_for_review(db, app.id, registrar_id)
                        review_approve(db, app.id, created_users["supervisor1"].id, "初审通过")
                        submit_for_recheck(db, app.id, created_users["supervisor1"].id)
                    elif app_data["status"] == ReleaseStatusEnum.PUBLISHED:
                        submit_for_review(db, app.id, registrar_id)
                        review_approve(db, app.id, created_users["supervisor1"].id, "初审通过")
                        submit_for_recheck(db, app.id, created_users["supervisor1"].id)
                        recheck_approve(db, app.id, created_users["reviewer1"].id, "复核通过")
                        publish_release(db, app.id, created_users["reviewer1"].id)
                    elif app_data["status"] == ReleaseStatusEnum.REVIEWED_POST_LAUNCH:
                        submit_for_review(db, app.id, registrar_id)
                        review_approve(db, app.id, created_users["supervisor1"].id, "初审通过")
                        submit_for_recheck(db, app.id, created_users["supervisor1"].id)
                        recheck_approve(db, app.id, created_users["reviewer1"].id, "复核通过")
                        publish_release(db, app.id, created_users["reviewer1"].id)
                        from crud import create_post_launch_review, complete_post_launch_review
                        from schemas import PostLaunchReviewCreate
                        review_create = PostLaunchReviewCreate(
                            release_application_id=app.id,
                            review_content="发布过程顺利，用户反馈良好",
                            issues_found="无重大问题",
                            improvement_measures="继续监控性能指标",
                            release_result="success"
                        )
                        review = create_post_launch_review(db, review_create, created_users["reviewer1"].id)
                        complete_post_launch_review(db, review.id, created_users["reviewer1"].id)

                print(f"创建样例申请: {app_data['title']} - {app_data['status'].value}")

        print("\n数据库初始化完成!")
        print("\n样例账号:")
        print("  发布登记员: registrar1 / 123456 (张登记)")
        print("  发布登记员: registrar2 / 123456 (李登记)")
        print("  发布审核主管: supervisor1 / 123456 (王主管)")
        print("  发布审核主管: supervisor2 / 123456 (赵主管)")
        print("  复核负责人: reviewer1 / 123456 (陈复核)")
        print("  复核负责人: reviewer2 / 123456 (刘复核)")

    finally:
        db.close()


if __name__ == "__main__":
    init_db()
