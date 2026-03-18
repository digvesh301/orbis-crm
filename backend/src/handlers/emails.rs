// ─────────────────────────────────────────────────────────────────────────────
// Emails & Communications Handler (Day 8)
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

fn fmt_name(first: Option<&str>, last: Option<&str>) -> Option<String> {
    match (first, last) {
        (Some(f), Some(l)) if !f.is_empty() => Some(format!("{} {}", f, l.trim())),
        (Some(f), _)       if !f.is_empty() => Some(f.to_string()),
        _                                   => None,
    }
}

// ─── Request Types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListEmailsQuery {
    pub search:           Option<String>,
    pub status:           Option<String>,
    pub direction:        Option<String>,
    pub linked_module:    Option<String>,
    pub linked_record_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct SendEmailRequest {
    pub to_emails:        Vec<String>,
    pub cc_emails:        Option<Vec<String>>,
    pub bcc_emails:       Option<Vec<String>>,
    pub subject:          String,
    pub body_html:        Option<String>,
    pub body_text:        Option<String>,
    pub scheduled_at:     Option<chrono::DateTime<chrono::Utc>>,
    pub linked_module:    Option<String>, // 'contacts', 'deals', 'leads', etc.
    pub linked_record_id: Option<Uuid>,
}

// ─── GET /api/v1/emails ───────────────────────────────────────────────────────

pub async fn list_emails(
    State(state): State<AppState>,
    Query(q): Query<ListEmailsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT e.id, e.direction::text as "direction", e.status::text as "status", e.from_email, e.from_name,
               e.to_emails, e.cc_emails, e.bcc_emails, e.subject, e.body_html, e.body_text,
               e.scheduled_at, e.sent_at, e.open_count, e.click_count,
               e.linked_module, e.linked_record_id, e.created_at,
               e.created_by, u.first_name as author_first, u.last_name as author_last, u.avatar_url as author_avatar
        FROM emails e
        LEFT JOIN users u ON u.id = e.created_by
        WHERE e.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);

    if let Some(ref search) = q.search {
        let qs = format!("%{}%", search);
        q_builder.push(" AND (e.subject ILIKE ");
        q_builder.push_bind(qs.clone());
        q_builder.push(" OR e.to_emails::text ILIKE ");
        q_builder.push_bind(qs.clone());
        q_builder.push(" OR e.from_email ILIKE ");
        q_builder.push_bind(qs);
        q_builder.push(") ");
    }

    if let Some(ref status) = q.status {
        q_builder.push(" AND e.status = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(status);
        q_builder.push("::text as email_status))");
    }

    if let Some(ref direction) = q.direction {
        q_builder.push(" AND e.direction = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(direction);
        q_builder.push("::text as email_direction))");
    }

    if let Some(ref module) = q.linked_module {
        q_builder.push(" AND e.linked_module = ");
        q_builder.push_bind(module);
    }
    if let Some(record) = q.linked_record_id {
        q_builder.push(" AND e.linked_record_id = ");
        q_builder.push_bind(record);
    }

    q_builder.push(" ORDER BY COALESCE(e.sent_at, e.created_at) DESC");

    let rows = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    let emails: Vec<Value> = rows.into_iter().map(|row| {
        let first: Option<String> = row.get("author_first");
        let last: Option<String> = row.get("author_last");

        json!({
            "id":               row.get::<Uuid, _>("id"),
            "direction":        row.get::<String, _>("direction"),
            "status":           row.get::<String, _>("status"),
            "from_email":       row.get::<String, _>("from_email"),
            "from_name":        row.get::<Option<String>, _>("from_name"),
            "to_emails":        row.get::<Value, _>("to_emails"),
            "cc_emails":        row.get::<Value, _>("cc_emails"),
            "bcc_emails":       row.get::<Value, _>("bcc_emails"),
            "subject":          row.get::<String, _>("subject"),
            "body_html":        row.get::<Option<String>, _>("body_html"),
            "body_text":        row.get::<Option<String>, _>("body_text"),
            "scheduled_at":     row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("scheduled_at"),
            "sent_at":          row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("sent_at"),
            "open_count":       row.get::<i32, _>("open_count"),
            "click_count":      row.get::<i32, _>("click_count"),
            "linked_module":    row.get::<Option<String>, _>("linked_module"),
            "linked_record_id": row.get::<Option<Uuid>, _>("linked_record_id"),
            "created_at":       row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "author": {
                "id":         row.get::<Option<Uuid>, _>("created_by"),
                "name":       fmt_name(first.as_deref(), last.as_deref()),
                "avatar_url": row.get::<Option<String>, _>("author_avatar"),
            }
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": emails
    })))
}

// ─── POST /api/v1/emails/send ─────────────────────────────────────────────────

pub async fn send_email(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<SendEmailRequest>,
) -> AppResult<impl IntoResponse> {
    if body.to_emails.is_empty() {
        return Err(AppError::Validation("At least one recipient is required".into()));
    }
    if body.subject.trim().is_empty() {
        return Err(AppError::Validation("Subject is required".into()));
    }
    if body.body_html.is_none() && body.body_text.is_none() {
        return Err(AppError::Validation("Email body is required".into()));
    }

    // Capture User Info to populate the "From" side, in a real app this uses the 'Integration' configs
    let sender = sqlx::query!(
        "SELECT first_name, last_name, email FROM users WHERE id = $1 AND org_id = $2",
        auth.user_id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::Forbidden)?;

    let from_name = fmt_name(Some(&sender.first_name), sender.last_name.as_deref())
        .unwrap_or_else(|| "User".to_string());
    
    let is_scheduled = body.scheduled_at.is_some();
    let initial_status = if is_scheduled { "scheduled" } else { "sent" };
    let initial_sent_at = if is_scheduled { None } else { Some(chrono::Utc::now()) };

    let to_json = serde_json::to_value(&body.to_emails).unwrap_or(json!([]));
    let cc_json = serde_json::to_value(&body.cc_emails).unwrap_or(json!([]));
    let bcc_json = serde_json::to_value(&body.bcc_emails).unwrap_or(json!([]));

    let email = sqlx::query!(
        r#"
        INSERT INTO emails (
            org_id, direction, status, from_email, from_name,
            to_emails, cc_emails, bcc_emails, subject, body_html, body_text,
            scheduled_at, sent_at, linked_module, linked_record_id, created_by
        )
        VALUES (
            $1, 'outbound', CAST($2::text as email_status), $3, $4,
            $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15
        )
        RETURNING id, tracking_id, created_at
        "#,
        auth.org_id,
        initial_status,
        sender.email,
        from_name,
        to_json,
        cc_json,
        bcc_json,
        body.subject.trim(),
        body.body_html.as_deref(),
        body.body_text.as_deref(),
        body.scheduled_at,
        initial_sent_at,
        body.linked_module.as_deref(),
        body.linked_record_id,
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    // In a production app, here you would:
    // 1. Send the email logic externally using Lettre/SendGrid/SES
    // let result = external_mailer::send(&email_data).await;
    // if !result.success { sqlx::query!("UPDATE emails SET status='failed' WHERE id = $1"...); }

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": email.id,
                "tracking_id": email.tracking_id,
                "status": initial_status,
                "created_at": email.created_at
            }
        }))
    ))
}


// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, post};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_emails))
        .route("/send", post(send_email))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
