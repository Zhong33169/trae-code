use chrono::{DateTime, Duration, Utc, NaiveDateTime};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UserRole {
    Registrar,
    Auditor,
    Reviewer,
}

impl fmt::Display for UserRole {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            UserRole::Registrar => write!(f, "registrar"),
            UserRole::Auditor => write!(f, "auditor"),
            UserRole::Reviewer => write!(f, "reviewer"),
        }
    }
}

impl TryFrom<&str> for UserRole {
    type Error = String;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "registrar" => Ok(UserRole::Registrar),
            "auditor" => Ok(UserRole::Auditor),
            "reviewer" => Ok(UserRole::Reviewer),
            _ => Err(format!("Invalid role: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeType {
    OrderSampling,
    SampleConfirmation,
    ProductionScheduling,
    Archived,
}

impl NodeType {
    pub fn next(&self) -> Option<Self> {
        match self {
            NodeType::OrderSampling => Some(NodeType::SampleConfirmation),
            NodeType::SampleConfirmation => Some(NodeType::ProductionScheduling),
            NodeType::ProductionScheduling => Some(NodeType::Archived),
            NodeType::Archived => None,
        }
    }

    pub fn display_name(&self) -> &str {
        match self {
            NodeType::OrderSampling => "订单打样",
            NodeType::SampleConfirmation => "样衣确认",
            NodeType::ProductionScheduling => "大货排产",
            NodeType::Archived => "归档",
        }
    }

    pub fn timeout_hours() -> i64 {
        24
    }
}

impl fmt::Display for NodeType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            NodeType::OrderSampling => write!(f, "order_sampling"),
            NodeType::SampleConfirmation => write!(f, "sample_confirmation"),
            NodeType::ProductionScheduling => write!(f, "production_scheduling"),
            NodeType::Archived => write!(f, "archived"),
        }
    }
}

impl TryFrom<&str> for NodeType {
    type Error = String;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "order_sampling" => Ok(NodeType::OrderSampling),
            "sample_confirmation" => Ok(NodeType::SampleConfirmation),
            "production_scheduling" => Ok(NodeType::ProductionScheduling),
            "archived" => Ok(NodeType::Archived),
            _ => Err(format!("Invalid node type: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Processing,
    Rejected,
    Completed,
    Archived,
}

impl fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TaskStatus::Pending => write!(f, "pending"),
            TaskStatus::Processing => write!(f, "processing"),
            TaskStatus::Rejected => write!(f, "rejected"),
            TaskStatus::Completed => write!(f, "completed"),
            TaskStatus::Archived => write!(f, "archived"),
        }
    }
}

impl TryFrom<&str> for TaskStatus {
    type Error = String;

    fn try_from(s: &str) -> Result<Self, Self::Error> {
        match s.to_lowercase().as_str() {
            "pending" => Ok(TaskStatus::Pending),
            "processing" => Ok(TaskStatus::Processing),
            "rejected" => Ok(TaskStatus::Rejected),
            "completed" => Ok(TaskStatus::Completed),
            "archived" => Ok(TaskStatus::Archived),
            _ => Err(format!("Invalid task status: {}", s)),
        }
    }
}

