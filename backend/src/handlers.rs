use crate::auth::AuthUser;
use crate::db::DbPool;
use crate::models::*;
use chrono::{DateTime, NaiveDate, Utc};
use rocket::serde::json::Json;
use rocket::State;
use rusqlite::{params, Connection, OptionalExtension, Row};
#[allow(unused_imports)]
use uuid::Uuid;

fn get_user_by_username(pool: &DbPool, username: &str) -> Option<User> {
    let conn = pool.get().ok()?;
    let mut stmt = conn
        .prepare(
            "SELECT u.id, u.username, u.password_hash, u.real_name, u.role_id,
                    r.role_code, r.role_name, u.status, u.created_at
             FROM users u LEFT JOIN roles r ON u.role_id = r.id
             WHERE u.username = ?1 AND u.status = 1",
        )
        .ok()?;
    stmt.query_row(params![username], |row| map_user(row))
        .optional()
        .ok()?
}

fn map_user(row: &Row) -> rusqlite::Result<User> {
    Ok(User {
        id: row.get(0)?,
        username: row.get(1)?,
        password_hash: row.get(2)?,
        real_name: row.get(3)?,
        role_id: row.get(4)?,
        role_code: row.get(5).ok(),
        role_name: row.get(6).ok(),
        status: row.get(7)?,
        created_at: row.get::<_, String>(8).ok().and_then(|s| parse_dt(&s)),
    })
}

fn map_ar(row: &Row) -> rusqlite::Result<AccountsReceivable> {
    let status: String = row.get(8)?;
    Ok(AccountsReceivable {
        id: row.get(0)?,
        ar_no: row.get(1)?,
        buyer_name: row.get(2)?,
        supplier_name: row.get(3)?,
        amount: row.get(4)?,
        invoice_no: row.get(5).ok(),
        invoice_date: row.get::<_, String>(6).ok().and_then(|s| parse_date(&s)),
        due_date: row.get::<_, String>(7).ok().and_then(|s| parse_date(&s)),
        status: status.clone(),
        status_name: Some(status_to_name(&status).to_string()),
        remark: row.get(9).ok(),
        created_by: row.get(10).ok(),
        created_at: row.get::<_, String>(11).ok().and_then(|s| parse_dt(&s)),
        updated_at: row.get::<_, String>(12).ok().and_then(|s| parse_dt(&s)),
        confirmation_count: row.get(13).ok(),
        verified_amount: row.get(14).ok(),
    })
}

fn map_order(row: &Row) -> rusqlite::Result<ConfirmationOrder> {
    let status: String = row.get(8)?;
    let role_code: Option<String> = row.get(22).ok().flatten();
    let rc = role_code.as_deref().unwrap_or("registrar");

    Ok(ConfirmationOrder {
        id: row.get(0)?,
        order_no: row.get(1)?,
        ar_id: row.get(2)?,
        ar_no: row.get(3)?,
        buyer_name: row.get(4)?,
        supplier_name: row.get(5)?,
        amount: row.get(6)?,
        confirm_amount: row.get(7).ok(),
        status: status.clone(),
        status_name: Some(status_to_name(&status).to_string()),
        current_handler_role: row.get(9).ok(),
        current_handler_name: row.get(25).ok(),
        reject_reason: row.get(10).ok(),
        advance_reason: row.get(11).ok(),
        shift: row.get(12).ok(),
        handover_from: row.get(13).ok(),
        handover_from_name: row.get(26).ok(),
        handover_to: row.get(14).ok(),
        handover_to_name: row.get(27).ok(),
        handover_time: row.get::<_, String>(15).ok().and_then(|s| parse_dt(&s)),
        created_by: row.get(16).ok(),
        created_by_name: row.get(24).ok(),
        created_at: row.get::<_, String>(17).ok().and_then(|s| parse_dt(&s)),
        updated_at: row.get::<_, String>(18).ok().and_then(|s| parse_dt(&s)),
        verification_count: row.get(19).ok(),
        verified_amount: row.get(20).ok(),
        allowed_actions: Some(get_role_actions(rc, &status)),
        visible_fields: Some(get_role_visible_fields(rc)),
    })
}

fn map_verification(row: &Row) -> rusqlite::Result<PaymentVerification> {
    Ok(PaymentVerification {
        id: row.get(0)?,
        verify_no: row.get(1)?,
        order_id: row.get(2)?,
        order_no: row.get(3)?,
        payment_amount: row.get(4)?,
        payment_date: row
            .get::<_, String>(5)
            .ok()
            .and_then(|s| parse_date(&s))
            .unwrap_or(NaiveDate::from_ymd_opt(2025, 1, 1).unwrap()),
        payer_name: row.get(6).ok(),
        bank_slip_no: row.get(7).ok(),
        remark: row.get(8).ok(),
        status: row.get(9)?,
        status_name: Some(status_to_name(&row.get::<_, String>(9)?).to_string()),
        created_by: row.get(10).ok(),
        created_by_name: row.get(12).ok(),
        created_at: row.get::<_, String>(11).ok().and_then(|s| parse_dt(&s)),
    })
}

fn map_log(row: &Row) -> rusqlite::Result<OperationLog> {
    Ok(OperationLog {
        id: row.get(0)?,
        user_id: row.get(1).ok(),
        user_name: row.get(2).ok(),
        action: row.get(3)?,
        target_type: row.get(4)?,
        target_id: row.get(5).ok(),
        target_no: row.get(6).ok(),
        from_status: row.get(7).ok(),
        to_status: row.get(8).ok(),
        remark: row.get(9).ok(),
        ip_address: row.get(10).ok(),
        created_at: row.get::<_, String>(11).ok().and_then(|s| parse_dt(&s)),
    })
}

fn parse_dt(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_str(
        &format!("{} +0000", s.replace("T", " ").split('.').next().unwrap_or(s)),
        "%Y-%m-%d %H:%M:%S %z",
    )
    .ok()
    .map(|d| d.with_timezone(&Utc))
}

fn parse_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.split('T').next().unwrap_or(s), "%Y-%m-%d").ok()
}

fn gen_ar_no(conn: &Connection) -> String {
    let dt = Utc::now().format("%Y%m").to_string();
    let seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(ar_no, 11) AS INTEGER)), 0) FROM accounts_receivable WHERE ar_no LIKE ?1",
            params![format!("AR{}%", dt)],
            |row| row.get(0),
        )
        .unwrap_or(0)
        + 1;
    format!("AR{}{:04}", dt, seq)
}

