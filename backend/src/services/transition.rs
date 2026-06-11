use sqlx::SqlitePool;
use uuid::Uuid;
use crate::models::{CreativeDemand, DemandStatus, TransitionRequest};

pub struct TransitionResult {
    pub success: bool,
    pub message: String,
    pub error_code: Option<String>,
    pub demand: Option<CreativeDemand>,
}

pub const ERROR_CODE_VERSION_CONFLICT: &str = "VERSION_CONFLICT";
pub const ERROR_CODE_PERMISSION_DENIED: &str = "PERMISSION_DENIED";
pub const ERROR_CODE_PREREQUISITE_MISSING: &str = "PREREQUISITE_MISSING";
pub const ERROR_CODE_INVALID_TRANSITION: &str = "INVALID_TRANSITION";

pub async fn validate_and_transition(
    pool: &SqlitePool,
    demand_id: &str,
    request: &TransitionRequest,
    user_id: &str,
    user_role: &str,
    user_name: &str,
) -> Result<TransitionResult, sqlx::Error> {
    let mut tx = pool.begin().await?;

    let demand: Option<CreativeDemand> = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(demand_id)
    .fetch_optional(&mut *tx)
    .await?;

    let demand = match demand {
        Some(d) => d,
        None => {
            tx.rollback().await?;
            return Ok(TransitionResult {
                success: false,
                message: "创意需求单不存在".to_string(),
                error_code: Some("NOT_FOUND".to_string()),
                demand: None,
            });
        }
    };

    if let Some(client_version) = request.version {
        if client_version != demand.version {
            tx.rollback().await?;
            return Ok(TransitionResult {
                success: false,
                message: format!(
                    "版本冲突：您的版本={}，当前最新版本={}，请刷新后重试",
                    client_version, demand.version
                ),
                error_code: Some(ERROR_CODE_VERSION_CONFLICT.to_string()),
                demand: Some(demand),
            });
        }
    }

    let current_status = match DemandStatus::from_str(&demand.status) {
        Some(s) => s,
        None => {
            tx.rollback().await?;
            return Ok(TransitionResult {
                success: false,
                message: "当前状态无效".to_string(),
                error_code: Some(ERROR_CODE_INVALID_TRANSITION.to_string()),
                demand: Some(demand),
            });
        }
    };

    let target_status = match DemandStatus::from_str(&request.target_status) {
        Some(s) => s,
        None => {
            tx.rollback().await?;
            return Ok(TransitionResult {
                success: false,
                message: "目标状态无效".to_string(),
                error_code: Some(ERROR_CODE_INVALID_TRANSITION.to_string()),
                demand: Some(demand),
            });
        }
    };

    if !current_status.can_transition_to(&target_status, user_role) {
        tx.rollback().await?;
        return Ok(TransitionResult {
            success: false,
            message: format!(
                "权限不足或状态流转顺序错误：从 {} 到 {} 不允许角色 {} 操作",
                demand.status, request.target_status, user_role
            ),
            error_code: Some(ERROR_CODE_PERMISSION_DENIED.to_string()),
            demand: Some(demand),
        });
    }

    if let Err(prereq_err) = demand.validate_transition_prerequisites(&target_status) {
        tx.rollback().await?;
        return Ok(TransitionResult {
            success: false,
            message: format!("证据缺失：{}", prereq_err),
            error_code: Some(ERROR_CODE_PREREQUISITE_MISSING.to_string()),
            demand: Some(demand),
        });
    }

    let handler_role_for_next = match target_status {
        DemandStatus::PendingRegistrar => "registrar",
        DemandStatus::PendingSupervisor => "supervisor",
        DemandStatus::PendingReviewer => "reviewer",
        _ => &demand.current_handler_role,
    };

    let transition_id = Uuid::new_v4().to_string();
    let new_version = demand.version + 1;

    let result = sqlx::query(
        r#"
        UPDATE creative_demands 
        SET status = ?, current_handler_role = ?, current_handler_id = ?, 
            updated_at = CURRENT_TIMESTAMP, version = ?,
            processing_result = ?, return_reason = ?
        WHERE id = ? AND version = ?
        "#
    )
    .bind(target_status.as_str())
    .bind(handler_role_for_next)
    .bind(if target_status == DemandStatus::Completed || target_status == DemandStatus::Rejected {
        Some(user_id.to_string())
    } else {
        None::<String>
    })
    .bind(new_version)
    .bind(&request.comments)
    .bind(if target_status == DemandStatus::Rejected {
        request.comments.clone()
    } else {
        None
    })
    .bind(demand_id)
    .bind(demand.version)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() == 0 {
        tx.rollback().await?;
        return Ok(TransitionResult {
            success: false,
            message: format!(
                "并发冲突：该创意需求单已被其他用户修改（当前版本={}，您的版本={}），请刷新后重试",
                demand.version + 1, demand.version
            ),
            error_code: Some(ERROR_CODE_VERSION_CONFLICT.to_string()),
            demand: Some(demand),
        });
    }

    sqlx::query(
        r#"
        INSERT INTO status_transitions 
        (id, creative_demand_id, from_status, to_status, handler_role, handler_id, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(transition_id)
    .bind(demand_id)
    .bind(&demand.status)
    .bind(target_status.as_str())
    .bind(user_role)
    .bind(user_id)
    .bind(&request.comments)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        r#"
        INSERT INTO audit_logs 
        (id, creative_demand_id, user_id, user_name, user_role, action, 
         old_status, new_status, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(Uuid::new_v4().to_string())
    .bind(demand_id)
    .bind(user_id)
    .bind(user_name)
    .bind(user_role)
    .bind("status_transition")
    .bind(&demand.status)
    .bind(target_status.as_str())
    .bind(&request.comments)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    let updated_demand: CreativeDemand = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE id = ?"
    )
    .bind(demand_id)
    .fetch_one(pool)
    .await?;

    Ok(TransitionResult {
        success: true,
        message: "状态流转成功".to_string(),
        error_code: None,
        demand: Some(updated_demand),
    })
}
