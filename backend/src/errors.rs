use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Central application error type.
/// Every handler returns `Result<T, AppError>` — no panics in production.
#[derive(Debug, Error)]
pub enum AppError {
    // ─── Auth Errors ───────────────────────────────────────────
    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("Email not verified")]
    EmailNotVerified,

    #[error("Account is inactive")]
    AccountInactive,

    #[error("Token is invalid or expired")]
    InvalidToken,

    #[error("Access denied — insufficient permissions")]
    Forbidden,

    #[error("Authentication required")]
    Unauthorized,

    // ─── Resource Errors ───────────────────────────────────────
    #[error("{0} not found")]
    NotFound(&'static str),

    #[error("{0} already exists")]
    Conflict(&'static str),

    // ─── Validation Errors ─────────────────────────────────────
    #[error("Validation failed: {0}")]
    Validation(String),

    #[error("Bad request: {0}")]
    BadRequest(String),

    // ─── Rate Limit ────────────────────────────────────────────
    #[error("Too many requests — please slow down")]
    RateLimited,

    // ─── Infrastructure Errors ─────────────────────────────────
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Redis error: {0}")]
    Redis(#[from] redis::RedisError),

    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),

    // ─── File Errors ───────────────────────────────────────────
    #[error("File too large — maximum size is {0}MB")]
    FileTooLarge(u64),

    #[error("File type not allowed: {0}")]
    FileTypeNotAllowed(String),
}

impl AppError {
    /// HTTP status code for this error
    fn status_code(&self) -> StatusCode {
        match self {
            AppError::InvalidCredentials => StatusCode::UNAUTHORIZED,
            AppError::EmailNotVerified => StatusCode::FORBIDDEN,
            AppError::AccountInactive => StatusCode::FORBIDDEN,
            AppError::InvalidToken => StatusCode::UNAUTHORIZED,
            AppError::Forbidden => StatusCode::FORBIDDEN,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,

            AppError::NotFound(_) => StatusCode::NOT_FOUND,
            AppError::Conflict(_) => StatusCode::CONFLICT,

            AppError::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,

            AppError::RateLimited => StatusCode::TOO_MANY_REQUESTS,

            AppError::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Redis(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AppError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,

            AppError::FileTooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
            AppError::FileTypeNotAllowed(_) => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        }
    }

    /// Error code string for API consumers
    fn error_code(&self) -> &'static str {
        match self {
            AppError::InvalidCredentials => "INVALID_CREDENTIALS",
            AppError::EmailNotVerified => "EMAIL_NOT_VERIFIED",
            AppError::AccountInactive => "ACCOUNT_INACTIVE",
            AppError::InvalidToken => "INVALID_TOKEN",
            AppError::Forbidden => "FORBIDDEN",
            AppError::Unauthorized => "UNAUTHORIZED",

            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Conflict(_) => "CONFLICT",

            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::BadRequest(_) => "BAD_REQUEST",

            AppError::RateLimited => "RATE_LIMITED",

            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Redis(_) => "CACHE_ERROR",
            AppError::Internal(_) => "INTERNAL_ERROR",

            AppError::FileTooLarge(_) => "FILE_TOO_LARGE",
            AppError::FileTypeNotAllowed(_) => "FILE_TYPE_NOT_ALLOWED",
        }
    }

    /// Should we expose internal details to client?
    fn is_internal(&self) -> bool {
        matches!(
            self,
            AppError::Database(_) | AppError::Redis(_) | AppError::Internal(_)
        )
    }
}

/// Convert AppError into an Axum HTTP response with consistent JSON shape:
/// { "success": false, "error": { "code": "...", "message": "..." } }
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let code = self.error_code();

        // Don't leak internal error details to client
        let message = if self.is_internal() {
            tracing::error!("Internal error: {:?}", self);
            "An internal error occurred. Please try again.".to_string()
        } else {
            self.to_string()
        };

        let body = Json(json!({
            "success": false,
            "error": {
                "code": code,
                "message": message
            }
        }));

        (status, body).into_response()
    }
}

/// Shorthand result type for all handlers
pub type AppResult<T> = Result<T, AppError>;
