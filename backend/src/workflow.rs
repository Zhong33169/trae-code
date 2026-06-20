use rusqlite::Connection;
use crate::errors::AppError;
use crate::models::Evidence;

const ROLE_LABELS: &[(&str, &str)] = &[
    ("registrar", "登记员"),
    ("reviewer", "审核主管"),
    ("archivist", "复核负责人"),
];

const STATUS_LABELS: &[(&str, &str)] = &[
    ("pending_review", "待审核"),
    ("pending_archive", "待复核"),
    ("rejected_for_correction", "补正退回"),
    ("rejected_for_review", "审核退回"),
    ("archived", "已归档"),
];

fn role_label(role: &str) -> &str {
    ROLE_LABELS.iter().find(|(r, _)| *r == role).map(|(_, l)| *l).unwrap_or(role)
}

fn status_label(status: &str) -> &str {
    STATUS_LABELS.iter().find(|(s, _)| *s == status).map(|(_, l)| *l).unwrap_or(status)
}

pub fn validate_role(required: &str, actual: &str) -> Result<(), AppError> {
    if actual == required {
        return Ok(());
    }
    let actual_label = role_label(actual);
    let required_label = role_label(required);
    Err(AppError::RoleMismatch(format!(
        "{}不能执行此操作，该操作需要{}角色",
        actual_label, required_label
    )))
}

pub fn validate_status(allowed: &[&str], actual: &str) -> Result<(), AppError> {
    if allowed.contains(&actual) {
        return Ok(());
    }
    let actual_label = status_label(actual);
    Err(AppError::WrongStatus(format!(
        "当前单据状态为「{}」，不能执行此操作",
        actual_label
    )))
}

pub fn validate_evidence(evidence: &[Evidence]) -> Result<(), AppError> {
    let has_reservation = evidence.iter().any(|e| e.evidence_type == "reservation");
    let has_check_in = evidence.iter().any(|e| e.evidence_type == "check_in");
    let has_data_recovery = evidence.iter().any(|e| e.evidence_type == "data_recovery");

    let mut missing = Vec::new();
    if !has_reservation {
        missing.push("预约凭证");
    }
    if !has_check_in {
        missing.push("入场核销证据");
    }
    if !has_data_recovery {
        missing.push("数据补录证据");
    }

    if missing.is_empty() {
        Ok(())
    } else {
        Err(AppError::MissingEvidence(format!("缺少{}", missing.join("、"))))
    }
}

pub fn validate_version(request_version: i64, db_version: i64) -> Result<(), AppError> {
    if request_version == db_version {
        return Ok(());
    }
    Err(AppError::VersionConflict(
        "单据已被他人操作，请刷新后重试".into(),
    ))
}

pub fn check_duplicate(
    conn: &Connection,
    visitor_id_number: &str,
    exhibition_name: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let count: i64 = if let Some(exclude_id) = exclude_id {
        conn.query_row(
            "SELECT COUNT(*) FROM appointments WHERE visitor_id_number = ?1 AND exhibition_name = ?2 AND status != 'archived' AND id != ?3",
            rusqlite::params![visitor_id_number, exhibition_name, exclude_id],
            |row| row.get(0),
        )
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM appointments WHERE visitor_id_number = ?1 AND exhibition_name = ?2 AND status != 'archived'",
            rusqlite::params![visitor_id_number, exhibition_name],
            |row| row.get(0),
        )
    }.unwrap_or(0);

    if count > 0 {
        return Err(AppError::Duplicate(
            "该观众在此展会已有未归档预约单".into(),
        ));
    }
    Ok(())
}
