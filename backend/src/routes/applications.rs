use rocket::serde::json::Json;
use rocket::http::Status;
use rusqlite::params;
use serde_json;

use crate::models::*;
use crate::db::DB_CONN;
use crate::auth::AuthenticatedUser;

fn generate_application_no() -> String {
    use chrono::Utc;
    use rand::Rng;
    let now = Utc::now();
    let rand: u32 = rand::thread_rng().gen_range(1000..9999);
    format!("RP{}{:04}", now.format("%Y%m%d%H%M%S"), rand)
}

fn parse_items(items_json: &str) -> Vec<ReplenishmentItem> {
    serde_json::from_str(items_json).unwrap_or_default()
}

fn get_application_by_id(id: i64) -> Option<ReplenishmentApplication> {
    let conn = DB_CONN.lock().unwrap();
    let result = conn.query_row(
        "SELECT a.id, a.application_no, a.store_id, s.store_no, s.store_name, 
                a.status, a.current_version, a.items, 
                a.evidence_store_replenishment, a.evidence_delivery_confirmation, a.evidence_registration,
                a.remarks, a.created_by, u1.display_name, a.created_at, 
                a.updated_by, u2.display_name, a.updated_at
         FROM replenishment_applications a
         JOIN stores s ON a.store_id = s.id
         JOIN users u1 ON a.created_by = u1.id
         LEFT JOIN users u2 ON a.updated_by = u2.id
         WHERE a.id = ?1",
        params![id],
        |row| {
            let status_str: String = row.get(5)?;
            let items_json: String = row.get(7)?;
            Ok(ReplenishmentApplication {
                id: row.get(0)?,
                application_no: row.get(1)?,
                store_id: row.get(2)?,
                store_no: row.get(3)?,
                store_name: row.get(4)?,
                status: ApplicationStatus::from_str(&status_str).unwrap_or(ApplicationStatus::Draft),
                current_version: row.get(6)?,
                items: parse_items(&items_json),
                evidence_store_replenishment: row.get(8)?,
                evidence_delivery_confirmation: row.get(9)?,
                evidence_registration: row.get(10)?,
                remarks: row.get(11)?,
                created_by: row.get(12)?,
                created_by_name: row.get(13)?,
                created_at: row.get(14)?,
                updated_by: row.get(15)?,
                updated_by_name: row.get(16)?,
                updated_at: row.get(17)?,
            })
        },
    );
    result.ok()
}

#[get("/applications?<status>&<store_id>")]
pub fn list_applications(
    auth: AuthenticatedUser,
    status: Option<String>,
    store_id: Option<i64>,
) -> Json<Vec<ReplenishmentApplication>> {
    let conn = DB_CONN.lock().unwrap();
    
    let mut sql = String::from(
        "SELECT a.id, a.application_no, a.store_id, s.store_no, s.store_name, 
                a.status, a.current_version, a.items, 
                a.evidence_store_replenishment, a.evidence_delivery_confirmation, a.evidence_registration,
                a.remarks, a.created_by, u1.display_name, a.created_at, 
                a.updated_by, u2.display_name, a.updated_at
         FROM replenishment_applications a
         JOIN stores s ON a.store_id = s.id
         JOIN users u1 ON a.created_by = u1.id
         LEFT JOIN users u2 ON a.updated_by = u2.id
         WHERE 1=1"
    );
    
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(s) = &status {
        sql.push_str(" AND a.status = ?");
        params_vec.push(Box::new(s.clone()));
    }
    
    if let Some(sid) = store_id {
        sql.push_str(" AND a.store_id = ?");
        params_vec.push(Box::new(sid));
    }
    
    sql.push_str(" ORDER BY a.created_at DESC");
    
    let mut stmt = conn.prepare(&sql).unwrap();
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let apps = stmt.query_map(params_refs.as_slice(), |row| {
        let status_str: String = row.get(5)?;
        let items_json: String = row.get(7)?;
        Ok(ReplenishmentApplication {
            id: row.get(0)?,
            application_no: row.get(1)?,
            store_id: row.get(2)?,
            store_no: row.get(3)?,
            store_name: row.get(4)?,
            status: ApplicationStatus::from_str(&status_str).unwrap_or(ApplicationStatus::Draft),
            current_version: row.get(6)?,
            items: parse_items(&items_json),
            evidence_store_replenishment: row.get(8)?,
            evidence_delivery_confirmation: row.get(9)?,
            evidence_registration: row.get(10)?,
            remarks: row.get(11)?,
            created_by: row.get(12)?,
            created_by_name: row.get(13)?,
            created_at: row.get(14)?,
            updated_by: row.get(15)?,
            updated_by_name: row.get(16)?,
            updated_at: row.get(17)?,
        })
    }).unwrap();

    let result: Vec<ReplenishmentApplication> = apps.filter_map(|a| a.ok()).collect();
    Json(result)
}

