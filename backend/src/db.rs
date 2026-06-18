use std::sync::Mutex;
use rusqlite::{params, Connection};
use uuid::Uuid;
use chrono::{Utc, DateTime};
use crate::models::*;
use crate::errors::AppError;
use crate::auth;

pub struct DbPool {
    conn: Mutex<Connection>,
}

impl DbPool {
    pub fn new(conn: Connection) -> Self {
        DbPool {
            conn: Mutex::new(conn),
        }
    }
}

pub fn init_db() -> Result<DbPool, AppError> {
    let conn = Connection::open("bank_inspection.db")?;
    create_tables(&conn)?;
    seed_data(&conn)?;
    Ok(DbPool::new(conn))
}

fn create_tables(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS corporate_info (
            id TEXT PRIMARY KEY,
            company_name TEXT NOT NULL,
            credit_code TEXT UNIQUE NOT NULL,
            legal_representative TEXT NOT NULL,
            register_date TEXT NOT NULL,
            business_scope TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS annual_reminders (
            id TEXT PRIMARY KEY,
            corporate_id TEXT NOT NULL,
            year INTEGER NOT NULL,
            due_date TEXT NOT NULL,
            is_sent INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (corporate_id) REFERENCES corporate_info(id)
        );

        CREATE TABLE IF NOT EXISTS inspection_forms (
            id TEXT PRIMARY KEY,
            form_no TEXT UNIQUE NOT NULL,
            corporate_id TEXT NOT NULL,
            corporate_name TEXT NOT NULL,
            year INTEGER NOT NULL,
            status TEXT NOT NULL,
            registrant_id TEXT NOT NULL,
            registrant_name TEXT NOT NULL,
            auditor_id TEXT,
            auditor_name TEXT,
            reviewer_id TEXT,
            reviewer_name TEXT,
            current_handover_id TEXT,
            business_license TEXT,
            annual_report TEXT,
            tax_certificate TEXT,
            other_materials TEXT,
            audit_opinion TEXT,
            review_opinion TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            submitted_at TEXT,
            audited_at TEXT,
            reviewed_at TEXT,
            archived_at TEXT,
            FOREIGN KEY (corporate_id) REFERENCES corporate_info(id),
            FOREIGN KEY (registrant_id) REFERENCES users(id),
            FOREIGN KEY (auditor_id) REFERENCES users(id),
            FOREIGN KEY (reviewer_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS handover_records (
            id TEXT PRIMARY KEY,
            form_id TEXT NOT NULL,
            shift TEXT NOT NULL,
            handover_person_id TEXT NOT NULL,
            handover_person_name TEXT NOT NULL,
            receiver_person_id TEXT NOT NULL,
            receiver_person_name TEXT NOT NULL,
            confirm_time TEXT,
            remark TEXT,
            created_at TEXT NOT NULL,
            is_confirmed INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (form_id) REFERENCES inspection_forms(id),
            FOREIGN KEY (handover_person_id) REFERENCES users(id),
            FOREIGN KEY (receiver_person_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id TEXT PRIMARY KEY,
            form_id TEXT,
            form_no TEXT,
            operator_id TEXT NOT NULL,
            operator_name TEXT NOT NULL,
            action TEXT NOT NULL,
            action_display TEXT NOT NULL,
            detail TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (form_id) REFERENCES inspection_forms(id)
        );

        CREATE INDEX IF NOT EXISTS idx_forms_status ON inspection_forms(status);
        CREATE INDEX IF NOT EXISTS idx_forms_corporate ON inspection_forms(corporate_id);
        CREATE INDEX IF NOT EXISTS idx_forms_registrant ON inspection_forms(registrant_id);
        CREATE INDEX IF NOT EXISTS idx_forms_year ON inspection_forms(year);
        CREATE INDEX IF NOT EXISTS idx_logs_form ON operation_logs(form_id);
        CREATE INDEX IF NOT EXISTS idx_logs_operator ON operation_logs(operator_id);
        CREATE INDEX IF NOT EXISTS idx_reminders_corporate ON annual_reminders(corporate_id);
        "#,
    )?;
    Ok(())
}

fn seed_data(conn: &Connection) -> Result<(), AppError> {
    let user_count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
    if user_count > 0 {
        return Ok(());
    }

    let users = vec![
        ("registrar1", "张登记", "registrar", "123456"),
        ("registrar2", "李登记", "registrar", "123456"),
        ("auditor1", "王审核", "auditor", "123456"),
        ("auditor2", "赵审核", "auditor", "123456"),
        ("reviewer1", "陈复核", "reviewer", "123456"),
    ];

    for (username, name, role, password) in users {
        let id = Uuid::new_v4().to_string();
        let password_hash = auth::hash_password(password)?;
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO users (id, username, name, password_hash, role, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, username, name, password_hash, role, now],
        )?;
    }

    let corporates = vec![
        ("北京星辰科技有限公司", "91110000MA01ABCD01", "张三", "高新技术企业"),
        ("上海银河贸易有限公司", "91310000MA1GHIJK02", "李四", "进出口贸易"),
        ("广州明珠实业有限公司", "91440000MA5LMNOP03", "王五", "制造业"),
        ("深圳云海软件有限公司", "91440300MA3QRSTU04", "赵六", "软件开发"),
        ("杭州锦绣文化传媒有限公司", "91330100MA8VWXYZ05", "孙七", "文化传媒"),
    ];

    for (company_name, credit_code, legal_representative, business_scope) in corporates {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        let register_date = Utc::now().checked_sub_signed(chrono::Duration::days(365 * 3)).unwrap().to_rfc3339();
        conn.execute(
            "INSERT INTO corporate_info (id, company_name, credit_code, legal_representative, register_date, business_scope, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![id, company_name, credit_code, legal_representative, register_date, business_scope, now, now],
        )?;

        let year = 2024;
        let reminder_id = Uuid::new_v4().to_string();
        let due_date = chrono::NaiveDate::from_ymd_opt(2025, 6, 30)
            .and_then(|d| d.and_hms_opt(23, 59, 59))
            .unwrap()
            .and_local_timezone(Utc)
            .unwrap()
            .to_rfc3339();
        conn.execute(
            "INSERT INTO annual_reminders (id, corporate_id, year, due_date, is_sent, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![reminder_id, id, year, due_date, 1, now],
        )?;
    }

    Ok(())
}

fn get_conn(pool: &DbPool) -> Result<std::sync::MutexGuard<'_, Connection>, AppError> {
    pool.conn.lock().map_err(|e| AppError::InternalError(format!("数据库连接池错误: {}", e)))
}

pub fn get_user_by_username(pool: &DbPool, username: &str) -> Result<Option<(User, String)>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, username, name, password_hash, role, created_at FROM users WHERE username = ?1"
    )?;

    let mut rows = stmt.query(params![username])?;
    if let Some(row) = rows.next()? {
        let id_str: String = row.get(0)?;
        let user = User {
            id: Uuid::parse_str(&id_str).unwrap(),
            username: row.get(1)?,
            name: row.get(2)?,
            role: Role::from_str(&row.get::<_, String>(3)?).unwrap_or(Role::Registrar),
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(5)?)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(Utc::now()),
        };
        let password_hash: String = row.get(3)?;
        Ok(Some((user, password_hash)))
    } else {
        Ok(None)
    }
}

