use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub role: String,
    pub real_name: String,
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
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub user_id: String,
    pub role: String,
    pub real_name: String,
    pub exp: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn ok(data: T, msg: &str) -> Self {
        ApiResponse { success: true, message: msg.to_string(), data: Some(data) }
    }
    pub fn ok_no_data(msg: &str) -> Self {
        ApiResponse { success: true, message: msg.to_string(), data: None }
    }
    pub fn err(msg: &str) -> Self {
        ApiResponse { success: false, message: msg.to_string(), data: None }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeedRecord {
    pub id: String,
    pub batch_no: String,
    pub seed_type: String,
    pub seed_species: String,
    pub quantity: i64,
    pub unit: String,
    pub source: String,
    pub supplier: Option<String>,
    pub register_id: String,
    pub register_name: String,
    pub register_time: String,
    pub current_node: String,
    pub overall_status: String,
    pub pond_entry_time: Option<String>,
    pub pond_id: Option<String>,
    pub pond_quantity: Option<i64>,
    pub survival_rate: Option<f64>,
    pub survival_observe_time: Option<String>,
    pub archive_time: Option<String>,
    pub archive_remark: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSeedRecordRequest {
    pub seed_type: String,
    pub seed_species: String,
    pub quantity: i64,
    pub unit: Option<String>,
    pub source: String,
    pub supplier: Option<String>,
    pub deadline_hours: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSeedRecordRequest {
    pub seed_type: Option<String>,
    pub seed_species: Option<String>,
    pub quantity: Option<i64>,
    pub unit: Option<String>,
    pub source: Option<String>,
    pub supplier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeTracking {
    pub id: String,
    pub record_id: String,
    pub node_type: String,
    pub node_name: String,
    pub assignee_id: Option<String>,
    pub assignee_name: Option<String>,
    pub deadline: String,
    pub status: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub is_timeout: bool,
    pub timeout_reason: Option<String>,
    pub follow_up_action: Option<String>,
    pub timeout_remark: Option<String>,
    pub remark: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeedRecordDetail {
    pub record: SeedRecord,
    pub nodes: Vec<NodeTracking>,
    pub logs: Vec<OperationLog>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub record_id: Option<String>,
    pub user_id: String,
    pub user_name: String,
    pub user_role: String,
    pub action: String,
    pub action_target: String,
    pub detail: Option<String>,
    pub old_status: Option<String>,
    pub new_status: Option<String>,
    pub evidence_note: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PondEntryRequest {
    pub pond_id: String,
    pub pond_quantity: i64,
    pub remark: Option<String>,
    pub deadline_hours: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurvivalObserveRequest {
    pub survival_rate: f64,
    pub remark: Option<String>,
    pub deadline_hours: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveRequest {
    pub archive_remark: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApproveRequest {
    pub evidence_note: Option<String>,
    pub deadline_hours: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectRequest {
    pub reason: String,
    pub evidence_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeoutHandleRequest {
    pub timeout_reason: String,
    pub follow_up_action: String,
    pub timeout_remark: Option<String>,
    pub evidence_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordListQuery {
    pub status: Option<String>,
    pub node: Option<String>,
    pub keyword: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedRecords {
    pub items: Vec<SeedRecord>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub timeout_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statistics {
    pub total_records: i64,
    pub pending_count: i64,
    pub processing_count: i64,
    pub completed_count: i64,
    pub rejected_count: i64,
    pub timeout_count: i64,
    pub by_status: Vec<StatusStat>,
    pub by_node: Vec<NodeStat>,
    pub recent_trend: Vec<TrendItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusStat {
    pub status: String,
    pub status_label: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeStat {
    pub node: String,
    pub node_label: String,
    pub count: i64,
    pub timeout_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendItem {
    pub date: String,
    pub new_count: i64,
    pub completed_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchActionRequest {
    pub record_ids: Vec<String>,
    pub action: String,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveSummary {
    pub id: String,
    pub record_id: String,
    pub batch_no: String,
    pub archive_time: String,
    pub archive_remark: String,
    pub reviewer_id: String,
    pub reviewer_name: String,
    pub total_duration_hours: f64,
    pub node_count: i64,
    pub completed_node_count: i64,
    pub timeout_node_count: i64,
    pub timeout_summary: Option<String>,
    pub node_duration_summary: Option<String>,
    pub final_status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveSummaryPublic {
    pub id: String,
    pub record_id: String,
    pub batch_no: String,
    pub archive_time: String,
    pub archive_remark: String,
    pub reviewer_name: String,
    pub total_duration_hours: f64,
    pub node_count: i64,
    pub completed_node_count: i64,
    pub timeout_node_count: i64,
    pub timeout_summary: Option<String>,
    pub node_duration_summary: Option<String>,
    pub final_status: String,
    pub created_at: String,
}