#[get("/applications/<id>")]
pub fn get_application(
    auth: AuthenticatedUser,
    id: i64,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    get_application_by_id(id)
        .map(Json)
        .ok_or_else(|| (
            Status::NotFound,
            Json(ApiError {
                error: "申请不存在".to_string(),
                details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
            })
        ))
}

#[post("/applications", format = "json", data = "<req>")]
pub fn create_application(
    auth: AuthenticatedUser,
    req: Json<CreateApplicationRequest>,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::Registrar => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有补货登记员可以创建申请，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    if req.items.is_empty() {
        return Err((
            Status::BadRequest,
            Json(ApiError {
                error: "申请内容无效".to_string(),
                details: Some("补货商品列表不能为空".to_string()),
            })
        ));
    }

    let conn = DB_CONN.lock().unwrap();
    let app_no = generate_application_no();
    let items_json = serde_json::to_string(&req.items).unwrap();

    conn.execute(
        "INSERT INTO replenishment_applications 
         (application_no, store_id, status, current_version, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, created_by)
         VALUES (?1, ?2, 'draft', 1, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            app_no,
            req.store_id,
            items_json,
            req.evidence_store_replenishment,
            req.evidence_delivery_confirmation,
            req.evidence_registration,
            req.remarks,
            auth.user.id
        ],
    ).map_err(|e| (
        Status::InternalServerError,
        Json(ApiError {
            error: "创建申请失败".to_string(),
            details: Some(e.to_string()),
        })
    ))?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, 1, NULL, 'draft', ?2, ?3, ?4, ?5, ?6, 'create', ?7)",
        params![
            id,
            items_json,
            req.evidence_store_replenishment,
            req.evidence_delivery_confirmation,
            req.evidence_registration,
            req.remarks,
            auth.user.id
        ],
    ).unwrap();

    drop(conn);
    Ok(Json(get_application_by_id(id).unwrap()))
}

