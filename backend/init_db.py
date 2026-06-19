import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal, engine, Base
from models import User, RoleEnum, ReleaseApplication, ReleaseStatusEnum, ShiftEnum
from crud import (
    create_user, create_release_application, submit_for_review,
    review_approve, submit_for_recheck, recheck_approve, publish_release,
    rollback_release, create_rollback_plan, approve_rollback_plan,
    create_shift_handover, confirm_shift_handover,
    create_post_launch_review, complete_post_launch_review
)
from auth import get_user
from schemas import (
    ReleaseApplicationCreate, RollbackPlanCreate,
    ShiftHandoverCreate, PostLaunchReviewCreate
)
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
                "target_status": ReleaseStatusEnum.DRAFT,
                "rollback": None,
                "handover": None,
                "post_review": None,
            },
            {
                "title": "支付网关安全升级",
                "project_name": "电商平台",
                "version": "v1.5.2",
                "description": "支付网关安全加固，符合等保三级要求",
                "release_content": "1. SSL证书更新\n2. 加密算法升级\n3. 新增风控规则",
                "impact_scope": "支付模块全部接口",
                "target_status": ReleaseStatusEnum.PENDING_REVIEW,
                "rollback": None,
                "handover": None,
                "post_review": None,
            },
            {
                "title": "首页性能优化发布",
                "project_name": "企业官网",
                "version": "v3.1.0",
                "description": "首页加载速度优化，LCP从3.2s降至1.5s",
                "release_content": "1. 图片懒加载\n2. 代码分割\n3. CDN缓存策略优化",
                "impact_scope": "首页及相关静态资源",
                "target_status": ReleaseStatusEnum.PUBLISHED,
                "rollback": {
                    "trigger_condition": "首页LCP超过5秒\n错误率超过1%",
                    "rollback_steps": "1. 切换CDN回源地址至旧版本\n2. 清除CDN缓存\n3. 回滚Nginx配置\n4. 验证首页访问正常",
                    "rollback_person": "李运维",
                    "expected_duration": "15分钟"
                },
                "handover": {
                    "shift": ShiftEnum.DAY,
                    "to_user": "reviewer2",
                    "content": "首页优化已上线，需要持续监控CDN命中率\n关注LCP指标是否稳定在1.5s以下"
                },
                "post_review": None,
            },
            {
                "title": "报表模块bug修复",
                "project_name": "数据分析平台",
                "version": "v1.2.3",
                "description": "修复报表导出乱码、数据统计错误等问题",
                "release_content": "1. 修复Excel导出乱码\n2. 修复统计公式错误\n3. 优化大数据量查询",
                "impact_scope": "报表模块",
                "target_status": ReleaseStatusEnum.RECHECK_APPROVED,
                "rollback": {
                    "trigger_condition": "报表导出功能异常\n统计数据与旧版偏差超过5%",
                    "rollback_steps": "1. 停止报表服务\n2. 回滚报表服务版本\n3. 清除报表缓存\n4. 验证报表功能正常",
                    "rollback_person": "张运维",
                    "expected_duration": "20分钟"
                },
                "handover": {
                    "shift": ShiftEnum.NIGHT,
                    "to_user": "registrar2",
                    "content": "报表模块待发布，回滚预案已准备\n如发布后有问题请联系王主管"
                },
                "post_review": None,
            },
            {
                "title": "消息推送服务重构",
                "project_name": "移动APP后端",
                "version": "v2.1.0",
                "description": "消息推送服务性能重构，支持百万级并发",
                "release_content": "1. 推送队列优化\n2. 新增失败重试机制\n3. 推送统计报表",
                "impact_scope": "消息推送服务",
                "target_status": ReleaseStatusEnum.PENDING_RECHECK,
                "rollback": {
                    "trigger_condition": "推送成功率低于99%\n推送延迟超过10秒",
                    "rollback_steps": "1. 切换推送服务至旧版集群\n2. 恢复旧版推送队列配置\n3. 验证推送功能正常",
                    "rollback_person": "王运维",
                    "expected_duration": "25分钟"
                },
                "handover": None,
                "post_review": None,
            },
            {
                "title": "登录模块安全加固",
                "project_name": "智慧政务平台",
                "version": "v1.8.0",
                "description": "登录模块增加图形验证码、滑块验证等安全措施",
                "release_content": "1. 图形验证码接入\n2. 滑块验证接入\n3. 登录失败锁定策略",
                "impact_scope": "登录模块",
                "target_status": ReleaseStatusEnum.REVIEWED_POST_LAUNCH,
                "rollback": {
                    "trigger_condition": "登录成功率低于95%\n验证码服务不可用",
                    "rollback_steps": "1. 禁用图形验证码，切换为纯密码模式\n2. 回滚登录服务至旧版\n3. 验证登录功能正常",
                    "rollback_person": "赵运维",
                    "expected_duration": "10分钟"
                },
                "handover": {
                    "shift": ShiftEnum.DAY,
                    "to_user": "registrar2",
                    "content": "登录安全加固已发布，请关注用户登录成功率\n如有异常请及时联系复核负责人"
                },
                "post_review": {
                    "review_content": "发布过程顺利，灰度期间无异常",
                    "issues_found": "部分用户验证码加载较慢，已优化CDN配置",
                    "improvement_measures": "1. 增加验证码服务冗余节点\n2. 优化验证码图片压缩",
                    "release_result": "success"
                },
            },
            {
                "title": "订单系统性能优化",
                "project_name": "电商平台",
                "version": "v2.3.0",
                "description": "订单系统数据库和缓存优化，提升并发处理能力",
                "release_content": "1. 订单表索引优化\n2. 引入Redis缓存\n3. 异步消息队列改造",
                "impact_scope": "订单模块全部接口",
                "target_status": ReleaseStatusEnum.ROLLED_BACK,
                "rollback": {
                    "trigger_condition": "订单创建失败率超过1%\n订单查询超时率超过5%",
                    "rollback_steps": "1. 切换数据库读写至旧集群\n2. 清除Redis订单缓存\n3. 回滚订单服务版本\n4. 验证订单流程正常",
                    "rollback_person": "李运维",
                    "expected_duration": "30分钟"
                },
                "handover": {
                    "shift": ShiftEnum.NIGHT,
                    "to_user": "supervisor2",
                    "content": "订单优化已发布但发现性能异常，已执行回滚\n请后续班次持续关注订单系统稳定性"
                },
                "post_review": None,
            },
        ]

        app_count = db.query(ReleaseApplication).count()
        if app_count == 0:
            registrar1 = created_users["registrar1"]
            supervisor1 = created_users["supervisor1"]
            reviewer1 = created_users["reviewer1"]

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
                app = create_release_application(db, app_create, registrar1.id)

                target = app_data["target_status"]
                rollback_data = app_data["rollback"]
                handover_data = app_data["handover"]
                review_data = app_data["post_review"]

                if rollback_data and target.value not in [ReleaseStatusEnum.DRAFT.value, ReleaseStatusEnum.PENDING_REVIEW.value]:
                    plan_create = RollbackPlanCreate(
                        release_application_id=app.id,
                        trigger_condition=rollback_data["trigger_condition"],
                        rollback_steps=rollback_data["rollback_steps"],
                        rollback_person=rollback_data["rollback_person"],
                        expected_duration=rollback_data["expected_duration"]
                    )
                    plan = create_rollback_plan(db, plan_create, registrar1.id)
                    if target.value not in [ReleaseStatusEnum.REVIEW_APPROVED.value, ReleaseStatusEnum.PENDING_RECHECK.value]:
                        approve_rollback_plan(db, plan.id, supervisor1.id)

                if handover_data and target.value in [
                    ReleaseStatusEnum.RECHECK_APPROVED.value,
                    ReleaseStatusEnum.PUBLISHED.value,
                    ReleaseStatusEnum.REVIEWED_POST_LAUNCH.value,
                    ReleaseStatusEnum.ROLLED_BACK.value
                ]:
                    to_user = created_users[handover_data["to_user"]]
                    handover_create = ShiftHandoverCreate(
                        release_application_id=app.id,
                        to_user_id=to_user.id,
                        shift=handover_data["shift"],
                        handover_content=handover_data["content"]
                    )
                    handover = create_shift_handover(db, handover_create, registrar1.id)
                    confirm_shift_handover(db, handover.id, to_user.id)

                if target == ReleaseStatusEnum.DRAFT:
                    pass

                elif target == ReleaseStatusEnum.PENDING_REVIEW:
                    submit_for_review(db, app.id, registrar1.id)

                elif target == ReleaseStatusEnum.REVIEW_APPROVED:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "审核通过，方案可行")

                elif target == ReleaseStatusEnum.PENDING_RECHECK:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "初审通过")
                    submit_for_recheck(db, app.id, supervisor1.id)

                elif target == ReleaseStatusEnum.RECHECK_APPROVED:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "初审通过")
                    submit_for_recheck(db, app.id, supervisor1.id)
                    recheck_approve(db, app.id, reviewer1.id, "复核通过")

                elif target == ReleaseStatusEnum.PUBLISHED:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "初审通过")
                    submit_for_recheck(db, app.id, supervisor1.id)
                    recheck_approve(db, app.id, reviewer1.id, "复核通过")
                    publish_release(db, app.id, reviewer1.id)

                elif target == ReleaseStatusEnum.REVIEWED_POST_LAUNCH:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "初审通过")
                    submit_for_recheck(db, app.id, supervisor1.id)
                    recheck_approve(db, app.id, reviewer1.id, "复核通过")
                    publish_release(db, app.id, reviewer1.id)

                    if review_data:
                        review_create = PostLaunchReviewCreate(
                            release_application_id=app.id,
                            review_content=review_data["review_content"],
                            issues_found=review_data["issues_found"],
                            improvement_measures=review_data["improvement_measures"],
                            release_result=review_data["release_result"]
                        )
                        review = create_post_launch_review(db, review_create, reviewer1.id)
                        complete_post_launch_review(db, review.id, reviewer1.id)

                elif target == ReleaseStatusEnum.ROLLED_BACK:
                    submit_for_review(db, app.id, registrar1.id)
                    review_approve(db, app.id, supervisor1.id, "初审通过")
                    submit_for_recheck(db, app.id, supervisor1.id)
                    recheck_approve(db, app.id, reviewer1.id, "复核通过")
                    publish_release(db, app.id, reviewer1.id)
                    rollback_release(db, app.id, reviewer1.id, "性能异常，订单超时率超阈值")

                print(f"创建样例申请: {app_data['title']} - {target.value}")

            # 补充跨角色可见动作样例：给已发布、待复核等申请添加额外的跨岗位交接
            registrar2 = created_users["registrar2"]
            supervisor2 = created_users["supervisor2"]
            reviewer2 = created_users["reviewer2"]

            extra_handovers = [
                # app 3: 已发布首页优化 - 额外添加一个 registrar2→supervisor2 的白班交接（已确认）
                {
                    "app_id": 3,
                    "from": registrar2,
                    "to": supervisor2,
                    "shift": ShiftEnum.DAY,
                    "content": "补充日班交接：CDN缓存命中率已提升至96.2%\n首页LCP稳定在1.3s-1.5s区间\n无异常告警",
                    "confirm": True,
                    "by": supervisor2
                },
                # app 6: 已复盘登录模块 - 额外添加 supervisor1→reviewer2 的夜班交接（已确认）
                {
                    "app_id": 6,
                    "from": supervisor1,
                    "to": reviewer2,
                    "shift": ShiftEnum.NIGHT,
                    "content": "复盘报告已归档\n验证码服务新增华东节点\n登录成功率保持99.1%",
                    "confirm": True,
                    "by": reviewer2
                },
                # app 5: 待复核消息推送 - 添加 registrar1→supervisor2 的未确认交接（演示待确认状态+主管可见待接收）
                {
                    "app_id": 5,
                    "from": registrar1,
                    "to": supervisor2,
                    "shift": ShiftEnum.NIGHT,
                    "content": "消息推送模块已完成初审\n夜班请主管跟进复核环节\n如发现推送延迟问题请先检查队列堆积",
                    "confirm": False,
                    "by": None
                },
                # app 5: 待复核消息推送 - 添加 registrar2→registrar1 的白班交接（已确认，同岗位交接）
                {
                    "app_id": 5,
                    "from": registrar2,
                    "to": registrar1,
                    "shift": ShiftEnum.DAY,
                    "content": "消息推送服务待复核\n已完成20万条压力测试，成功率99.7%\n交付文档已同步至共享目录",
                    "confirm": True,
                    "by": registrar1
                },
            ]

            for hx in extra_handovers:
                hc = ShiftHandoverCreate(
                    release_application_id=hx["app_id"],
                    to_user_id=hx["to"].id,
                    shift=hx["shift"],
                    handover_content=hx["content"]
                )
                handover = create_shift_handover(db, hc, hx["from"].id)
                if handover and hx["confirm"]:
                    confirm_shift_handover(db, handover.id, hx["by"].id)
            print(f"补充了 {len(extra_handovers)} 条跨角色交接样例")

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