pub fn get_user_by_id(pool: &DbPool, user_id: Uuid) -> Result<Option<User>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, username, name, role, created_at FROM users WHERE id = ?1"
    )?;

    let mut rows = stmt.query(params![user_id.to_string()])?;
    if let Some(row) = rows.next()? {
        let id_str: String = row.get(0)?;
        Ok(Some(User {
            id: Uuid::parse_str(&id_str).unwrap(),
            username: row.get(1)?,
            name: row.get(2)?,
            role: Role::from_str(&row.get::<_, String>(3)?).unwrap_or(Role::Registrar),
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(Utc::now()),
        }))
    } else {
        Ok(None)
    }
}

pub fn list_users(pool: &DbPool, role_filter: Option<&str>) -> Result<Vec<User>, AppError> {
    let conn = get_conn(pool)?;
    let sql = match role_filter {
        Some(_) => "SELECT id, username, name, role, created_at FROM users WHERE role = ?1 ORDER BY created_at",
        None => "SELECT id, username, name, role, created_at FROM users ORDER BY created_at",
    };
    let mut stmt = conn.prepare(sql)?;

    let role_owned = role_filter.map(|s| s.to_string());

    let mut rows = if let Some(ref r) = role_owned {
        stmt.query(params![r])?
    } else {
        stmt.query([])?
    };
    let mut users = Vec::new();
    while let Some(row) = rows.next()? {
        let id_str: String = row.get(0)?;
        users.push(User {
            id: Uuid::parse_str(&id_str).unwrap(),
            username: row.get(1)?,
            name: row.get(2)?,
            role: Role::from_str(&row.get::<_, String>(3)?).unwrap_or(Role::Registrar),
            created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(4)?)
                .map(|d| d.with_timezone(&Utc))
                .unwrap_or(Utc::now()),
        });
    }
    Ok(users)
}

fn parse_datetime(s: &str) -> DateTime<Utc> {
    DateTime::parse_from_rfc3339(s)
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or(Utc::now())
}

fn parse_option_datetime(s: Option<String>) -> Option<DateTime<Utc>> {
    s.and_then(|s| DateTime::parse_from_rfc3339(&s).ok().map(|d| d.with_timezone(&Utc)))
}