#[put("/applications/<id>", format = "json", data = "<req>")]
pub fn update_application(
    auth: AuthenticatedUser,
    id: i64,
    req: Json<UpdateApplicationRequest>,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::Registrar => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有补货登记员可以编辑申请，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    let app = get_application_by_id(id)
        .ok_or_else(|| (
            Status::NotFound,
            Json(ApiError {
                error: "申请不存在".to_string(),
                details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
            })
        ))?;

    match app.status {
        ApplicationStatus::Draft | ApplicationStatus::NeedsCorrection => {}
        _ => {
            return Err((
                Status::BadRequest,
                Json(ApiError {
                    error: "状态不允许编辑".to_string(),
                    details: Some(format!("当前状态为「{}」，只有草稿或需补正状态可以编辑", app.status.display_name())),
                })
            ));
        }
    }

    if app.current_version != req.current_version {
        return Err((
            Status::Conflict,
            Json(ApiError {
                error: "版本冲突".to_string(),
                details: Some(format!("当前版本为 v{}，你提供的版本为 v{}，请刷新后重试", app.current_version, req.current_version)),
            })
        ));
    }

    let new_version = app.current_version + 1;
    let items_json = req.items.as_ref()
        .map(|items| serde_json::to_string(items).unwrap())
        .unwrap_or_else(|| serde_json::to_string(&app.items).unwrap());

    let new_ev_store = req.evidence_store_replenishment
        .as_deref()
        .or(app.evidence_store_replenishment.as_deref());
    let new_ev_delivery = req.evidence_delivery_confirmation
        .as_deref()
        .or(app.evidence_delivery_confirmation.as_deref());
    let new_ev_reg = req.evidence_registration
        .as_deref()
        .or(app.evidence_registration.as_deref());
    let new_remarks = req.remarks.as_deref().or(app.remarks.as_deref());

    let conn = DB_CONN.lock().unwrap();

    conn.execute(
        "UPDATE replenishment_applications 
         SET current_version = ?1, items = ?2, 
             evidence_store_replenishment = COALESCE(?3, evidence_store_replenishment),
             evidence_delivery_confirmation = COALESCE(?4, evidence_delivery_confirmation),
             evidence_registration = COALESCE(?5, evidence_registration),
             remarks = COALESCE(?6, remarks),
             updated_by = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
        params![
            new_version,
            items_json,
            req.evidence_store_replenishment,
            req.evidence_delivery_confirmation,
            req.evidence_registration,
            req.remarks,
            auth.user.id,
            id
        ],
    ).map_err(|e| (
        Status::InternalServerError,
        Json(ApiError {
            error: "更新申请失败".to_string(),
            details: Some(e.to_string()),
        })
    ))?;

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, ?2, ?3, ?3, ?4, ?5, ?6, ?7, ?8, 'correct', ?9)",
        params![
            id,
            new_version,
            app.status.as_str(),
            items_json,
            new_ev_store,
            new_ev_delivery,
            new_ev_reg,
            new_remarks,
            auth.user.id
        ],
    ).unwrap();

    drop(conn);
    Ok(Json(get_application_by_id(id).unwrap()))
}

#[post("/applications/<id>/submit", format = "json", data = "<req>")]
pub fn submit_application(
    auth: AuthenticatedUser,
    id: i64,
    req: Json<SubmitRequest>,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::Registrar => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有补货登记员可以提交申请，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    let app = get_application_by_id(id)
        .ok_or_else(|| (
            Status::NotFound,
            Json(ApiError {
                error: "申请不存在".to_string(),
                details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
            })
        ))?;

    match app.status {
        ApplicationStatus::Draft | ApplicationStatus::NeedsCorrection => {}
        _ => {
            return Err((
                Status::BadRequest,
                Json(ApiError {
                    error: "状态不允许提交".to_string(),
                    details: Some(format!("当前状态为「{}」，只有草稿或需补正状态可以提交审核", app.status.display_name())),
                })
            ));
        }
    }

    if app.current_version != req.current_version {
        return Err((
            Status::Conflict,
            Json(ApiError {
                error: "版本冲突".to_string(),
                details: Some(format!("当前版本为 v{}，你提供的版本为 v{}，请刷新后重试", app.current_version, req.current_version)),
            })
        ));
    }

    let mut missing_evidence: Vec<&str> = Vec::new();
    if app.evidence_store_replenishment.as_deref().unwrap_or("").is_empty() {
        missing_evidence.push("门店补货凭证");
    }
    if app.evidence_delivery_confirmation.as_deref().unwrap_or("").is_empty() {
        missing_evidence.push("配送确认单");
    }
    if app.evidence_registration.as_deref().unwrap_or("").is_empty() {
        missing_evidence.push("补货申请登记凭证");
    }

    if !missing_evidence.is_empty() {
        return Err((
            Status::BadRequest,
            Json(ApiError {
                error: "缺少必要凭证".to_string(),
                details: Some(format!("提交审核前请先上传：{}", missing_evidence.join("、"))),
            })
        ));
    }

    let new_version = app.current_version + 1;
    let items_json = serde_json::to_string(&app.items).unwrap();

    let conn = DB_CONN.lock().unwrap();

    conn.execute(
        "UPDATE replenishment_applications 
         SET status = 'pending_review', current_version = ?1, 
             updated_by = ?2, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?3",
        params![new_version, auth.user.id, id],
    ).unwrap();

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, ?2, ?3, 'pending_review', ?4, ?5, ?6, ?7, ?8, 'submit', ?9)",
        params![
            id,
            new_version,
            app.status.as_str(),
            items_json,
            app.evidence_store_replenishment,
            app.evidence_delivery_confirmation,
            app.evidence_registration,
            app.remarks,
            auth.user.id
        ],
    ).unwrap();

    drop(conn);
    Ok(Json(get_application_by_id(id).unwrap()))
}

