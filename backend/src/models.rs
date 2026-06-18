use chrono::Utc;
use poem::web::Json;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: String,
    pub display_name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Topic {
    pub id: String,
    pub topic_no: String,
    pub title: String,
    pub source: String,
    pub reporter: String,
    pub department: String,
    #[serde(default)]
    pub deadline: Option<String>,
    pub status: String,
    #[serde(default)]
    pub content: Option<String>,
    pub register_id: String,
    #[serde(default)]
    pub register_name: Option<String>,
    pub register_at: String,
    #[serde(default)]
    pub reviewer_id: Option<String>,
    #[serde(default)]
    pub reviewer_name: Option<String>,
    #[serde(default)]
    pub review_at: Option<String>,
    #[serde(default)]
    pub review_result: Option<String>,
    #[serde(default)]
    pub review_comment: Option<String>,
    #[serde(default)]
    pub archiver_id: Option<String>,
    #[serde(default)]
    pub archiver_name: Option<String>,
    #[serde(default)]
    pub archive_at: Option<String>,
    #[serde(default)]
    pub archive_comment: Option<String>,
    #[serde(default)]
    pub reject_reason: Option<String>,
    #[serde(default)]
    pub anomaly_tag: Option<String>,
    pub created_from: String,
    #[serde(default)]
    pub import_batch_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTopicRequest {
    pub topic_no: String,
    pub title: String,
    pub source: String,
    pub reporter: String,
    pub department: String,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub anomaly_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewRequest {
    pub result: String,
    #[serde(default)]
    pub comment: Option<String>,
    #[serde(default)]
    pub reject_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveRequest {
    #[serde(default)]
    pub comment: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub topic_id: String,
    pub filename: String,
    #[serde(default)]
    pub file_type: Option<String>,
    #[serde(default)]
    pub file_size: Option<i64>,
    pub uploaded_by: String,
    #[serde(default)]
    pub uploaded_by_name: Option<String>,
    pub uploaded_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentCreateReq {
    pub filename: String,
    #[serde(default)]
    pub file_type: Option<String>,
    #[serde(default)]
    pub file_size: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportBatch {
    pub id: String,
    pub batch_no: String,
    pub source: String,
    pub operator_id: String,
    #[serde(default)]
    pub operator_name: Option<String>,
    pub imported_at: String,
    pub total_count: i64,
    pub success_count: i64,
    pub conflict_count: i64,
    pub error_count: i64,
    #[serde(default)]
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRecord {
    pub id: String,
    pub batch_id: String,
    pub topic_no: String,
    #[serde(default)]
    pub title: Option<String>,
    pub status: String,
    #[serde(default)]
    pub diff_json: Option<String>,
    #[serde(default)]
    pub error_msg: Option<String>,
    #[serde(default)]
    pub topic_id: Option<String>,
    #[serde(default = "default_process_status")]
    pub process_status: String,
    #[serde(default)]
    pub process_remark: Option<String>,
    #[serde(default)]
    pub processed_by: Option<String>,
    #[serde(default)]
    pub processed_by_name: Option<String>,
    #[serde(default)]
    pub processed_at: Option<String>,
}

fn default_process_status() -> String {
    "pending".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessConflictRequest {
    pub action: String,
    pub remark: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportTopicItem {
    pub topic_no: String,
    pub title: String,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub reporter: Option<String>,
    #[serde(default, alias = "reporter_name")]
    pub reporter_name: Option<String>,
    pub department: String,
    #[serde(default, alias = "planned_publish_date")]
    pub deadline: Option<String>,
    #[serde(default, alias = "initial_status")]
    pub status: Option<String>,
    #[serde(default, alias = "content_summary")]
    pub content: Option<String>,
    #[serde(default, alias = "anomaly")]
    pub anomaly_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRequest {
    pub source: String,
    #[serde(default)]
    pub remark: Option<String>,
    pub items: Vec<ImportTopicItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: String,
    pub batch_no: String,
    pub total_count: i64,
    pub success_count: i64,
    pub conflict_count: i64,
    pub error_count: i64,
    pub records: Vec<ImportRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLog {
    pub id: String,
    #[serde(default)]
    pub topic_id: Option<String>,
    #[serde(default)]
    pub import_batch_id: Option<String>,
    pub user_id: String,
    pub user_name: String,
    pub action: String,
    #[serde(default)]
    pub old_status: Option<String>,
    #[serde(default)]
    pub new_status: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    pub created_at: String,
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
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T) -> Self {
        Self { code: 0, message: "success".to_string(), data: Some(data) }
    }
    pub fn ok_msg(message: &str) -> Self {
        Self { code: 0, message: message.to_string(), data: None }
    }
    pub fn err(message: &str) -> Self {
        Self { code: -1, message: message.to_string(), data: None }
    }
}

pub fn json_ok<T: Serialize>(data: T) -> Json<ApiResponse<T>> {
    Json(ApiResponse::ok(data))
}
pub fn json_ok_msg(message: &str) -> Json<ApiResponse<()>> {
    Json(ApiResponse::ok_msg(message))
}
pub fn json_err<T>(message: &str) -> Json<ApiResponse<T>> {
    Json(ApiResponse::err(message))
}

pub fn new_uuid() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_str() -> String {
    Utc::now().to_rfc3339()
}
