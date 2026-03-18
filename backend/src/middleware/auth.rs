use axum::{
    async_trait,
    extract::{FromRequestParts, Request, State},
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{errors::AppError, state::AppState, utils::jwt::verify_jwt};

// ─── AuthUser — extracted from JWT in every protected handler ─────────────────
// Usage in handler: `auth: AuthUser` (no State needed)
// Contains only what's in the JWT — no DB hit required.

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub org_id:  Uuid,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        _state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // Claims are injected by auth_middleware — extract them
        parts
            .extensions
            .get::<crate::utils::jwt::Claims>()
            .map(|c| AuthUser { user_id: c.sub, org_id: c.org })
            .ok_or(AppError::Unauthorized)
    }
}

// ─── auth_middleware — validates JWT, injects Claims ─────────────────────────
// Applied at router level via .route_layer()
// O(1): just cryptographic verification, no DB or Redis call

pub async fn auth_middleware(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let claims = verify_jwt(&state.config, token)?;
    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}

// Keep old name for backward compat with auth.rs /me handler
pub use auth_middleware as require_auth;