#[post("/applications/<id>/review", format = "json", data = "<req>")]
pub fn review_application(
    auth: AuthenticatedUser,
    id: i64,
    req: Json<ReviewRequest>,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::Reviewer => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有补货审核主管可以审核申请，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    let app = get_application_by_id(id)
        .ok_or_else(|| (
            Status::NotFound,
            Json(ApiError {
                error: "申请不存在".to_string(),
                details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
            })
        ))?;

    if app.status != ApplicationStatus::PendingReview {
        return Err((
            Status::BadRequest,
            Json(ApiError {
                error: "状态不允许审核".to_string(),
                details: Some(format!("当前状态为「{}」，只有待审核状态可以办理", app.status.display_name())),
            })
        ));
    }

    if app.current_version != req.current_version {
        return Err((
            Status::Conflict,
            Json(ApiError {
                error: "版本冲突".to_string(),
                details: Some(format!("当前版本为 v{}，你提供的版本为 v{}，请刷新后重试", app.current_version, req.current_version)),
            })
        ));
    }

    let (new_status, action) = if req.approved {
        (ApplicationStatus::Reviewed, ActionType::ReviewApprove)
    } else {
        (ApplicationStatus::NeedsCorrection, ActionType::ReviewReject)
    };

    let new_version = app.current_version + 1;
    let items_json = serde_json::to_string(&app.items).unwrap();

    let conn = DB_CONN.lock().unwrap();

    conn.execute(
        "UPDATE replenishment_applications 
         SET status = ?1, current_version = ?2, remarks = COALESCE(?3, remarks),
             updated_by = ?4, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
        params![new_status.as_str(), new_version, req.remarks, auth.user.id, id],
    ).unwrap();

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, ?2, 'pending_review', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            new_version,
            new_status.as_str(),
            items_json,
            app.evidence_store_replenishment,
            app.evidence_delivery_confirmation,
            app.evidence_registration,
            req.remarks,
            action.as_str(),
            auth.user.id
        ],
    ).unwrap();

    drop(conn);
    Ok(Json(get_application_by_id(id).unwrap()))
}

#[post("/applications/<id>/final-review", format = "json", data = "<req>")]
pub fn final_review_application(
    auth: AuthenticatedUser,
    id: i64,
    req: Json<ReviewRequest>,
) -> Result<Json<ReplenishmentApplication>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::FinalReviewer => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有连锁复核负责人可以复核归档，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    let app = get_application_by_id(id)
        .ok_or_else(|| (
            Status::NotFound,
            Json(ApiError {
                error: "申请不存在".to_string(),
                details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
            })
        ))?;

    if app.status != ApplicationStatus::Reviewed {
        return Err((
            Status::BadRequest,
            Json(ApiError {
                error: "状态不允许复核".to_string(),
                details: Some(format!("当前状态为「{}」，只有审核通过状态可以复核归档", app.status.display_name())),
            })
        ));
    }

    if app.current_version != req.current_version {
        return Err((
            Status::Conflict,
            Json(ApiError {
                error: "版本冲突".to_string(),
                details: Some(format!("当前版本为 v{}，你提供的版本为 v{}，请刷新后重试", app.current_version, req.current_version)),
            })
        ));
    }

    let (new_status, action) = if req.approved {
        (ApplicationStatus::Archived, ActionType::FinalApprove)
    } else {
        (ApplicationStatus::NeedsCorrection, ActionType::FinalReject)
    };

    let new_version = app.current_version + 1;
    let items_json = serde_json::to_string(&app.items).unwrap();

    let conn = DB_CONN.lock().unwrap();

    conn.execute(
        "UPDATE replenishment_applications 
         SET status = ?1, current_version = ?2, remarks = COALESCE(?3, remarks),
             updated_by = ?4, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
        params![new_status.as_str(), new_version, req.remarks, auth.user.id, id],
    ).unwrap();

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, ?2, 'reviewed', ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            new_version,
            new_status.as_str(),
            items_json,
            app.evidence_store_replenishment,
            app.evidence_delivery_confirmation,
            app.evidence_registration,
            req.remarks,
            action.as_str(),
            auth.user.id
        ],
    ).unwrap();

    drop(conn);
    Ok(Json(get_application_by_id(id).unwrap()))
}

