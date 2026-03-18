use axum::{
    extract::{Json, State},
    http::StatusCode,
    response::IntoResponse,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Utc;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier, password_hash::SaltString};
use rand::rngs::OsRng;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
    utils::{
        jwt::{create_access_token, create_refresh_token, hash_token, verify_jwt},
        email::send_verification_email,
    },
};

// ─── Request / Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub first_name: String,
    pub last_name: Option<String>,
    pub email: String,
    pub password: String,
    pub org_name: String,       // Creates org on register
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub token: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyEmailRequest {
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub success: bool,
    pub data: AuthData,
}

#[derive(Debug, Serialize)]
pub struct AuthData {
    pub access_token: String,
    pub refresh_token: String,
    pub token_type: String,
    pub expires_in: i64,   // seconds
    pub user: UserInfo,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: Option<String>,
    pub email: String,
    pub org_id: Uuid,
    pub org_name: String,
    pub avatar_url: Option<String>,
    pub is_email_verified: bool,
}

// ─── Helper: Hash Password ────────────────────────────────────────────────────

pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Password hash error: {}", e)))
}

pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Invalid hash: {}", e)))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

// ─── Helper: Slug generation ──────────────────────────────────────────────────

fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

// ─── POST /api/v1/auth/register ───────────────────────────────────────────────

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input
    if body.first_name.trim().is_empty() {
        return Err(AppError::Validation("First name is required".into()));
    }
    if body.email.trim().is_empty() || !body.email.contains('@') {
        return Err(AppError::Validation("Valid email is required".into()));
    }
    if body.password.len() < 8 {
        return Err(AppError::Validation("Password must be at least 8 characters".into()));
    }
    if body.org_name.trim().is_empty() {
        return Err(AppError::Validation("Organization name is required".into()));
    }

    let email = body.email.trim().to_lowercase();
    let password_hash = hash_password(&body.password)?;

    // Create org + user in a transaction
    let mut tx = state.db.begin().await?;

    // Check if email already registered globally
    let existing = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM users WHERE email = $1 AND deleted_at IS NULL",
        email
    )
    .fetch_one(&mut *tx)
    .await?;

    if existing.unwrap_or(0) > 0 {
        return Err(AppError::Conflict("Email is already registered"));
    }

    // Generate unique slug for org
    let base_slug = slugify(&body.org_name);
    let slug = format!("{}-{}", base_slug, &Uuid::new_v4().to_string()[..8]);

    // Create organization
    let org = sqlx::query!(
        r#"
        INSERT INTO organizations (name, slug)
        VALUES ($1, $2)
        RETURNING id, name
        "#,
        body.org_name.trim(),
        slug,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Seed default data for the new org
    sqlx::query!("SELECT seed_new_organization($1)", org.id)
        .execute(&mut *tx)
        .await?;

    // Get the Admin profile ID
    let admin_profile = sqlx::query_scalar!(
        "SELECT id FROM profiles WHERE org_id = $1 AND name = 'Admin'",
        org.id
    )
    .fetch_one(&mut *tx)
    .await?;

    // Create the first user (org owner = Admin)
    let user = sqlx::query!(
        r#"
        INSERT INTO users (org_id, profile_id, first_name, last_name, email, password_hash, status, is_email_verified)
        VALUES ($1, $2, $3, $4, $5, $6, 'active', false)
        RETURNING id, first_name, last_name, email, org_id, avatar_url, is_email_verified
        "#,
        org.id,
        admin_profile,
        body.first_name.trim(),
        body.last_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
        email,
        password_hash,
    )
    .fetch_one(&mut *tx)
    .await?;

    // Create email verification token
    let raw_token = Uuid::new_v4().to_string();
    let token_hash = hash_token(&raw_token);
    let expires_at = Utc::now() + chrono::Duration::hours(24);

    sqlx::query!(
        "INSERT INTO email_verifications (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
        user.id,
        token_hash,
        expires_at,
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    // Send verification email (non-blocking — don't fail registration if email fails)
    let _ = send_verification_email(
        &state.config,
        &email,
        &body.first_name,
        &raw_token,
    ).await;

    // Generate JWT tokens
    let access_token = create_access_token(&state.config, user.id, org.id)?;
    let refresh_token_raw = Uuid::new_v4().to_string();
    let refresh_token_hash = hash_token(&refresh_token_raw);

    // Store refresh token session
    let session_expires = Utc::now() + chrono::Duration::days(state.config.jwt_refresh_token_expiry_days);
    sqlx::query!(
        "INSERT INTO sessions (user_id, org_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        user.id,
        org.id,
        refresh_token_hash,
        session_expires,
    )
    .execute(&state.db)
    .await?;

    let expires_in = state.config.jwt_access_token_expiry_minutes * 60;

    Ok((
        StatusCode::CREATED,
        axum::Json(AuthResponse {
            success: true,
            data: AuthData {
                access_token,
                refresh_token: refresh_token_raw,
                token_type: "Bearer".into(),
                expires_in,
                user: UserInfo {
                    id: user.id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    email: user.email,
                    org_id: user.org_id,
                    org_name: org.name,
                    avatar_url: user.avatar_url,
                    is_email_verified: user.is_email_verified,
                },
            },
        }),
    ))
}

// ─── POST /api/v1/auth/login ──────────────────────────────────────────────────

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> AppResult<impl IntoResponse> {
    let email = body.email.trim().to_lowercase();

    // Find user
    let user = sqlx::query!(
        r#"
        SELECT u.id, u.first_name, u.last_name, u.email, u.org_id,
               u.password_hash, u.status::text as "status!", u.is_email_verified,
               u.avatar_url, o.name as org_name
        FROM users u
        JOIN organizations o ON o.id = u.org_id
        WHERE u.email = $1 AND u.deleted_at IS NULL
        LIMIT 1
        "#,
        email
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::InvalidCredentials)?;

    // Check account status
    if user.status == "suspended" || user.status == "inactive" {
        return Err(AppError::AccountInactive);
    }

    // Verify password
    let hash = user.password_hash.as_deref().unwrap_or("");
    if !verify_password(&body.password, hash)? {
        return Err(AppError::InvalidCredentials);
    }

    // Update last login
    sqlx::query!(
        "UPDATE users SET last_login_at = NOW(), last_active_at = NOW() WHERE id = $1",
        user.id
    )
    .execute(&state.db)
    .await?;

    // Generate tokens
    let access_token = create_access_token(&state.config, user.id, user.org_id)?;
    let refresh_token_raw = Uuid::new_v4().to_string();
    let refresh_token_hash = hash_token(&refresh_token_raw);

    let session_expires = Utc::now() + chrono::Duration::days(state.config.jwt_refresh_token_expiry_days);
    sqlx::query!(
        "INSERT INTO sessions (user_id, org_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
        user.id,
        user.org_id,
        refresh_token_hash,
        session_expires,
    )
    .execute(&state.db)
    .await?;

    let expires_in = state.config.jwt_access_token_expiry_minutes * 60;

    Ok(axum::Json(AuthResponse {
        success: true,
        data: AuthData {
            access_token,
            refresh_token: refresh_token_raw,
            token_type: "Bearer".into(),
            expires_in,
            user: UserInfo {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                org_id: user.org_id,
                org_name: user.org_name,
                avatar_url: user.avatar_url,
                is_email_verified: user.is_email_verified,
            },
        },
    }))
}

// ─── POST /api/v1/auth/refresh ────────────────────────────────────────────────

pub async fn refresh(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<impl IntoResponse> {
    let token_hash = hash_token(&body.refresh_token);

    let session = sqlx::query!(
        r#"
        SELECT s.id, s.user_id, s.org_id, s.expires_at
        FROM sessions s
        WHERE s.token_hash = $1 AND s.expires_at > NOW()
        "#,
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::InvalidToken)?;

    // Update last_used_at
    sqlx::query!(
        "UPDATE sessions SET last_used_at = NOW() WHERE id = $1",
        session.id
    )
    .execute(&state.db)
    .await?;

    let access_token = create_access_token(&state.config, session.user_id, session.org_id)?;
    let expires_in = state.config.jwt_access_token_expiry_minutes * 60;

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "data": {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": expires_in
        }
    })))
}

