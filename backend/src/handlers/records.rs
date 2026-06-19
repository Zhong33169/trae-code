use crate::auth::{node_label, require_role, role_label, status_label, AuthUser};
use crate::db::DbPool;
use crate::models::*;
use chrono::{DateTime, Duration, Utc};
use rocket::http::Status;
use rocket::response::status::Custom;
use rocket::serde::json::Json;
use rocket::State;
use uuid::Uuid;

fn now_str() -> String {
    Utc::now().to_rfc3339()
}

fn add_hours_str(hours: i64) -> String {
    (Utc::now() + Duration::hours(hours)).to_rfc3339()
}

fn check_timeout(deadline: &str) -> bool {
    if let Ok(dt) = DateTime::parse_from_rfc3339(deadline) {
        dt.with_timezone(&Utc) < Utc::now()
    } else {
        false
    }
}

fn gen_batch_no() -> String {
    let now = Utc::now();
    let rand: u32 = rand();
    format!("MZ{}{:04}", now.format("%Y%m%d%H%M"), rand % 10000)
}

fn rand() -> u32 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos() as u32).unwrap_or(42)
}

pub struct NodeAdvanceResult {
    pub old_record_status: String,
    pub new_record_status: String,
    pub new_record_node: String,
}

fn write_log(
    pool: &State<DbPool>,
    user: &AuthUser,
    record_id: Option<&str>,
    action: &str,
    action_target: &str,
    detail: Option<&str>,
    old_status: Option<&str>,
    new_status: Option<&str>,
    evidence_note: Option<&str>,
) {
    let conn = pool.lock();
    let _ = conn.execute(
        "INSERT INTO operation_logs (id, record_id, user_id, user_name, user_role, action, action_target, detail, old_status, new_status, evidence_note, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
        rusqlite::params![
            Uuid::new_v4().to_string(),
            record_id,
            user.user_id,
            user.real_name,
            user.role,
            action,
            action_target,
            detail,
            old_status,
            new_status,
            evidence_note,
            now_str(),
        ],
    );
}

fn update_record_timestamp(pool: &State<DbPool>, record_id: &str) {
    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE seed_records SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now_str(), record_id],
    );
}

fn upsert_node(
    pool: &State<DbPool>,
    record_id: &str,
    node_type: &str,
    node_name: &str,
    assignee_id: Option<&str>,
    assignee_name: Option<&str>,
    deadline_hours: i64,
    status: &str,
    remark: Option<&str>,
) -> String {
    let conn = pool.lock();
    let existing: Result<String, _> = conn.query_row(
        "SELECT id FROM node_tracking WHERE record_id = ?1 AND node_type = ?2",
        rusqlite::params![record_id, node_type],
        |row| row.get(0),
    );
    if let Ok(id) = existing {
        let _ = conn.execute(
            "UPDATE node_tracking SET status = ?1, remark = COALESCE(?2, remark), updated_at = ?3 WHERE id = ?4",
            rusqlite::params![status, remark, now_str(), id],
        );
        return id;
    }
    let id = Uuid::new_v4().to_string();
    let _ = conn.execute(
        "INSERT INTO node_tracking (id, record_id, node_type, node_name, assignee_id, assignee_name, deadline, status, remark, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",
        rusqlite::params![
            id,
            record_id,
            node_type,
            node_name,
            assignee_id,
            assignee_name,
            add_hours_str(deadline_hours),
            status,
            remark,
            now_str(),
            now_str(),
        ],
    );
    id
}