pub fn create_inspection_form(
    pool: &DbPool,
    registrant: &auth::AuthUser,
    req: &CreateFormRequest,
) -> Result<InspectionForm, AppError> {
    let conn = get_conn(pool)?;

    let year = req.year;
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM inspection_forms WHERE strftime('%Y', created_at) = ?1",
        params![year.to_string()],
        |row| row.get(0),
    )?;

    let form_no = format!("NJ{:04}{:04}", year, count + 1);
    let id = Uuid::new_v4();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"INSERT INTO inspection_forms 
           (id, form_no, corporate_id, corporate_name, year, status, 
            registrant_id, registrant_name, business_license, annual_report, 
            tax_certificate, other_materials, created_at, updated_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)"#,
        params![
            id.to_string(),
            form_no,
            req.corporate_id.to_string(),
            req.corporate_name,
            req.year,
            FormStatus::Draft.as_str(),
            registrant.user_id.to_string(),
            registrant.name.clone(),
            req.business_license,
            req.annual_report,
            req.tax_certificate,
            req.other_materials,
            now,
            now,
        ],
    )?;

    add_operation_log(
        pool,
        Some(id),
        Some(&form_no),
        &registrant.user_id,
        &registrant.name,
        "create",
        "创建年检单",
        Some(format!("创建年检单 {}", form_no)),
    )?;

    get_form_by_id(pool, id).map(|opt| opt.unwrap())
}

pub fn update_inspection_form(
    pool: &DbPool,
    form_id: Uuid,
    operator: &auth::AuthUser,
    req: &UpdateFormRequest,
) -> Result<InspectionForm, AppError> {
    let form = get_form_by_id(pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    if !matches!(form.status, FormStatus::Draft | FormStatus::AuditRejected | FormStatus::ReviewRejected) {
        return Err(AppError::BusinessError(format!(
            "当前状态「{}」不允许编辑",
            form.status.display_name()
        )));
    }

    if matches!(operator.role, Role::Registrar) && form.registrant_id != operator.user_id {
        return Err(AppError::PermissionError("只能编辑自己创建的年检单".to_string()));
    }

    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"UPDATE inspection_forms 
           SET business_license = ?1, annual_report = ?2, 
               tax_certificate = ?3, other_materials = ?4, updated_at = ?5
           WHERE id = ?6"#,
        params![
            req.business_license,
            req.annual_report,
            req.tax_certificate,
            req.other_materials,
            now,
            form_id.to_string(),
        ],
    )?;

    add_operation_log(
        pool,
        Some(form_id),
        Some(&form.form_no),
        &operator.user_id,
        &operator.name,
        "update",
        "更新年检单",
        Some("更新年检单资料".to_string()),
    )?;

    drop(conn);
    get_form_by_id(pool, form_id).map(|opt| opt.unwrap())
}

pub fn get_form_by_id(pool: &DbPool, form_id: Uuid) -> Result<Option<InspectionForm>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        r#"SELECT id, form_no, corporate_id, corporate_name, year, status,
           registrant_id, registrant_name, auditor_id, auditor_name,
           reviewer_id, reviewer_name, current_handover_id,
           business_license, annual_report, tax_certificate, other_materials,
           audit_opinion, review_opinion,
           created_at, updated_at, submitted_at, audited_at, reviewed_at, archived_at
           FROM inspection_forms WHERE id = ?1"#
    )?;

    let mut rows = stmt.query(params![form_id.to_string()])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row_to_form(row)?))
    } else {
        Ok(None)
    }
}

fn row_to_form(row: &rusqlite::Row) -> Result<InspectionForm, AppError> {
    let id_str: String = row.get(0)?;
    Ok(InspectionForm {
        id: Uuid::parse_str(&id_str).unwrap(),
        form_no: row.get(1)?,
        corporate_id: Uuid::parse_str(&row.get::<_, String>(2)?).unwrap(),
        corporate_name: row.get(3)?,
        year: row.get(4)?,
        status: FormStatus::from_str(&row.get::<_, String>(5)?).unwrap_or(FormStatus::Draft),
        registrant_id: Uuid::parse_str(&row.get::<_, String>(6)?).unwrap(),
        registrant_name: row.get(7)?,
        auditor_id: row.get::<_, Option<String>>(8)?.and_then(|s| Uuid::parse_str(&s).ok()),
        auditor_name: row.get(9)?,
        reviewer_id: row.get::<_, Option<String>>(10)?.and_then(|s| Uuid::parse_str(&s).ok()),
        reviewer_name: row.get(11)?,
        current_handover_id: row.get::<_, Option<String>>(12)?.and_then(|s| Uuid::parse_str(&s).ok()),
        business_license: row.get(13)?,
        annual_report: row.get(14)?,
        tax_certificate: row.get(15)?,
        other_materials: row.get(16)?,
        audit_opinion: row.get(17)?,
        review_opinion: row.get(18)?,
        created_at: parse_datetime(&row.get::<_, String>(19)?),
        updated_at: parse_datetime(&row.get::<_, String>(20)?),
        submitted_at: parse_option_datetime(row.get::<_, Option<String>>(21)?),
        audited_at: parse_option_datetime(row.get::<_, Option<String>>(22)?),
        reviewed_at: parse_option_datetime(row.get::<_, Option<String>>(23)?),
        archived_at: parse_option_datetime(row.get::<_, Option<String>>(24)?),
    })
}