fn do_review_single(
    app_id: i64,
    current_version: i32,
    approved: bool,
    remarks: Option<&str>,
    user_id: i64,
    role: &UserRole,
) -> BatchResultItem {
    let app = match get_application_by_id(app_id) {
        Some(a) => a,
        None => {
            return BatchResultItem {
                application_id: app_id,
                application_no: "UNKNOWN".to_string(),
                success: false,
                status: "not_found".to_string(),
                message: "申请不存在".to_string(),
            };
        }
    };

    if app.current_version != current_version {
        return BatchResultItem {
            application_id: app.id,
            application_no: app.application_no,
            success: false,
            status: app.status.as_str().to_string(),
            message: format!("版本冲突：当前版本 v{}，你提供的版本 v{}", app.current_version, current_version),
        };
    }

    match role {
        UserRole::Reviewer => {
            if app.status != ApplicationStatus::PendingReview {
                return BatchResultItem {
                    application_id: app.id,
                    application_no: app.application_no,
                    success: false,
                    status: app.status.as_str().to_string(),
                    message: format!("状态「{}」不允许审核", app.status.display_name()),
                };
            }
        }
        UserRole::FinalReviewer => {
            if app.status != ApplicationStatus::Reviewed {
                return BatchResultItem {
                    application_id: app.id,
                    application_no: app.application_no,
                    success: false,
                    status: app.status.as_str().to_string(),
                    message: format!("状态「{}」不允许复核", app.status.display_name()),
                };
            }
        }
        _ => {
            return BatchResultItem {
                application_id: app.id,
                application_no: app.application_no,
                success: false,
                status: app.status.as_str().to_string(),
                message: "角色无权审核".to_string(),
            };
        }
    }

    let (new_status, action) = match role {
        UserRole::Reviewer => {
            if approved {
                (ApplicationStatus::Reviewed, ActionType::ReviewApprove)
            } else {
                (ApplicationStatus::NeedsCorrection, ActionType::ReviewReject)
            }
        }
        UserRole::FinalReviewer => {
            if approved {
                (ApplicationStatus::Archived, ActionType::FinalApprove)
            } else {
                (ApplicationStatus::NeedsCorrection, ActionType::FinalReject)
            }
        }
        _ => unreachable!(),
    };

    let new_version = app.current_version + 1;
    let items_json = serde_json::to_string(&app.items).unwrap();

    let conn = DB_CONN.lock().unwrap();

    let update_result = conn.execute(
        "UPDATE replenishment_applications 
         SET status = ?1, current_version = ?2, remarks = COALESCE(?3, remarks),
             updated_by = ?4, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?5",
        params![new_status.as_str(), new_version, remarks, user_id, app.id],
    );

    if update_result.is_err() {
        return BatchResultItem {
            application_id: app.id,
            application_no: app.application_no,
            success: false,
            status: app.status.as_str().to_string(),
            message: "更新失败，请重试".to_string(),
        };
    }

    conn.execute(
        "INSERT INTO application_versions 
         (application_id, version, status_from, status_to, items, 
          evidence_store_replenishment, evidence_delivery_confirmation, evidence_registration,
          remarks, action, performed_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            app.id,
            new_version,
            app.status.as_str(),
            new_status.as_str(),
            items_json,
            app.evidence_store_replenishment,
            app.evidence_delivery_confirmation,
            app.evidence_registration,
            remarks,
            action.as_str(),
            user_id
        ],
    ).unwrap();

    let msg = if approved {
        match role {
            UserRole::Reviewer => "审核通过",
            UserRole::FinalReviewer => "复核归档成功",
            _ => "",
        }
    } else {
        "已驳回，需补正"
    };

    BatchResultItem {
        application_id: app.id,
        application_no: app.application_no,
        success: true,
        status: new_status.as_str().to_string(),
        message: msg.to_string(),
    }
}

