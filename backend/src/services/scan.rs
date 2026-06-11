use sqlx::SqlitePool;
use uuid::Uuid;
use crate::models::{CreativeDemand, ScanResponse, ScanRecordWithDetails, ScanRecordListResponse};

pub async fn scan_code(
    pool: &SqlitePool,
    code: &str,
    user_id: &str,
    user_name: &str,
    user_role: &str,
) -> Result<ScanResponse, sqlx::Error> {
    let record_id = Uuid::new_v4().to_string();

    let demand: Option<CreativeDemand> = sqlx::query_as::<_, CreativeDemand>(
        "SELECT * FROM creative_demands WHERE code = ?"
    )
    .bind(code)
    .fetch_optional(pool)
    .await?;

    let response = match demand {
        None => {
            let err_code = "INVALID_CODE";
            let err_msg = format!("创意需求单编号 '{}' 不存在，请检查二维码是否有效", code);
            sqlx::query(
                r#"
                INSERT INTO scan_records 
                (id, creative_demand_id, user_id, user_name, user_role, scan_result, error_code, error_message)
                VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
                "#
            )
            .bind(&record_id)
            .bind(None::<String>)
            .bind(user_id)
            .bind(user_name)
            .bind(user_role)
            .bind(err_code)
            .bind(&err_msg)
            .execute(pool)
            .await?;

            ScanResponse {
                success: false,
                creative_demand: None,
                error_code: Some(err_code.to_string()),
                error_message: Some(err_msg),
                is_current_handler: false,
                current_handler_role: None,
            }
        }
        Some(demand) => {
            let is_current_handler = demand.current_handler_role == user_role;
            let handler_role = demand.current_handler_role.clone();
            let demand_id = demand.id.clone();

            let duplicate_scan: Option<i64> = sqlx::query_scalar(
                r#"
                SELECT COUNT(*) FROM scan_records 
                WHERE creative_demand_id = ? AND user_id = ? AND scan_result = 'success'
                "#
            )
            .bind(&demand_id)
            .bind(user_id)
            .fetch_one(pool)
            .await?;

            if duplicate_scan.unwrap_or(0) > 0 {
                let err_code = "DUPLICATE_SCAN";
                let err_msg = format!("该创意需求单已被您扫码核验过，请勿重复扫码");
                
                sqlx::query(
                    r#"
                    INSERT INTO scan_records 
                    (id, creative_demand_id, user_id, user_name, user_role, scan_result, error_code, error_message)
                    VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
                    "#
                )
                .bind(&record_id)
                .bind(&demand_id)
                .bind(user_id)
                .bind(user_name)
                .bind(user_role)
                .bind(err_code)
                .bind(&err_msg)
                .execute(pool)
                .await?;

                return Ok(ScanResponse {
                    success: false,
                    creative_demand: Some(demand),
                    error_code: Some(err_code.to_string()),
                    error_message: Some(err_msg),
                    is_current_handler,
                    current_handler_role: Some(handler_role),
                });
            }

            if !is_current_handler {
                let role_name = match handler_role.as_str() {
                    "registrar" => "创意需求登记员",
                    "supervisor" => "创意需求审核主管",
                    "reviewer" => "广告代理公司复核负责人",
                    _ => &handler_role,
                };
                let err_code = "WRONG_HANDLER";
                let err_msg = format!(
                    "当前处理人应为【{}】，您的角色无权处理此创意需求单",
                    role_name
                );

                sqlx::query(
                    r#"
                    INSERT INTO scan_records 
                    (id, creative_demand_id, user_id, user_name, user_role, scan_result, error_code, error_message)
                    VALUES (?, ?, ?, ?, ?, 'failed', ?, ?)
                    "#
                )
                .bind(&record_id)
                .bind(&demand_id)
                .bind(user_id)
                .bind(user_name)
                .bind(user_role)
                .bind(err_code)
                .bind(&err_msg)
                .execute(pool)
                .await?;

                return Ok(ScanResponse {
                    success: false,
                    creative_demand: Some(demand),
                    error_code: Some(err_code.to_string()),
                    error_message: Some(err_msg),
                    is_current_handler: false,
                    current_handler_role: Some(handler_role),
                });
            }

            sqlx::query(
                r#"
                INSERT INTO scan_records 
                (id, creative_demand_id, user_id, user_name, user_role, scan_result, error_code, error_message)
                VALUES (?, ?, ?, ?, ?, 'success', NULL, NULL)
                "#
            )
            .bind(&record_id)
            .bind(&demand_id)
            .bind(user_id)
            .bind(user_name)
            .bind(user_role)
            .execute(pool)
            .await?;

            ScanResponse {
                success: true,
                creative_demand: Some(demand),
                error_code: None,
                error_message: None,
                is_current_handler: true,
                current_handler_role: Some(user_role.to_string()),
            }
        }
    };

    Ok(response)
}

pub async fn get_scan_records(
    pool: &SqlitePool,
    demand_id: Option<&str>,
    limit: i64,
    offset: i64,
) -> Result<ScanRecordListResponse, sqlx::Error> {
    let base_sql = r#"
        SELECT sr.id, sr.creative_demand_id, cd.code as creative_demand_code, 
               cd.title as creative_demand_title, sr.user_id, sr.user_name, 
               sr.user_role, sr.scan_result, sr.error_code, sr.error_message, sr.scanned_at
        FROM scan_records sr
        LEFT JOIN creative_demands cd ON sr.creative_demand_id = cd.id
    "#;

    let (count_sql, list_sql) = if let Some(_did) = demand_id {
        (
            format!("{} WHERE sr.creative_demand_id = ?", base_sql),
            format!("{} WHERE sr.creative_demand_id = ? ORDER BY sr.scanned_at DESC LIMIT ? OFFSET ?", base_sql),
        )
    } else {
        (
            base_sql.to_string(),
            format!("{} ORDER BY sr.scanned_at DESC LIMIT ? OFFSET ?", base_sql),
        )
    };

    let total: i64 = if let Some(did) = demand_id {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM ({})", count_sql))
            .bind(did)
            .fetch_one(pool)
            .await?
    } else {
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM ({})", count_sql))
            .fetch_one(pool)
            .await?
    };

    let items: Vec<ScanRecordWithDetails> = if let Some(did) = demand_id {
        sqlx::query_as::<_, ScanRecordWithDetails>(&list_sql)
            .bind(did)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
    } else {
        sqlx::query_as::<_, ScanRecordWithDetails>(&list_sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
    };

    Ok(ScanRecordListResponse { items, total })
}