fn complete_node_and_advance(
    pool: &State<DbPool>,
    record_id: &str,
    current_node_type: &str,
    next_node_type: &str,
    next_node_role: &str,
    next_deadline_hours: i64,
    next_overall_status: &str,
    extra_updates: &[(&str, &dyn rusqlite::ToSql)],
    node_remark: Option<&str>,
) -> NodeAdvanceResult {
    let (old_record, old_status) = {
        let conn = pool.lock();
        let row: Result<(String, String), _> = conn.query_row(
            "SELECT id, overall_status FROM seed_records WHERE id = ?1",
            rusqlite::params![record_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        );
        row.unwrap_or_else(|_| (record_id.to_string(), "pending".to_string()))
    };
    let _ = old_record;
    let now = now_str();
    {
        let conn = pool.lock();
        let status_owned = next_overall_status.to_string();
        let node_owned = next_node_type.to_string();
        let now_owned = now.clone();
        let id_owned = record_id.to_string();

        let mut set_clauses: Vec<String> = vec![
            "overall_status = ?".to_string(),
            "current_node = ?".to_string(),
            "updated_at = ?".to_string(),
        ];
        let mut values: Vec<&dyn rusqlite::ToSql> = vec![
            &status_owned,
            &node_owned,
            &now_owned,
        ];
        for (col, val) in extra_updates {
            set_clauses.push(format!("{} = ?", col));
            values.push(*val);
        }
        values.push(&id_owned);
        let sql = format!(
            "UPDATE seed_records SET {} WHERE id = ?",
            set_clauses.join(", ")
        );
        let _ = conn.execute(&sql, rusqlite::params_from_iter(values.into_iter()));
        let _ = conn.execute(
            "UPDATE node_tracking SET status = 'completed', completed_at = ?1, remark = COALESCE(?2, remark), updated_at = ?3 WHERE record_id = ?4 AND node_type = ?5",
            rusqlite::params![now, node_remark, now, record_id, current_node_type],
        );
    }
    let assignee = find_user_by_role(pool, next_node_role);
    if !next_node_type.is_empty() && next_node_type != "done" {
        upsert_node(
            pool,
            record_id,
            next_node_type,
            node_label(next_node_type),
            assignee.as_ref().map(|(i, _)| i.as_str()),
            assignee.as_ref().map(|(_, n)| n.as_str()),
            next_deadline_hours,
            "pending",
            None,
        );
    }
    NodeAdvanceResult {
        old_record_status: old_status,
        new_record_status: next_overall_status.to_string(),
        new_record_node: next_node_type.to_string(),
    }
}

fn refresh_node_timeout(pool: &State<DbPool>, record_id: &str) {
    let skip = {
        let conn = pool.lock();
        let status: Result<String, _> = conn.query_row(
            "SELECT overall_status FROM seed_records WHERE id = ?1",
            rusqlite::params![record_id],
            |row| row.get::<_, String>(0),
        );
        matches!(status, Ok(s) if s == "completed")
    };
    if skip { return; }
    let conn = pool.lock();
    let mut stmt = conn
        .prepare("SELECT id, deadline FROM node_tracking WHERE record_id = ?1")
        .unwrap();
    let rows = stmt
        .query_map(rusqlite::params![record_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .unwrap();
    for r in rows {
        if let Ok((id, deadline)) = r {
            let to = if check_timeout(&deadline) { 1 } else { 0 };
            let _ = conn.execute(
                "UPDATE node_tracking SET is_timeout = ?1, updated_at = ?2 WHERE id = ?3",
                rusqlite::params![to, now_str(), id],
            );
        }
    }
}

fn count_timeout_for_record(pool: &State<DbPool>, record_id: &str) -> i64 {
    let skip = {
        let conn = pool.lock();
        let status: Result<String, _> = conn.query_row(
            "SELECT overall_status FROM seed_records WHERE id = ?1",
            rusqlite::params![record_id],
            |row| row.get::<_, String>(0),
        );
        matches!(status, Ok(s) if s == "completed")
    };
    if skip { return 0; }
    let conn = pool.lock();
    conn.query_row(
        "SELECT COUNT(*) FROM node_tracking WHERE record_id = ?1 AND is_timeout = 1 AND status != 'completed'",
        rusqlite::params![record_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

fn role_to_assign(node: &str) -> &'static str {
    match node {
        "audit" => "auditor",
        "pond_entry" | "survival_observe" | "registration" => "registrar",
        "archive_review" => "reviewer",
        _ => "registrar",
    }
}

fn find_user_by_role(pool: &State<DbPool>, role: &str) -> Option<(String, String)> {
    let conn = pool.lock();
    conn.query_row(
        "SELECT id, real_name FROM users WHERE role = ?1 LIMIT 1",
        rusqlite::params![role],
        |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
    )
    .ok()
}

fn query_record(pool: &State<DbPool>, id: &str) -> Option<SeedRecord> {
    let conn = pool.lock();
    conn.query_row(
        "SELECT id, batch_no, seed_type, seed_species, quantity, unit, source, supplier, register_id, register_name, register_time, current_node, overall_status, pond_entry_time, pond_id, pond_quantity, survival_rate, survival_observe_time, archive_time, archive_remark, created_at, updated_at FROM seed_records WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(SeedRecord {
                id: row.get(0)?,
                batch_no: row.get(1)?,
                seed_type: row.get(2)?,
                seed_species: row.get(3)?,
                quantity: row.get(4)?,
                unit: row.get(5)?,
                source: row.get(6)?,
                supplier: row.get(7).ok(),
                register_id: row.get(8)?,
                register_name: row.get(9)?,
                register_time: row.get(10)?,
                current_node: row.get(11)?,
                overall_status: row.get(12)?,
                pond_entry_time: row.get(13).ok(),
                pond_id: row.get(14).ok(),
                pond_quantity: row.get(15).ok(),
                survival_rate: row.get(16).ok(),
                survival_observe_time: row.get(17).ok(),
                archive_time: row.get(18).ok(),
                archive_remark: row.get(19).ok(),
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
            })
        },
    )
    .ok()
}

fn query_nodes(pool: &State<DbPool>, record_id: &str) -> Vec<NodeTracking> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, record_id, node_type, node_name, assignee_id, assignee_name, deadline, status, started_at, completed_at, is_timeout, timeout_reason, follow_up_action, timeout_remark, remark, created_at, updated_at FROM node_tracking WHERE record_id = ?1 ORDER BY created_at ASC",
        )
        .unwrap();
    let rows = stmt
        .query_map(rusqlite::params![record_id], |row| {
            Ok(NodeTracking {
                id: row.get(0)?,
                record_id: row.get(1)?,
                node_type: row.get(2)?,
                node_name: row.get(3)?,
                assignee_id: row.get(4).ok(),
                assignee_name: row.get(5).ok(),
                deadline: row.get(6)?,
                status: row.get(7)?,
                started_at: row.get(8).ok(),
                completed_at: row.get(9).ok(),
                is_timeout: row.get::<_, i64>(10)? != 0,
                timeout_reason: row.get(11).ok(),
                follow_up_action: row.get(12).ok(),
                timeout_remark: row.get(13).ok(),
                remark: row.get(14).ok(),
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })
        .unwrap();
    rows.filter_map(|r| r.ok()).collect()
}

fn query_logs(pool: &State<DbPool>, record_id: &str) -> Vec<OperationLog> {
    let conn = pool.lock();
    let mut stmt = conn
        .prepare(
            "SELECT id, record_id, user_id, user_name, user_role, action, action_target, detail, old_status, new_status, evidence_note, created_at FROM operation_logs WHERE record_id = ?1 ORDER BY created_at DESC",
        )
        .unwrap();
    let rows = stmt
        .query_map(rusqlite::params![record_id], |row| {
            Ok(OperationLog {
                id: row.get(0)?,
                record_id: row.get(1).ok(),
                user_id: row.get(2)?,
                user_name: row.get(3)?,
                user_role: row.get(4)?,
                action: row.get(5)?,
                action_target: row.get(6)?,
                detail: row.get(7).ok(),
                old_status: row.get(8).ok(),
                new_status: row.get(9).ok(),
                evidence_note: row.get(10).ok(),
                created_at: row.get(11)?,
            })
        })
        .unwrap();
    rows.filter_map(|r| r.ok()).collect()
}

#[get("/?<status>&<node>&<keyword>&<page>&<page_size>")]
pub fn list_records(
    pool: &State<DbPool>,
    user: AuthUser,
    status: Option<String>,
    node: Option<String>,
    keyword: Option<String>,
    page: Option<u32>,
    page_size: Option<u32>,
) -> Json<ApiResponse<PaginatedRecords>> {
    let page = page.unwrap_or(1).max(1);
    let page_size = page_size.unwrap_or(10).clamp(1, 100);
    let offset = (page - 1) * page_size;

    let mut sql = "SELECT id, batch_no, seed_type, seed_species, quantity, unit, source, supplier, register_id, register_name, register_time, current_node, overall_status, pond_entry_time, pond_id, pond_quantity, survival_rate, survival_observe_time, archive_time, archive_remark, created_at, updated_at FROM seed_records WHERE 1=1".to_string();
    let mut params: Vec<String> = vec![];

    if let Some(s) = &status {
        sql.push_str(" AND overall_status = ?");
        params.push(s.clone());
    }
    if let Some(n) = &node {
        sql.push_str(" AND current_node = ?");
        params.push(n.clone());
    }
    if let Some(kw) = &keyword {
        sql.push_str(" AND (batch_no LIKE ? OR seed_species LIKE ? OR seed_type LIKE ? OR supplier LIKE ?)");
        let like = format!("%{}%", kw);
        params.push(like.clone());
        params.push(like.clone());
        params.push(like.clone());
        params.push(like);
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");

    let (items, total, timeout_count): (Vec<SeedRecord>, i64, i64) = {
        let conn = pool.lock();
        let mut stmt = conn.prepare(&sql).unwrap();
        let param_refs: Vec<&dyn rusqlite::ToSql> = params
            .iter()
            .map(|x| x as &dyn rusqlite::ToSql)
            .collect();
        let mut all_params: Vec<&dyn rusqlite::ToSql> = vec![];
        all_params.extend(param_refs);
        all_params.push(&page_size as &dyn rusqlite::ToSql);
        all_params.push(&offset as &dyn rusqlite::ToSql);

        let rows = stmt
            .query_map(all_params.as_slice(), |row| {
                Ok(SeedRecord {
                    id: row.get(0)?,
                    batch_no: row.get(1)?,
                    seed_type: row.get(2)?,
                    seed_species: row.get(3)?,
                    quantity: row.get(4)?,
                    unit: row.get(5)?,
                    source: row.get(6)?,
                    supplier: row.get(7).ok(),
                    register_id: row.get(8)?,
                    register_name: row.get(9)?,
                    register_time: row.get(10)?,
                    current_node: row.get(11)?,
                    overall_status: row.get(12)?,
                    pond_entry_time: row.get(13).ok(),
                    pond_id: row.get(14).ok(),
                    pond_quantity: row.get(15).ok(),
                    survival_rate: row.get(16).ok(),
                    survival_observe_time: row.get(17).ok(),
                    archive_time: row.get(18).ok(),
                    archive_remark: row.get(19).ok(),
                    created_at: row.get(20)?,
                    updated_at: row.get(21)?,
                })
            })
            .unwrap();
        let items: Vec<SeedRecord> = rows.filter_map(|r| r.ok()).collect();

        let mut cnt_sql = "SELECT COUNT(*) FROM seed_records WHERE 1=1".to_string();
        let mut cnt_params: Vec<String> = vec![];
        if let Some(s) = &status {
            cnt_sql.push_str(" AND overall_status = ?");
            cnt_params.push(s.clone());
        }
        if let Some(n) = &node {
            cnt_sql.push_str(" AND current_node = ?");
            cnt_params.push(n.clone());
        }
        if let Some(kw) = &keyword {
            cnt_sql.push_str(" AND (batch_no LIKE ? OR seed_species LIKE ? OR seed_type LIKE ? OR supplier LIKE ?)");
            let like = format!("%{}%", kw);
            cnt_params.push(like.clone());
            cnt_params.push(like.clone());
            cnt_params.push(like.clone());
            cnt_params.push(like);
        }
        let cnt_param_refs: Vec<&dyn rusqlite::ToSql> = cnt_params
            .iter()
            .map(|x| x as &dyn rusqlite::ToSql)
            .collect();
        let total: i64 = conn
            .query_row(&cnt_sql, cnt_param_refs.as_slice(), |row| row.get(0))
            .unwrap_or(0);

        let mut timeout_sql = "SELECT COUNT(DISTINCT nt.record_id) FROM node_tracking nt JOIN seed_records sr ON sr.id = nt.record_id WHERE nt.is_timeout = 1 AND nt.status != 'completed' AND sr.overall_status != 'completed'".to_string();
        let mut to_params: Vec<String> = vec![];
        if let Some(s) = &status {
            timeout_sql.push_str(" AND sr.overall_status = ?");
            to_params.push(s.clone());
        }
        if let Some(n) = &node {
            timeout_sql.push_str(" AND sr.current_node = ?");
            to_params.push(n.clone());
        }
        if let Some(kw) = &keyword {
            timeout_sql.push_str(" AND (sr.batch_no LIKE ? OR sr.seed_species LIKE ?)");
            let like = format!("%{}%", kw);
            to_params.push(like.clone());
            to_params.push(like);
        }
        let to_param_refs: Vec<&dyn rusqlite::ToSql> = to_params
            .iter()
            .map(|x| x as &dyn rusqlite::ToSql)
            .collect();
        let timeout_count: i64 = conn
            .query_row(&timeout_sql, to_param_refs.as_slice(), |row| row.get(0))
            .unwrap_or(0);

        (items, total, timeout_count)
    };

    for r in &items {
        refresh_node_timeout(pool, &r.id);
    }

    let _ = user;
    Json(ApiResponse::ok(
        PaginatedRecords { items, total, page, page_size, timeout_count },
        "获取苗种记录列表成功",
    ))
}

#[get("/<id>")]
pub fn get_record(
    pool: &State<DbPool>,
    _user: AuthUser,
    id: &str,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    refresh_node_timeout(pool, id);
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "获取苗种记录详情成功",
    )))
}

