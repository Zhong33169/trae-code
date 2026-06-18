use actix_web::{HttpResponse, ResponseError};
use thiserror::Error;
use serde::Serialize;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("数据库错误: {0}")]
    DatabaseError(String),

    #[error("认证失败: {0}")]
    AuthError(String),

    #[error("权限不足: {0}")]
    PermissionError(String),

    #[error("参数错误: {0}")]
    ValidationError(String),

    #[error("业务错误: {0}")]
    BusinessError(String),

    #[error("资源不存在: {0}")]
    NotFoundError(String),

    #[error("系统错误: {0}")]
    InternalError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    message: String,
    code: String,
}

impl ResponseError for AppError {
    fn error_response(&self) -> HttpResponse {
        let (status, code) = match self {
            AppError::AuthError(_) => (401, "UNAUTHORIZED"),
            AppError::PermissionError(_) => (403, "FORBIDDEN"),
            AppError::ValidationError(_) => (400, "VALIDATION_ERROR"),
            AppError::BusinessError(_) => (400, "BUSINESS_ERROR"),
            AppError::NotFoundError(_) => (404, "NOT_FOUND"),
            _ => (500, "INTERNAL_ERROR"),
        };

        HttpResponse::build(status.try_into().unwrap())
            .json(ErrorResponse {
                success: false,
                message: self.to_string(),
                code: code.to_string(),
            })
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AppError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AppError::AuthError(err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::InternalError(err.to_string())
    }
}
