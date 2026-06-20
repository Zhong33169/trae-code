import aiosqlite
import os
from config import DATABASE_PATH, REQUIRED_MATERIALS, CORRECTION_MATERIALS

DB_PATH = DATABASE_PATH


async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transfer_applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_no TEXT NOT NULL UNIQUE,
                seller_name TEXT NOT NULL,
                seller_id_no TEXT NOT NULL,
                buyer_name TEXT NOT NULL,
                buyer_id_no TEXT NOT NULL,
                vehicle_plate TEXT NOT NULL,
                vehicle_vin TEXT NOT NULL,
                vehicle_brand TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '草稿',
                current_role TEXT NOT NULL DEFAULT '登记员',
                assignee_id INTEGER,
                deadline_at TEXT,
                overdue_reason TEXT,
                overdue_action TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                version INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (assignee_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                is_required INTEGER NOT NULL DEFAULT 1,
                is_submitted INTEGER NOT NULL DEFAULT 0,
                submitted_at TEXT,
                remarks TEXT,
                category TEXT NOT NULL DEFAULT 'transfer',
                FOREIGN KEY (application_id) REFERENCES transfer_applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS correction_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                correction_no TEXT NOT NULL,
                reason TEXT NOT NULL,
                required_materials TEXT NOT NULL,
                deadline_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT '待补正',
                submitted_at TEXT,
                review_opinion TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (application_id) REFERENCES transfer_applications(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS process_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT,
                operator_id INTEGER NOT NULL,
                operator_name TEXT NOT NULL,
                operator_role TEXT NOT NULL,
                opinion TEXT,
                materials_snapshot TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (application_id) REFERENCES transfer_applications(id) ON DELETE CASCADE,
                FOREIGN KEY (operator_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                application_id INTEGER,
                action TEXT NOT NULL,
                actor_id INTEGER NOT NULL,
                actor_name TEXT NOT NULL,
                actor_role TEXT NOT NULL,
                detail TEXT,
                ip_address TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (application_id) REFERENCES transfer_applications(id),
                FOREIGN KEY (actor_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_applications_status ON transfer_applications(status);
            CREATE INDEX IF NOT EXISTS idx_applications_current_role ON transfer_applications(current_role);
            CREATE INDEX IF NOT EXISTS idx_applications_assignee ON transfer_applications(assignee_id);
            CREATE INDEX IF NOT EXISTS idx_materials_application ON materials(application_id);
            CREATE INDEX IF NOT EXISTS idx_process_records_application ON process_records(application_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_application ON audit_logs(application_id);
            CREATE INDEX IF NOT EXISTS idx_correction_records_application ON correction_records(application_id);
        """)
        await db.commit()


async def seed_demo_data():
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM users")
        count = (await cursor.fetchone())[0]
        if count > 0:
            return

        users = [
            ("zhangsan", "张三", "登记员"),
            ("lisi", "李四", "审核主管"),
            ("wangwu", "王五", "复核负责人"),
        ]
        for u in users:
            await db.execute(
                "INSERT INTO users (username, display_name, role) VALUES (?, ?, ?)", u
            )
        await db.commit()

        from datetime import datetime, timedelta
        import json

        now = datetime.now()

        apps_data = [
            {
                "no": "TF-2026-0001",
                "seller": ("赵六", "110101199001011234"),
                "buyer": ("钱七", "310101199203022345"),
                "plate": "京A12345",
                "vin": "LSVAU2A39EN123456",
                "brand": "大众帕萨特 2018款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now + timedelta(hours=24),
            },
            {
                "no": "TF-2026-0002",
                "seller": ("孙八", "440101198805053456"),
                "buyer": ("周九", "510101199506064567"),
                "plate": "粤B67890",
                "vin": "LSVAU2A39EN654321",
                "brand": "丰田凯美瑞 2020款",
                "status": "审核中",
                "role": "审核主管",
                "deadline": now + timedelta(hours=10),
            },
            {
                "no": "TF-2026-0003",
                "seller": ("吴十", "330101199107075678"),
                "buyer": ("郑十一", "120101198812086789"),
                "plate": "浙C11111",
                "vin": "LSVAU2A39EN111111",
                "brand": "本田雅阁 2019款",
                "status": "待补正",
                "role": "登记员",
                "deadline": now - timedelta(hours=5),
                "overdue_reason": "补正材料提交超时",
                "overdue_action": "待登记员补正后重新提交",
            },
            {
                "no": "TF-2026-0004",
                "seller": ("冯十二", "210101199309097890"),
                "buyer": ("陈十三", "610101199010108901"),
                "plate": "辽D22222",
                "vin": "LSVAU2A39EN222222",
                "brand": "别克君威 2017款",
                "status": "已逾期",
                "role": "登记员",
                "deadline": now - timedelta(hours=72),
                "overdue_reason": "审核超时未处理，系统自动标记逾期",
                "overdue_action": "需登记员重新提交或审核主管驳回",
            },
            {
                "no": "TF-2026-0005",
                "seller": ("褚十四", "430101198712129012"),
                "buyer": ("卫十五", "500101199411110123"),
                "plate": "湘E33333",
                "vin": "LSVAU2A39EN333333",
                "brand": "宝马3系 2021款",
                "status": "待复核归档",
                "role": "复核负责人",
                "deadline": now + timedelta(hours=12),
            },
            {
                "no": "TF-2026-0006",
                "seller": ("蒋十六", "220101199601012345"),
                "buyer": ("沈十七", "130101198702023456"),
                "plate": "吉F44444",
                "vin": "LSVAU2A39EN444444",
                "brand": "奔驰C级 2022款",
                "status": "已办结",
                "role": "复核负责人",
                "deadline": now - timedelta(hours=48),
            },
            {
                "no": "TF-2026-0007",
                "seller": ("韩十八", "340101199503034567"),
                "buyer": ("杨十九", "370101199204045678"),
                "plate": "皖G55555",
                "vin": "LSVAU2A39EN555555",
                "brand": "奥迪A4L 2020款",
                "status": "已驳回",
                "role": "登记员",
                "deadline": now - timedelta(hours=24),
            },
            {
                "no": "TF-2026-0008",
                "seller": ("朱二十", "230101198906066789"),
                "buyer": ("秦廿一", "420101199307077890"),
                "plate": "黑H66666",
                "vin": "LSVAU2A39EN666666",
                "brand": "特斯拉Model 3 2023款",
                "status": "草稿",
                "role": "登记员",
                "deadline": None,
            },
            {
                "no": "TF-2026-0009",
                "seller": ("尤廿二", "520101198810088901"),
                "buyer": ("许廿三", "140101199109099012"),
                "plate": "贵J77777",
                "vin": "LSVAU2A39EN777777",
                "brand": "比亚迪汉 2023款",
                "status": "复核归档中",
                "role": "复核负责人",
                "deadline": now + timedelta(hours=6),
            },
            {
                "no": "TF-2026-0010",
                "seller": ("何廿四", "620101199212120123"),
                "buyer": ("吕廿五", "150101198801021234"),
                "plate": "甘K88888",
                "vin": "LSVAU2A39EN888888",
                "brand": "蔚来ES6 2022款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now - timedelta(hours=2),
                "overdue_reason": "审核时限即将到期",
                "overdue_action": "需审核主管立即处理",
            },
            {
                "no": "TF-2026-0011",
                "seller": ("施廿六", "350101198903151234"),
                "buyer": ("张廿七", "320101199304162345"),
                "plate": "闽L99999",
                "vin": "LSVAU2A39EN999999",
                "brand": "小鹏P7 2022款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now + timedelta(hours=36),
                "all_materials": True,
            },
            {
                "no": "TF-2026-0012",
                "seller": ("孔廿八", "360101199005173456"),
                "buyer": ("曹廿九", "410101199106184567"),
                "plate": "赣M10101",
                "vin": "LSVAU2A39EN000001",
                "brand": "理想L9 2023款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now + timedelta(hours=28),
                "all_materials": True,
            },
            {
                "no": "TF-2026-0013",
                "seller": ("严三十", "530101198707195678"),
                "buyer": ("华卅一", "450101199408206789"),
                "plate": "云N11223",
                "vin": "LSVAU2A39EN000002",
                "brand": "问界M5 2023款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now + timedelta(hours=40),
                "all_materials": False,
                "missing_materials": ["车辆购置税完税证明"],
            },
            {
                "no": "TF-2026-0014",
                "seller": ("金卅二", "210101198609216789"),
                "buyer": ("魏卅三", "610101199510227890"),
                "plate": "辽P33445",
                "vin": "LSVAU2A39EN000003",
                "brand": "极氪001 2023款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now - timedelta(hours=12),
                "overdue_reason": "超过48小时审核时限",
                "overdue_action": "需审核主管立即处理或退回登记员补正",
                "all_materials": True,
            },
            {
                "no": "TF-2026-0015",
                "seller": ("陶卅四", "440101198911237890"),
                "buyer": ("姜卅五", "510101199212248901"),
                "plate": "粤Q55667",
                "vin": "LSVAU2A39EN000004",
                "brand": "比亚迪海豹 2023款",
                "status": "待审核",
                "role": "审核主管",
                "deadline": now - timedelta(hours=6),
                "overdue_reason": "超过48小时审核时限",
                "overdue_action": "需审核主管立即处理",
                "all_materials": True,
            },
            {
                "no": "TF-2026-0016",
                "seller": ("戚卅六", "330101199102258901"),
                "buyer": ("谢卅七", "310101199303269012"),
                "plate": "浙R77889",
                "vin": "LSVAU2A39EN000005",
                "brand": "长安深蓝SL03 2023款",
                "status": "待复核归档",
                "role": "复核负责人",
                "deadline": now + timedelta(hours=18),
                "all_materials": True,
            },
            {
                "no": "TF-2026-0017",
                "seller": ("邹卅八", "370101198704279012"),
                "buyer": ("喻卅九", "420101199405280123"),
                "plate": "鲁S99001",
                "vin": "LSVAU2A39EN000006",
                "brand": "哪吒S 2023款",
                "status": "待复核归档",
                "role": "复核负责人",
                "deadline": now + timedelta(hours=20),
                "all_materials": False,
                "missing_materials": ["交强险保单"],
            },
        ]

        for app in apps_data:
            assignee = 1 if app["role"] == "登记员" else (2 if app["role"] == "审核主管" else 3)
            deadline_str = app["deadline"].strftime("%Y-%m-%d %H:%M:%S") if app["deadline"] else None
            overdue_reason = app.get("overdue_reason")
            overdue_action = app.get("overdue_action")

            cursor = await db.execute(
                """INSERT INTO transfer_applications
                (application_no, seller_name, seller_id_no, buyer_name, buyer_id_no,
                 vehicle_plate, vehicle_vin, vehicle_brand, status, current_role,
                 assignee_id, deadline_at, overdue_reason, overdue_action)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (app["no"], app["seller"][0], app["seller"][1],
                 app["buyer"][0], app["buyer"][1],
                 app["plate"], app["vin"], app["brand"],
                 app["status"], app["role"], assignee, deadline_str,
                 overdue_reason, overdue_action),
            )
            app_id = cursor.lastrowid

            for mat_name in REQUIRED_MATERIALS:
                submitted = app["status"] not in ("草稿", "待补正")
                if "all_materials" in app:
                    submitted = app["all_materials"]
                if app.get("missing_materials") and mat_name in app["missing_materials"]:
                    submitted = False
                submitted_at = now.strftime("%Y-%m-%d %H:%M:%S") if submitted else None
                if app["status"] == "已驳回" and mat_name == "车辆购置税完税证明":
                    submitted = False
                    submitted_at = None
                await db.execute(
                    """INSERT INTO materials (application_id, name, is_required, is_submitted, submitted_at, category)
                    VALUES (?, ?, 1, ?, ?, 'transfer')""",
                    (app_id, mat_name, int(submitted), submitted_at),
                )

            if app["status"] == "待补正":
                for mat_name in CORRECTION_MATERIALS:
                    await db.execute(
                        """INSERT INTO materials (application_id, name, is_required, is_submitted, category)
                        VALUES (?, ?, 1, 0, 'correction')""",
                        (app_id, mat_name),
                    )
                await db.execute(
                    """INSERT INTO correction_records
                    (application_id, correction_no, reason, required_materials, deadline_at, status, review_opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, f"BC-{app['no']}", "买卖合同签字不完整，身份证明复印件模糊",
                     json.dumps(["补正说明", "补正材料", "买卖合同", "双方身份证明"]),
                     (now + timedelta(hours=72)).strftime("%Y-%m-%d %H:%M:%S"),
                     "待补正", "买卖合同第3页缺少卖方签字；买方身份证明复印件不清晰，请重新提供"),
                )

            if app["status"] == "已驳回":
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "提交审核", "草稿", "待审核", 1, "张三", "登记员", "申请提交，材料基本齐全"),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "开始审核", "待审核", "审核中", 2, "李四", "审核主管", ""),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "审核驳回", "审核中", "已驳回", 2, "李四", "审核主管",
                     "车辆购置税完税证明缺失，不符合过户条件"),
                )

            if app["status"] == "已办结":
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "提交审核", "草稿", "待审核", 1, "张三", "登记员", "材料齐全，提交审核"),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "开始审核", "待审核", "审核中", 2, "李四", "审核主管", ""),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "审核通过", "审核中", "待复核归档", 2, "李四", "审核主管", "材料审核通过"),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "开始复核", "待复核归档", "复核归档中", 3, "王五", "复核负责人", ""),
                )
                await db.execute(
                    """INSERT INTO process_records
                    (application_id, action, from_status, to_status, operator_id, operator_name, operator_role, opinion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (app_id, "复核归档", "复核归档中", "已办结", 3, "王五", "复核负责人", "复核通过，已归档"),
                )

        await db.commit()