#[post("/", format = "json", data = "<req>")]
pub fn create_record(
    pool: &State<DbPool>,
    user: AuthUser,
    req: Json<CreateSeedRecordRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["registrar"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;

    if req.seed_type.trim().is_empty()
        || req.seed_species.trim().is_empty()
        || req.quantity <= 0
        || req.source.trim().is_empty()
    {
        return Err(Custom(
            Status::BadRequest,
            Json(ApiResponse::err("苗种类型、品种、数量（>0）、来源均为必填项")),
        ));
    }

    let id = Uuid::new_v4().to_string();
    let batch_no = gen_batch_no();
    let now = now_str();
    let deadline_hours = req.deadline_hours.unwrap_or(24);

    {
        let conn = pool.lock();
        conn.execute(
            "INSERT INTO seed_records (id, batch_no, seed_type, seed_species, quantity, unit, source, supplier, register_id, register_name, register_time, current_node, overall_status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
            rusqlite::params![
                id,
                batch_no,
                req.seed_type.trim(),
                req.seed_species.trim(),
                req.quantity,
                req.unit.clone().unwrap_or_else(|| "尾".to_string()),
                req.source.trim(),
                req.supplier,
                user.user_id,
                user.real_name,
                now,
                "audit",
                "pending",
                now,
                now,
            ],
        )
        .map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&format!("创建苗种记录失败：{}", e)))))?;
    }

    upsert_node(
        pool,
        &id,
        "registration",
        node_label("registration"),
        Some(&user.user_id),
        Some(&user.real_name),
        deadline_hours,
        "completed",
        Some("登记员发起苗种记录，自动进入审核节点"),
    );

    let auditor = find_user_by_role(pool, role_to_assign("audit"));
    upsert_node(
        pool,
        &id,
        "audit",
        node_label("audit"),
        auditor.as_ref().map(|(i, _)| i.as_str()),
        auditor.as_ref().map(|(_, n)| n.as_str()),
        deadline_hours,
        "pending",
        None,
    );

    write_log(
        pool,
        &user,
        Some(&id),
        "创建苗种记录并提交审核",
        &format!("批次号 {}", batch_no),
        Some(&format!(
            "苗种类型：{}，品种：{}，数量：{}{}，来源：{}，节点时限：{}小时",
            req.seed_type,
            req.seed_species,
            req.quantity,
            req.unit.clone().unwrap_or_else(|| "尾".to_string()),
            req.source,
            deadline_hours,
        )),
        None,
        Some("pending"),
        None,
    );

    let record = query_record(pool, &id).unwrap();
    let nodes = query_nodes(pool, &id);
    let logs = query_logs(pool, &id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("苗种记录创建成功，批次号：{}，已进入「{}」节点（责任人：{}）",
            batch_no,
            node_label("audit"),
            auditor.map(|(_, n)| n).unwrap_or_else(|| role_label("auditor").to_string()),
        ),
    )))
}