#[post("/applications/batch-review", format = "json", data = "<req>")]
pub fn batch_review_applications(
    auth: AuthenticatedUser,
    req: Json<BatchReviewRequest>,
) -> Result<Json<BatchReviewResponse>, (Status, Json<ApiError>)> {
    match auth.user.role {
        UserRole::Reviewer | UserRole::FinalReviewer => {}
        _ => {
            return Err((
                Status::Forbidden,
                Json(ApiError {
                    error: "角色权限不足".to_string(),
                    details: Some(format!("只有审核主管或复核负责人可以批量审核，当前角色为{}", auth.user.role.display_name())),
                })
            ));
        }
    }

    if req.applications.is_empty() {
        return Err((
            Status::BadRequest,
            Json(ApiError {
                error: "批量审核失败".to_string(),
                details: Some("请至少选择一条申请".to_string()),
            })
        ));
    }

    let remarks = req.remarks.as_deref();
    let mut results = Vec::new();

    for item in &req.applications {
        let result = do_review_single(
            item.application_id,
            item.current_version,
            req.approved,
            remarks,
            auth.user.id,
            &auth.user.role,
        );
        results.push(result);
    }

    let success_count = results.iter().filter(|r| r.success).count();
    let failed_count = results.len() - success_count;

    Ok(Json(BatchReviewResponse {
        results,
        success_count,
        failed_count,
    }))
}

#[get("/applications/<id>/history")]
pub fn get_application_history(
    auth: AuthenticatedUser,
    id: i64,
) -> Result<Json<Vec<ApplicationVersion>>, (Status, Json<ApiError>)> {
    let conn = DB_CONN.lock().unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT v.id, v.application_id, v.version, v.status_from, v.status_to, 
                v.items, v.evidence_store_replenishment, v.evidence_delivery_confirmation, 
                v.evidence_registration, v.remarks, v.action, v.performed_by, 
                u.display_name, v.performed_at
         FROM application_versions v
         JOIN users u ON v.performed_by = u.id
         WHERE v.application_id = ?1
         ORDER BY v.version DESC"
    ).unwrap();

    let versions = stmt.query_map(params![id], |row| {
        let action_str: String = row.get(10)?;
        let items_json: Option<String> = row.get(5)?;
        Ok(ApplicationVersion {
            id: row.get(0)?,
            application_id: row.get(1)?,
            version: row.get(2)?,
            status_from: row.get(3)?,
            status_to: row.get(4)?,
            items: items_json.as_deref().map(|j| parse_items(j)),
            evidence_store_replenishment: row.get(6)?,
            evidence_delivery_confirmation: row.get(7)?,
            evidence_registration: row.get(8)?,
            remarks: row.get(9)?,
            action: ActionType::from_str(&action_str).unwrap_or(ActionType::Create),
            performed_by: row.get(11)?,
            performed_by_name: row.get(12)?,
            performed_at: row.get(13)?,
        })
    }).unwrap();

    let result: Vec<ApplicationVersion> = versions.filter_map(|v| v.ok()).collect();
    
    if result.is_empty() {
        if get_application_by_id(id).is_none() {
            return Err((
                Status::NotFound,
                Json(ApiError {
                    error: "申请不存在".to_string(),
                    details: Some(format!("未找到 ID 为 {} 的补货申请", id)),
                })
            ));
        }
    }

    Ok(Json(result))
}
