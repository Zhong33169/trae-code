use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchTask {
    pub id: String,
    pub batch_name: String,
    pub operator_id: String,
    pub operator_name: String,
    pub total_count: i64,
    pub success_count: i64,
    pub fail_count: i64,
    pub skip_count: i64,
    pub result_details: Option<String>,
    pub status: String,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchResultItem {
    pub material_id: String,
    pub case_no: String,
    pub case_name: String,
    pub result: String,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessRequest {
    pub material_ids: Vec<String>,
    pub operator_id: String,
    pub action: String,
    pub batch_name: String,
    pub audit_remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessResponse {
    pub batch_id: String,
    pub total_count: usize,
    pub success_count: usize,
    pub fail_count: usize,
    pub skip_count: usize,
    pub details: Vec<BatchResultItem>,
    pub status: String,
}