#[put("/<id>", format = "json", data = "<req>")]
pub fn update_record(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<UpdateSeedRecordRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["registrar"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;

    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;

    if record.overall_status != "correction" && record.overall_status != "pending" {
        return Err(Custom(
            Status::Forbidden,
            Json(ApiResponse::err(&format!(
                "当前记录状态为「{}」，仅待补正或待处理时可修改",
                status_label(&record.overall_status)
            ))),
        ));
    }

    let mut seed_type = record.seed_type.clone();
    let mut seed_species = record.seed_species.clone();
    let mut quantity = record.quantity;
    let mut unit = record.unit.clone();
    let mut source = record.source.clone();
    let mut supplier = record.supplier.clone();

    if let Some(v) = &req.seed_type { seed_type = v.clone(); }
    if let Some(v) = &req.seed_species { seed_species = v.clone(); }
    if let Some(v) = req.quantity { quantity = v; }
    if let Some(v) = &req.unit { unit = v.clone(); }
    if let Some(v) = &req.source { source = v.clone(); }
    if req.supplier.is_some() { supplier = req.supplier.clone(); }

    let is_correction = record.overall_status == "correction";
    let now = now_str();
    {
        let conn = pool.lock();
        conn.execute(
            "UPDATE seed_records SET seed_type=?1, seed_species=?2, quantity=?3, unit=?4, source=?5, supplier=?6, updated_at=?7 WHERE id=?8",
            rusqlite::params![seed_type, seed_species, quantity, unit, source, supplier, now, id],
        ).map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&format!("更新失败：{}", e)))))?;
        if is_correction {
            let _ = conn.execute(
                "UPDATE seed_records SET overall_status = 'pending', current_node = 'audit', updated_at = ?1 WHERE id = ?2",
                rusqlite::params![now, id],
            );
            let _ = conn.execute(
                "UPDATE node_tracking SET status='pending', completed_at=NULL, updated_at=?1 WHERE record_id=?2 AND node_type='audit'",
                rusqlite::params![now, id],
            );
        }
    }

    write_log(
        pool,
        &user,
        Some(id),
        if is_correction { "补正苗种记录并重新提交审核" } else { "修改苗种记录" },
        &format!("批次号 {}", record.batch_no),
        Some(if is_correction { "登记员补正后重新提交至审核节点" } else { "登记员在待处理状态下修改苗种记录" }),
        if is_correction { Some("correction") } else { Some(&record.overall_status) },
        Some("pending"),
        None,
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        if is_correction { "补正完成，已重新提交至苗种审核节点" } else { "苗种记录已更新" },
    )))
}

