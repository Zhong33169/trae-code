use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplaintTicket {
    pub id: i64,
    pub ticket_no: String,
    pub title: String,
    pub content: String,
    pub complainant: String,
    pub contact: Option<String>,
    pub status: String,
    pub priority: String,
    pub source: String,
    pub is_exception: bool,
    pub exception_reason: Option<String>,
    pub deadline: Option<DateTime<Utc>>,
    pub created_by: i64,
    pub created_by_name: Option<String>,
    pub handler_id: Option<i64>,
    pub handler_name: Option<String>,
    pub reviewer_id: Option<i64>,
    pub reviewer_name: Option<String>,
    pub result_summary: Option<String>,
    pub return_reason: Option<String>,
    pub audit_remark: Option<String>,
    pub import_batch_id: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTicketRequest {
    pub title: String,
    pub content: String,
    pub complainant: String,
    pub contact: Option<String>,
    pub priority: Option<String>,
    pub source: Option<String>,
    pub deadline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTicketRequest {
    pub title: Option<String>,
    pub content: Option<String>,
    pub complainant: Option<String>,
    pub contact: Option<String>,
    pub priority: Option<String>,
    pub deadline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessRequest {
    pub result_summary: Option<String>,
    pub audit_remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReturnRequest {
    pub return_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketListParams {
    pub status: Option<String>,
    pub is_exception: Option<bool>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub keyword: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketListResponse {
    pub total: i64,
    pub items: Vec<ComplaintTicket>,
    pub page: i64,
    pub page_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TicketAttachment {
    pub id: i64,
    pub ticket_id: i64,
    pub filename: String,
    pub file_path: String,
    pub file_size: i64,
    pub uploaded_by: i64,
    pub uploaded_by_name: Option<String>,
    pub uploaded_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: i64,
    pub ticket_id: Option<i64>,
    pub user_id: Option<i64>,
    pub user_name: Option<String>,
    pub action: String,
    pub detail: Option<String>,
    pub is_failure: bool,
    pub failure_reason: Option<String>,
    pub batch_id: Option<i64>,
    pub source_ip: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatch {
    pub id: i64,
    pub batch_no: String,
    pub source: String,
    pub total_count: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub imported_by: i64,
    pub imported_by_name: Option<String>,
    pub imported_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRecord {
    pub id: i64,
    pub batch_id: i64,
    pub ticket_id: Option<i64>,
    pub original_ticket_no: String,
    pub original_data: Option<String>,
    pub status: String,
    pub diff_detail: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportItem {
    pub ticket_no: String,
    pub title: String,
    pub content: String,
    pub complainant: String,
    pub contact: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub source: Option<String>,
    pub deadline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub source: String,
    pub items: Vec<ImportItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: i64,
    pub batch_no: String,
    pub total: i64,
    pub success: i64,
    pub failed: i64,
    pub records: Vec<ImportRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        ApiResponse {
            code: 0,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn error(message: &str) -> Self {
        ApiResponse {
            code: 1,
            message: message.to_string(),
            data: None,
        }
    }

    pub fn error_with_code(code: i32, message: &str) -> Self {
        ApiResponse {
            code,
            message: message.to_string(),
            data: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusTransition {
    pub from: String,
    pub to: String,
    pub action: String,
    pub allowed_roles: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AllowedAction {
    pub key: String,
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionResponse {
    pub user: User,
    pub role_label: String,
    pub allowed_actions: Vec<AllowedAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogInsert {
    pub ticket_id: Option<i64>,
    pub user_id: Option<i64>,
    pub action: String,
    pub detail: Option<String>,
    pub is_failure: bool,
    pub failure_reason: Option<String>,
    pub batch_id: Option<i64>,
    pub source_ip: Option<String>,
    pub user_agent: Option<String>,
}
