use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Appointment {
    pub id: String,
    pub visitor_name: String,
    pub visitor_phone: String,
    pub visitor_id_number: String,
    pub exhibition_name: String,
    pub status: String,
    pub current_handler_role: String,
    pub version: i64,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct EvidenceGroup {
    pub reservation: Vec<Evidence>,
    pub check_in: Vec<Evidence>,
    pub data_recovery: Vec<Evidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionRecord {
    pub version: i64,
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub timestamp: String,
    pub changes: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppointmentDetail {
    pub id: String,
    pub visitor_name: String,
    pub visitor_phone: String,
    pub visitor_id_number: String,
    pub exhibition_name: String,
    pub status: String,
    pub current_handler_role: String,
    pub version: i64,
    pub created_by: String,
    pub updated_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub evidence: EvidenceGroup,
    pub version_history: Vec<VersionRecord>,
    pub operation_logs: Vec<OperationLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub id: String,
    pub appointment_id: String,
    #[serde(rename = "type")]
    pub evidence_type: String,
    pub content: String,
    pub created_by: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub appointment_id: String,
    pub action: String,
    pub operator: String,
    pub operator_role: String,
    pub detail: String,
    pub timestamp: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponseUser {
    pub username: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: LoginResponseUser,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct CreateAppointmentRequest {
    pub visitor_name: String,
    pub visitor_phone: String,
    pub visitor_id_number: String,
    pub exhibition_name: String,
}

#[derive(Debug, Deserialize)]
pub struct CorrectAppointmentRequest {
    pub visitor_name: String,
    pub visitor_phone: String,
    pub visitor_id_number: String,
    pub exhibition_name: String,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct ReviewRequest {
    pub action: String,
    pub detail: Option<String>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct ArchiveRequest {
    pub action: String,
    pub detail: Option<String>,
    pub version: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateEvidenceRequest {
    #[serde(rename = "type")]
    pub evidence_type: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct BatchReviewRequest {
    pub ids: Vec<String>,
    pub action: String,
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchArchiveRequest {
    pub ids: Vec<String>,
    pub action: String,
    pub comment: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BatchResultItem {
    pub id: String,
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub username: String,
    pub role: String,
    pub display_name: String,
}

#[derive(Debug, Deserialize)]
pub struct AppointmentQuery {
    pub status: Option<String>,
    pub keyword: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}