fn gen_order_no(conn: &Connection) -> String {
    let dt = Utc::now().format("%Y%m").to_string();
    let seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(order_no, 11) AS INTEGER)), 0) FROM confirmation_orders WHERE order_no LIKE ?1",
            params![format!("CO{}%", dt)],
            |row| row.get(0),
        )
        .unwrap_or(0)
        + 1;
    format!("CO{}{:04}", dt, seq)
}

fn gen_verify_no(conn: &Connection) -> String {
    let dt = Utc::now().format("%Y%m").to_string();
    let seq: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(CAST(SUBSTR(verify_no, 11) AS INTEGER)), 0) FROM payment_verifications WHERE verify_no LIKE ?1",
            params![format!("PV{}%", dt)],
            |row| row.get(0),
        )
        .unwrap_or(0)
        + 1;
    format!("PV{}{:04}", dt, seq)
}

fn insert_log(
    conn: &Connection,
    user_id: i64,
    user_name: &str,
    action: &str,
    target_type: &str,
    target_id: i64,
    target_no: &str,
    from_status: Option<&str>,
    to_status: Option<&str>,
    remark: Option<&str>,
) {
    let _ = conn.execute(
        "INSERT INTO operation_logs (user_id, user_name, action, target_type, target_id, target_no, from_status, to_status, remark, ip_address)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            user_id,
            user_name,
            action,
            target_type,
            target_id,
            target_no,
            from_status,
            to_status,
            remark,
            "127.0.0.1"
        ],
    );
}

fn sync_ar_status(conn: &Connection, ar_id: i64) {
    let _ = conn.execute(
        "UPDATE accounts_receivable SET status = CASE
            WHEN (SELECT COUNT(*) FROM confirmation_orders WHERE ar_id = ?1 AND status = 'archived') > 0 THEN 'confirmed'
            ELSE 'pending'
        END, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![ar_id],
    );
}

fn sync_verified_amounts(conn: &Connection, order_id: i64) {
    let _ = conn.execute(
        "UPDATE confirmation_orders SET
            verified_amount = (SELECT COALESCE(SUM(payment_amount), 0) FROM payment_verifications WHERE order_id = ?1),
            verification_count = (SELECT COUNT(*) FROM payment_verifications WHERE order_id = ?1),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = ?1",
        params![order_id],
    );
    let _ = conn.execute(
        "UPDATE accounts_receivable SET
            verified_amount = (SELECT COALESCE(SUM(pv.payment_amount), 0)
                              FROM payment_verifications pv
                              JOIN confirmation_orders co ON pv.order_id = co.id
                              WHERE co.ar_id = accounts_receivable.id),
            updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT ar_id FROM confirmation_orders WHERE id = ?1)",
        params![order_id],
    );
}

fn validate_handover(
    shift: &str,
    handover_from: Option<i64>,
    handover_to: Option<i64>,
) -> Result<(), String> {
    if shift.trim().is_empty() {
        return Err("班次不能为空".to_string());
    }
    if handover_from.is_none() || handover_from.unwrap() <= 0 {
        return Err("交出人不能为空".to_string());
    }
    if handover_to.is_none() || handover_to.unwrap() <= 0 {
        return Err("接收人不能为空".to_string());
    }
    Ok(())
}

#[post("/login", data = "<req>")]
pub fn login(
    req: Json<LoginRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<LoginResponse>> {
    let user = match get_user_by_username(pool, &req.username) {
        Some(u) => u,
        None => return Json(ApiResponse::error(1001, "用户名或密码错误")),
    };

    let valid = bcrypt::verify(&req.password, &user.password_hash).unwrap_or(false);
    if !valid {
        return Json(ApiResponse::error(1001, "用户名或密码错误"));
    }

    let token = match crate::auth::create_token(
        user.id,
        &user.username,
        user.role_code.as_deref().unwrap_or(""),
        user.role_id,
        &user.real_name,
    ) {
        Ok(t) => t,
        Err(e) => return Json(ApiResponse::error(1002, &format!("登录失败: {}", e))),
    };

    Json(ApiResponse::success(LoginResponse { token, user }))
}

#[get("/me")]
pub fn current_user(auth: AuthUser, pool: &State<DbPool>) -> Json<ApiResponse<User>> {
    let user = match get_user_by_username(pool, &auth.username) {
        Some(u) => u,
        None => return Json(ApiResponse::error(404, "用户不存在")),
    };
    Json(ApiResponse::success(user))
}

#[get("/users")]
pub fn get_users(_auth: AuthUser, pool: &State<DbPool>) -> Json<ApiResponse<Vec<User>>> {
    let conn = pool.get().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT u.id, u.username, u.password_hash, u.real_name, u.role_id,
                    r.role_code, r.role_name, u.status, u.created_at
             FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.status = 1 ORDER BY u.id",
        )
        .unwrap();
    let rows = stmt.query_map([], map_user).unwrap();
    let users: Vec<User> = rows.filter_map(|r| r.ok()).collect();
    Json(ApiResponse::success(users))
}

