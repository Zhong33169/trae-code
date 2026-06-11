use chrono::{DateTime, Utc};
use poem_openapi::Object;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, Object, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password: String,
    pub role: String,
    pub name: String,
    pub shift: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub role: String,
    pub name: String,
    pub shift: String,
}

impl From<User> for UserInfo {
    fn from(user: User) -> Self {
        UserInfo {
            id: user.id,
            username: user.username,
            role: user.role,
            name: user.name,
            shift: user.shift,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, FromRow)]
pub struct Ticket {
    pub id: String,
    pub title: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub description: String,
    pub status: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct TicketDetail {
    #[serde(flatten)]
    pub ticket: Ticket,
    pub creator_name: String,
    pub handover_records: Vec<HandoverRecordDetail>,
    pub operation_logs: Vec<OperationLogDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreateTicketRequest {
    pub title: String,
    pub customer_name: String,
    pub customer_phone: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct UpdateTicketStatusRequest {
    pub status: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct TicketListResponse {
    pub total: i64,
    pub items: Vec<TicketListItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, FromRow)]
pub struct TicketListItem {
    pub id: String,
    pub title: String,
    pub customer_name: String,
    pub status: String,
    pub created_by: String,
    pub creator_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, FromRow)]
pub struct HandoverRecord {
    pub id: String,
    pub ticket_id: String,
    pub shift: String,
    pub from_user: String,
    pub to_user: String,
    pub handover_time: DateTime<Utc>,
    pub status: String,
    pub remark: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct HandoverRecordDetail {
    #[serde(flatten)]
    pub record: HandoverRecord,
    pub from_user_name: String,
    pub to_user_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct CreateHandoverRequest {
    pub ticket_id: String,
    pub to_user: String,
    pub shift: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct HandoverActionRequest {
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object, FromRow)]
pub struct OperationLog {
    pub id: String,
    pub ticket_id: String,
    pub user_id: String,
    pub action: String,
    pub detail: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct OperationLogDetail {
    #[serde(flatten)]
    pub log: OperationLog,
    pub user_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Object)]
pub struct StatisticsResponse {
    pub total_tickets: i64,
    pub incoming_count: i64,
    pub dispatched_count: i64,
    pub return_visit_count: i64,
    pub closed_count: i64,
    pub exception_count: i64,
    pub pending_handover_count: i64,
    pub today_tickets: i64,
}

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}
