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
) -> String {
    let conn = pool.lock();
    let existing: Result<String, _> = conn.query_row(
        "SELECT id FROM node_tracking WHERE record_id = ?1 AND node_type = ?2",
        rusqlite::params![record_id, node_type],
        |row| row.get(0),
    );
    if let Ok(id) = existing {
        let _ = conn.execute(
            "UPDATE node_tracking SET updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now_str(), id],
        );
        return id;
    }
    let id = Uuid::new_v4().to_string();
    let _ = conn.execute(
        "INSERT INTO node_tracking (id, record_id, node_type, node_name, assignee_id, assignee_name, deadline, status, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        rusqlite::params![
            id,
            record_id,
            node_type,
            node_name,
            assignee_id,
            assignee_name,
            add_hours_str(deadline_hours),
            status,
            now_str(),
            now_str(),
        ],
    );
    id
}

fn refresh_node_timeout(pool: &State<DbPool>, record_id: &str) {
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
    let conn = pool.lock();
    conn.query_row(
        "SELECT COUNT(*) FROM node_tracking WHERE record_id = ?1 AND is_timeout = 1",
        rusqlite::params![record_id],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

fn role_to_assign(node: &str) -> &'static str {
    match node {
        "audit" => "auditor",
        "pond_entry" | "survival_observe" => "registrar",
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

        let mut timeout_sql = "SELECT COUNT(DISTINCT nt.record_id) FROM node_tracking nt JOIN seed_records sr ON sr.id = nt.record_id WHERE nt.is_timeout = 1 AND nt.status != 'completed'".to_string();
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
                "registration",
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
    );

    write_log(
        pool,
        &user,
        Some(&id),
        "创建苗种记录",
        &format!("批次号 {}", batch_no),
        Some(&format!(
            "苗种类型：{}，品种：{}，数量：{}{}，来源：{}",
            req.seed_type,
            req.seed_species,
            req.quantity,
            req.unit.clone().unwrap_or_else(|| "尾".to_string()),
            req.source
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
        &format!("苗种记录创建成功，批次号：{}，已提交至{}审核", batch_no, role_label("auditor")),
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

    let mut record = query_record(pool, id)
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

    if let Some(v) = &req.seed_type { record.seed_type = v.clone(); }
    if let Some(v) = &req.seed_species { record.seed_species = v.clone(); }
    if let Some(v) = req.quantity { record.quantity = v; }
    if let Some(v) = &req.unit { record.unit = v.clone(); }
    if let Some(v) = &req.source { record.source = v.clone(); }
    if req.supplier.is_some() { record.supplier = req.supplier.clone(); }

    {
        let conn = pool.lock();
        conn.execute(
            "UPDATE seed_records SET seed_type=?1, seed_species=?2, quantity=?3, unit=?4, source=?5, supplier=?6, updated_at=?7 WHERE id=?8",
            rusqlite::params![
                record.seed_type, record.seed_species, record.quantity, record.unit,
                record.source, record.supplier, now_str(), id,
            ],
        ).map_err(|e| Custom(Status::InternalServerError, Json(ApiResponse::err(&format!("更新失败：{}", e)))))?;
    }

    if record.overall_status == "correction" {
        let conn = pool.lock();
        let _ = conn.execute(
            "UPDATE seed_records SET overall_status = 'pending', current_node = 'audit', updated_at = ?1 WHERE id = ?2",
            rusqlite::params![now_str(), id],
        );
        record.overall_status = "pending".to_string();
        record.current_node = "audit".to_string();
    }

    write_log(
        pool,
        &user,
        Some(id),
        if record.overall_status == "pending" { "补正苗种记录并重新提交审核" } else { "修改苗种记录" },
        &format!("批次号 {}", record.batch_no),
        Some("登记员更新了苗种记录信息"),
        Some("correction"),
        Some("pending"),
        None,
    );

    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "苗种记录已更新并重新提交审核",
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
    if record.current_node != "audit" || (record.overall_status != "pending" && record.overall_status != "processing") {
        return Err(Custom(Status::BadRequest, Json(ApiResponse::err(&format!(
            "当前节点「{}」状态「{}」不允许审核通过，需在审核节点待处理或处理中",
            node_label(&record.current_node), status_label(&record.overall_status)
        )))));
    }

    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE seed_records SET overall_status='approved', current_node='pond_entry', updated_at=?1 WHERE id=?2",
        rusqlite::params![now_str(), id],
    );
    let _ = conn.execute(
        "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='audit'",
        rusqlite::params![now_str(), now_str(), id],
    );
    drop(conn);

    let deadline_hours = req.deadline_hours.unwrap_or(48);
    upsert_node(
        pool,
        id,
        "pond_entry",
        node_label("pond_entry"),
        Some(&user.user_id),
        Some(&user.real_name),
        deadline_hours,
        "pending",
    );

    write_log(
        pool,
        &user,
        Some(id),
        "审核通过",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("审核主管已通过该批次苗种记录，进入下一节点：{}", node_label("pond_entry"))),
        Some(&record.overall_status),
        Some("approved"),
        req.evidence_note.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "审核已通过，记录转入苗种入塘节点",
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

    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE seed_records SET overall_status='correction', current_node='registration', updated_at=?1 WHERE id=?2",
        rusqlite::params![now_str(), id],
    );
    let _ = conn.execute(
        "UPDATE node_tracking SET status='rejected', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='audit'",
        rusqlite::params![now_str(), now_str(), id],
    );
    drop(conn);

    write_log(
        pool,
        &user,
        Some(id),
        "审核驳回",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("驳回原因：{}", req.reason)),
        Some(&record.overall_status),
        Some("correction"),
        req.evidence_note.as_deref(),
    );

    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("已驳回至登记员补正，原因：{}", req.reason),
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
    {
        let conn = pool.lock();
        let _ = conn.execute(
            "UPDATE seed_records SET pond_entry_time=?1, pond_id=?2, pond_quantity=?3, overall_status='processing', current_node='survival_observe', updated_at=?4 WHERE id=?5",
            rusqlite::params![now, req.pond_id.trim(), req.pond_quantity, now, id],
        );
        let _ = conn.execute(
            "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='pond_entry'",
            rusqlite::params![now, now, id],
        );
    }

    let deadline_hours = req.deadline_hours.unwrap_or(240);
    upsert_node(
        pool,
        id,
        "survival_observe",
        node_label("survival_observe"),
        Some(&user.user_id),
        Some(&user.real_name),
        deadline_hours,
        "pending",
    );

    write_log(
        pool,
        &user,
        Some(id),
        "苗种入塘登记",
        &format!("批次号 {}", record.batch_no),
        Some(&format!(
            "池塘：{}，入塘数量：{}{}",
            req.pond_id, req.pond_quantity, record.unit
        )),
        Some(&record.overall_status),
        Some("processing"),
        req.remark.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
 let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("苗种入塘登记已完成，进入「{}」节点", node_label("survival_observe")),
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
    let reviewer = find_user_by_role(pool, role_to_assign("archive_review"));
    {
        let conn = pool.lock();
        let _ = conn.execute(
            "UPDATE seed_records SET survival_rate=?1, survival_observe_time=?2, current_node='archive_review', updated_at=?3 WHERE id=?4",
            rusqlite::params![req.survival_rate, now, now, id],
        );
        let _ = conn.execute(
            "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='survival_observe'",
            rusqlite::params![now, now, id],
        );
    }

    let deadline_hours = req.deadline_hours.unwrap_or(72);
    upsert_node(
        pool,
        id,
        "archive_review",
        node_label("archive_review"),
        reviewer.as_ref().map(|(i, _)| i.as_str()),
        reviewer.as_ref().map(|(_, n)| n.as_str()),
        deadline_hours,
        "pending",
    );

    write_log(
        pool,
        &user,
        Some(id),
        "成活观察登记",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("成活率：{:.2}%", req.survival_rate)),
        Some(&record.overall_status),
        Some("processing"),
        req.remark.as_deref(),
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        &format!("成活观察已登记，进入「{}」节点", node_label("archive_review")),
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
    {
        let conn = pool.lock();
        let _ = conn.execute(
            "UPDATE seed_records SET archive_time=?1, archive_remark=?2, overall_status='completed', current_node='done', updated_at=?3 WHERE id=?4",
            rusqlite::params![now, req.archive_remark.trim(), now, id],
        );
        let _ = conn.execute(
            "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='archive_review'",
            rusqlite::params![now, now, id],
        );
    }

    write_log(
        pool,
        &user,
        Some(id),
        "批次归档复核完成",
        &format!("批次号 {}", record.batch_no),
        Some(&format!("归档复核意见：{}", req.archive_remark)),
        Some(&record.overall_status),
        Some("completed"),
        None,
    );

    refresh_node_timeout(pool, id);
    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "批次归档完成，记录已结案",
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

    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE node_tracking SET timeout_reason=?1, follow_up_action=?2, timeout_remark=?3, updated_at=?4 WHERE record_id=?5 AND is_timeout=1 AND status != 'completed'",
        rusqlite::params![
            req.timeout_reason.trim(),
            req.follow_up_action.trim(),
            req.timeout_remark,
            now_str(),
            id,
        ],
    );
    drop(conn);
    update_record_timestamp(pool, id);

    write_log(
        pool,
        &user,
        Some(id),
        "处理节点超时",
        &format!("批次号 {}", record.batch_no),
        Some(&format!(
            "超时原因：{}；后续处理措施：{}；备注：{}",
            req.timeout_reason,
            req.follow_up_action,
            req.timeout_remark.clone().unwrap_or_default()
        )),
        None,
        None,
        req.evidence_note.as_deref(),
    );

    let record = query_record(pool, id).unwrap();
    let nodes = query_nodes(pool, id);
    let logs = query_logs(pool, id);
    Ok(Json(ApiResponse::ok(
        SeedRecordDetail { record, nodes, logs },
        "超时节点已登记原因与处理措施，证据已留存",
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
                    Err(msg) => { fail_count += 1; messages.push(format!("批次 {}: {}", rid, msg)); }
                }
            }
            "archive" => {
                let res = archive_inner(pool, &user, rid, &req.remark);
                match res {
                    Ok(_) => ok_count += 1,
                    Err(msg) => { fail_count += 1; messages.push(format!("批次 {}: {}", rid, msg)); }
                }
            }
            _ => {
                return Err(Custom(Status::BadRequest, Json(ApiResponse::err("不支持的批量操作"))));
            }
        }
    }

    let msg = if fail_count == 0 {
        format!("批量操作成功，共处理 {} 条记录", ok_count)
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
    let record = query_record(pool, id).ok_or_else(|| "未找到记录".to_string())?;
    if record.current_node != "audit" { return Err("非审核节点".into()); }
    let now = now_str();
    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE seed_records SET overall_status='approved', current_node='pond_entry', updated_at=?1 WHERE id=?2",
        rusqlite::params![now, id],
    );
    let _ = conn.execute(
        "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='audit'",
        rusqlite::params![now, now, id],
    );
    drop(conn);
    let registrar = find_user_by_role(pool, "registrar");
    upsert_node(pool, id, "pond_entry", node_label("pond_entry"),
        registrar.as_ref().map(|(i, _)| i.as_str()),
        registrar.as_ref().map(|(_, n)| n.as_str()),
        48, "pending");
    write_log(pool, user, Some(id), "批量审核通过", &format!("批次号 {}", record.batch_no),
        remark.as_deref(), Some(&record.overall_status), Some("approved"), remark.as_deref());
    Ok(())
}