pub fn list_forms(
    pool: &DbPool,
    status_filter: Option<&str>,
    page: i64,
    page_size: i64,
    user_role: &Role,
    user_id: Uuid,
) -> Result<ListResponse<InspectionForm>, AppError> {
    let conn = get_conn(pool)?;
    let offset = (page - 1) * page_size;
    let user_id_str = user_id.to_string();
    let status_str = status_filter.map(|s| s.to_string());

    let base_select = r#"SELECT id, form_no, corporate_id, corporate_name, year, status,
           registrant_id, registrant_name, auditor_id, auditor_name,
           reviewer_id, reviewer_name, current_handover_id,
           business_license, annual_report, tax_certificate, other_materials,
           audit_opinion, review_opinion,
           created_at, updated_at, submitted_at, audited_at, reviewed_at, archived_at
           FROM inspection_forms"#;

    let total: i64;
    let mut items = Vec::new();

    match user_role {
        Role::Registrar => {
            if let Some(ref status) = status_str {
                let count_sql = "SELECT COUNT(*) FROM inspection_forms WHERE status = ?1 AND registrant_id = ?2";
                total = conn.query_row(count_sql, params![status, user_id_str], |row| row.get(0))?;

                let list_sql = format!("{} WHERE status = ?1 AND registrant_id = ?2 ORDER BY created_at DESC LIMIT ?3 OFFSET ?4", base_select);
                let mut stmt = conn.prepare(&list_sql)?;
                let mut rows = stmt.query(params![status, user_id_str, page_size, offset])?;
                while let Some(row) = rows.next()? {
                    items.push(row_to_form(row)?);
                }
            } else {
                let count_sql = "SELECT COUNT(*) FROM inspection_forms WHERE registrant_id = ?1";
                total = conn.query_row(count_sql, params![user_id_str], |row| row.get(0))?;

                let list_sql = format!("{} WHERE registrant_id = ?1 ORDER BY created_at DESC LIMIT ?2 OFFSET ?3", base_select);
                let mut stmt = conn.prepare(&list_sql)?;
                let mut rows = stmt.query(params![user_id_str, page_size, offset])?;
                while let Some(row) = rows.next()? {
                    items.push(row_to_form(row)?);
                }
            }
        }
        Role::Auditor => {
            let count_sql = "SELECT COUNT(*) FROM inspection_forms WHERE status IN ('pending_audit', 'audit_rejected')";
            total = conn.query_row(count_sql, [], |row| row.get(0))?;

            let list_sql = format!("{} WHERE status IN ('pending_audit', 'audit_rejected') ORDER BY created_at DESC LIMIT ?1 OFFSET ?2", base_select);
            let mut stmt = conn.prepare(&list_sql)?;
            let mut rows = stmt.query(params![page_size, offset])?;
            while let Some(row) = rows.next()? {
                items.push(row_to_form(row)?);
            }
        }
        Role::Reviewer => {
            let count_sql = "SELECT COUNT(*) FROM inspection_forms WHERE status IN ('pending_review', 'review_rejected', 'archived')";
            total = conn.query_row(count_sql, [], |row| row.get(0))?;

            let list_sql = format!("{} WHERE status IN ('pending_review', 'review_rejected', 'archived') ORDER BY created_at DESC LIMIT ?1 OFFSET ?2", base_select);
            let mut stmt = conn.prepare(&list_sql)?;
            let mut rows = stmt.query(params![page_size, offset])?;
            while let Some(row) = rows.next()? {
                items.push(row_to_form(row)?);
            }
        }
    }

    Ok(ListResponse {
        items,
        total,
        page,
        page_size,
    })
}

