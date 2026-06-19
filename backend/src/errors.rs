use axum::{
    http::StatusCode,
    response::{IntoResponse, Json},
};
use serde_json::json;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    Database(String),

    #[error("未授权: {0}")]
    Unauthorized(String),

    #[error("禁止访问: {0}")]
    Forbidden(String),

    #[error("未找到: {0}")]
    NotFound(String),

    #[error("验证失败: {0}")]
    Validation(String),

    #[error("版本冲突: {0}")]
    VersionConflict(String),

    #[error("状态错误: {0}")]
    InvalidStatus(String),

    #[error("缺少证据: {0}")]
    MissingEvidence(String),

    #[error("角色错误: {0}")]
    WrongRole(String),

    #[error("内部错误: {0}")]
    Internal(String),
}

impl From<sqlx::Error> for AppError {
    fn from(err: sqlx::Error) -> Self {
        match err {
            sqlx::Error::RowNotFound => AppError::NotFound("记录不存在".to_string()),
            _ => AppError::Database(err.to_string()),
        }
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::Unauthorized(format!("Token 无效: {}", err))
    }
}

impl From<bcrypt::BcryptError> for AppError {
    fn from(err: bcrypt::BcryptError) -> Self {
        AppError::Internal(format!("密码处理错误: {}", err))
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let status = match &self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::Forbidden(_) => StatusCode::FORBIDDEN,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            AppError::VersionConflict(_) => StatusCode::CONFLICT,
            AppError::InvalidStatus(_) => StatusCode::BAD_REQUEST,
            AppError::MissingEvidence(_) => StatusCode::BAD_REQUEST,
            AppError::WrongRole(_) => StatusCode::FORBIDDEN,
            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let error_type = match &self {
            AppError::Unauthorized(_) => "unauthorized",
            AppError::Forbidden(_) => "forbidden",
            AppError::NotFound(_) => "not_found",
            AppError::Validation(_) => "validation_error",
            AppError::VersionConflict(_) => "version_conflict",
            AppError::InvalidStatus(_) => "invalid_status",
            AppError::MissingEvidence(_) => "missing_evidence",
            AppError::WrongRole(_) => "wrong_role",
            AppError::Database(_) => "database_error",
            AppError::Internal(_) => "internal_error",
        };

        (status, Json(json!({
            "error": error_type,
            "message": self.to_string()
        })))
            .into_response()
    }
}

pub type AppResult<T> = Result<T, AppError>;
