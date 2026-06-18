use rusqlite::Connection;
use std::path::Path;
use std::fs;

pub fn init_database() -> Result<Connection, Box<dyn std::error::Error>> {
    let data_dir = Path::new("data");
    if !data_dir.exists() {
        fs::create_dir_all(data_dir)?;
    }
    
    let db_path = data_dir.join("litigation.db");
    let conn = Connection::open(&db_path)?;
    
    create_tables(&conn)?;
    migrate(&conn)?;
    seed_data(&conn)?;
    
    Ok(conn)
}

fn create_tables(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            real_name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS litigation_materials (
            id TEXT PRIMARY KEY,
            case_no TEXT UNIQUE NOT NULL,
            case_name TEXT NOT NULL,
            plaintiff TEXT,
            defendant TEXT,
            court_name TEXT,
            case_type TEXT,
            status TEXT NOT NULL,
            priority TEXT DEFAULT 'normal',
            deadline TEXT,
            registered_by TEXT NOT NULL,
            registered_at TEXT NOT NULL,
            reviewed_by TEXT,
            reviewed_at TEXT,
            verified_by TEXT,
            verified_at TEXT,
            archived_by TEXT,
            archived_at TEXT,
            reject_reason TEXT,
            audit_remark TEXT,
            is_overdue INTEGER DEFAULT 0,
            overdue_hours INTEGER DEFAULT 0,
            FOREIGN KEY (registered_by) REFERENCES users(id),
            FOREIGN KEY (reviewed_by) REFERENCES users(id),
            FOREIGN KEY (verified_by) REFERENCES users(id),
            FOREIGN KEY (archived_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            material_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER DEFAULT 0,
            uploaded_by TEXT NOT NULL,
            uploaded_at TEXT NOT NULL,
            is_required INTEGER DEFAULT 1,
            status TEXT DEFAULT 'valid',
            reject_reason TEXT,
            rejected_by TEXT,
            rejected_at TEXT,
            replaces_attachment_id TEXT,
            FOREIGN KEY (material_id) REFERENCES litigation_materials(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS material_status_logs (
            id TEXT PRIMARY KEY,
            material_id TEXT NOT NULL,
            from_status TEXT,
            to_status TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            action TEXT NOT NULL,
            remark TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (material_id) REFERENCES litigation_materials(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            material_id TEXT,
            attachment_id TEXT,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            operator_role TEXT NOT NULL,
            action TEXT NOT NULL,
            action_detail TEXT,
            result TEXT NOT NULL,
            fail_reason TEXT,
            batch_id TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (material_id) REFERENCES litigation_materials(id),
            FOREIGN KEY (attachment_id) REFERENCES attachments(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS batch_tasks (
            id TEXT PRIMARY KEY,
            batch_name TEXT NOT NULL,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            total_count INTEGER NOT NULL,
            success_count INTEGER DEFAULT 0,
            fail_count INTEGER DEFAULT 0,
            skip_count INTEGER DEFAULT 0,
            result_details TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            completed_at TEXT,
            FOREIGN KEY (operator_id) REFERENCES users(id)
        );

        CREATE INDEX IF NOT EXISTS idx_materials_status ON litigation_materials(status);
        CREATE INDEX IF NOT EXISTS idx_materials_case_no ON litigation_materials(case_no);
        CREATE INDEX IF NOT EXISTS idx_attachments_material ON attachments(material_id);
        CREATE INDEX IF NOT EXISTS idx_audit_material ON audit_logs(material_id);
        CREATE INDEX IF NOT EXISTS idx_audit_operator ON audit_logs(operator_id);
        CREATE INDEX IF NOT EXISTS idx_status_logs_material ON material_status_logs(material_id);
        "
    )?;
    Ok(())
}

fn migrate(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let has_replaces: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('attachments') WHERE name = 'replaces_attachment_id'",
        [],
        |row| row.get::<_, i64>(0),
    ).unwrap_or(0) > 0;
    if !has_replaces {
        conn.execute_batch("ALTER TABLE attachments ADD COLUMN replaces_attachment_id TEXT;")?;
    }
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    if count > 0 {
        return Ok(());
    }

    let now = chrono::Local::now().to_rfc3339();

    conn.execute(
        "INSERT INTO users (id, username, password, real_name, role, created_at) VALUES 
         ('u1', 'registrar1', '123456', '张登记', 'registrar', ?1),
         ('u2', 'registrar2', '123456', '李补正', 'registrar', ?1),
         ('u3', 'reviewer1', '123456', '王审核', 'reviewer', ?1),
         ('u4', 'reviewer2', '123456', '赵主管', 'reviewer', ?1),
         ('u5', 'verifier1', '123456', '陈复核', 'verifier', ?1),
         ('u6', 'verifier2', '123456', '刘归档', 'verifier', ?1)",
        [&now],
    )?;

    conn.execute(
        "INSERT INTO litigation_materials 
         (id, case_no, case_name, plaintiff, defendant, court_name, case_type, 
          status, priority, deadline, registered_by, registered_at, 
          reviewed_by, reviewed_at, verified_by, verified_at, archived_by, archived_at,
          audit_remark, is_overdue)
         VALUES 
         ('m1', 'CASE-2026-0001', '买卖合同纠纷一审', '上海A科技有限公司', '北京B贸易有限公司', '上海市浦东新区人民法院', 'civil',
          'registered', 'high', '2026-06-25T18:00:00+08:00', 'u1', '2026-06-17T09:30:00+08:00',
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, 0),

         ('m2', 'CASE-2026-0002', '借款合同纠纷再审', '中国C银行股份有限公司', '周某某', '上海市高级人民法院', 'civil',
          'registered', 'normal', '2026-06-16T18:00:00+08:00', 'u1', '2026-06-16T14:20:00+08:00',
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, 1),

         ('m3', 'CASE-2026-0003', '劳动合同争议仲裁执行', '李某某', '上海D网络技术有限公司', '上海市劳动人事争议仲裁委员会', 'labor',
          'reviewing', 'high', '2026-06-22T18:00:00+08:00', 'u2', '2026-06-15T10:15:00+08:00',
          'u3', '2026-06-17T08:50:00+08:00', NULL, NULL, NULL, NULL,
          NULL, 0),

         ('m4', 'CASE-2026-0004', '建设工程施工合同纠纷', '上海E建筑工程有限公司', '上海F置业集团', '上海市第一中级人民法院', 'civil',
          'returned', 'urgent', '2026-06-20T18:00:00+08:00', 'u1', '2026-06-14T11:00:00+08:00',
          'u4', '2026-06-16T16:30:00+08:00', NULL, NULL, NULL, NULL,
          '缺少竣工验收报告原件及工程结算对账单，见附件驳回原因', 0),

         ('m5', 'CASE-2026-0005', '知识产权侵权诉讼', '上海G电子科技有限公司', '深圳H数码有限公司', '上海知识产权法院', 'ip',
          'review_passed', 'normal', '2026-06-28T18:00:00+08:00', 'u2', '2026-06-13T15:45:00+08:00',
          'u3', '2026-06-15T09:20:00+08:00', NULL, NULL, NULL, NULL,
          NULL, 0),

         ('m6', 'CASE-2026-0006', '房屋租赁合同纠纷', '孙某某', '上海I物业管理有限公司', '上海市静安区人民法院', 'civil',
          'verified', 'low', '2026-06-30T18:00:00+08:00', 'u1', '2026-06-12T09:00:00+08:00',
          'u4', '2026-06-13T10:30:00+08:00', 'u5', '2026-06-16T14:00:00+08:00', NULL, NULL,
          '合同原件与复印件比对一致，附件齐全，予以复核通过', 0),

         ('m7', 'CASE-2026-0007', '股权转让纠纷', '吴某某等3人', '上海J投资管理有限公司', '上海市第二中级人民法院', 'commercial',
          'archived', 'high', '2026-06-15T18:00:00+08:00', 'u2', '2026-06-10T13:30:00+08:00',
          'u3', '2026-06-11T09:00:00+08:00', 'u6', '2026-06-12T16:00:00+08:00', 'u6', '2026-06-12T17:30:00+08:00',
          '全部材料核验无误，已归档至2026年诉讼案卷第12号柜', 0),

         ('m8', 'CASE-2026-0008', '保险合同纠纷', '郑某某', '中国K财产保险股份有限公司上海分公司', '上海市黄浦区人民法院', 'insurance',
          'registered', 'normal', '2026-06-24T18:00:00+08:00', 'u2', '2026-06-17T11:00:00+08:00',
          NULL, NULL, NULL, NULL, NULL, NULL,
          NULL, 0)",
        [],
    )?;

    conn.execute(
        "INSERT INTO attachments 
         (id, material_id, file_name, file_type, file_size, uploaded_by, uploaded_at, 
          is_required, status, reject_reason, rejected_by, rejected_at, replaces_attachment_id)
         VALUES 
         ('a1', 'm1', '起诉状.pdf', 'application/pdf', 2048576, 'u1', '2026-06-17T09:32:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a2', 'm1', '买卖合同原件.pdf', 'application/pdf', 3145728, 'u1', '2026-06-17T09:35:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a3', 'm1', '送货凭证.pdf', 'application/pdf', 1572864, 'u1', '2026-06-17T09:38:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a4', 'm1', '被告工商信息.pdf', 'application/pdf', 524288, 'u1', '2026-06-17T09:40:00+08:00', 0, 'valid', NULL, NULL, NULL, NULL),

         ('a5', 'm2', '再审申请书.pdf', 'application/pdf', 2621440, 'u1', '2026-06-16T14:22:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a6', 'm2', '一审判决书.pdf', 'application/pdf', 4194304, 'u1', '2026-06-16T14:25:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),

         ('a7', 'm3', '仲裁裁决书.pdf', 'application/pdf', 3670016, 'u2', '2026-06-15T10:18:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a8', 'm3', '劳动合同.pdf', 'application/pdf', 2097152, 'u2', '2026-06-15T10:20:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a9', 'm3', '工资银行流水.pdf', 'application/pdf', 1048576, 'u2', '2026-06-15T10:22:00+08:00', 1, 'rejected', '银行流水缺少离职前3个月完整记录，仅有复印件无银行盖章', 'u4', '2026-06-17T08:55:00+08:00', NULL),

         ('a10', 'm4', '起诉状.pdf', 'application/pdf', 2097152, 'u1', '2026-06-14T11:02:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a11', 'm4', '建设工程施工合同.pdf', 'application/pdf', 5242880, 'u1', '2026-06-14T11:05:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a12', 'm4', '竣工验收报告.pdf', 'application/pdf', 4194304, 'u1', '2026-06-14T11:10:00+08:00', 1, 'rejected', '仅提交复印件，无建设单位、施工单位、监理单位三方盖章原件', 'u4', '2026-06-16T16:32:00+08:00', NULL),

         ('a13', 'm5', '起诉状.pdf', 'application/pdf', 3145728, 'u2', '2026-06-13T15:48:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a14', 'm5', '专利证书.pdf', 'application/pdf', 2097152, 'u2', '2026-06-13T15:50:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a15', 'm5', '侵权比对分析报告.pdf', 'application/pdf', 5242880, 'u2', '2026-06-13T15:55:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),

         ('a16', 'm6', '起诉状.pdf', 'application/pdf', 1572864, 'u1', '2026-06-12T09:02:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a17', 'm6', '房屋租赁合同.pdf', 'application/pdf', 2097152, 'u1', '2026-06-12T09:05:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),

         ('a18', 'm7', '起诉状.pdf', 'application/pdf', 2621440, 'u2', '2026-06-10T13:32:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),
         ('a19', 'm7', '股权转让协议.pdf', 'application/pdf', 3145728, 'u2', '2026-06-10T13:35:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),

         ('a20', 'm8', '起诉状.pdf', 'application/pdf', 1048576, 'u2', '2026-06-17T11:02:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL),

         ('a21', 'm3', '工资银行流水（盖章版）.pdf', 'application/pdf', 1572864, 'u2', '2026-06-17T15:30:00+08:00', 1, 'valid', NULL, NULL, NULL, 'a9'),
         ('a22', 'm4', '竣工验收报告（盖章版）.pdf', 'application/pdf', 5242880, 'u1', '2026-06-17T10:20:00+08:00', 1, 'valid', NULL, NULL, NULL, 'a12'),
         ('a23', 'm4', '工程结算对账单原件.pdf', 'application/pdf', 3145728, 'u1', '2026-06-17T10:25:00+08:00', 1, 'valid', NULL, NULL, NULL, NULL)",
        [],
    )?;

    conn.execute(
        "INSERT INTO material_status_logs 
         (id, material_id, from_status, to_status, operator_id, operator_name, action, remark, created_at)
         VALUES 
         ('l1', 'm1', NULL, 'registered', 'u1', '张登记', 'register', '新建诉讼材料登记', '2026-06-17T09:40:00+08:00'),
         ('l2', 'm2', NULL, 'registered', 'u1', '张登记', 'register', '新建诉讼材料登记', '2026-06-16T14:25:00+08:00'),
         ('l3', 'm3', NULL, 'registered', 'u2', '李补正', 'register', '新建诉讼材料登记', '2026-06-15T10:22:00+08:00'),
         ('l4', 'm3', 'registered', 'reviewing', 'u3', '王审核', 'start_review', '领取审核任务', '2026-06-17T08:50:00+08:00'),
         ('l5', 'm4', NULL, 'registered', 'u1', '张登记', 'register', '新建诉讼材料登记', '2026-06-14T11:10:00+08:00'),
         ('l6', 'm4', 'registered', 'reviewing', 'u4', '赵主管', 'start_review', '领取审核任务', '2026-06-16T16:00:00+08:00'),
         ('l7', 'm4', 'reviewing', 'returned', 'u4', '赵主管', 'return_material', '附件不齐全且质量不合格', '2026-06-16T16:30:00+08:00'),
         ('l8', 'm5', NULL, 'registered', 'u2', '李补正', 'register', '新建诉讼材料登记', '2026-06-13T15:55:00+08:00'),
         ('l9', 'm5', 'registered', 'reviewing', 'u3', '王审核', 'start_review', '领取审核任务', '2026-06-15T09:00:00+08:00'),
         ('l10', 'm5', 'reviewing', 'review_passed', 'u3', '王审核', 'pass_review', '材料完整，审核通过', '2026-06-15T09:20:00+08:00'),
         ('l11', 'm6', NULL, 'registered', 'u1', '张登记', 'register', '新建诉讼材料登记', '2026-06-12T09:05:00+08:00'),
         ('l12', 'm6', 'registered', 'reviewing', 'u4', '赵主管', 'start_review', '领取审核任务', '2026-06-13T09:00:00+08:00'),
         ('l13', 'm6', 'reviewing', 'review_passed', 'u4', '赵主管', 'pass_review', '材料完整，审核通过', '2026-06-13T10:30:00+08:00'),
         ('l14', 'm6', 'review_passed', 'verifying', 'u5', '陈复核', 'start_verify', '领取复核任务', '2026-06-16T10:00:00+08:00'),
         ('l15', 'm6', 'verifying', 'verified', 'u5', '陈复核', 'pass_verify', '合同原件与复印件比对一致', '2026-06-16T14:00:00+08:00'),
         ('l16', 'm7', NULL, 'registered', 'u2', '李补正', 'register', '新建诉讼材料登记', '2026-06-10T13:35:00+08:00'),
         ('l17', 'm7', 'registered', 'reviewing', 'u3', '王审核', 'start_review', '领取审核任务', '2026-06-11T08:00:00+08:00'),
         ('l18', 'm7', 'reviewing', 'review_passed', 'u3', '王审核', 'pass_review', '材料完整，审核通过', '2026-06-11T09:00:00+08:00'),
         ('l19', 'm7', 'review_passed', 'verifying', 'u6', '刘归档', 'start_verify', '领取复核任务', '2026-06-12T09:00:00+08:00'),
         ('l20', 'm7', 'verifying', 'verified', 'u6', '刘归档', 'pass_verify', '全部材料核验无误', '2026-06-12T16:00:00+08:00'),
         ('l21', 'm7', 'verified', 'archived', 'u6', '刘归档', 'archive', '已归档至2026年诉讼案卷第12号柜', '2026-06-12T17:30:00+08:00'),
         ('l22', 'm8', NULL, 'registered', 'u2', '李补正', 'register', '新建诉讼材料登记', '2026-06-17T11:02:00+08:00'),
         ('l23', 'm4', 'returned', 'registered', 'u1', '张登记', 'resubmit', '补齐竣工验收报告盖章版和工程结算对账单，替代件有效，重新提交', '2026-06-17T10:30:00+08:00')",
        [],
    )?;

    conn.execute(
        "INSERT INTO audit_logs 
         (id, material_id, attachment_id, operator_id, operator_name, operator_role, 
          action, action_detail, result, fail_reason, batch_id, created_at)
         VALUES 
         ('au1', 'm3', 'a9', 'u4', '赵主管', 'reviewer',
          'reject_attachment', '驳回附件：工资银行流水.pdf', 'fail', 
          '银行流水缺少离职前3个月完整记录，仅有复印件无银行盖章', NULL, '2026-06-17T08:55:00+08:00'),

         ('au2', 'm4', 'a12', 'u4', '赵主管', 'reviewer',
          'reject_attachment', '驳回附件：竣工验收报告.pdf', 'fail',
          '仅提交复印件，无建设单位、施工单位、监理单位三方盖章原件', NULL, '2026-06-16T16:32:00+08:00'),

         ('au3', 'm4', NULL, 'u4', '赵主管', 'reviewer',
          'return_material', '退回诉讼材料单CASE-2026-0004', 'fail',
          '缺少竣工验收报告原件及工程结算对账单，见附件驳回原因', NULL, '2026-06-16T16:30:00+08:00'),

         ('au4', 'm2', NULL, 'u1', '张登记', 'registrar',
          'register', '登记CASE-2026-0002，截止日2026-06-19', 'fail',
          '材料已超期未审核，超期约48小时', NULL, '2026-06-16T14:25:00+08:00'),

         ('au5', 'm7', NULL, 'u6', '刘归档', 'verifier',
          'archive', '归档CASE-2026-0007', 'success', NULL, 'b1', '2026-06-12T17:30:00+08:00'),

         ('au6', 'm4', 'a22', 'u1', '张登记', 'registrar',
          'add_attachment', '添加替代件附件：竣工验收报告（盖章版）.pdf（替代被驳回的a12）', 'success', NULL, NULL, '2026-06-17T10:20:00+08:00'),

         ('au7', 'm4', 'a23', 'u1', '张登记', 'registrar',
          'add_attachment', '添加补正附件：工程结算对账单原件.pdf', 'success', NULL, NULL, '2026-06-17T10:25:00+08:00'),

         ('au8', 'm4', NULL, 'u1', '张登记', 'registrar',
          'resubmit', '补正后重新提交CASE-2026-0004，被驳回原件保留，有效替代件满足必填项', 'success', NULL, NULL, '2026-06-17T10:30:00+08:00'),

         ('au9', 'm3', NULL, 'u5', '陈复核', 'verifier',
          'resubmit', '越权操作：复核负责人尝试补正提交', 'fail',
          '角色权限不符，只有诉讼材料登记员才能补正提交', NULL, '2026-06-17T11:00:00+08:00'),

         ('au10', NULL, NULL, 'u5', '陈复核', 'verifier',
          'batch_pass_review', '越权操作：复核负责人尝试批量审核', 'fail',
          '角色权限不符，只有审核主管才能批量审核', 'b2', '2026-06-17T14:00:00+08:00'),

         ('au11', 'm4', NULL, 'u4', '赵主管', 'reviewer',
          'batch_pass_review', '批量审核CASE-2026-0004，被驳回原件已由有效替代件满足', 'success', NULL, 'b2', '2026-06-17T14:05:00+08:00')",
        [],
    )?;

    Ok(())
}
