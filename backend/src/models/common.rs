use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
    pub total: Option<i64>,
}

impl<T: Serialize> ApiResponse<T> {
    pub fn ok(data: T, message: &str) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: Some(data),
            total: None,
        }
    }

    pub fn ok_with_total(data: T, total: i64, message: &str) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: Some(data),
            total: Some(total),
        }
    }

    pub fn ok_msg(message: &str) -> Self {
        Self {
            success: true,
            message: message.into(),
            data: None,
            total: None,
        }
    }

    pub fn err(message: &str) -> Self {
        Self {
            success: false,
            message: message.into(),
            data: None,
            total: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct StatsSummary {
    pub total: i64,
    pub registered: i64,
    pub reviewing: i64,
    pub review_passed: i64,
    pub returned: i64,
    pub verifying: i64,
    pub verified: i64,
    pub archived: i64,
    pub overdue: i64,
    pub has_attachment_issues: i64,
}
