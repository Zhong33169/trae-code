import asyncio
import json
from database import get_db, init_db, close_db


async def seed():
    await init_db()
    db = await get_db()

    cursor = await db.execute("SELECT COUNT(*) as cnt FROM users")
    if (await cursor.fetchone())["cnt"] > 0:
        print("数据库已有数据，跳过种子数据")
        await close_db()
        return

    users = [
        (1, "张登记", "clerk"),
        (2, "李主管", "supervisor"),
        (3, "王复核", "rechecker"),
    ]
    for uid, name, role in users:
        await db.execute(
            "INSERT INTO users (id, name, role) VALUES (?, ?, ?)",
            [uid, name, role],
        )
    await db.commit()

    orders = [
        {
            "order_no": "WXO-20260601-001",
            "title": "A栋3楼配电箱跳闸频繁",
            "description": "A栋3楼配电箱近一周内反复跳闸，已影响园区企业正常办公，疑似线路老化或负载过大所致，需尽快排查。",
            "enterprise_name": "华信科技有限公司",
            "contact_person": "陈明",
            "contact_phone": "13800001001",
            "repair_type": "电气故障",
            "urgency": "high",
            "location": "A栋3楼配电间",
            "evidence_descriptions": ["配电箱跳闸记录表", "现场照片3张", "用电负荷监测数据"],
            "status": "archived",
            "current_handler_id": None,
            "current_handler_role": None,
            "version": 7,
            "created_at": "2026-06-01 09:15:00",
            "updated_at": "2026-06-03 16:30:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-01 09:15:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-01 09:30:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-01 14:00:00",
                },
                {
                    "action": "review_approve", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "review_approved",
                    "opinion": "情况属实，需尽快安排电工排查线路", "result": "approve",
                    "created_at": "2026-06-02 10:00:00",
                },
                {
                    "action": "accept_recheck", "operator_id": 3, "operator_name": "王复核",
                    "operator_role": "rechecker", "from_status": "review_approved", "to_status": "under_recheck",
                    "created_at": "2026-06-02 15:00:00",
                },
                {
                    "action": "recheck_archive", "operator_id": 3, "operator_name": "王复核",
                    "operator_role": "rechecker", "from_status": "under_recheck", "to_status": "archived",
                    "opinion": "审核意见合理，维修方案可行，同意归档", "result": "archive",
                    "created_at": "2026-06-03 16:30:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260605-002",
            "title": "B栋地下车库消防喷淋管道漏水",
            "description": "B栋地下车库B2区域消防喷淋管道接口处渗漏，已形成地面积水，存在安全隐患，需紧急处理。",
            "enterprise_name": "中恒物业管理公司",
            "contact_person": "刘伟",
            "contact_phone": "13800001002",
            "repair_type": "消防设施",
            "urgency": "urgent",
            "location": "B栋B2层车库喷淋区",
            "evidence_descriptions": ["现场漏水视频", "管道接口照片", "积水区域测量记录"],
            "status": "under_review",
            "current_handler_id": 2,
            "current_handler_role": "supervisor",
            "version": 3,
            "created_at": "2026-06-05 08:20:00",
            "updated_at": "2026-06-05 14:30:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-05 08:20:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-05 08:45:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-05 14:30:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260608-003",
            "title": "C栋5楼卫生间管道漏水",
            "description": "C栋5楼男卫生间上水管道连接处持续渗漏，已渗透至4楼天花板，影响楼下企业正常使用。",
            "enterprise_name": "瑞达电子科技公司",
            "contact_person": "孙丽",
            "contact_phone": "13800001003",
            "repair_type": "管道漏水",
            "urgency": "high",
            "location": "C栋5楼男卫生间",
            "evidence_descriptions": ["4楼天花板水渍照片"],
            "status": "returned",
            "current_handler_id": 1,
            "current_handler_role": "clerk",
            "version": 4,
            "created_at": "2026-06-08 10:00:00",
            "updated_at": "2026-06-09 11:00:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-08 10:00:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-08 10:30:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-08 15:00:00",
                },
                {
                    "action": "review_return", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "returned",
                    "opinion": "证据不足，需补充材料", "reason": "缺少5楼卫生间管道漏水现场照片和漏水点精确定位，仅提供4楼天花板照片无法确定漏水源头，请补充5楼现场照片及管道走向图",
                    "result": "return",
                    "created_at": "2026-06-09 11:00:00",
                },
                {
                    "action": "validation_failed", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "returned", "to_status": "returned",
                    "reason": "退回工单必须补充证据描述后才能提交", "result": "failed",
                    "created_at": "2026-06-09 14:20:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260609-004",
            "title": "D栋2楼中央空调制冷效果差",
            "description": "D栋2楼整层空调制冷效果明显不足，室温持续高于28度，已接到多家企业投诉，影响员工工作效率。",
            "enterprise_name": "创新软件园有限公司",
            "contact_person": "赵强",
            "contact_phone": "13800001004",
            "repair_type": "空调异常",
            "urgency": "medium",
            "location": "D栋2楼空调机房及办公区",
            "evidence_descriptions": ["温湿度监测记录", "空调出风口温度测量数据", "报修企业清单", "补正：空调主机运行参数截图", "补正：维保公司现场检测报告"],
            "status": "review_approved",
            "current_handler_id": None,
            "current_handler_role": "rechecker",
            "version": 6,
            "created_at": "2026-06-09 08:00:00",
            "updated_at": "2026-06-11 17:00:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-09 08:00:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-09 08:30:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-09 14:00:00",
                },
                {
                    "action": "review_return", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "returned",
                    "opinion": "需补充空调主机检测报告", "reason": "现有证据仅含出风口温度数据，缺少空调主机运行参数和维保公司专业检测报告，无法判断是主机故障还是管道问题",
                    "result": "return",
                    "created_at": "2026-06-10 10:00:00",
                },
                {
                    "action": "update", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "returned", "to_status": "returned",
                    "opinion": "已补充空调主机运行参数截图和维保公司现场检测报告",
                    "created_at": "2026-06-10 16:00:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "returned", "to_status": "submitted",
                    "opinion": "已补正完毕，重新提交审核",
                    "created_at": "2026-06-10 16:30:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-11 09:00:00",
                },
                {
                    "action": "review_approve", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "review_approved",
                    "opinion": "证据充分，补正材料完整，建议安排专业空调维保公司检修主机", "result": "approve",
                    "created_at": "2026-06-11 17:00:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260520-005",
            "title": "E栋大堂门禁系统故障",
            "description": "E栋大堂主入口门禁系统无法正常刷卡开门，访客和员工均需人工放行，存在安全管理风险。",
            "enterprise_name": "万通安防科技有限公司",
            "contact_person": "周建国",
            "contact_phone": "13800001005",
            "repair_type": "设施损坏",
            "urgency": "high",
            "location": "E栋1楼大堂主入口",
            "evidence_descriptions": ["门禁系统故障截图", "刷卡失败记录导出"],
            "status": "submitted",
            "current_handler_id": None,
            "current_handler_role": "supervisor",
            "version": 2,
            "created_at": "2026-05-20 11:00:00",
            "updated_at": "2026-05-20 11:30:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-05-20 11:00:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-05-20 11:30:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260610-006",
            "title": "F栋4楼电梯厅天花板脱落",
            "description": "F栋4楼电梯厅吊顶天花板局部脱落，露出线缆，有继续脱落风险，需紧急处理防止人员伤害。",
            "enterprise_name": "合众建筑装饰公司",
            "contact_person": "马超",
            "contact_phone": "13800001006",
            "repair_type": "设施损坏",
            "urgency": "urgent",
            "location": "F栋4楼电梯厅",
            "evidence_descriptions": ["天花板脱落现场照片4张", "线缆暴露特写", "已设置警戒线照片"],
            "status": "review_approved",
            "current_handler_id": None,
            "current_handler_role": "rechecker",
            "version": 4,
            "created_at": "2026-06-10 07:30:00",
            "updated_at": "2026-06-11 10:00:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-10 07:30:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-10 08:00:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-10 09:00:00",
                },
                {
                    "action": "review_approve", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "review_approved",
                    "opinion": "安全隐患紧急，已现场确认警戒措施到位，建议立即安排装修公司修复吊顶", "result": "approve",
                    "created_at": "2026-06-11 10:00:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260607-007",
            "title": "G栋1楼大堂地面瓷砖大面积开裂",
            "description": "G栋1楼大堂地面瓷砖出现大面积开裂和空鼓，影响美观和通行安全，企业客户多次投诉。",
            "enterprise_name": "盛世物业管理有限公司",
            "contact_person": "钱伟",
            "contact_phone": "13800001007",
            "repair_type": "设施损坏",
            "urgency": "low",
            "location": "G栋1楼大堂",
            "evidence_descriptions": [],
            "status": "rejected",
            "current_handler_id": None,
            "current_handler_role": None,
            "version": 4,
            "created_at": "2026-06-07 13:00:00",
            "updated_at": "2026-06-08 09:30:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-07 13:00:00",
                },
                {
                    "action": "submit", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": "draft", "to_status": "submitted",
                    "created_at": "2026-06-07 13:30:00",
                },
                {
                    "action": "accept_review", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "submitted", "to_status": "under_review",
                    "created_at": "2026-06-07 16:00:00",
                },
                {
                    "action": "review_reject", "operator_id": 2, "operator_name": "李主管",
                    "operator_role": "supervisor", "from_status": "under_review", "to_status": "rejected",
                    "opinion": "不符合报修条件，予以驳回", "reason": "该区域瓷砖开裂属装修质保期内问题，应由开发商施工单位负责维修，不属于物业报修范围。建议联系开发商维保部门处理",
                    "result": "reject",
                    "created_at": "2026-06-08 09:30:00",
                },
            ],
        },
        {
            "order_no": "WXO-20260611-008",
            "title": "H栋6楼会议室投影仪无法开机",
            "description": "H栋6楼共享会议室投影仪无法正常开机，电源指示灯不亮，影响企业客户会议使用。",
            "enterprise_name": "博远教育培训公司",
            "contact_person": "林小红",
            "contact_phone": "13800001008",
            "repair_type": "其他",
            "urgency": "medium",
            "location": "H栋6楼602会议室",
            "evidence_descriptions": [],
            "status": "draft",
            "current_handler_id": 1,
            "current_handler_role": "clerk",
            "version": 1,
            "created_at": "2026-06-11 16:45:00",
            "updated_at": "2026-06-11 16:45:00",
            "records": [
                {
                    "action": "create", "operator_id": 1, "operator_name": "张登记",
                    "operator_role": "clerk", "from_status": None, "to_status": "draft",
                    "created_at": "2026-06-11 16:45:00",
                },
            ],
        },
    ]

    for order in orders:
        evidence_json = json.dumps(order["evidence_descriptions"], ensure_ascii=False)
        cursor = await db.execute(
            """INSERT INTO repair_orders
               (order_no, title, description, enterprise_name, contact_person, contact_phone,
                repair_type, urgency, location, evidence_descriptions, status,
                current_handler_id, current_handler_role, version, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            [order["order_no"], order["title"], order["description"],
             order["enterprise_name"], order["contact_person"], order["contact_phone"],
             order["repair_type"], order["urgency"], order["location"], evidence_json,
             order["status"], order["current_handler_id"], order["current_handler_role"],
             order["version"], order["created_at"], order["updated_at"]],
        )
        order_db_id = cursor.lastrowid

        ver = 1
        for record in order["records"]:
            if record["action"] == "create":
                from_v = None
                to_v = 1
                ver = 1
            elif record["action"] == "validation_failed":
                from_v = ver
                to_v = ver
            else:
                from_v = ver
                to_v = ver + 1
                ver = to_v
            await db.execute(
                """INSERT INTO operation_records
                   (order_id, action, operator_id, operator_name, operator_role,
                    opinion, result, reason, from_status, to_status, from_version, to_version, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [order_db_id, record["action"], record["operator_id"],
                 record["operator_name"], record["operator_role"],
                 record.get("opinion"), record.get("result"), record.get("reason"),
                 record.get("from_status"), record.get("to_status"), from_v, to_v, record["created_at"]],
            )

        await db.execute(
            "UPDATE repair_orders SET version = ? WHERE id = ?",
            [ver, order_db_id],
        )

    await db.commit()
    print("种子数据写入完成：3个用户，8条工单")
    await close_db()


if __name__ == "__main__":
    asyncio.run(seed())