#[post("/<id>/approve-audit", format = "json", data = "<req>")]
pub fn approve_audit(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<ApproveRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["auditor"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if record.current_node != "audit" {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err(&format!(
            "当前节点「{}」不允许审核通过，需在苗种审核节点",
            node_label(&record.current_node)
        )))));
    }

    let next_deadline = req.deadline_hours.unwrap_or(48);
    let advance = complete_node_and_advance(
        pool,
        id,
        "audit",
        "pond_entry",
        role_to_assign("pond_entry"),
        next_deadline,
        "approved",
        &[],
        req.evidence_note.as_deref(),
    );

    write_log(
        pool,
        &user,
        Some(id),
        "审核通过",
        &format!("批次号 {}", record.batch_no),
        Some(&format!(
            "审核主管通过该批次苗种记录，下一节点「{}」（责任人：{}，时限 {} 小时）",
            node_label("pond_entry"),
            role_label(role_to_assign("pond_entry")),
            next_deadline
        )),
        Some(&advance.old_record_status),
        Some(&advance.new_record_status),
        req.evidence_note.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("审核已通过，记录转入「{}」节点（责任人：{}）",
            node_label("pond_entry"),
            role_label(role_to_assign("pond_entry"))
        ),
    )))
}

#[post("/<id>/reject-audit", format = "json", data = "<req>")]
pub fn reject_audit(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<RejectRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["auditor"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if record.current_node != "audit" {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("仅审核节点允许驳回"))));
    }
    if req.reason.trim().is_empty() {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("请填写驳回原因"))));
    }

    let old_status = record.overall_status.clone();
    let now = now_str();
    {
        let conn = pool.lock();
        let _ = conn.execute(
            "UPDATE seed_records SET overall_status='correction', current_node='registration', updated_at=?1 WHERE id=?2",
            rusqlite::params![now, id],
        );
        let _ = conn.execute(
            "UPDATE node_tracking SET status='rejected', completed_at=?1, remark=?2, updated_at=?3 WHERE record_id=?4 AND node_type='audit'",
            rusqlite::params![now, req.reason.trim(), now, id],
        );
    }

    let detail_full = format!(
        "驳回原因：{}{}",
        req.reason,
        req.evidence_note.as_deref().map(|e| format!("；证据说明：{}", e)).unwrap_or_default()
    );
    write_log(
        pool,
        &user,
        Some(id),
        "审核驳回（退回登记员补正）",
        &format!("批次号 {}", record.batch_no),
        Some(&detail_full),
        Some(&old_status),
        Some("correction"),
        req.evidence_note.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("已退回至苗种登记节点，登记员需补正。原因：{}", req.reason),
    )))
}

#[post("/<id>/pond-entry", format = "json", data = "<req>")]
pub fn pond_entry(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<PondEntryRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["registrar"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if record.current_node != "pond_entry" {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err(&format!(
            "当前节点「{}」，不允许执行苗种入塘",
            node_label(&record.current_node)
        )))));
    }
    if req.pond_id.trim().is_empty() || req.pond_quantity <= 0 {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("池塘编号和入塘数量（>0）为必填"))));
    }

    let now = now_str();
    let pond_qty_str = req.pond_quantity.to_string();
    let next_deadline = req.deadline_hours.unwrap_or(240);
    let advance = complete_node_and_advance(
        pool,
        id,
        "pond_entry",
        "survival_observe",
        role_to_assign("survival_observe"),
        next_deadline,
        "processing",
        &[
            ("pond_entry_time", &now as &dyn rusqlite::ToSql),
            ("pond_id", &req.pond_id.trim() as &dyn rusqlite::ToSql),
            ("pond_quantity", &pond_qty_str.parse::<i64>().unwrap_or(0) as &dyn rusqlite::ToSql),
        ],
        req.remark.as_deref(),
    );

    let detail = format!(
        "池塘编号：{}，入塘数量：{} {}；{}",
        req.pond_id, req.pond_quantity, record.unit,
        req.remark.as_deref().map(|r| format!("备注：{}", r)).unwrap_or_default()
    );
    write_log(
        pool,
        &user,
        Some(id),
        "苗种入塘登记完成",
        &format!("批次号 {}", record.batch_no),
        Some(&detail),
        Some(&advance.old_record_status),
        Some(&advance.new_record_status),
        req.remark.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("苗种入塘登记完成，进入「{}」节点（责任人：{}，时限 {} 小时）",
            node_label("survival_observe"),
            role_label(role_to_assign("survival_observe")),
            next_deadline
        ),
    )))
}