#[get("/ar?<page>&<page_size>&<status>&<keyword>")]
pub fn list_ar(
    _auth: AuthUser,
    page: Option<i64>,
    page_size: Option<i64>,
    status: Option<String>,
    keyword: Option<String>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<PaginatedResponse<AccountsReceivable>>> {
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(20);
    let offset = (p - 1) * ps;

    let conn = pool.get().unwrap();
    let mut where_clauses: Vec<String> = vec![];
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(s) = &status {
        if !s.is_empty() {
            where_clauses.push("a.status = ?".to_string());
            args.push(Box::new(s.clone()));
        }
    }
    if let Some(k) = &keyword {
        if !k.is_empty() {
            where_clauses.push("(a.ar_no LIKE ? OR a.buyer_name LIKE ? OR a.supplier_name LIKE ?)".to_string());
            let like = format!("%{}%", k);
            args.push(Box::new(like.clone()));
            args.push(Box::new(like.clone()));
            args.push(Box::new(like));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM accounts_receivable a {}",
        where_sql
    );
    let original_len = args.len();
    let args_refs: Vec<&dyn rusqlite::ToSql> = args[..original_len].iter().map(|a| a.as_ref()).collect();
    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(args_refs.iter().copied()), |r| r.get(0))
        .unwrap_or(0);

    let sql = format!(
        "SELECT a.id, a.ar_no, a.buyer_name, a.supplier_name, a.amount, a.invoice_no, a.invoice_date, a.due_date,
                a.status, a.remark, a.created_by, a.created_at, a.updated_at,
                (SELECT COUNT(*) FROM confirmation_orders co WHERE co.ar_id = a.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv
                 JOIN confirmation_orders co2 ON pv.order_id = co2.id WHERE co2.ar_id = a.id)
         FROM accounts_receivable a {} ORDER BY a.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    args.push(Box::new(ps));
    args.push(Box::new(offset));
    let mut stmt = conn.prepare(&sql).unwrap();
    let args_refs2: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(args_refs2.iter().copied()), map_ar)
        .unwrap();
    let items: Vec<AccountsReceivable> = rows.filter_map(|r| r.ok()).collect();

    Json(ApiResponse::success(PaginatedResponse {
        items,
        total,
        page: p,
        page_size: ps,
    }))
}

#[get("/ar/<id>")]
pub fn get_ar(
    _auth: AuthUser,
    id: i64,
    pool: &State<DbPool>,
) -> Json<ApiResponse<AccountsReceivable>> {
    let conn = pool.get().unwrap();
    let sql = "SELECT a.id, a.ar_no, a.buyer_name, a.supplier_name, a.amount, a.invoice_no, a.invoice_date, a.due_date,
                      a.status, a.remark, a.created_by, a.created_at, a.updated_at,
                      (SELECT COUNT(*) FROM confirmation_orders co WHERE co.ar_id = a.id),
                      (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv
                       JOIN confirmation_orders co2 ON pv.order_id = co2.id WHERE co2.ar_id = a.id)
               FROM accounts_receivable a WHERE a.id = ?1";
    let ar = conn.query_row(sql, params![id], map_ar).optional();

    match ar {
        Ok(Some(a)) => Json(ApiResponse::success(a)),
        _ => Json(ApiResponse::error(404, "应收账款不存在")),
    }
}

#[post("/ar", data = "<req>")]
pub fn create_ar(
    auth: AuthUser,
    req: Json<CreateArRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<AccountsReceivable>> {
    if auth.role_code != "registrar" {
        return Json(ApiResponse::error(403, "仅登记员可创建应收账款"));
    }
    if req.amount <= 0.0 {
        return Json(ApiResponse::error(400, "金额必须大于0"));
    }
    if req.buyer_name.trim().is_empty() || req.supplier_name.trim().is_empty() {
        return Json(ApiResponse::error(400, "买方和卖方名称不能为空"));
    }

    let conn = pool.get().unwrap();
    let ar_no = gen_ar_no(&conn);

    match conn.execute(
        "INSERT INTO accounts_receivable (ar_no, buyer_name, supplier_name, amount, invoice_no, invoice_date, due_date, status, remark, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending', ?8, ?9)",
        params![
            ar_no,
            req.buyer_name.trim(),
            req.supplier_name.trim(),
            req.amount,
            req.invoice_no,
            req.invoice_date.map(|d| d.to_string()),
            req.due_date.map(|d| d.to_string()),
            req.remark,
            auth.user_id
        ],
    ) {
        Ok(_) => {
            let id = conn.last_insert_rowid();
            insert_log(&conn, auth.user_id, &auth.real_name, "创建", "accounts_receivable", id, &ar_no, None, Some("pending"), None);
            let ar = conn.query_row(
                "SELECT a.id, a.ar_no, a.buyer_name, a.supplier_name, a.amount, a.invoice_no, a.invoice_date, a.due_date,
                        a.status, a.remark, a.created_by, a.created_at, a.updated_at, 0, 0
                 FROM accounts_receivable a WHERE a.id = ?1",
                params![id],
                map_ar,
            ).unwrap();
            Json(ApiResponse::success(ar))
        }
        Err(e) => Json(ApiResponse::error(500, &format!("创建失败: {}", e))),
    }
}

#[put("/ar/<id>", data = "<req>")]
pub fn update_ar(
    auth: AuthUser,
    id: i64,
    req: Json<UpdateArRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<AccountsReceivable>> {
    if auth.role_code != "registrar" {
        return Json(ApiResponse::error(403, "仅登记员可修改应收账款"));
    }

    let conn = pool.get().unwrap();

    let exists: bool = conn
        .query_row("SELECT EXISTS(SELECT 1 FROM accounts_receivable WHERE id = ?1)", params![id], |r| r.get(0))
        .unwrap_or(false);
    if !exists {
        return Json(ApiResponse::error(404, "应收账款不存在"));
    }

    let _ = conn.execute(
        "UPDATE accounts_receivable SET
            buyer_name = COALESCE(?1, buyer_name),
            supplier_name = COALESCE(?2, supplier_name),
            amount = COALESCE(?3, amount),
            invoice_no = COALESCE(?4, invoice_no),
            invoice_date = COALESCE(?5, invoice_date),
            due_date = COALESCE(?6, due_date),
            status = COALESCE(?7, status),
            remark = COALESCE(?8, remark),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?9",
        params![
            req.buyer_name.clone(),
            req.supplier_name.clone(),
            req.amount,
            req.invoice_no.clone(),
            req.invoice_date.map(|d| d.to_string()),
            req.due_date.map(|d| d.to_string()),
            req.status.clone(),
            req.remark.clone(),
            id
        ],
    );

    let ar_no: String = conn
        .query_row("SELECT ar_no FROM accounts_receivable WHERE id = ?1", params![id], |r| r.get(0))
        .unwrap_or_default();
    insert_log(&conn, auth.user_id, &auth.real_name, "更新", "accounts_receivable", id, &ar_no, None, req.status.as_deref(), None);

    let ar = conn.query_row(
        "SELECT a.id, a.ar_no, a.buyer_name, a.supplier_name, a.amount, a.invoice_no, a.invoice_date, a.due_date,
                a.status, a.remark, a.created_by, a.created_at, a.updated_at,
                (SELECT COUNT(*) FROM confirmation_orders co WHERE co.ar_id = a.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv
                 JOIN confirmation_orders co2 ON pv.order_id = co2.id WHERE co2.ar_id = a.id)
         FROM accounts_receivable a WHERE a.id = ?1",
        params![id],
        map_ar,
    ).unwrap();
    Json(ApiResponse::success(ar))
}

#[get("/orders?<page>&<page_size>&<status>&<keyword>&<ar_id>")]
pub fn list_orders(
    auth: AuthUser,
    page: Option<i64>,
    page_size: Option<i64>,
    status: Option<String>,
    keyword: Option<String>,
    ar_id: Option<i64>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<PaginatedResponse<ConfirmationOrder>>> {
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(20);
    let offset = (p - 1) * ps;

    let conn = pool.get().unwrap();
    let mut where_clauses: Vec<String> = vec![];
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    let rc = auth.role_code.clone();

    if rc == "auditor" {
        where_clauses.push("co.current_handler_role = ?".to_string());
        args.push(Box::new("auditor".to_string()));
    } else if rc == "reviewer" {
        where_clauses.push("co.current_handler_role = ?".to_string());
        args.push(Box::new("reviewer".to_string()));
    }

    if let Some(s) = &status {
        if !s.is_empty() {
            where_clauses.push("co.status = ?".to_string());
            args.push(Box::new(s.clone()));
        }
    }
    if let Some(aid) = ar_id {
        where_clauses.push("co.ar_id = ?".to_string());
        args.push(Box::new(aid));
    }
    if let Some(k) = &keyword {
        if !k.is_empty() {
            where_clauses.push("(co.order_no LIKE ? OR co.ar_no LIKE ? OR co.buyer_name LIKE ? OR co.supplier_name LIKE ?)".to_string());
            let like = format!("%{}%", k);
            args.push(Box::new(like.clone()));
            args.push(Box::new(like.clone()));
            args.push(Box::new(like.clone()));
            args.push(Box::new(like));
        }
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM confirmation_orders co {}", where_sql);
    let original_len = args.len();
    let args_refs: Vec<&dyn rusqlite::ToSql> = args[..original_len].iter().map(|a| a.as_ref()).collect();
    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(args_refs.iter().copied()), |r| r.get(0))
        .unwrap_or(0);

    let sql = format!(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         {} ORDER BY co.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    args.push(Box::new(rc.clone()));
    args.push(Box::new(ps));
    args.push(Box::new(offset));
    let mut stmt = conn.prepare(&sql).unwrap();
    let args_refs2: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(args_refs2.iter().copied()), map_order)
        .unwrap();
    let items: Vec<ConfirmationOrder> = rows.filter_map(|r| r.ok()).collect();

    Json(ApiResponse::success(PaginatedResponse {
        items,
        total,
        page: p,
        page_size: ps,
    }))
}

#[get("/orders/<id>")]
pub fn get_order(
    auth: AuthUser,
    id: i64,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    let conn = pool.get().unwrap();
    let rc = auth.role_code.clone();

    let sql = "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                      co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                      co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                      (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                      (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                      u1.id, ?2, u1.real_name,
                      u_creator.real_name, u_handler.real_name,
                      u_from.real_name, u_to.real_name
               FROM confirmation_orders co
               LEFT JOIN users u_creator ON co.created_by = u_creator.id
               LEFT JOIN users u_handler ON CASE
                  WHEN co.current_handler_role = 'registrar' THEN 1
                  WHEN co.current_handler_role = 'auditor' THEN 2
                  WHEN co.current_handler_role = 'reviewer' THEN 3
               END = u_handler.id
               LEFT JOIN users u1 ON co.created_by = u1.id
               LEFT JOIN users u_from ON co.handover_from = u_from.id
               LEFT JOIN users u_to ON co.handover_to = u_to.id
               WHERE co.id = ?1";
    let order = conn.query_row(sql, params![id, rc], map_order).optional();

    match order {
        Ok(Some(o)) => Json(ApiResponse::success(o)),
        _ => Json(ApiResponse::error(404, "应收确权单不存在")),
    }
}

#[post("/orders", data = "<req>")]
pub fn create_order(
    auth: AuthUser,
    req: Json<CreateOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "registrar" {
        return Json(ApiResponse::error(403, "仅登记员可创建确权单"));
    }

    let conn = pool.get().unwrap();

    let ar_result = conn
        .query_row(
            "SELECT ar_no, buyer_name, supplier_name, amount FROM accounts_receivable WHERE id = ?1",
            params![req.ar_id],
            |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, f64>(3)?,
                ))
            },
        )
        .optional();

    let (ar_no, buyer_name, supplier_name, ar_amount) = match ar_result {
        Ok(Some(a)) => a,
        _ => return Json(ApiResponse::error(404, "关联的应收账款不存在")),
    };

    let has_pending: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM confirmation_orders WHERE ar_id = ?1 AND status IN ('draft', 'pending_audit', 'pending_review', 'returned'))",
            params![req.ar_id],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if has_pending {
        return Json(ApiResponse::error(400, "该应收账款已有进行中的确权单，请先处理"));
    }

    let order_no = gen_order_no(&conn);
    let c_amt = req.confirm_amount.unwrap_or(ar_amount);
    if c_amt > ar_amount {
        return Json(ApiResponse::error(400, "确权金额不能超过应收账款金额"));
    }

    match conn.execute(
        "INSERT INTO confirmation_orders (order_no, ar_id, ar_no, buyer_name, supplier_name, amount, confirm_amount, status, current_handler_role, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'draft', 'registrar', ?8)",
        params![
            order_no,
            req.ar_id,
            ar_no,
            buyer_name,
            supplier_name,
            ar_amount,
            c_amt,
            auth.user_id
        ],
    ) {
        Ok(_) => {
            let id = conn.last_insert_rowid();
            insert_log(&conn, auth.user_id, &auth.real_name, "创建", "confirmation_order", id, &order_no, None, Some("draft"), req.remark.as_deref());
            let order = conn.query_row(
                "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                        co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                        co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                        0, 0,
                        u1.id, 'registrar', u1.real_name,
                        u_creator.real_name, '应收确权登记员',
                        u_from.real_name, u_to.real_name
                 FROM confirmation_orders co
                 LEFT JOIN users u_creator ON co.created_by = u_creator.id
                 LEFT JOIN users u1 ON co.created_by = u1.id
                 LEFT JOIN users u_from ON co.handover_from = u_from.id
                 LEFT JOIN users u_to ON co.handover_to = u_to.id
                 WHERE co.id = ?1",
                params![id],
                map_order,
            ).unwrap();
            Json(ApiResponse::success(order))
        }
        Err(e) => Json(ApiResponse::error(500, &format!("创建失败: {}", e))),
    }
}

