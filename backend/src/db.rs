use sqlx::SqlitePool;

pub struct AppState {
    pub pool: SqlitePool,
}

pub async fn init_pool(database_url: &str) -> SqlitePool {
    SqlitePool::connect(database_url)
        .await
        .expect("Failed to create database pool")
}

pub async fn run_migrations(pool: &SqlitePool) {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS borrow_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_no TEXT UNIQUE NOT NULL,
            borrower_name TEXT NOT NULL,
            borrower_id TEXT,
            book_title TEXT NOT NULL,
            book_isbn TEXT,
            borrow_date DATE NOT NULL,
            due_date DATE NOT NULL,
            return_date DATE,
            status TEXT NOT NULL DEFAULT 'draft',
            exception_type TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            current_handler_id INTEGER,
            current_handler_role TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS evidence_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_record_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            evidence_type TEXT NOT NULL,
            is_required INTEGER NOT NULL DEFAULT 0,
            file_path TEXT,
            uploaded_by INTEGER,
            uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS process_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_record_id INTEGER NOT NULL,
            handler_id INTEGER NOT NULL,
            handler_name TEXT NOT NULL,
            handler_role TEXT NOT NULL,
            action TEXT NOT NULL,
            from_status TEXT NOT NULL,
            to_status TEXT NOT NULL,
            opinion TEXT,
            reject_reason TEXT,
            version_before INTEGER NOT NULL,
            version_after INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#
    )
    .execute(pool)
    .await
    .unwrap();
}

pub async fn seed_sample_data(pool: &SqlitePool) {
    let user_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if user_count > 0 {
        return;
    }

    sqlx::query(
        "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)"
    )
    .bind("registrar1")
    .bind("123456")
    .bind("registrar")
    .bind("张登记")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)"
    )
    .bind("registrar2")
    .bind("123456")
    .bind("registrar")
    .bind("李登记")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)"
    )
    .bind("supervisor1")
    .bind("123456")
    .bind("supervisor")
    .bind("王审核")
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO users (username, password, role, name) VALUES (?, ?, ?, ?)"
    )
    .bind("director1")
    .bind("123456")
    .bind("director")
    .bind("赵复核")
    .execute(pool)
    .await
    .unwrap();

    let record_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records")
        .fetch_one(pool)
        .await
        .unwrap_or(0);

    if record_count > 0 {
        return;
    }

    // 正常 - 已归档
    seed_record_with_process(
        pool,
        "BR20240001",
        "陈明",
        "S2021001",
        "深入理解计算机系统",
        "978-7-111-54493-7",
        "2024-01-15",
        "2024-02-15",
        Some("2024-02-10"),
        "archived",
        None,
        3,
        1,
        "registrar",
        "正常借阅，按时归还",
    ).await;

    // 缺证据 - 草稿（缺少必填证据，无法提交）
    seed_record_with_process(
        pool,
        "BR20240002",
        "刘洋",
        "S2021002",
        "算法导论",
        "978-7-111-40701-0",
        "2024-02-01",
        "2024-03-01",
        None,
        "draft",
        Some("missing_evidence"),
        1,
        2,
        "registrar",
        "借阅登记时缺少身份证明材料",
    ).await;

    // 逾期 - 待复核
    seed_record_with_process(
        pool,
        "BR20240003",
        "王芳",
        "T2020003",
        "操作系统概念",
        "978-7-111-38665-2",
        "2023-12-01",
        "2024-01-01",
        None,
        "pending_review",
        Some("overdue"),
        2,
        3,
        "supervisor",
        "借阅已逾期30天，需复核处理",
    ).await;

    // 退回补正 - 待登记员补正
    seed_record_with_process(
        pool,
        "BR20240004",
        "赵强",
        "S2022004",
        "计算机网络：自顶向下方法",
        "978-7-111-59972-5",
        "2024-03-10",
        "2024-04-10",
        None,
        "returned_correction",
        None,
        2,
        1,
        "registrar",
        "审核发现书籍ISBN号有误，需退回补正",
    ).await;

    // 状态冲突 - 草稿
    seed_record_with_process(
        pool,
        "BR20240005",
        "孙丽",
        "S2021005",
        "数据库系统概念",
        "978-7-111-37529-6",
        "2024-01-20",
        "2024-02-20",
        Some("2024-02-18"),
        "draft",
        Some("conflict"),
        1,
        2,
        "registrar",
        "系统记录已归还但借阅状态未更新，存在状态冲突",
    ).await;

    // 正常 - 待审核
    seed_record_with_process(
        pool,
        "BR20240006",
        "周杰",
        "T2019006",
        "设计模式：可复用面向对象软件的基础",
        "978-7-111-21126-5",
        "2024-03-01",
        "2024-04-01",
        None,
        "pending_audit",
        None,
        1,
        1,
        "registrar",
        "正常借阅登记",
    ).await;

    // 正常 - 待复核
    seed_record_with_process(
        pool,
        "BR20240007",
        "吴敏",
        "S2020007",
        "软件工程：实践者的研究方法",
        "978-7-111-55501-8",
        "2024-02-15",
        "2024-03-15",
        None,
        "pending_review",
        None,
        2,
        3,
        "supervisor",
        "审核通过，待复核归档",
    ).await;
}

