use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserWithPassword {
    pub id: String,
    pub username: String,
    pub password_hash: String,
    pub real_name: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NursingPlan {
    pub id: String,
    pub plan_no: String,
    pub elder_name: String,
    pub elder_gender: String,
    pub elder_age: i32,
    pub room_no: String,
    pub bed_no: String,
    pub admission_date: Option<String>,
    
    pub assessment_status: String,
    pub assessment_content: Option<String>,
    pub assessment_by: Option<String>,
    pub assessment_at: Option<String>,
    
    pub plan_content: Option<String>,
    pub plan_level: Option<String>,
    
    pub family_confirm_status: String,
    pub family_confirm_by: Option<String>,
    pub family_confirm_at: Option<String>,
    pub family_confirm_remark: Option<String>,
    
    pub status: String,
    pub current_step: String,
    pub return_reason: Option<String>,
    
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePlanRequest {
    pub elder_name: String,
    pub elder_gender: String,
    pub elder_age: i32,
    pub room_no: String,
    pub bed_no: String,
    pub admission_date: Option<String>,
    pub plan_content: Option<String>,
    pub plan_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlanRequest {
    pub elder_name: Option<String>,
    pub elder_gender: Option<String>,
    pub elder_age: Option<i32>,
    pub room_no: Option<String>,
    pub bed_no: Option<String>,
    pub admission_date: Option<String>,
    pub plan_content: Option<String>,
    pub plan_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssessmentUpdateRequest {
    pub assessment_status: String,
    pub assessment_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FamilyConfirmRequest {
    pub family_confirm_status: String,
    pub family_confirm_by: String,
    pub family_confirm_remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandoverInfo {
    pub shift: String,
    pub handover_by: String,
    pub takeover_by: String,
    pub confirm_time: String,
    pub handover_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusTransitionRequest {
    pub action: String,
    pub reason: Option<String>,
    pub handover: Option<HandoverInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HandoverRecord {
    pub id: String,
    pub plan_id: String,
    pub shift: String,
    pub handover_by: String,
    pub takeover_by: String,
    pub confirm_time: String,
    pub handover_content: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLog {
    pub id: String,
    pub plan_id: String,
    pub operator_id: String,
    pub operator_name: String,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub reason: Option<String>,
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
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanListResponse {
    pub total: i64,
    pub items: Vec<NursingPlan>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatisticsResponse {
    pub total_plans: i64,
    pub draft: i64,
    pub pending_audit: i64,
    pub audited: i64,
    pub pending_review: i64,
    pub archived: i64,
    pub returned: i64,
    pub by_shift: Vec<ShiftStat>,
    pub by_level: Vec<LevelStat>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftStat {
    pub shift: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LevelStat {
    pub level: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTransitionRequest {
    pub plan_ids: Vec<String>,
    pub action: String,
    pub reason: Option<String>,
    pub handover: Option<HandoverInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchOperation {
    pub id: String,
    pub batch_no: String,
    pub action: String,
    pub operator_id: String,
    pub operator_name: String,
    pub total_count: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub reason: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItem {
    pub id: String,
    pub batch_id: String,
    pub plan_id: String,
    pub plan_no: String,
    pub elder_name: String,
    pub success: bool,
    pub error_message: Option<String>,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchTransitionResponse {
    pub batch: BatchOperation,
    pub items: Vec<BatchItem>,
}