#[post("/orders/submit", data = "<req>")]
pub fn submit_order(
    auth: AuthUser,
    req: Json<SubmitOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "registrar" {
        return Json(ApiResponse::error(403, "仅登记员可提交确权单"));
    }

    if let Err(e) = validate_handover(&req.shift, Some(req.handover_from), Some(req.handover_to)) {
        return Json(ApiResponse::error(400, &format!("交接信息不完整: {}", e)));
    }
    if req.advance_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明推进原因"));
    }

    let conn = pool.get().unwrap();
    let tx = conn.unchecked_transaction().unwrap();

    let result: Option<(String, String, i64)> = tx
        .query_row(
            "SELECT order_no, status, ar_id FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?)),
        )
        .optional()
        .unwrap();

    let (order_no, status, ar_id) = match result {
        Some(r) => r,
        None => {
            tx.rollback().ok();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if status != "draft" && status != "returned" {
        tx.rollback().ok();
        return Json(ApiResponse::error(
            400,
            &format!("当前状态为「{}」，不可提交", status_to_name(&status)),
        ));
    }

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let from = status.as_str();
    let to = "pending_audit";

    if let Err(e) = tx.execute(
        "UPDATE confirmation_orders SET status = ?1, current_handler_role = 'auditor', advance_reason = ?2,
                shift = ?3, handover_from = ?4, handover_to = ?5, handover_time = ?6, reject_reason = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?7",
        params![to, req.advance_reason.trim(), req.shift.trim(), req.handover_from, req.handover_to, now, req.order_id],
    ) {
        tx.rollback().ok();
        return Json(ApiResponse::error(500, &format!("提交失败: {}", e)));
    }

    sync_ar_status(&tx, ar_id);

    insert_log(&tx, auth.user_id, &auth.real_name, "提交", "confirmation_order", req.order_id, &order_no, Some(from), Some(to), Some(&req.advance_reason));

    tx.commit().ok();

    let rc = auth.role_code.clone();
    let order = conn.query_row(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?2, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         WHERE co.id = ?1",
        params![req.order_id, rc],
        map_order,
    ).unwrap();

    Json(ApiResponse::success(order))
}

#[post("/orders/approve", data = "<req>")]
pub fn approve_order(
    auth: AuthUser,
    req: Json<ApproveOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "auditor" {
        return Json(ApiResponse::error(403, "仅审核主管可审核"));
    }

    if let Err(e) = validate_handover(&req.shift, Some(req.handover_from), Some(req.handover_to)) {
        return Json(ApiResponse::error(400, &format!("交接信息不完整: {}", e)));
    }
    if req.advance_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明审核通过原因"));
    }

    let conn = pool.get().unwrap();
    let tx = conn.unchecked_transaction().unwrap();

    let result: Option<(String, String, f64, i64)> = tx
        .query_row(
            "SELECT order_no, status, amount, ar_id FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, f64>(2)?, r.get::<_, i64>(3)?)),
        )
        .optional()
        .unwrap();

    let (order_no, status, ar_amount, ar_id) = match result {
        Some(r) => r,
        None => {
            tx.rollback().ok();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if status != "pending_audit" {
        tx.rollback().ok();
        return Json(ApiResponse::error(
            400,
            &format!("当前状态为「{}」，审核仅可在待审核状态操作", status_to_name(&status)),
        ));
    }

    let c_amt = req.confirm_amount.unwrap_or(ar_amount);
    if c_amt > ar_amount {
        tx.rollback().ok();
        return Json(ApiResponse::error(400, "确权金额不能超过应收账款金额"));
    }
    if c_amt <= 0.0 {
        tx.rollback().ok();
        return Json(ApiResponse::error(400, "确权金额必须大于0"));
    }

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let from = status.as_str();
    let to = "pending_review";

    if let Err(e) = tx.execute(
        "UPDATE confirmation_orders SET status = ?1, current_handler_role = 'reviewer', confirm_amount = ?2,
                advance_reason = ?3, shift = ?4, handover_from = ?5, handover_to = ?6, handover_time = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
        params![to, c_amt, req.advance_reason.trim(), req.shift.trim(), req.handover_from, req.handover_to, now, req.order_id],
    ) {
        tx.rollback().ok();
        return Json(ApiResponse::error(500, &format!("审核失败: {}", e)));
    }

    sync_ar_status(&tx, ar_id);

    insert_log(&tx, auth.user_id, &auth.real_name, "审核通过", "confirmation_order", req.order_id, &order_no, Some(from), Some(to), Some(&req.advance_reason));

    tx.commit().ok();

    let rc = auth.role_code.clone();
    let order = conn.query_row(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?2, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         WHERE co.id = ?1",
        params![req.order_id, rc],
        map_order,
    ).unwrap();

    Json(ApiResponse::success(order))
}

#[post("/orders/reject", data = "<req>")]
pub fn reject_order(
    auth: AuthUser,
    req: Json<RejectOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "auditor" && auth.role_code != "reviewer" {
        return Json(ApiResponse::error(403, "仅审核或复核人员可退回"));
    }
    if req.reject_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明退回原因"));
    }

    let conn = pool.get().unwrap();
    let tx = conn.unchecked_transaction().unwrap();

    let result: Option<(String, String, i64)> = tx
        .query_row(
            "SELECT order_no, status, ar_id FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?)),
        )
        .optional()
        .unwrap();

    let (order_no, status, ar_id) = match result {
        Some(r) => r,
        None => {
            tx.rollback().ok();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if !matches!(status.as_str(), "pending_audit" | "pending_review") {
        tx.rollback().ok();
        return Json(ApiResponse::error(
            400,
            &format!("当前状态为「{}」，不可退回", status_to_name(&status)),
        ));
    }

    let from = status.as_str();
    let to = "returned";

    if let Err(e) = tx.execute(
        "UPDATE confirmation_orders SET status = ?1, current_handler_role = 'registrar', reject_reason = ?2, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?3",
        params![to, req.reject_reason.trim(), req.order_id],
    ) {
        tx.rollback().ok();
        return Json(ApiResponse::error(500, &format!("退回失败: {}", e)));
    }

    sync_ar_status(&tx, ar_id);

    insert_log(&tx, auth.user_id, &auth.real_name, "退回", "confirmation_order", req.order_id, &order_no, Some(from), Some(to), Some(&req.reject_reason));

    tx.commit().ok();

    let rc = auth.role_code.clone();
    let order = conn.query_row(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?2, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         WHERE co.id = ?1",
        params![req.order_id, rc],
        map_order,
    ).unwrap();

    Json(ApiResponse::success(order))
}

#[post("/orders/review", data = "<req>")]
pub fn review_order(
    auth: AuthUser,
    req: Json<ReviewOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "reviewer" {
        return Json(ApiResponse::error(403, "仅复核负责人可复核"));
    }
    if let Err(e) = validate_handover(&req.shift, Some(req.handover_from), Some(req.handover_to)) {
        return Json(ApiResponse::error(400, &format!("交接信息不完整: {}", e)));
    }
    if req.advance_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明复核通过原因"));
    }

    let conn = pool.get().unwrap();
    let tx = conn.unchecked_transaction().unwrap();

    let result: Option<(String, String, i64)> = tx
        .query_row(
            "SELECT order_no, status, ar_id FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?)),
        )
        .optional()
        .unwrap();

    let (order_no, status, ar_id) = match result {
        Some(r) => r,
        None => {
            tx.rollback().ok();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if status != "pending_review" {
        tx.rollback().ok();
        return Json(ApiResponse::error(
            400,
            &format!("当前状态为「{}」，复核仅可在待复核状态操作", status_to_name(&status)),
        ));
    }

    let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let from = status.as_str();
    let to = "pending_review";

    if let Err(e) = tx.execute(
        "UPDATE confirmation_orders SET advance_reason = ?1, shift = ?2, handover_from = ?3, handover_to = ?4, handover_time = ?5, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?6 AND status = ?7",
        params![req.advance_reason.trim(), req.shift.trim(), req.handover_from, req.handover_to, now, req.order_id, from],
    ) {
        tx.rollback().ok();
        return Json(ApiResponse::error(500, &format!("复核失败: {}", e)));
    }

    let _ = to;
    sync_ar_status(&tx, ar_id);

    insert_log(&tx, auth.user_id, &auth.real_name, "复核确认", "confirmation_order", req.order_id, &order_no, Some(from), Some(from), Some(&req.advance_reason));

    tx.commit().ok();

    let rc = auth.role_code.clone();
    let order = conn.query_row(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?2, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         WHERE co.id = ?1",
        params![req.order_id, rc],
        map_order,
    ).unwrap();

    Json(ApiResponse::success(order))
}

#[post("/orders/archive", data = "<req>")]
pub fn archive_order(
    auth: AuthUser,
    req: Json<ArchiveOrderRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<ConfirmationOrder>> {
    if auth.role_code != "reviewer" {
        return Json(ApiResponse::error(403, "仅复核负责人可归档"));
    }
    if req.advance_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明归档原因"));
    }

    let conn = pool.get().unwrap();
    let tx = conn.unchecked_transaction().unwrap();

    let result: Option<(String, String, i64)> = tx
        .query_row(
            "SELECT order_no, status, ar_id FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, i64>(2)?)),
        )
        .optional()
        .unwrap();

    let (order_no, status, ar_id) = match result {
        Some(r) => r,
        None => {
            tx.rollback().ok();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if status != "pending_review" {
        tx.rollback().ok();
        return Json(ApiResponse::error(
            400,
            &format!("当前状态为「{}」，仅待复核状态可归档", status_to_name(&status)),
        ));
    }

    let from = status.as_str();
    let to = "archived";

    if let Err(e) = tx.execute(
        "UPDATE confirmation_orders SET status = ?1, advance_reason = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![to, req.advance_reason.trim(), req.order_id],
    ) {
        tx.rollback().ok();
        return Json(ApiResponse::error(500, &format!("归档失败: {}", e)));
    }

    sync_ar_status(&tx, ar_id);

    insert_log(&tx, auth.user_id, &auth.real_name, "归档", "confirmation_order", req.order_id, &order_no, Some(from), Some(to), Some(&req.advance_reason));

    tx.commit().ok();

    let rc = auth.role_code.clone();
    let order = conn.query_row(
        "SELECT co.id, co.order_no, co.ar_id, co.ar_no, co.buyer_name, co.supplier_name, co.amount, co.confirm_amount,
                co.status, co.current_handler_role, co.reject_reason, co.advance_reason, co.shift,
                co.handover_from, co.handover_to, co.handover_time, co.created_by, co.created_at, co.updated_at,
                (SELECT COUNT(*) FROM payment_verifications pv WHERE pv.order_id = co.id),
                (SELECT COALESCE(SUM(pv.payment_amount), 0) FROM payment_verifications pv WHERE pv.order_id = co.id),
                u1.id, ?2, u1.real_name,
                u_creator.real_name, u_handler.real_name,
                u_from.real_name, u_to.real_name
         FROM confirmation_orders co
         LEFT JOIN users u_creator ON co.created_by = u_creator.id
         LEFT JOIN users u_handler ON CASE
            WHEN co.current_handler_role = 'registrar' THEN 1
            WHEN co.current_handler_role = 'auditor' THEN 2
            WHEN co.current_handler_role = 'reviewer' THEN 3
         END = u_handler.id
         LEFT JOIN users u1 ON co.created_by = u1.id
         LEFT JOIN users u_from ON co.handover_from = u_from.id
         LEFT JOIN users u_to ON co.handover_to = u_to.id
         WHERE co.id = ?1",
        params![req.order_id, rc],
        map_order,
    ).unwrap();

    Json(ApiResponse::success(order))
}

#[post("/orders/batch-submit", data = "<req>")]
pub fn batch_submit(
    auth: AuthUser,
    req: Json<BatchSubmitRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<BatchSubmitResponse>> {
    if auth.role_code != "registrar" {
        return Json(ApiResponse::error(403, "仅登记员可批量提交"));
    }

    if let Err(e) = validate_handover(&req.shift, Some(req.handover_from), Some(req.handover_to)) {
        return Json(ApiResponse::error(400, &format!("交接信息不完整: {}", e)));
    }
    if req.advance_reason.trim().is_empty() {
        return Json(ApiResponse::error(400, "必须说明推进原因"));
    }
    if req.order_ids.is_empty() {
        return Json(ApiResponse::error(400, "请至少选择一条记录"));
    }

    let conn = pool.get().unwrap();
    let mut results: Vec<BatchResultItem> = vec![];
    let mut success_count = 0usize;

    for &oid in &req.order_ids {
        let result = conn
            .query_row(
                "SELECT order_no, status, ar_id FROM confirmation_orders WHERE id = ?1",
                params![oid],
                |r| {
                    Ok((
                        r.get::<_, String>(0)?,
                        r.get::<_, String>(1)?,
                        r.get::<_, i64>(2)?,
                    ))
                },
            )
            .optional()
            .unwrap();

        match result {
            None => {
                results.push(BatchResultItem {
                    order_id: oid,
                    order_no: format!("ID{}", oid),
                    success: false,
                    message: "确权单不存在".to_string(),
                });
            }
            Some((order_no, status, ar_id)) => {
                if status != "draft" && status != "returned" {
                    results.push(BatchResultItem {
                        order_id: oid,
                        order_no,
                        success: false,
                        message: format!("当前状态「{}」不可提交", status_to_name(&status)),
                    });
                    continue;
                }

                let now = Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
                let from = status.clone();
                let to = "pending_audit";

                match conn.execute(
                    "UPDATE confirmation_orders SET status = ?1, current_handler_role = 'auditor', advance_reason = ?2,
                            shift = ?3, handover_from = ?4, handover_to = ?5, handover_time = ?6, reject_reason = NULL, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?7",
                    params![to, req.advance_reason.trim(), req.shift.trim(), req.handover_from, req.handover_to, now, oid],
                ) {
                    Ok(_) => {
                        sync_ar_status(&conn, ar_id);
                        insert_log(&conn, auth.user_id, &auth.real_name, "批量提交", "confirmation_order", oid, &order_no, Some(&from), Some(to), Some(&req.advance_reason));
                        success_count += 1;
                        results.push(BatchResultItem {
                            order_id: oid,
                            order_no,
                            success: true,
                            message: "提交成功".to_string(),
                        });
                    }
                    Err(e) => {
                        results.push(BatchResultItem {
                            order_id: oid,
                            order_no,
                            success: false,
                            message: format!("失败: {}", e),
                        });
                    }
                }
            }
        }
    }

    Json(ApiResponse::success(BatchSubmitResponse {
        total: req.order_ids.len(),
        success_count,
        fail_count: req.order_ids.len() - success_count,
        results,
    }))
}

#[get("/verifications?<page>&<page_size>&<ar_id>&<order_id>")]
pub fn list_verifications(
    _auth: AuthUser,
    page: Option<i64>,
    page_size: Option<i64>,
    ar_id: Option<i64>,
    order_id: Option<i64>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<PaginatedResponse<PaymentVerification>>> {
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(20);
    let offset = (p - 1) * ps;

    let conn = pool.get().unwrap();
    let mut where_clauses: Vec<String> = vec![];
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(aid) = ar_id {
        where_clauses.push("co.ar_id = ?".to_string());
        args.push(Box::new(aid));
    }
    if let Some(oid) = order_id {
        where_clauses.push("pv.order_id = ?".to_string());
        args.push(Box::new(oid));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM payment_verifications pv JOIN confirmation_orders co ON pv.order_id = co.id {}",
        where_sql
    );
    let original_len = args.len();
    let args_refs: Vec<&dyn rusqlite::ToSql> = args[..original_len].iter().map(|a| a.as_ref()).collect();
    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(args_refs.iter().copied()), |r| r.get(0))
        .unwrap_or(0);

    let sql = format!(
        "SELECT pv.id, pv.verify_no, pv.order_id, pv.order_no, pv.payment_amount, pv.payment_date,
                pv.payer_name, pv.bank_slip_no, pv.remark, pv.status, pv.created_by, pv.created_at,
                u.real_name
         FROM payment_verifications pv LEFT JOIN users u ON pv.created_by = u.id
         LEFT JOIN confirmation_orders co ON pv.order_id = co.id
         {} ORDER BY pv.created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    args.push(Box::new(ps));
    args.push(Box::new(offset));
    let mut stmt = conn.prepare(&sql).unwrap();
    let args_refs2: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(args_refs2.iter().copied()), map_verification)
        .unwrap();
    let items: Vec<PaymentVerification> = rows.filter_map(|r| r.ok()).collect();

    Json(ApiResponse::success(PaginatedResponse {
        items,
        total,
        page: p,
        page_size: ps,
    }))
}

#[post("/verifications", data = "<req>")]
pub fn create_verification(
    auth: AuthUser,
    req: Json<CreateVerificationRequest>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<PaymentVerification>> {
    if auth.role_code != "reviewer" {
        return Json(ApiResponse::error(403, "仅复核负责人可创建回款核销"));
    }
    if req.payment_amount <= 0.0 {
        return Json(ApiResponse::error(400, "回款金额必须大于0"));
    }

    let mut conn = pool.get().unwrap();
    let tx = match conn.transaction() {
        Ok(t) => t,
        Err(e) => return Json(ApiResponse::error(500, &format!("事务启动失败: {}", e))),
    };

    let order_info: Option<(i64, String, String, f64)> = tx
        .query_row(
            "SELECT ar_id, order_no, status, COALESCE(confirm_amount, amount) FROM confirmation_orders WHERE id = ?1",
            params![req.order_id],
            |r| Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, f64>(3)?)),
        )
        .optional()
        .unwrap();

    let (ar_id, order_no, status, confirm_amt) = match order_info {
        Some(r) => r,
        None => {
            let _ = tx.rollback();
            return Json(ApiResponse::error(404, "确权单不存在"));
        }
    };

    if status != "archived" {
        let _ = tx.rollback();
        return Json(ApiResponse::error(400, &format!("确权单状态为「{}」，仅已归档的确权单可核销", status_to_name(&status))));
    }

    let verified_sum: f64 = tx
        .query_row(
            "SELECT COALESCE(SUM(payment_amount), 0) FROM payment_verifications WHERE order_id = ?1",
            params![req.order_id],
            |r| r.get(0),
        )
        .unwrap_or(0.0);

    if verified_sum + req.payment_amount > confirm_amt + 0.01 {
        let _ = tx.rollback();
        return Json(ApiResponse::error(400, &format!("累计核销金额（{:.2}）+本次（{:.2}）超过确权金额（{:.2}）", verified_sum, req.payment_amount, confirm_amt)));
    }

    let verify_no = gen_verify_no(&tx);

    match tx.execute(
        "INSERT INTO payment_verifications (verify_no, order_id, order_no, payment_amount, payment_date, payer_name, bank_slip_no, remark, status, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'verified', ?9)",
        params![
            verify_no,
            req.order_id,
            order_no,
            req.payment_amount,
            req.payment_date.to_string(),
            req.payer_name,
            req.bank_slip_no,
            req.remark,
            auth.user_id
        ],
    ) {
        Ok(_) => {
            let id = tx.last_insert_rowid();
            sync_verified_amounts(&tx, req.order_id);
            sync_ar_status(&tx, ar_id);
            insert_log(&tx, auth.user_id, &auth.real_name, "核销", "payment_verification", id, &verify_no, None, Some("verified"), req.remark.as_deref());
            insert_log(&tx, auth.user_id, &auth.real_name, "更新已核销金额", "confirmation_order", req.order_id, &order_no, None, None, Some(&format!("回款金额 {:.2} 元", req.payment_amount)));

            if let Err(e) = tx.commit() {
                return Json(ApiResponse::error(500, &format!("事务提交失败: {}", e)));
            }

            let pv = conn.query_row(
                "SELECT pv.id, pv.verify_no, pv.order_id, pv.order_no, pv.payment_amount, pv.payment_date,
                        pv.payer_name, pv.bank_slip_no, pv.remark, pv.status, pv.created_by, pv.created_at,
                        u.real_name
                 FROM payment_verifications pv LEFT JOIN users u ON pv.created_by = u.id WHERE pv.id = ?1",
                params![id],
                map_verification,
            ).unwrap();
            Json(ApiResponse::success(pv))
        }
        Err(e) => {
            let _ = tx.rollback();
            Json(ApiResponse::error(500, &format!("核销失败: {}", e)))
        }
    }
}

#[get("/stats")]
pub fn get_stats(
    _auth: AuthUser,
    pool: &State<DbPool>,
) -> Json<ApiResponse<StatsResponse>> {
    let conn = pool.get().unwrap();

    let ar_total: i64 = conn.query_row("SELECT COUNT(*) FROM accounts_receivable", [], |r| r.get(0)).unwrap_or(0);
    let ar_total_amount: f64 = conn.query_row("SELECT COALESCE(SUM(amount), 0) FROM accounts_receivable", [], |r| r.get(0)).unwrap_or(0.0);
    let ar_pending: i64 = conn.query_row("SELECT COUNT(*) FROM accounts_receivable WHERE status = 'pending'", [], |r| r.get(0)).unwrap_or(0);
    let ar_confirmed: i64 = conn.query_row("SELECT COUNT(*) FROM accounts_receivable WHERE status = 'confirmed'", [], |r| r.get(0)).unwrap_or(0);

    let order_total: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders", [], |r| r.get(0)).unwrap_or(0);
    let order_draft: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = 'draft'", [], |r| r.get(0)).unwrap_or(0);
    let order_pending_audit: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = 'pending_audit'", [], |r| r.get(0)).unwrap_or(0);
    let order_pending_review: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = 'pending_review'", [], |r| r.get(0)).unwrap_or(0);
    let order_archived: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = 'archived'", [], |r| r.get(0)).unwrap_or(0);
    let order_returned: i64 = conn.query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = 'returned'", [], |r| r.get(0)).unwrap_or(0);

    let verification_total: i64 = conn.query_row("SELECT COUNT(*) FROM payment_verifications", [], |r| r.get(0)).unwrap_or(0);
    let verification_total_amount: f64 = conn.query_row("SELECT COALESCE(SUM(payment_amount), 0) FROM payment_verifications", [], |r| r.get(0)).unwrap_or(0.0);

    let status_list = vec![
        ("draft", "草稿"),
        ("pending_audit", "待审核"),
        ("pending_review", "待复核"),
        ("archived", "已归档"),
        ("returned", "已退回"),
    ];
    let mut order_amount_by_status: Vec<StatusAmountItem> = vec![];
    for (st, name) in status_list {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM confirmation_orders WHERE status = ?1", params![st], |r| r.get(0))
            .unwrap_or(0);
        let amount: f64 = conn
            .query_row("SELECT COALESCE(SUM(COALESCE(confirm_amount, amount)), 0) FROM confirmation_orders WHERE status = ?1", params![st], |r| r.get(0))
            .unwrap_or(0.0);
        order_amount_by_status.push(StatusAmountItem {
            status: st.to_string(),
            status_name: name.to_string(),
            count,
            amount,
        });
    }

    Json(ApiResponse::success(StatsResponse {
        ar_total,
        ar_total_amount,
        ar_pending,
        ar_confirmed,
        order_total,
        order_draft,
        order_pending_audit,
        order_pending_review,
        order_archived,
        order_returned,
        verification_total,
        verification_total_amount,
        order_amount_by_status,
    }))
}

#[get("/logs?<page>&<page_size>&<target_type>&<target_id>")]
pub fn list_logs(
    _auth: AuthUser,
    page: Option<i64>,
    page_size: Option<i64>,
    target_type: Option<String>,
    target_id: Option<i64>,
    pool: &State<DbPool>,
) -> Json<ApiResponse<PaginatedResponse<OperationLog>>> {
    let p = page.unwrap_or(1);
    let ps = page_size.unwrap_or(20);
    let offset = (p - 1) * ps;

    let conn = pool.get().unwrap();
    let mut where_clauses: Vec<String> = vec![];
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];

    if let Some(tt) = &target_type {
        if !tt.is_empty() {
            where_clauses.push("target_type = ?".to_string());
            args.push(Box::new(tt.clone()));
        }
    }
    if let Some(tid) = target_id {
        where_clauses.push("target_id = ?".to_string());
        args.push(Box::new(tid));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM operation_logs {}", where_sql);
    let original_len = args.len();
    let args_refs: Vec<&dyn rusqlite::ToSql> = args[..original_len].iter().map(|a| a.as_ref()).collect();
    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(args_refs.iter().copied()), |r| r.get(0))
        .unwrap_or(0);

    let sql = format!(
        "SELECT id, user_id, user_name, action, target_type, target_id, target_no, from_status, to_status, remark, ip_address, created_at
         FROM operation_logs {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        where_sql
    );
    args.push(Box::new(ps));
    args.push(Box::new(offset));
    let mut stmt = conn.prepare(&sql).unwrap();
    let args_refs2: Vec<&dyn rusqlite::ToSql> = args.iter().map(|a| a.as_ref()).collect();
    let rows = stmt
        .query_map(rusqlite::params_from_iter(args_refs2.iter().copied()), map_log)
        .unwrap();
    let items: Vec<OperationLog> = rows.filter_map(|r| r.ok()).collect();

    Json(ApiResponse::success(PaginatedResponse {
        items,
        total,
        page: p,
        page_size: ps,
    }))
}
