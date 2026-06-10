use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use chrono::{DateTime, NaiveDate, Utc};

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub role: String,
    pub name: String,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct BorrowRecord {
    pub id: i64,
    pub record_no: String,
    pub borrower_name: String,
    pub borrower_id: Option<String>,
    pub book_title: String,
    pub book_isbn: Option<String>,
    pub borrow_date: NaiveDate,
    pub due_date: NaiveDate,
    pub return_date: Option<NaiveDate>,
    pub status: String,
    pub exception_type: Option<String>,
    pub version: i64,
    pub current_handler_id: Option<i64>,
    pub current_handler_role: Option<String>,
    #[sqlx(default)]
    pub current_handler_name: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateRecordRequest {
    pub record_no: String,
    pub borrower_name: String,
    pub borrower_id: Option<String>,
    pub book_title: String,
    pub book_isbn: Option<String>,
    pub borrow_date: String,
    pub due_date: String,
    pub return_date: Option<String>,
    pub description: Option<String>,
    pub created_by: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateRecordRequest {
    pub borrower_name: Option<String>,
    pub borrower_id: Option<String>,
    pub book_title: Option<String>,
    pub book_isbn: Option<String>,
    pub borrow_date: Option<String>,
    pub due_date: Option<String>,
    pub return_date: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitRequest {
    pub handler_id: i64,
    pub handler_role: String,
    pub version: i64,
    pub opinion: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuditRequest {
    pub handler_id: i64,
    pub handler_role: String,
    pub version: i64,
    pub passed: bool,
    pub opinion: String,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReviewRequest {
    pub handler_id: i64,
    pub handler_role: String,
    pub version: i64,
    pub passed: bool,
    pub opinion: String,
    pub reject_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CorrectRequest {
    pub handler_id: i64,
    pub handler_role: String,
    pub version: i64,
    pub opinion: String,
    pub borrower_name: Option<String>,
    pub book_title: Option<String>,
    pub book_isbn: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct ProcessRecord {
    pub id: i64,
    pub borrow_record_id: i64,
    pub handler_id: i64,
    pub handler_name: String,
    pub handler_role: String,
    pub action: String,
    pub from_status: String,
    pub to_status: String,
    pub opinion: Option<String>,
    pub reject_reason: Option<String>,
    pub version_before: i64,
    pub version_after: i64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, FromRow)]
pub struct EvidenceItem {
    pub id: i64,
    pub borrow_record_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub evidence_type: String,
    pub is_required: bool,
    pub file_path: Option<String>,
    pub uploaded_by: Option<i64>,
    pub uploaded_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AddEvidenceRequest {
    pub name: String,
    pub description: Option<String>,
    pub evidence_type: String,
    pub is_required: bool,
    pub file_path: Option<String>,
    pub uploaded_by: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatsResponse {
    pub total: i64,
    pub draft: i64,
    pub pending_audit: i64,
    pub pending_review: i64,
    pub returned_correction: i64,
    pub archived: i64,
    pub missing_evidence: i64,
    pub overdue: i64,
    pub conflict: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: i64,
}