#[post("/<id>/survival-observe", format = "json", data = "<req>")]
pub fn survival_observe(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<SurvivalObserveRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["registrar"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if record.current_node != "survival_observe" {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err(&format!(
            "当前节点「{}」，不允许登记成活观察",
            node_label(&record.current_node)
        )))));
    }
    if !(0.0..=100.0).contains(&req.survival_rate) {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("成活率应在 0 到 100 之间"))));
    }

    let now = now_str();
    let rate_str = req.survival_rate.to_string();
    let next_deadline = req.deadline_hours.unwrap_or(72);
    let advance = complete_node_and_advance(
        pool,
        id,
        "survival_observe",
        "archive_review",
        role_to_assign("archive_review"),
        next_deadline,
        "processing",
        &[
            ("survival_rate", &rate_str.parse::<f64>().unwrap_or(0.0) as &dyn rusqlite::ToSql),
            ("survival_observe_time", &now as &dyn rusqlite::ToSql),
        ],
        req.remark.as_deref(),
    );

    let detail = format!(
        "成活率：{:.2}%{}",
        req.survival_rate,
        req.remark.as_deref().map(|r| format!("；观察备注：{}", r)).unwrap_or_default()
    );
    write_log(
        pool,
        &user,
        Some(id),
        "成活观察登记完成",
        &format!("批次号 {}", record.batch_no),
        Some(&detail),
        Some(&advance.old_record_status),
        Some(&advance.new_record_status),
        req.remark.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("成活观察登记完成，进入「{}」节点（责任人：{}，时限 {} 小时）",
            node_label("archive_review"),
            role_label(role_to_assign("archive_review")),
            next_deadline
        ),
    )))
}

#[post("/<id>/archive", format = "json", data = "<req>")]
pub fn archive(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<ArchiveRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["reviewer"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if record.current_node != "archive_review" {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err(&format!(
            "当前节点「{}」，不允许归档复核",
            node_label(&record.current_node)
        )))));
    }
    if req.archive_remark.trim().is_empty() {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("归档复核意见为必填"))));
    }

    let now = now_str();
    let rm_str = req.archive_remark.trim().to_string();
    let advance = complete_node_and_advance(
        pool,
        id,
        "archive_review",
        "done",
        "",
        0,
        "completed",
        &[
            ("archive_time", &now as &dyn rusqlite::ToSql),
            ("archive_remark", &rm_str.as_str() as &dyn rusqlite::ToSql),
        ],
        Some(req.archive_remark.trim()),
    );

    write_log(
        pool,
        &user,
        Some(id),
        "批次归档复核完成（结案）",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("归档复核意见：{}", req.archive_remark)),
        Some(&advance.old_record_status),
        Some("completed"),
        None,
    );

    refresh_node_timeout(pool, id);
    let _ = build_and_save_archive_summary(pool, id, &user);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "批次归档完成，记录已结案，状态与节点不再允许变更",
    )))
}

#[post("/<id>/handle-timeout", format = "json", data = "<req>")]
pub fn handle_timeout(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
    req: Json<TimeoutHandleRequest>,
) -> Result<Json<ApiResponse<SeedRecordDetail>>, Custom<Json<ApiResponse<()>>>> {
    require_role(&user, &["registrar", "auditor", "reviewer"])
        .map_err(|e| Custom(Status::Forbidden, Json(ApiResponse::err(&e))))?;
    refresh_node_timeout(pool, id);
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;
    if count_timeout_for_record(pool, id) == 0 {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("当前记录没有超时的节点，无需处理"))));
    }
    if req.timeout_reason.trim().is_empty() || req.follow_up_action.trim().is_empty() {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("超时原因与后续处理措施均为必填"))));
    }

    let now = now_str();
    {
        let conn = pool.lock();
        let remark_for_coalesce = req.timeout_remark.clone().unwrap_or_default();
        let _ = conn.execute(
            "UPDATE node_tracking SET timeout_reason=?1, follow_up_action=?2, timeout_remark=?3, updated_at=?4, remark=COALESCE(remark, ?5) WHERE record_id=?6 AND is_timeout=1 AND status != 'completed'",
            rusqlite::params![
                req.timeout_reason.trim(),
                req.follow_up_action.trim(),
                req.timeout_remark.clone(),
                now,
                remark_for_coalesce,
                id,
            ],
        );
    }
    update_record_timestamp(pool, id);

    let detail_full = format!(
        "超时原因：{}；后续处理措施：{}{}{}",
        req.timeout_reason,
        req.follow_up_action,
        req.timeout_remark.as_deref().map(|r| format!("；超时处理备注：{}", r)).unwrap_or_default(),
        req.evidence_note.as_deref().map(|e| format!("；证据说明：{}", e)).unwrap_or_default()
    );
    write_log(
        pool,
        &user,
        Some(id),
        "节点超时处理登记",
        &format!("批次号 {}", record.batch_no),
        Some(&detail_full),
        None,
        None,
        req.evidence_note.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "超时节点的原因、后续处理、证据说明已全部留存，节点追踪与操作记录均可回查",
    )))
}