pub fn submit_for_audit(
    pool: &DbPool,
    form_id: Uuid,
    operator: &auth::AuthUser,
    handover_req: &HandoverRequest,
) -> Result<InspectionForm, AppError> {
    let form = get_form_by_id(pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    if !matches!(form.status, FormStatus::Draft | FormStatus::AuditRejected | FormStatus::ReviewRejected) {
        return Err(AppError::BusinessError(format!(
            "当前状态「{}」不允许提交审核",
            form.status.display_name()
        )));
    }

    if matches!(operator.role, Role::Registrar) && form.registrant_id != operator.user_id {
        return Err(AppError::PermissionError("只能提交自己创建的年检单".to_string()));
    }

    let shift = Shift::from_str(&handover_req.shift)
        .map_err(|_| AppError::ValidationError("班次信息无效".to_string()))?;

    if handover_req.receiver_person_id.is_nil() {
        return Err(AppError::ValidationError("请选择接收人".to_string()));
    }

    let receiver = get_user_by_id(pool, handover_req.receiver_person_id)?
        .ok_or_else(|| AppError::ValidationError("接收人不存在".to_string()))?;

    let handover_id = create_handover_record(
        pool,
        form_id,
        &shift,
        &operator.user_id,
        &operator.name,
        &handover_req.receiver_person_id,
        &receiver.name,
        handover_req.remark.as_deref(),
    )?;

    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        r#"UPDATE inspection_forms 
           SET status = ?1, current_handover_id = ?2, submitted_at = ?3, updated_at = ?4
           WHERE id = ?5"#,
        params![
            FormStatus::PendingAudit.as_str(),
            handover_id.to_string(),
            now,
            now,
            form_id.to_string(),
        ],
    )?;

    add_operation_log(
        pool,
        Some(form_id),
        Some(&form.form_no),
        &operator.user_id,
        &operator.name,
        "submit_audit",
        "提交审核",
        Some(format!("提交审核，{}交接给{}", shift.display_name(), receiver.name)),
    )?;

    drop(conn);
    get_form_by_id(pool, form_id).map(|opt| opt.unwrap())
}

pub fn create_handover_record(
    pool: &DbPool,
    form_id: Uuid,
    shift: &Shift,
    handover_person_id: &Uuid,
    handover_person_name: &str,
    receiver_person_id: &Uuid,
    receiver_person_name: &str,
    remark: Option<&str>,
) -> Result<Uuid, AppError> {
    let id = Uuid::new_v4();
    let now = Utc::now().to_rfc3339();
    let conn = get_conn(pool)?;

    conn.execute(
        r#"INSERT INTO handover_records 
           (id, form_id, shift, handover_person_id, handover_person_name, 
            receiver_person_id, receiver_person_name, remark, created_at, is_confirmed)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)"#,
        params![
            id.to_string(),
            form_id.to_string(),
            shift.as_str(),
            handover_person_id.to_string(),
            handover_person_name,
            receiver_person_id.to_string(),
            receiver_person_name,
            remark,
            now,
        ],
    )?;

    Ok(id)
}

pub fn get_handover_by_id(pool: &DbPool, handover_id: Uuid) -> Result<Option<HandoverRecord>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        r#"SELECT id, form_id, shift, handover_person_id, handover_person_name,
           receiver_person_id, receiver_person_name, confirm_time, remark, created_at, is_confirmed
           FROM handover_records WHERE id = ?1"#
    )?;

    let mut rows = stmt.query(params![handover_id.to_string()])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row_to_handover(row)?))
    } else {
        Ok(None)
    }
}

fn row_to_handover(row: &rusqlite::Row) -> Result<HandoverRecord, AppError> {
    let id_str: String = row.get(0)?;
    Ok(HandoverRecord {
        id: Uuid::parse_str(&id_str).unwrap(),
        form_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
        shift: Shift::from_str(&row.get::<_, String>(2)?).unwrap_or(Shift::Morning),
        handover_person_id: Uuid::parse_str(&row.get::<_, String>(3)?).unwrap(),
        handover_person_name: row.get(4)?,
        receiver_person_id: Uuid::parse_str(&row.get::<_, String>(5)?).unwrap(),
        receiver_person_name: row.get(6)?,
        confirm_time: parse_option_datetime(row.get::<_, Option<String>>(7)?),
        remark: row.get(8)?,
        created_at: parse_datetime(&row.get::<_, String>(9)?),
        is_confirmed: row.get::<_, i64>(10)? != 0,
    })
}

pub fn list_handovers(pool: &DbPool, form_id: Uuid) -> Result<Vec<HandoverRecord>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        r#"SELECT id, form_id, shift, handover_person_id, handover_person_name,
           receiver_person_id, receiver_person_name, confirm_time, remark, created_at, is_confirmed
           FROM handover_records WHERE form_id = ?1 ORDER BY created_at DESC"#
    )?;

    let mut rows = stmt.query(params![form_id.to_string()])?;
    let mut records = Vec::new();
    while let Some(row) = rows.next()? {
        records.push(row_to_handover(row)?);
    }
    Ok(records)
}

