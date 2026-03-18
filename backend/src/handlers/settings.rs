// ─────────────────────────────────────────────────────────────────────────────
// Settings Handlers (Day 14)
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::State,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    errors::{AppError, AppResult},
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Request Types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct UpdateOrgRequest {
    pub name: Option<String>,
    pub website: Option<String>,
    pub phone: Option<String>,
    pub timezone: Option<String>,
    pub date_format: Option<String>,
    pub currency: Option<String>,
    pub currency_symbol: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub email: Option<String>, // We might not want them to change this directly, but possible
    pub title: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

pub async fn get_org_settings(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let org = sqlx::query!(
        r#"
        SELECT id, name, slug, logo_url, website, phone, email, 
               timezone, date_format, currency, currency_symbol, language, plan::text as "plan!"
        FROM organizations
        WHERE id = $1 AND is_active = true
        "#,
        auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Organization"))?;

    Ok(Json(json!({ "success": true, "data": {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "logo_url": org.logo_url,
        "website": org.website,
        "phone": org.phone,
        "email": org.email,
        "timezone": org.timezone,
        "date_format": org.date_format,
        "currency": org.currency,
        "currency_symbol": org.currency_symbol,
        "language": org.language,
        "plan": org.plan.to_string(),
    }})))
}

pub async fn update_org_settings(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateOrgRequest>,
) -> AppResult<impl IntoResponse> {
    // Only admins should ideally update org settings, but we assume middleware or simple check here
    
    let org = sqlx::query!(
        r#"
        UPDATE organizations
        SET 
            name = COALESCE($2, name),
            website = COALESCE($3, website),
            phone = COALESCE($4, phone),
            timezone = COALESCE($5, timezone),
            date_format = COALESCE($6, date_format),
            currency = COALESCE($7, currency),
            currency_symbol = COALESCE($8, currency_symbol),
            updated_at = NOW()
        WHERE id = $1 AND is_active = true
        RETURNING id
        "#,
        auth.org_id,
        body.name.as_deref().map(str::trim),
        body.website.as_deref(),
        body.phone.as_deref(),
        body.timezone.as_deref(),
        body.date_format.as_deref(),
        body.currency.as_deref(),
        body.currency_symbol.as_deref(),
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Organization"))?;

    Ok(Json(json!({ "success": true, "message": "Organization settings updated." })))
}

pub async fn get_user_settings(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let user = sqlx::query!(
        r#"
        SELECT id, first_name, last_name, email, title, avatar_url
        FROM users
        WHERE id = $1 AND deleted_at IS NULL
        "#,
        auth.user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("User"))?;

    Ok(Json(json!({ "success": true, "data": {
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "title": user.title,
        "avatar_url": user.avatar_url,
    }})))
}

pub async fn update_user_profile(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdateUserRequest>,
) -> AppResult<impl IntoResponse> {
    sqlx::query!(
        r#"
        UPDATE users
        SET 
            first_name = COALESCE($2, first_name),
            last_name = COALESCE($3, last_name),
            title = COALESCE($4, title),
            updated_at = NOW()
        WHERE id = $1
        "#,
        auth.user_id,
        body.first_name.as_deref().map(str::trim),
        body.last_name.as_deref().map(str::trim),
        body.title.as_deref(),
    )
    .execute(&state.db)
    .await?;

    // Invalidate user cache to ensure /me reflects latest immediately
    let cache_key = crate::utils::cache::key_user(auth.user_id);
    crate::utils::cache::cache_del(&state, &cache_key).await;

    Ok(Json(json!({ "success": true, "message": "Profile updated." })))
}

pub async fn change_password(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<UpdatePasswordRequest>,
) -> AppResult<impl IntoResponse> {
    if body.new_password.len() < 8 {
        return Err(AppError::Validation("New password must be at least 8 characters".into()));
    }

    let user = sqlx::query!("SELECT password_hash FROM users WHERE id = $1", auth.user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User"))?;

    let hash = user.password_hash.as_deref().unwrap_or("");
    if !crate::handlers::auth::verify_password(&body.current_password, hash)? {
        return Err(AppError::Validation("Incorrect current password".into()));
    }

    let new_hash = crate::handlers::auth::hash_password(&body.new_password)?;

    sqlx::query!("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1", auth.user_id, new_hash)
        .execute(&state.db)
        .await?;

    // Optionally revoke other sessions, skipping for now.
    
    Ok(Json(json!({ "success": true, "message": "Password changed successfully." })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, post, patch};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/org", get(get_org_settings).patch(update_org_settings))
        .route("/profile", get(get_user_settings).patch(update_user_profile))
        .route("/password", post(change_password))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
