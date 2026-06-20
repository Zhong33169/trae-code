use actix_web::{HttpResponse, http::StatusCode};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    RoleMismatch(String),
    #[error("{0}")]
    WrongStatus(String),
    #[error("{0}")]
    MissingEvidence(String),
    #[error("{0}")]
    VersionConflict(String),
    #[error("{0}")]
    Duplicate(String),
    #[error("{0}")]
    Unauthorized(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    BadRequest(String),
    #[error("{0}")]
    InternalError(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    code: String,
    message: String,
}

impl AppError {
    pub fn error_code(&self) -> &str {
        match self {
            AppError::RoleMismatch(_) => "ROLE_MISMATCH",
            AppError::WrongStatus(_) => "WRONG_STATUS",
            AppError::MissingEvidence(_) => "MISSING_EVIDENCE",
            AppError::VersionConflict(_) => "VERSION_CONFLICT",
            AppError::Duplicate(_) => "DUPLICATE",
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::BadRequest(_) => "BAD_REQUEST",
            AppError::InternalError(_) => "INTERNAL_ERROR",
        }
    }
}

impl actix_web::ResponseError for AppError {
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::InternalError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            _ => StatusCode::BAD_REQUEST,
        }
    }

    fn error_response(&self) -> HttpResponse {
        HttpResponse::build(self.status_code()).json(ErrorResponse {
            code: self.error_code().to_string(),
            message: self.to_string(),
        })
    }
}