async fn seed_record_with_process(
    pool: &SqlitePool,
    record_no: &str,
    borrower_name: &str,
    borrower_id: &str,
    book_title: &str,
    book_isbn: &str,
    borrow_date: &str,
    due_date: &str,
    return_date: Option<&str>,
    status: &str,
    exception_type: Option<&str>,
    version: i64,
    current_handler_id: i64,
    current_handler_role: &str,
    description: &str,
) {
    sqlx::query(
        r#"
        INSERT INTO borrow_records
        (record_no, borrower_name, borrower_id, book_title, book_isbn,
         borrow_date, due_date, return_date, status, exception_type,
         version, current_handler_id, current_handler_role, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(record_no)
    .bind(borrower_name)
    .bind(borrower_id)
    .bind(book_title)
    .bind(book_isbn)
    .bind(borrow_date)
    .bind(due_date)
    .bind(return_date)
    .bind(status)
    .bind(exception_type)
    .bind(version)
    .bind(current_handler_id)
    .bind(current_handler_role)
    .bind(description)
    .execute(pool)
    .await
    .unwrap();

    // 证据项
    let record_id: i64 = sqlx::query_scalar("SELECT id FROM borrow_records WHERE record_no = ?")
        .bind(record_no)
        .fetch_one(pool)
        .await
        .unwrap();

    // 对于缺证据的记录，缺少一项必填证据（身份证明）
    if exception_type != Some("missing_evidence") {
        sqlx::query(
            "INSERT INTO evidence_items (borrow_record_id, name, description, evidence_type, is_required, file_path, uploaded_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(record_id)
        .bind("借阅人身份证明")
        .bind("学生卡/工作证扫描件")
        .bind("id_card")
        .bind(1)
        .bind("/evidence/id_card_001.jpg")
        .bind(1)
        .execute(pool)
        .await
        .unwrap();
    }

    // 借阅单（必填）
    sqlx::query(
        "INSERT INTO evidence_items (borrow_record_id, name, description, evidence_type, is_required, file_path, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(record_id)
    .bind("借阅登记单")
    .bind("读者签名的借阅登记单")
    .bind("borrow_form")
    .bind(1)
    .bind("/evidence/borrow_form_001.pdf")
    .bind(1)
    .execute(pool)
    .await
    .unwrap();

    // 归还凭证（可选）
    sqlx::query(
        "INSERT INTO evidence_items (borrow_record_id, name, description, evidence_type, is_required, file_path, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(record_id)
    .bind("归还凭证")
    .bind("图书归还确认单")
    .bind("return_receipt")
    .bind(0)
    .bind("/evidence/return_receipt_001.pdf")
    .bind(1)
    .execute(pool)
    .await
    .unwrap();

    // 生成处理记录
    match status {
        "archived" => {
            insert_process_record(pool, record_id, 1, "张登记", "registrar",
                "submit", "draft", "pending_audit",
                "借阅登记完成，提交审核", None, 1, 2).await;
            insert_process_record(pool, record_id, 3, "王审核", "supervisor",
                "audit_pass", "pending_audit", "pending_review",
                "材料齐全，审核通过", None, 2, 3).await;
            insert_process_record(pool, record_id, 4, "赵复核", "director",
                "review_pass", "pending_review", "archived",
                "复核无误，归档保存", None, 3, 4).await;
            sqlx::query("UPDATE borrow_records SET version = 4, current_handler_id = 1, current_handler_role = 'registrar' WHERE id = ?")
                .bind(record_id)
                .execute(pool)
                .await
                .unwrap();
        }
        "pending_audit" => {
            insert_process_record(pool, record_id, 1, "张登记", "registrar",
                "submit", "draft", "pending_audit",
                "借阅登记提交", None, 1, 2).await;
            sqlx::query("UPDATE borrow_records SET version = 2, current_handler_id = 3, current_handler_role = 'supervisor' WHERE id = ?")
                .bind(record_id)
                .execute(pool)
                .await
                .unwrap();
        }
        "pending_review" => {
            insert_process_record(pool, record_id, 1, "张登记", "registrar",
                "submit", "draft", "pending_audit",
                "借阅登记提交", None, 1, 2).await;
            insert_process_record(pool, record_id, 3, "王审核", "supervisor",
                "audit_pass", "pending_audit", "pending_review",
                "逾期借阅，需复核处理", None, 2, 3).await;
            sqlx::query("UPDATE borrow_records SET version = 3, current_handler_id = 4, current_handler_role = 'director' WHERE id = ?")
                .bind(record_id)
                .execute(pool)
                .await
                .unwrap();
        }
        "returned_correction" => {
            insert_process_record(pool, record_id, 1, "张登记", "registrar",
                "submit", "draft", "pending_audit",
                "借阅登记提交", None, 1, 2).await;
            insert_process_record(pool, record_id, 3, "王审核", "supervisor",
                "audit_reject", "pending_audit", "returned_correction",
                "信息有误，需补正", Some("书籍ISBN号与系统记录不符，借阅用途描述不完整，请核实后补充提交"), 2, 3).await;
            insert_process_record(pool, record_id, 1, "张登记", "registrar",
                "correct", "returned_correction", "returned_correction",
                "已补正：更新ISBN号，补充借阅用途说明", None, 3, 4).await;
            sqlx::query("UPDATE borrow_records SET version = 4, current_handler_id = 1, current_handler_role = 'registrar' WHERE id = ?")
                .bind(record_id)
                .execute(pool)
                .await
                .unwrap();
        }
        _ => {}
    }

    if exception_type == Some("missing_evidence") {
        insert_process_record(pool, record_id, 1, "张登记", "registrar",
            "validation_failed", "draft", "draft",
            "提交校验失败", Some("缺少必填证据项：身份证明和借阅登记单为必填项"), 1, 1).await;
    }
}

async fn insert_process_record(
    pool: &SqlitePool,
    borrow_record_id: i64,
    handler_id: i64,
    handler_name: &str,
    handler_role: &str,
    action: &str,
    from_status: &str,
    to_status: &str,
    opinion: &str,
    reject_reason: Option<&str>,
    version_before: i64,
    version_after: i64,
) {
    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, reject_reason, version_before, version_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(borrow_record_id)
    .bind(handler_id)
    .bind(handler_name)
    .bind(handler_role)
    .bind(action)
    .bind(from_status)
    .bind(to_status)
    .bind(opinion)
    .bind(reject_reason)
    .bind(version_before)
    .bind(version_after)
    .execute(pool)
    .await
    .unwrap();
}