pub fn confirm_handover(
    pool: &DbPool,
    handover_id: Uuid,
    operator: &auth::AuthUser,
) -> Result<HandoverRecord, AppError> {
    let handover = get_handover_by_id(pool, handover_id)?
        .ok_or_else(|| AppError::NotFoundError("交接记录不存在".to_string()))?;

    if handover.is_confirmed {
        return Err(AppError::BusinessError("该交接已确认".to_string()));
    }

    if handover.receiver_person_id != operator.user_id {
        return Err(AppError::PermissionError("只有接收人可以确认交接".to_string()));
    }

    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE handover_records SET is_confirmed = 1, confirm_time = ?1 WHERE id = ?2",
        params![now, handover_id.to_string()],
    )?;

    add_operation_log(
        pool,
        Some(handover.form_id),
        None,
        &operator.user_id,
        &operator.name,
        "confirm_handover",
        "确认交接",
        Some(format!("确认{}交接", handover.shift.display_name())),
    )?;

    drop(conn);
    get_handover_by_id(pool, handover_id).map(|h| h.unwrap())
}

pub fn validate_handover_before_audit(
    pool: &DbPool,
    form_id: Uuid,
) -> Result<(), AppError> {
    let form = get_form_by_id(pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    let handover_id = form.current_handover_id
        .ok_or_else(|| AppError::BusinessError("请先完成交接确认".to_string()))?;

    let handover = get_handover_by_id(pool, handover_id)?
        .ok_or_else(|| AppError::BusinessError("交接记录不存在".to_string()))?;

    if !handover.is_confirmed {
        return Err(AppError::BusinessError("交接未确认，请先确认交接".to_string()));
    }

    if handover.confirm_time.is_none() {
        return Err(AppError::BusinessError("交接确认时间缺失".to_string()));
    }

    Ok(())
}

pub fn audit_form(
    pool: &DbPool,
    form_id: Uuid,
    operator: &auth::AuthUser,
    req: &AuditRequest,
) -> Result<InspectionForm, AppError> {
    let form = get_form_by_id(pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    if !matches!(form.status, FormStatus::PendingAudit) {
        return Err(AppError::BusinessError(format!(
            "当前状态「{}」不允许审核",
            form.status.display_name()
        )));
    }

    if !matches!(operator.role, Role::Auditor) {
        return Err(AppError::PermissionError("只有审核主管可以审核".to_string()));
    }

    validate_handover_before_audit(pool, form_id)?;

    let new_status = if req.pass {
        FormStatus::PendingReview
    } else {
        FormStatus::AuditRejected
    };

    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();

    if req.pass {
        conn.execute(
            r#"UPDATE inspection_forms 
               SET status = ?1, auditor_id = ?2, auditor_name = ?3, 
                   audit_opinion = ?4, audited_at = ?5, updated_at = ?5
               WHERE id = ?6"#,
            params![
                new_status.as_str(),
                operator.user_id.to_string(),
                operator.name.clone(),
                req.opinion,
                now,
                form_id.to_string(),
            ],
        )?;
    } else {
        conn.execute(
            r#"UPDATE inspection_forms 
               SET status = ?1, auditor_id = ?2, auditor_name = ?3, 
                   audit_opinion = ?4, audited_at = ?5, updated_at = ?5
               WHERE id = ?6"#,
            params![
                new_status.as_str(),
                operator.user_id.to_string(),
                operator.name.clone(),
                req.opinion,
                now,
                form_id.to_string(),
            ],
        )?;
    }

    let action = if req.pass { "audit_pass" } else { "audit_reject" };
    let action_display = if req.pass { "审核通过" } else { "审核退回" };
    add_operation_log(
        pool,
        Some(form_id),
        Some(&form.form_no),
        &operator.user_id,
        &operator.name,
        action,
        action_display,
        req.opinion.clone(),
    )?;

    drop(conn);
    get_form_by_id(pool, form_id).map(|opt| opt.unwrap())
}

pub fn review_form(
    pool: &DbPool,
    form_id: Uuid,
    operator: &auth::AuthUser,
    req: &ReviewRequest,
) -> Result<InspectionForm, AppError> {
    let form = get_form_by_id(pool, form_id)?
        .ok_or_else(|| AppError::NotFoundError("年检单不存在".to_string()))?;

    if !matches!(form.status, FormStatus::PendingReview) {
        return Err(AppError::BusinessError(format!(
            "当前状态「{}」不允许复核",
            form.status.display_name()
        )));
    }

    if !matches!(operator.role, Role::Reviewer) {
        return Err(AppError::PermissionError("只有复核负责人可以复核".to_string()));
    }

    validate_handover_before_audit(pool, form_id)?;

    let new_status = if req.pass {
        FormStatus::Archived
    } else {
        FormStatus::ReviewRejected
    };

    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();

    if req.pass {
        conn.execute(
            r#"UPDATE inspection_forms 
               SET status = ?1, reviewer_id = ?2, reviewer_name = ?3, 
                   review_opinion = ?4, reviewed_at = ?5, archived_at = ?5, updated_at = ?5
               WHERE id = ?6"#,
            params![
                new_status.as_str(),
                operator.user_id.to_string(),
                operator.name.clone(),
                req.opinion,
                now,
                form_id.to_string(),
            ],
        )?;
    } else {
        conn.execute(
            r#"UPDATE inspection_forms 
               SET status = ?1, reviewer_id = ?2, reviewer_name = ?3, 
                   review_opinion = ?4, reviewed_at = ?5, updated_at = ?5
               WHERE id = ?6"#,
            params![
                new_status.as_str(),
                operator.user_id.to_string(),
                operator.name.clone(),
                req.opinion,
                now,
                form_id.to_string(),
            ],
        )?;
    }

    let action = if req.pass { "review_pass" } else { "review_reject" };
    let action_display = if req.pass { "复核通过归档" } else { "复核退回" };
    add_operation_log(
        pool,
        Some(form_id),
        Some(&form.form_no),
        &operator.user_id,
        &operator.name,
        action,
        action_display,
        req.opinion.clone(),
    )?;

    drop(conn);
    get_form_by_id(pool, form_id).map(|opt| opt.unwrap())
}

pub fn add_operation_log(
    pool: &DbPool,
    form_id: Option<Uuid>,
    form_no: Option<&str>,
    operator_id: &Uuid,
    operator_name: &str,
    action: &str,
    action_display: &str,
    detail: Option<String>,
) -> Result<(), AppError> {
    let id = Uuid::new_v4();
    let now = Utc::now().to_rfc3339();
    let conn = get_conn(pool)?;

    conn.execute(
        r#"INSERT INTO operation_logs 
           (id, form_id, form_no, operator_id, operator_name, action, action_display, detail, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"#,
        params![
            id.to_string(),
            form_id.map(|u| u.to_string()),
            form_no,
            operator_id.to_string(),
            operator_name,
            action,
            action_display,
            detail,
            now,
        ],
    )?;

    Ok(())
}

pub fn list_operation_logs(
    pool: &DbPool,
    form_id_filter: Option<Uuid>,
    page: i64,
    page_size: i64,
) -> Result<ListResponse<OperationLog>, AppError> {
    let conn = get_conn(pool)?;
    let offset = (page - 1) * page_size;
    let fid_str = form_id_filter.map(|f| f.to_string());

    let total: i64 = if let Some(ref fid) = fid_str {
        conn.query_row(
            "SELECT COUNT(*) FROM operation_logs WHERE form_id = ?1",
            params![fid],
            |row| row.get(0),
        )?
    } else {
        conn.query_row("SELECT COUNT(*) FROM operation_logs", [], |row| row.get(0))?
    };

    let list_sql_with_limit = if fid_str.is_some() {
        r#"SELECT id, form_id, form_no, operator_id, operator_name, action, action_display, detail, created_at
           FROM operation_logs WHERE form_id = ?1
           ORDER BY created_at DESC LIMIT ? OFFSET ?"#.to_string()
    } else {
        r#"SELECT id, form_id, form_no, operator_id, operator_name, action, action_display, detail, created_at
           FROM operation_logs
           ORDER BY created_at DESC LIMIT ? OFFSET ?"#.to_string()
    };

    let mut stmt = conn.prepare(&list_sql_with_limit)?;

    let mut rows = if let Some(ref fid) = fid_str {
        stmt.query(params![fid, page_size, offset])?
    } else {
        stmt.query(params![page_size, offset])?
    };

    let mut items = Vec::new();
    while let Some(row) = rows.next()? {
        items.push(row_to_log(row)?);
    }

    Ok(ListResponse {
        items,
        total,
        page,
        page_size,
    })
}

fn row_to_log(row: &rusqlite::Row) -> Result<OperationLog, AppError> {
    let id_str: String = row.get(0)?;
    Ok(OperationLog {
        id: Uuid::parse_str(&id_str).unwrap(),
        form_id: row.get::<_, Option<String>>(1)?.and_then(|s| Uuid::parse_str(&s).ok()),
        form_no: row.get(2)?,
        operator_id: Uuid::parse_str(&row.get::<_, String>(3)?).unwrap(),
        operator_name: row.get(4)?,
        action: row.get(5)?,
        action_display: row.get(6)?,
        detail: row.get(7)?,
        created_at: parse_datetime(&row.get::<_, String>(8)?),
    })
}

pub fn get_stats(pool: &DbPool, user_role: &Role, user_id: Uuid) -> Result<StatsResponse, AppError> {
    let conn = get_conn(pool)?;

    let statuses = vec![
        "draft", "pending_audit", "audit_rejected",
        "pending_review", "review_rejected", "archived",
    ];

    let mut counts = std::collections::HashMap::new();

    for status in &statuses {
        let count: i64 = match user_role {
            Role::Registrar => {
                conn.query_row(
                    "SELECT COUNT(*) FROM inspection_forms WHERE status = ?1 AND registrant_id = ?2",
                    params![status, user_id.to_string()],
                    |row| row.get(0),
                )?
            }
            Role::Auditor => {
                if *status == "pending_audit" || *status == "audit_rejected" {
                    conn.query_row(
                        "SELECT COUNT(*) FROM inspection_forms WHERE status = ?1",
                        params![status],
                        |row| row.get(0),
                    )?
                } else {
                    0
                }
            }
            Role::Reviewer => {
                if *status == "pending_review" || *status == "review_rejected" || *status == "archived" {
                    conn.query_row(
                        "SELECT COUNT(*) FROM inspection_forms WHERE status = ?1",
                        params![status],
                        |row| row.get(0),
                    )?
                } else {
                    0
                }
            }
        };
        counts.insert(status.to_string(), count);
    }

    let total: i64 = match user_role {
        Role::Registrar => {
            conn.query_row(
                "SELECT COUNT(*) FROM inspection_forms WHERE registrant_id = ?1",
                params![user_id.to_string()],
                |row| row.get(0),
            )?
        }
        Role::Auditor => {
            conn.query_row(
                "SELECT COUNT(*) FROM inspection_forms WHERE status IN ('pending_audit', 'audit_rejected')",
                [],
                |row| row.get(0),
            )?
        }
        Role::Reviewer => {
            conn.query_row(
                "SELECT COUNT(*) FROM inspection_forms WHERE status IN ('pending_review', 'review_rejected', 'archived')",
                [],
                |row| row.get(0),
            )?
        }
    };

    let registrar_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'registrar'",
        [],
        |row| row.get(0),
    )?;
    let auditor_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'auditor'",
        [],
        |row| row.get(0),
    )?;
    let reviewer_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM users WHERE role = 'reviewer'",
        [],
        |row| row.get(0),
    )?;

    let mut monthly_stats = Vec::new();
    let mut stmt = conn.prepare(
        r#"SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as cnt
           FROM inspection_forms
           GROUP BY month
           ORDER BY month DESC
           LIMIT 12"#
    )?;

    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        monthly_stats.push(MonthlyStats {
            month: row.get(0)?,
            count: row.get(1)?,
        });
    }

    Ok(StatsResponse {
        total,
        draft: counts.get("draft").copied().unwrap_or(0),
        pending_audit: counts.get("pending_audit").copied().unwrap_or(0),
        audit_rejected: counts.get("audit_rejected").copied().unwrap_or(0),
        pending_review: counts.get("pending_review").copied().unwrap_or(0),
        review_rejected: counts.get("review_rejected").copied().unwrap_or(0),
        archived: counts.get("archived").copied().unwrap_or(0),
        by_role: StatsByRole {
            registrar_count,
            auditor_count,
            reviewer_count,
        },
        by_month: monthly_stats,
    })
}