pub fn calculate_timeout(started_at: &str, completed_at: Option<&str>) -> (bool, i64) {
    let parse_dt = |s: &str| -> Option<DateTime<Utc>> {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
            .ok()
            .map(|dt| DateTime::<Utc>::from_naive_utc_and_offset(dt, Utc))
    };

    let start = match parse_dt(started_at) {
        Some(dt) => dt,
        None => return (false, 0),
    };

    let end = match completed_at {
        Some(s) => match parse_dt(s) {
            Some(dt) => dt,
            None => return (false, 0),
        },
        None => Utc::now(),
    };

    let duration = end - start;
    let hours = duration.num_hours();
    let is_timeout = hours > NodeType::timeout_hours();
    let timeout_hours = if is_timeout { hours - NodeType::timeout_hours() } else { 0 };

    (is_timeout, timeout_hours)
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: String,
    pub username: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub real_name: String,
    pub role: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SamplingTask {
    pub id: String,
    pub task_no: String,
    pub order_no: Option<String>,
    pub style_no: String,
    pub style_name: String,
    pub customer_name: Option<String>,
    pub fabric_type: Option<String>,
    pub color: Option<String>,
    pub size_spec: Option<String>,
    pub quantity: Option<i64>,
    pub current_node: String,
    pub status: String,
    pub priority: Option<String>,
    pub deadline: Option<String>,
    pub order_sampling_started_at: Option<String>,
    pub order_sampling_completed_at: Option<String>,
    pub sample_confirmation_started_at: Option<String>,
    pub sample_confirmation_completed_at: Option<String>,
    pub production_scheduling_started_at: Option<String>,
    pub production_scheduling_completed_at: Option<String>,
    pub archived_at: Option<String>,
    pub registrar_id: Option<String>,
    pub auditor_id: Option<String>,
    pub reviewer_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl SamplingTask {
    pub fn is_timeout(&self) -> bool {
        let current_node = match NodeType::try_from(self.current_node.as_str()) {
            Ok(n) => n,
            Err(_) => return false,
        };

        if current_node == NodeType::Archived {
            return false;
        }

        let (started_at, completed_at) = match current_node {
            NodeType::OrderSampling => (
                self.order_sampling_started_at.as_deref(),
                self.order_sampling_completed_at.as_deref(),
            ),
            NodeType::SampleConfirmation => (
                self.sample_confirmation_started_at.as_deref(),
                self.sample_confirmation_completed_at.as_deref(),
            ),
            NodeType::ProductionScheduling => (
                self.production_scheduling_started_at.as_deref(),
                self.production_scheduling_completed_at.as_deref(),
            ),
            NodeType::Archived => return false,
        };

        match started_at {
            Some(sa) => {
                let (is_timeout, _) = calculate_timeout(sa, completed_at);
                is_timeout
            }
            None => false,
        }
    }

    pub fn timeout_hours(&self) -> i64 {
        let current_node = match NodeType::try_from(self.current_node.as_str()) {
            Ok(n) => n,
            Err(_) => return 0,
        };

        if current_node == NodeType::Archived {
            return 0;
        }

        let (started_at, completed_at) = match current_node {
            NodeType::OrderSampling => (
                self.order_sampling_started_at.as_deref(),
                self.order_sampling_completed_at.as_deref(),
            ),
            NodeType::SampleConfirmation => (
                self.sample_confirmation_started_at.as_deref(),
                self.sample_confirmation_completed_at.as_deref(),
            ),
            NodeType::ProductionScheduling => (
                self.production_scheduling_started_at.as_deref(),
                self.production_scheduling_completed_at.as_deref(),
            ),
            NodeType::Archived => return 0,
        };

        match started_at {
            Some(sa) => {
                let (_, hours) = calculate_timeout(sa, completed_at);
                hours
            }
            None => 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct NodeRecord {
    pub id: String,
    pub task_id: String,
    pub node_type: String,
    pub operator_id: String,
    pub action: String,
    pub remark: Option<String>,
    pub abnormal_reason: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub is_timeout: Option<i64>,
    pub timeout_hours: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct OperationLog {
    pub id: String,
    pub task_id: Option<String>,
    pub user_id: String,
    pub action: String,
    pub from_status: Option<String>,
    pub to_status: Option<String>,
    pub from_node: Option<String>,
    pub to_node: Option<String>,
    pub detail: Option<String>,
    pub ip_address: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub code: i32,
    pub message: String,
    pub data: Option<T>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        ApiResponse {
            code: 200,
            message: "success".to_string(),
            data: Some(data),
        }
    }

    pub fn success_msg(msg: &str) -> Self {
        ApiResponse {
            code: 200,
            message: msg.to_string(),
            data: None,
        }
    }

    pub fn error(code: i32, message: &str) -> Self {
        ApiResponse {
            code,
            message: message.to_string(),
            data: None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub token: String,
    pub user: UserInfo,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id: String,
    pub username: String,
    pub real_name: String,
    pub role: String,
    pub role_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String,
    pub user_id: String,
    pub username: String,
    pub role: String,
    pub exp: usize,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub order_no: Option<String>,
    pub style_no: String,
    pub style_name: String,
    pub customer_name: Option<String>,
    pub fabric_type: Option<String>,
    pub color: Option<String>,
    pub size_spec: Option<String>,
    pub quantity: Option<i64>,
    pub priority: Option<String>,
    pub deadline: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateTaskRequest {
    pub order_no: Option<String>,
    pub style_no: Option<String>,
    pub style_name: Option<String>,
    pub customer_name: Option<String>,
    pub fabric_type: Option<String>,
    pub color: Option<String>,
    pub size_spec: Option<String>,
    pub quantity: Option<i64>,
    pub priority: Option<String>,
    pub deadline: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AdvanceTaskRequest {
    pub action: String,
    pub remark: Option<String>,
    pub abnormal_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchAdvanceRequest {
    pub task_ids: Vec<String>,
    pub action: String,
    pub remark: Option<String>,
    pub abnormal_reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchItemResult {
    pub task_id: String,
    pub task_no: String,
    pub success: bool,
    pub error: Option<String>,
    pub action: Option<String>,
    pub from_node: Option<String>,
    pub to_node: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchAdvanceResult {
    pub success_count: i64,
    pub fail_count: i64,
    pub results: Vec<BatchItemResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskListQuery {
    pub page: Option<u32>,
    pub page_size: Option<u32>,
    pub status: Option<String>,
    pub current_node: Option<String>,
    pub keyword: Option<String>,
    pub is_timeout: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskListResponse {
    pub list: Vec<TaskListItem>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
    pub timeout_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskListItem {
    #[serde(flatten)]
    pub task: SamplingTask,
    pub is_timeout: bool,
    pub timeout_hours: i64,
    pub registrar_name: Option<String>,
    pub auditor_name: Option<String>,
    pub reviewer_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskDetailResponse {
    #[serde(flatten)]
    pub task: SamplingTask,
    pub is_timeout: bool,
    pub timeout_hours: i64,
    pub node_records: Vec<NodeRecordDetail>,
    pub operation_logs: Vec<OperationLogDetail>,
    pub registrar_name: Option<String>,
    pub auditor_name: Option<String>,
    pub reviewer_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NodeRecordDetail {
    #[serde(flatten)]
    pub record: NodeRecord,
    pub operator_name: Option<String>,
    pub node_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLogDetail {
    #[serde(flatten)]
    pub log: OperationLog,
    pub user_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SummaryStatistics {
    pub total_tasks: i64,
    pub pending_tasks: i64,
    pub processing_tasks: i64,
    pub completed_tasks: i64,
    pub timeout_tasks: i64,
    pub today_new_tasks: i64,
    pub today_completed_tasks: i64,
    pub avg_processing_hours: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendData {
    pub date: String,
    pub new_tasks: i64,
    pub completed_tasks: i64,
    pub timeout_tasks: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedResult<T> {
    pub list: Vec<T>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

pub fn role_display_name(role: &str) -> &str {
    match role {
        "registrar" => "登记员",
        "auditor" => "审核主管",
        "reviewer" => "复核负责人",
        _ => role,
    }
}
