use rocket::http::Status;
use rocket::response::Responder;
use rocket::serde::json::Json;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(String),
    #[error("Authentication failed: {0}")]
    Auth(String),
    #[error("Validation error: {0}")]
    Validation(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Permission denied: {0}")]
    Permission(String),
    #[error("Invalid state transition: {0}")]
    StateTransition(String),
}

#[derive(Serialize)]
struct ErrorResponse {
    success: bool,
    message: String,
    error_code: String,
}

impl<'r> Responder<'r, 'static> for AppError {
    fn respond_to(self, req: &'r rocket::Request<'_>) -> rocket::response::Result<'static> {
        let (status, error_code) = match &self {
            AppError::Database(_) => (Status::InternalServerError, "database_error"),
            AppError::Auth(_) => (Status::Unauthorized, "auth_failed"),
            AppError::Validation(_) => (Status::BadRequest, "validation_error"),
            AppError::NotFound(_) => (Status::NotFound, "not_found"),
            AppError::Permission(_) => (Status::Forbidden, "permission_denied"),
            AppError::StateTransition(_) => (Status::BadRequest, "state_transition_error"),
        };

        let body = Json(ErrorResponse {
            success: false,
            message: self.to_string(),
            error_code: error_code.to_string(),
        });

        let mut response = body.respond_to(req)?;
        response.set_status(status);
        Ok(response)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<r2d2::Error> for AppError {
    fn from(e: r2d2::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

pub type AppResult<T> = Result<Json<models::ApiResponse<T>>, AppError>;

use crate::models;