// ─── POST /api/v1/auth/logout ─────────────────────────────────────────────────

pub async fn logout(
    State(state): State<AppState>,
    Json(body): Json<RefreshRequest>,
) -> AppResult<impl IntoResponse> {
    let token_hash = hash_token(&body.refresh_token);
    sqlx::query!("DELETE FROM sessions WHERE token_hash = $1", token_hash)
        .execute(&state.db)
        .await?;

    Ok(axum::Json(serde_json::json!({"success": true, "message": "Logged out"})))
}

// ─── POST /api/v1/auth/verify-email ──────────────────────────────────────────

pub async fn verify_email(
    State(state): State<AppState>,
    Json(body): Json<VerifyEmailRequest>,
) -> AppResult<impl IntoResponse> {
    let token_hash = hash_token(&body.token);

    let verification = sqlx::query!(
        r#"
        SELECT id, user_id, expires_at, used_at
        FROM email_verifications
        WHERE token_hash = $1
        "#,
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::InvalidToken)?;

    if verification.used_at.is_some() {
        return Err(AppError::BadRequest("Email already verified".into()));
    }

    if verification.expires_at < Utc::now() {
        return Err(AppError::BadRequest("Verification link has expired".into()));
    }

    let mut tx = state.db.begin().await?;

    sqlx::query!(
        "UPDATE email_verifications SET used_at = NOW() WHERE id = $1",
        verification.id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "UPDATE users SET is_email_verified = true, status = 'active' WHERE id = $1",
        verification.user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "message": "Email verified successfully"
    })))
}