#[post("/batch", format = "json", data = "<req>")]
pub fn batch_action(
    pool: &State<DbPool>,
    user: AuthUser,
    req: Json<BatchActionRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, Custom<Json<ApiResponse<()>>>> {
    if req.record_ids.is_empty() {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err("请选择至少一条苗种记录"))));
    }
    let mut ok_count = 0usize;
    let mut fail_count = 0usize;
    let mut messages: Vec<String> = vec![];

    for rid in &req.record_ids {
        match req.action.as_str() {
            "approve-audit" => {
                let res = approve_audit_inner(pool, &user, rid, &req.remark);
                match res {
                    Ok(_) => ok_count += 1,
                    Err(msg) => { fail_count += 1; messages.push(format!("记录 {}: {}", rid, msg)); }
                }
            }
            "archive" => {
                let res = archive_inner(pool, &user, rid, &req.remark);
                match res {
                    Ok(_) => ok_count += 1,
                    Err(msg) => { fail_count += 1; messages.push(format!("记录 {}: {}", rid, msg)); }
                }
            }
            _ => {
                return Err(Custom(Status::BadRequest, Json(ApiResponse::err("不支持的批量操作（支持 approve-audit / archive）"))));
            }
        }
    }

    let msg = if fail_count == 0 {
        format!("批量操作成功，共处理 {} 条记录（与单条流程完全一致：状态流转/责任人/节点时限/日志均相同）", ok_count)
    } else {
        format!("批量操作完成：成功 {} 条，失败 {} 条", ok_count, fail_count)
    };
    Ok(Json(ApiResponse::ok(
        serde_json::json!({ "success_count": ok_count, "fail_count": fail_count, "detail": messages }),
        &msg,
    )))
}

fn approve_audit_inner(pool: &State<DbPool>, user: &AuthUser, id: &str, remark: &Option<String>) -> Result<(), String> {
    if user.role != "auditor" { return Err("仅苗种审核主管可批量审核通过".into()); }
    let record = query_record(pool, id).ok_or_else(|| "未找到苗种记录".to_string())?;
    if record.current_node != "audit" {
        return Err(format!("当前节点为「{}」，非审核节点，已跳过", node_label(&record.current_node)));
    }
    let advance = complete_node_and_advance(
        pool,
        id,
        "audit",
        "pond_entry",
        role_to_assign("pond_entry"),
        48,
        "approved",
        &[],
        remark.as_deref(),
    );
    write_log(
        pool,
        user,
        Some(id),
        "批量审核通过",
        &format!("批次号 {}", record.batch_no),
        Some(&format!(
            "批量审核通过，下一节点「{}」（责任人：{}，时限 48 小时）",
            node_label("pond_entry"),
            role_label(role_to_assign("pond_entry"))
        )),
        Some(&advance.old_record_status),
        Some(&advance.new_record_status),
        remark.as_deref(),
    );
    refresh_node_timeout(pool, id);
    Ok(())
}

fn archive_inner(pool: &State<DbPool>, user: &AuthUser, id: &str, remark: &Option<String>) -> Result<(), String> {
    if user.role != "reviewer" { return Err("仅水产养殖基地复核负责人可批量归档".into()); }
    let record = query_record(pool, id).ok_or_else(|| "未找到苗种记录".to_string())?;
    if record.current_node != "archive_review" {
        return Err(format!("当前节点为「{}」，非归档复核节点，已跳过", node_label(&record.current_node)));
    }
    let now = now_str();
    let rm = remark.clone().unwrap_or_else(|| "批量归档，复核通过".to_string());
    let advance = complete_node_and_advance(
        pool,
        id,
        "archive_review",
        "done",
        "",
        0,
        "completed",
        &[
            ("archive_time", &now as &dyn rusqlite::ToSql),
            ("archive_remark", &rm.as_str() as &dyn rusqlite::ToSql),
        ],
        Some(&rm),
    );
    write_log(
        pool,
        user,
        Some(id),
        "批量归档复核完成（结案）",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("归档复核意见：{}", rm)),
        Some(&advance.old_record_status),
        Some("completed"),
        None,
    );
    refresh_node_timeout(pool, id);
    let _ = build_and_save_archive_summary(pool, id, user);
    Ok(())
}

fn build_and_save_archive_summary(
    pool: &State<DbPool>,
    record_id: &str,
    user: &AuthUser,
) -> Result<ArchiveSummary, String> {
    let record = query_record(pool, record_id).ok_or_else(|| "未找到苗种记录".to_string())?;
    if record.overall_status != "completed" {
        return Err("仅已完成归档的记录可生成结案摘要".into());
    }
    let nodes = query_nodes(pool, record_id);

    let mut total_duration_hours: f64 = 0.0;
    let mut completed_count: i64 = 0;
    let mut timeout_count: i64 = 0;
    let mut node_duration_parts: Vec<String> = vec![];
    let mut timeout_parts: Vec<String> = vec![];

    for n in &nodes {
        if n.status == "completed" {
            completed_count += 1;
            if let (Some(started), Some(completed)) = (Some(n.created_at.clone()), n.completed_at.clone()) {
                if let (Ok(s), Ok(c)) = (
                    DateTime::parse_from_rfc3339(&started),
                    DateTime::parse_from_rfc3339(&completed),
                ) {
                    let dur = c.signed_duration_since(s);
                    let hours = dur.num_seconds() as f64 / 3600.0;
                    total_duration_hours += hours.max(0.0);
                    node_duration_parts.push(format!("{}: {:.1} 小时", n.node_name, hours.max(0.0)));
                }
            }
        }
        if n.is_timeout {
            timeout_count += 1;
            let reason = n.timeout_reason.as_deref().unwrap_or("未记录");
            let follow = n.follow_up_action.as_deref().unwrap_or("未记录");
            timeout_parts.push(format!("[{}] 原因：{}；后续：{}", n.node_name, reason, follow));
        }
    }

    let timeout_summary = if timeout_parts.is_empty() {
        None
    } else {
        Some(timeout_parts.join("；"))
    };
    let node_duration_summary = if node_duration_parts.is_empty() {
        None
    } else {
        Some(node_duration_parts.join("；"))
    };

    let now = now_str();
    let id = Uuid::new_v4().to_string();
    let reviewer_name = user.real_name.clone();
    let reviewer_id = user.user_id.clone();
    let archive_remark = record.archive_remark.clone().unwrap_or_default();
    let archive_time = record.archive_time.clone().unwrap_or_else(|| now.clone());

    {
        let conn = pool.lock();
        let existing: Result<String, _> = conn.query_row(
            "SELECT id FROM archive_summary WHERE record_id = ?1",
            rusqlite::params![record_id],
            |row| row.get(0),
        );
        if let Ok(existing_id) = existing {
            let _ = conn.execute(
                "UPDATE archive_summary SET archive_time=?1, archive_remark=?2, reviewer_id=?3, reviewer_name=?4, \
                 total_duration_hours=?5, node_count=?6, completed_node_count=?7, timeout_node_count=?8, \
                 timeout_summary=?9, node_duration_summary=?10, final_status=?11, updated_at=?12 WHERE id=?13",
                rusqlite::params![
                    archive_time,
                    archive_remark,
                    reviewer_id,
                    reviewer_name,
                    total_duration_hours,
                    nodes.len() as i64,
                    completed_count,
                    timeout_count,
                    timeout_summary,
                    node_duration_summary,
                    "completed",
                    now,
                    existing_id,
                ],
            );
            return Ok(query_archive_summary_inner(pool, record_id).unwrap());
        }

        let _ = conn.execute(
            "INSERT INTO archive_summary (
                id, record_id, batch_no, archive_time, archive_remark, reviewer_id, reviewer_name,
                total_duration_hours, node_count, completed_node_count, timeout_node_count,
                timeout_summary, node_duration_summary, final_status, created_at, updated_at
            ) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            rusqlite::params![
                id,
                record_id,
                record.batch_no,
                archive_time,
                archive_remark,
                reviewer_id,
                reviewer_name,
                total_duration_hours,
                nodes.len() as i64,
                completed_count,
                timeout_count,
                timeout_summary,
                node_duration_summary,
                "completed",
                now,
                now,
            ],
        );
    }

    query_archive_summary_inner(pool, record_id).ok_or_else(|| "生成结案摘要失败".into())
}