fn archive_inner(pool: &State<DbPool>, user: &AuthUser, id: &str, remark: &Option<String>) -> Result<(), String> {
    if user.role != "reviewer" { return Err("仅复核负责人可批量归档".into()); }
    let record = query_record(pool, id).ok_or_else(|| "未找到记录".to_string())?;
    if record.current_node != "archive_review" { return Err("非归档复核节点".into()); }
    let now = now_str();
    let rm = remark.clone().unwrap_or_else(|| "批量归档，复核通过".to_string());
    let conn = pool.lock();
    let _ = conn.execute(
        "UPDATE seed_records SET archive_time=?1, archive_remark=?2, overall_status='completed', current_node='done', updated_at=?3 WHERE id=?4",
        rusqlite::params![now, rm, now, id],
    );
    let _ = conn.execute(
        "UPDATE node_tracking SET status='completed', completed_at=?1, updated_at=?2 WHERE record_id=?3 AND node_type='archive_review'",
        rusqlite::params![now, now, id],
    );
    drop(conn);
    write_log(pool, user, Some(id), "批量归档复核", &format!("批次号 {}", record.batch_no),
        Some(&rm), Some(&record.overall_status), Some("completed"), None);
    Ok(())
}

pub fn routes() -> Vec<rocket::Route> {
    routes![
        list_records, get_record, create_record, update_record,
        approve_audit, reject_audit, pond_entry, survival_observe, archive,
        handle_timeout, batch_action
    ]
}