// ─── POST /api/v1/auth/forgot-password ───────────────────────────────────────

pub async fn forgot_password(
    State(state): State<AppState>,
    Json(body): Json<ForgotPasswordRequest>,
) -> AppResult<impl IntoResponse> {
    let email = body.email.trim().to_lowercase();

    // Always return success to prevent email enumeration
    let user = sqlx::query!(
        "SELECT id, first_name FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1",
        email
    )
    .fetch_optional(&state.db)
    .await?;

    if let Some(user) = user {
        let raw_token = Uuid::new_v4().to_string();
        let token_hash = hash_token(&raw_token);
        let expires_at = Utc::now() + chrono::Duration::hours(1);

        // Invalidate old tokens
        sqlx::query!(
            "DELETE FROM password_resets WHERE user_id = $1",
            user.id
        )
        .execute(&state.db)
        .await?;

        sqlx::query!(
            "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
            user.id,
            token_hash,
            expires_at,
        )
        .execute(&state.db)
        .await?;

        // Send reset email (non-blocking)
        let _ = crate::utils::email::send_password_reset_email(
            &state.config,
            &email,
            &user.first_name,
            &raw_token,
        ).await;
    }

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "message": "If that email exists, a reset link has been sent"
    })))
}

// ─── POST /api/v1/auth/reset-password ────────────────────────────────────────

pub async fn reset_password(
    State(state): State<AppState>,
    Json(body): Json<ResetPasswordRequest>,
) -> AppResult<impl IntoResponse> {
    if body.new_password.len() < 8 {
        return Err(AppError::Validation("Password must be at least 8 characters".into()));
    }

    let token_hash = hash_token(&body.token);

    let reset = sqlx::query!(
        "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1",
        token_hash
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::InvalidToken)?;

    if reset.used_at.is_some() {
        return Err(AppError::BadRequest("Reset link already used".into()));
    }

    if reset.expires_at < Utc::now() {
        return Err(AppError::BadRequest("Reset link has expired".into()));
    }

    let new_hash = hash_password(&body.new_password)?;
    let mut tx = state.db.begin().await?;

    sqlx::query!(
        "UPDATE users SET password_hash = $1 WHERE id = $2",
        new_hash,
        reset.user_id
    )
    .execute(&mut *tx)
    .await?;

    sqlx::query!(
        "UPDATE password_resets SET used_at = NOW() WHERE id = $1",
        reset.id
    )
    .execute(&mut *tx)
    .await?;

    // Invalidate all existing sessions
    sqlx::query!(
        "DELETE FROM sessions WHERE user_id = $1",
        reset.user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "message": "Password reset successfully. Please log in."
    })))
}

// ─── GET /api/v1/auth/me ──────────────────────────────────────────────────────

pub async fn me(
    State(state): State<AppState>,
    axum::Extension(claims): axum::Extension<crate::utils::jwt::Claims>,
) -> AppResult<impl IntoResponse> {
    use crate::utils::cache::{cache_get, cache_set, key_user};

    let cache_key = key_user(claims.sub);

    // ① Try Redis first — O(1), ~0.1ms
    if let Some(cached) = cache_get::<serde_json::Value>(&state, &cache_key).await {
        return Ok(axum::Json(serde_json::json!({
            "success": true,
            "data": cached,
            "cached": true    // visible in response for debugging
        })));
    }

    // ② Cache miss — hit PostgreSQL O(log n) by PK, ~0.5-2ms
    let user = sqlx::query!(
        r#"
        SELECT u.id, u.first_name, u.last_name, u.email, u.org_id,
               u.avatar_url, u.is_email_verified, o.name as org_name
        FROM users u
        JOIN organizations o ON o.id = u.org_id
        WHERE u.id = $1 AND u.deleted_at IS NULL
        "#,
        claims.sub
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("User"))?;

    let user_data = serde_json::json!({
        "id": user.id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "org_id": user.org_id,
        "org_name": user.org_name,
        "avatar_url": user.avatar_url,
        "is_email_verified": user.is_email_verified,
    });

    // ③ Populate cache for next 5 minutes (non-blocking)
    let _ = cache_set(&state, &cache_key, &user_data, 300_u64).await;

    Ok(axum::Json(serde_json::json!({
        "success": true,
        "data": user_data,
        "cached": false
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, post};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/register",        post(register))
        .route("/login",           post(login))
        .route("/refresh",         post(refresh))
        .route("/logout",          post(logout))
        .route("/verify-email",    post(verify_email))
        .route("/forgot-password", post(forgot_password))
        .route("/reset-password",  post(reset_password))
        .route("/me",              get(me).route_layer(from_fn_with_state(state, auth_middleware)))
}
