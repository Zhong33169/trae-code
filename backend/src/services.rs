use crate::models::*;
use sqlx::{SqlitePool, QueryBuilder, Sqlite};
use chrono::NaiveDate;

const SELECT_RECORD_WITH_HANDLER: &str = r#"
    SELECT br.*, u.name as current_handler_name
    FROM borrow_records br
    LEFT JOIN users u ON br.current_handler_id = u.id
"#;

pub async fn list_users(pool: &SqlitePool) -> Result<Vec<User>, String> {
    let users = sqlx::query_as::<_, User>(
        "SELECT id, username, password, role, name, created_at FROM users ORDER BY id"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(users)
}

pub async fn get_stats(pool: &SqlitePool) -> Result<StatsResponse, String> {
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let draft: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE status = 'draft'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pending_audit: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE status = 'pending_audit'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let pending_review: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE status = 'pending_review'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let returned_correction: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE status = 'returned_correction'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let archived: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE status = 'archived'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let missing_evidence: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE exception_type = 'missing_evidence'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let overdue: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE exception_type = 'overdue'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    let conflict: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM borrow_records WHERE exception_type = 'conflict'")
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(StatsResponse {
        total,
        draft,
        pending_audit,
        pending_review,
        returned_correction,
        archived,
        missing_evidence,
        overdue,
        conflict,
    })
}

pub async fn list_records(
    pool: &SqlitePool,
    status: Option<String>,
    exception_type: Option<String>,
    handler_role: Option<String>,
) -> Result<Vec<BorrowRecord>, String> {
    let mut query: QueryBuilder<Sqlite> = QueryBuilder::new(SELECT_RECORD_WITH_HANDLER);
    query.push(" WHERE 1=1");

    if let Some(s) = status {
        query.push(" AND br.status = ");
        query.push_bind(s);
    }

    if let Some(e) = exception_type {
        query.push(" AND br.exception_type = ");
        query.push_bind(e);
    }

    if let Some(r) = handler_role {
        query.push(" AND br.current_handler_role = ");
        query.push_bind(r);
    }

    query.push(" ORDER BY br.id DESC");

    let records = query.build_query_as::<BorrowRecord>()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(records)
}

pub async fn get_record(pool: &SqlitePool, id: i64) -> Result<Option<BorrowRecord>, String> {
    let record = sqlx::query_as::<_, BorrowRecord>(
        &format!("{} WHERE br.id = ?", SELECT_RECORD_WITH_HANDLER)
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(record)
}

pub async fn get_record_for_update(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    id: i64,
) -> Result<Option<BorrowRecord>, String> {
    let record = sqlx::query_as::<_, BorrowRecord>(
        &format!("{} WHERE br.id = ?", SELECT_RECORD_WITH_HANDLER)
    )
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|e| e.to_string())?;

    Ok(record)
}

pub async fn create_record(pool: &SqlitePool, req: CreateRecordRequest) -> Result<BorrowRecord, String> {
    let borrow_date = NaiveDate::parse_from_str(&req.borrow_date, "%Y-%m-%d")
        .map_err(|_| "借阅日期格式错误".to_string())?;
    let due_date = NaiveDate::parse_from_str(&req.due_date, "%Y-%m-%d")
        .map_err(|_| "应还日期格式错误".to_string())?;
    let return_date = req.return_date.as_ref().and_then(|d| {
        NaiveDate::parse_from_str(d, "%Y-%m-%d").ok()
    });

    let result = sqlx::query(
        r#"
        INSERT INTO borrow_records
        (record_no, borrower_name, borrower_id, book_title, book_isbn,
         borrow_date, due_date, return_date, status, version,
         current_handler_id, current_handler_role, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, 'registrar', ?)
        "#
    )
    .bind(&req.record_no)
    .bind(&req.borrower_name)
    .bind(&req.borrower_id)
    .bind(&req.book_title)
    .bind(&req.book_isbn)
    .bind(borrow_date)
    .bind(due_date)
    .bind(return_date)
    .bind(req.created_by)
    .bind(&req.description)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let id = result.last_insert_rowid();

    get_record(pool, id)
        .await?
        .ok_or_else(|| "创建失败".to_string())
}

pub async fn update_record(pool: &SqlitePool, id: i64, req: UpdateRecordRequest) -> Result<BorrowRecord, String> {
    let record = get_record(pool, id).await?
        .ok_or_else(|| "记录不存在".to_string())?;

    if record.status != "draft" && record.status != "returned_correction" {
        return Err("当前状态不允许修改".to_string());
    }

    let borrower_name = req.borrower_name.unwrap_or(record.borrower_name);
    let borrower_id = req.borrower_id.or(record.borrower_id);
    let book_title = req.book_title.unwrap_or(record.book_title);
    let book_isbn = req.book_isbn.or(record.book_isbn);
    let description = req.description.or(record.description);

    let borrow_date = req.borrow_date.map(|d| {
        NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()
    }).flatten().unwrap_or(record.borrow_date);

    let due_date = req.due_date.map(|d| {
        NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()
    }).flatten().unwrap_or(record.due_date);

    let return_date = req.return_date.map(|d| {
        NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()
    }).flatten();

    sqlx::query(
        r#"
        UPDATE borrow_records SET
            borrower_name = ?, borrower_id = ?, book_title = ?, book_isbn = ?,
            borrow_date = ?, due_date = ?, return_date = ?, description = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        "#
    )
    .bind(borrower_name)
    .bind(borrower_id)
    .bind(book_title)
    .bind(book_isbn)
    .bind(borrow_date)
    .bind(due_date)
    .bind(return_date)
    .bind(description)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    get_record(pool, id)
        .await?
        .ok_or_else(|| "更新失败".to_string())
}

pub async fn submit_record(
    pool: &SqlitePool,
    id: i64,
    req: SubmitRequest,
) -> Result<BorrowRecord, String> {
    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password, role, name, created_at FROM users WHERE id = ?"
    )
    .bind(req.handler_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "处理人不存在".to_string())?;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let record = get_record_for_update(&mut tx, id).await?
        .ok_or_else(|| "记录不存在".to_string())?;

    if record.status != "draft" && record.status != "returned_correction" {
        let err_msg = "只有草稿或退回补正状态可以提交审核".to_string();
        tx.rollback().await.ok();
        insert_validation_failed(pool, id, req.handler_id, &user.name, &req.handler_role, &record.status, &err_msg, req.version).await;
        return Err(err_msg);
    }

    if record.version != req.version {
        let err_msg = format!("版本冲突：当前版本为{}，您的版本为{}", record.version, req.version);
        tx.rollback().await.ok();
        insert_validation_failed(pool, id, req.handler_id, &user.name, &req.handler_role, &record.status, &err_msg, req.version).await;
        return Err(err_msg);
    }

    if req.handler_role != "registrar" {
        let err_msg = "只有借阅登记员可以提交借阅记录".to_string();
        tx.rollback().await.ok();
        insert_validation_failed(pool, id, req.handler_id, &user.name, &req.handler_role, &record.status, &err_msg, req.version).await;
        return Err(err_msg);
    }

    if let Some(handler_id) = record.current_handler_id {
        if handler_id != req.handler_id {
            let err_msg = "当前处理人不匹配".to_string();
            tx.rollback().await.ok();
            insert_validation_failed(pool, id, req.handler_id, &user.name, &req.handler_role, &record.status, &err_msg, req.version).await;
            return Err(err_msg);
        }
    }

    let required_evidence: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM evidence_items WHERE borrow_record_id = ? AND is_required = 1"
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    if required_evidence < 2 {
        let err_msg = "缺少必填证据项：身份证明和借阅登记单为必填项".to_string();
        tx.rollback().await.ok();
        insert_validation_failed(pool, id, req.handler_id, &user.name, &req.handler_role, &record.status, &err_msg, req.version).await;
        return Err(err_msg);
    }

    let from_status = record.status.clone();
    let new_version = record.version + 1;

    sqlx::query(
        r#"
        UPDATE borrow_records SET
            status = 'pending_audit',
            version = ?,
            current_handler_id = (SELECT id FROM users WHERE role = 'supervisor' LIMIT 1),
            current_handler_role = 'supervisor',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(new_version)
    .bind(id)
    .bind(req.version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, version_before, version_after)
        VALUES (?, ?, ?, ?, 'submit', ?, 'pending_audit', ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(req.handler_id)
    .bind(user.name)
    .bind(req.handler_role)
    .bind(from_status)
    .bind(&req.opinion)
    .bind(req.version)
    .bind(new_version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    get_record(pool, id)
        .await?
        .ok_or_else(|| "提交失败".to_string())
}

pub async fn audit_record(
    pool: &SqlitePool,
    id: i64,
    req: AuditRequest,
) -> Result<BorrowRecord, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let record = get_record_for_update(&mut tx, id).await?
        .ok_or_else(|| "记录不存在".to_string())?;

    if record.status != "pending_audit" {
        return Err("只有待审核状态可以审核".to_string());
    }

    if record.version != req.version {
        return Err(format!("版本冲突：当前版本为{}，您的版本为{}", record.version, req.version));
    }

    if req.handler_role != "supervisor" {
        return Err("只有借阅审核主管可以审核".to_string());
    }

    if let Some(handler_id) = record.current_handler_id {
        if handler_id != req.handler_id {
            return Err("当前处理人不匹配".to_string());
        }
    }

    let from_status = record.status.clone();
    let new_version = record.version + 1;
    let to_status = if req.passed {
        "pending_review".to_string()
    } else {
        "returned_correction".to_string()
    };
    let action = if req.passed { "audit_pass" } else { "audit_reject" };

    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password, role, name, created_at FROM users WHERE id = ?"
    )
    .bind(req.handler_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "处理人不存在".to_string())?;

    let next_handler_role = if req.passed { "director" } else { "registrar" };

    let next_handler: Option<i64> = sqlx::query_scalar(
        "SELECT id FROM users WHERE role = ? LIMIT 1"
    )
    .bind(next_handler_role)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .flatten();

    sqlx::query(
        r#"
        UPDATE borrow_records SET
            status = ?,
            version = ?,
            current_handler_id = ?,
            current_handler_role = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(&to_status)
    .bind(new_version)
    .bind(next_handler)
    .bind(next_handler_role)
    .bind(id)
    .bind(req.version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, reject_reason, version_before, version_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(req.handler_id)
    .bind(user.name)
    .bind(req.handler_role)
    .bind(action)
    .bind(from_status)
    .bind(&to_status)
    .bind(&req.opinion)
    .bind(&req.reject_reason)
    .bind(req.version)
    .bind(new_version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    get_record(pool, id)
        .await?
        .ok_or_else(|| "审核失败".to_string())
}

pub async fn review_record(
    pool: &SqlitePool,
    id: i64,
    req: ReviewRequest,
) -> Result<BorrowRecord, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let record = get_record_for_update(&mut tx, id).await?
        .ok_or_else(|| "记录不存在".to_string())?;

    if record.status != "pending_review" {
        return Err("只有待复核状态可以复核".to_string());
    }

    if record.version != req.version {
        return Err(format!("版本冲突：当前版本为{}，您的版本为{}", record.version, req.version));
    }

    if req.handler_role != "director" {
        return Err("只有图书馆复核负责人可以复核归档".to_string());
    }

    if let Some(handler_id) = record.current_handler_id {
        if handler_id != req.handler_id {
            return Err("当前处理人不匹配".to_string());
        }
    }

    let from_status = record.status.clone();
    let new_version = record.version + 1;
    let to_status = if req.passed {
        "archived".to_string()
    } else {
        "returned_correction".to_string()
    };
    let action = if req.passed { "review_pass" } else { "review_reject" };

    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password, role, name, created_at FROM users WHERE id = ?"
    )
    .bind(req.handler_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "处理人不存在".to_string())?;

    let (next_handler, next_handler_role): (Option<i64>, Option<&str>) = if req.passed {
        (None, None)
    } else {
        let next_id: Option<i64> = sqlx::query_scalar(
            "SELECT id FROM users WHERE role = 'registrar' LIMIT 1"
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| e.to_string())?
        .flatten();
        (next_id, Some("registrar"))
    };

    sqlx::query(
        r#"
        UPDATE borrow_records SET
            status = ?,
            version = ?,
            current_handler_id = ?,
            current_handler_role = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(&to_status)
    .bind(new_version)
    .bind(next_handler)
    .bind(next_handler_role)
    .bind(id)
    .bind(req.version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, reject_reason, version_before, version_after)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(req.handler_id)
    .bind(user.name)
    .bind(req.handler_role)
    .bind(action)
    .bind(from_status)
    .bind(&to_status)
    .bind(&req.opinion)
    .bind(&req.reject_reason)
    .bind(req.version)
    .bind(new_version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    get_record(pool, id)
        .await?
        .ok_or_else(|| "复核失败".to_string())
}

pub async fn correct_record(
    pool: &SqlitePool,
    id: i64,
    req: CorrectRequest,
) -> Result<BorrowRecord, String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let record = get_record_for_update(&mut tx, id).await?
        .ok_or_else(|| "记录不存在".to_string())?;

    if record.status != "returned_correction" {
        return Err("只有退回补正状态可以补正".to_string());
    }

    if record.version != req.version {
        return Err(format!("版本冲突：当前版本为{}，您的版本为{}", record.version, req.version));
    }

    if req.handler_role != "registrar" {
        return Err("只有借阅登记员可以补正".to_string());
    }

    if let Some(handler_id) = record.current_handler_id {
        if handler_id != req.handler_id {
            return Err("当前处理人不匹配".to_string());
        }
    }

    let user = sqlx::query_as::<_, User>(
        "SELECT id, username, password, role, name, created_at FROM users WHERE id = ?"
    )
    .bind(req.handler_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "处理人不存在".to_string())?;

    let borrower_name = req.borrower_name.unwrap_or(record.borrower_name);
    let book_title = req.book_title.unwrap_or(record.book_title);
    let book_isbn = req.book_isbn.or(record.book_isbn);
    let description = req.description.or(record.description);
    let new_version = record.version + 1;

    sqlx::query(
        r#"
        UPDATE borrow_records SET
            borrower_name = ?, book_title = ?, book_isbn = ?, description = ?,
            version = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
        "#
    )
    .bind(borrower_name)
    .bind(book_title)
    .bind(book_isbn)
    .bind(description)
    .bind(new_version)
    .bind(id)
    .bind(req.version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, version_before, version_after)
        VALUES (?, ?, ?, ?, 'correct', ?, ?, ?, ?, ?)
        "#
    )
    .bind(id)
    .bind(req.handler_id)
    .bind(user.name)
    .bind(&req.handler_role)
    .bind(&record.status)
    .bind(&record.status)
    .bind(&req.opinion)
    .bind(req.version)
    .bind(new_version)
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    get_record(pool, id)
        .await?
        .ok_or_else(|| "补正失败".to_string())
}

pub async fn list_process_records(
    pool: &SqlitePool,
    borrow_record_id: i64,
) -> Result<Vec<ProcessRecord>, String> {
    let records = sqlx::query_as::<_, ProcessRecord>(
        r#"
        SELECT * FROM process_records
        WHERE borrow_record_id = ?
        ORDER BY id DESC
        "#
    )
    .bind(borrow_record_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(records)
}

pub async fn list_evidence(
    pool: &SqlitePool,
    borrow_record_id: i64,
) -> Result<Vec<EvidenceItem>, String> {
    let items = sqlx::query_as::<_, EvidenceItem>(
        r#"
        SELECT id, borrow_record_id, name, description, evidence_type,
               is_required, file_path, uploaded_by, uploaded_at
        FROM evidence_items
        WHERE borrow_record_id = ?
        ORDER BY id
        "#
    )
    .bind(borrow_record_id)
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(items)
}

pub async fn add_evidence(
    pool: &SqlitePool,
    borrow_record_id: i64,
    req: AddEvidenceRequest,
) -> Result<EvidenceItem, String> {
    let result = sqlx::query(
        r#"
        INSERT INTO evidence_items
        (borrow_record_id, name, description, evidence_type, is_required, file_path, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(borrow_record_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.evidence_type)
    .bind(req.is_required)
    .bind(&req.file_path)
    .bind(req.uploaded_by)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    let id = result.last_insert_rowid();

    let item = sqlx::query_as::<_, EvidenceItem>(
        r#"
        SELECT id, borrow_record_id, name, description, evidence_type,
               is_required, file_path, uploaded_by, uploaded_at
        FROM evidence_items WHERE id = ?
        "#
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(item)
}

async fn insert_validation_failed(
    pool: &SqlitePool,
    borrow_record_id: i64,
    handler_id: i64,
    handler_name: &str,
    handler_role: &str,
    from_status: &str,
    reason: &str,
    version: i64,
) {
    sqlx::query(
        r#"
        INSERT INTO process_records
        (borrow_record_id, handler_id, handler_name, handler_role, action,
         from_status, to_status, opinion, reject_reason, version_before, version_after)
        VALUES (?, ?, ?, ?, 'validation_failed', ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(borrow_record_id)
    .bind(handler_id)
    .bind(handler_name)
    .bind(handler_role)
    .bind(from_status)
    .bind(from_status)
    .bind("提交校验失败")
    .bind(reason)
    .bind(version)
    .bind(version)
    .execute(pool)
    .await
    .ok();
}