fn query_archive_summary_inner(pool: &State<DbPool>, record_id: &str) -> Option<ArchiveSummary> {
    let conn = pool.lock();
    conn.query_row(
        "SELECT id, record_id, batch_no, archive_time, archive_remark, reviewer_id, reviewer_name,
                total_duration_hours, node_count, completed_node_count, timeout_node_count,
                timeout_summary, node_duration_summary, final_status, created_at, updated_at
         FROM archive_summary WHERE record_id = ?1",
        rusqlite::params![record_id],
        |row| {
            Ok(ArchiveSummary {
                id: row.get(0)?,
                record_id: row.get(1)?,
                batch_no: row.get(2)?,
                archive_time: row.get(3)?,
                archive_remark: row.get(4)?,
                reviewer_id: row.get(5)?,
                reviewer_name: row.get(6)?,
                total_duration_hours: row.get(7)?,
                node_count: row.get(8)?,
                completed_node_count: row.get(9)?,
                timeout_node_count: row.get(10)?,
                timeout_summary: row.get(11).ok(),
                node_duration_summary: row.get(12).ok(),
                final_status: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        },
    )
    .ok()
}

fn to_public_summary(s: &ArchiveSummary) -> ArchiveSummaryPublic {
    ArchiveSummaryPublic {
        id: s.id.clone(),
        record_id: s.record_id.clone(),
        batch_no: s.batch_no.clone(),
        archive_time: s.archive_time.clone(),
        archive_remark: s.archive_remark.clone(),
        reviewer_name: s.reviewer_name.clone(),
        total_duration_hours: s.total_duration_hours,
        node_count: s.node_count,
        completed_node_count: s.completed_node_count,
        timeout_node_count: s.timeout_node_count,
        timeout_summary: s.timeout_summary.clone(),
        node_duration_summary: s.node_duration_summary.clone(),
        final_status: s.final_status.clone(),
        created_at: s.created_at.clone(),
    }
}

#[get("/<id>/archive-summary")]
pub fn get_archive_summary(
    pool: &State<DbPool>,
    user: AuthUser,
    id: &str,
) -> Result<Json<ApiResponse<ArchiveSummaryPublic>>, Custom<Json<ApiResponse<()>>>> {
    let _ = user;
    let record = query_record(pool, id)
        .ok_or_else(|| Custom(Status::NotFound, Json(ApiResponse::err("未找到该苗种记录"))))?;

    if record.overall_status != "completed" {
        return Err(Custom(
            Status::BadRequest,
            Json(ApiResponse::err("该记录尚未归档结案，暂无结案摘要")),
        ));
    }

    let summary = query_archive_summary_inner(pool, id);
    let summary = match summary {
        Some(s) => s,
        None => {
            return Err(Custom(
                Status::NotFound,
                Json(ApiResponse::err("未找到结案摘要")),
            ))
        }
    };

    let can_see_full = user.role == "reviewer" || user.role == "auditor";
    let public = if can_see_full {
        to_public_summary(&summary)
    } else {
        let mut pub_s = to_public_summary(&summary);
        pub_s.reviewer_name = if user.role == "registrar" {
            summary.reviewer_name.clone()
        } else {
            "复核负责人".to_string()
        };
        pub_s
    };

    Ok(Json(ApiResponse::ok(public, "获取结案摘要成功")))
}

pub fn routes() -> Vec<rocket::Route> {
    routes![
        list_records, get_record, create_record, update_record,
        approve_audit, reject_audit, pond_entry, survival_observe, archive,
        handle_timeout, batch_action, get_archive_summary
    ]
}