pub fn list_corporate_info(pool: &DbPool) -> Result<Vec<CorporateInfo>, AppError> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        r#"SELECT id, company_name, credit_code, legal_representative, 
           register_date, business_scope, created_at, updated_at
           FROM corporate_info ORDER BY created_at DESC"#
    )?;

    let mut rows = stmt.query([])?;
    let mut items = Vec::new();
    while let Some(row) = rows.next()? {
        items.push(CorporateInfo {
            id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
            company_name: row.get(1)?,
            credit_code: row.get(2)?,
            legal_representative: row.get(3)?,
            register_date: parse_datetime(&row.get::<_, String>(4)?),
            business_scope: row.get(5)?,
            created_at: parse_datetime(&row.get::<_, String>(6)?),
            updated_at: parse_datetime(&row.get::<_, String>(7)?),
        });
    }
    Ok(items)
}

pub fn list_reminders(pool: &DbPool, is_sent_filter: Option<bool>) -> Result<Vec<AnnualReminder>, AppError> {
    let conn = get_conn(pool)?;
    let sql = match is_sent_filter {
        Some(_) => r#"SELECT id, corporate_id, year, due_date, is_sent, created_at
                      FROM annual_reminders WHERE is_sent = ?1 ORDER BY due_date"#,
        None => r#"SELECT id, corporate_id, year, due_date, is_sent, created_at
                   FROM annual_reminders ORDER BY due_date"#,
    };
    let mut stmt = conn.prepare(sql)?;

    let is_sent_val = is_sent_filter.map(|s| if s { 1 } else { 0 });

    let mut rows = if let Some(ref v) = is_sent_val {
        stmt.query(params![v])?
    } else {
        stmt.query([])?
    };

    let mut items = Vec::new();
    while let Some(row) = rows.next()? {
        items.push(AnnualReminder {
            id: Uuid::parse_str(&row.get::<_, String>(0)?).unwrap(),
            corporate_id: Uuid::parse_str(&row.get::<_, String>(1)?).unwrap(),
            year: row.get(2)?,
            due_date: parse_datetime(&row.get::<_, String>(3)?),
            is_sent: row.get::<_, i64>(4)? != 0,
            created_at: parse_datetime(&row.get::<_, String>(5)?),
        });
    }
    Ok(items)
}
