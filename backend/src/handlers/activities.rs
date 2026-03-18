// ─────────────────────────────────────────────────────────────────────────────
// Activities Handler (Day 6)
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
pub struct ListActivitiesQuery {
    pub activity_type:    Option<String>,
    pub status:           Option<String>,
    pub linked_module:    Option<String>,
    pub linked_record_id: Option<Uuid>,
    pub assigned_to:      Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateActivityRequest {
    pub activity_type:      String, // 'call', 'email', 'meeting', 'task', etc.
    pub subject:            String,
    pub description:        Option<String>,
    pub due_date:           Option<chrono::NaiveDate>,
    pub start_time:         Option<chrono::DateTime<chrono::Utc>>,
    pub end_time:           Option<chrono::DateTime<chrono::Utc>>,
    pub linked_module:      Option<String>, // "contacts", "deals"
    pub linked_record_id:   Option<Uuid>,   // specific contact or deal id
    pub assigned_to:        Option<Uuid>,
    pub priority:           Option<String>, // 'low', 'normal', 'high'
}

#[derive(Debug, Deserialize)]
pub struct UpdateActivityRequest {
    pub status:             Option<String>, // 'planned', 'in_progress', 'completed', 'cancelled'
    pub subject:            Option<String>,
    pub description:        Option<String>,
    pub outcome:            Option<String>,
    pub due_date:           Option<chrono::NaiveDate>,
    pub start_time:         Option<chrono::DateTime<chrono::Utc>>,
    pub end_time:           Option<chrono::DateTime<chrono::Utc>>,
    pub assigned_to:        Option<Uuid>,
    pub priority:           Option<String>,
}

// ─── GET /api/v1/activities ───────────────────────────────────────────────────

pub async fn list_activities(
    State(state): State<AppState>,
    Query(q): Query<ListActivitiesQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT a.id, a.activity_type::text as "activity_type", a.status::text as "status", a.subject, a.description,
               a.outcome, a.due_date, a.start_time, a.end_time, a.priority,
               a.linked_module, a.linked_record_id, a.created_at,
               a.assigned_to, u.first_name as assigned_first, u.last_name as assigned_last, u.avatar_url as assigned_avatar
        FROM activities a
        LEFT JOIN users u ON u.id = a.assigned_to
        WHERE a.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND a.deleted_at IS NULL ");

    if let Some(ref act_type) = q.activity_type {
        q_builder.push(" AND a.activity_type = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(act_type);
        q_builder.push("::text as activity_type))");
    }

    if let Some(ref status) = q.status {
        q_builder.push(" AND a.status = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(status);
        q_builder.push("::text as activity_status))");
    }

    if let Some(ref module) = q.linked_module {
        q_builder.push(" AND a.linked_module = ");
        q_builder.push_bind(module);
    }

    if let Some(record) = q.linked_record_id {
        q_builder.push(" AND a.linked_record_id = ");
        q_builder.push_bind(record);
    }

    if let Some(assignee) = q.assigned_to {
        q_builder.push(" AND a.assigned_to = ");
        q_builder.push_bind(assignee);
    }

    q_builder.push(" ORDER BY COALESCE(a.due_date, a.created_at::date) ASC, a.created_at DESC");

    let rows = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    
    let activities: Vec<Value> = rows.into_iter().map(|row| {
        let first: Option<String> = row.get("assigned_first");
        let last: Option<String> = row.get("assigned_last");
        
        json!({
            "id":               row.get::<Uuid, _>("id"),
            "activity_type":    row.get::<String, _>("activity_type"),
            "status":           row.get::<String, _>("status"),
            "subject":          row.get::<String, _>("subject"),
            "description":      row.get::<Option<String>, _>("description"),
            "outcome":          row.get::<Option<String>, _>("outcome"),
            "due_date":         row.get::<Option<chrono::NaiveDate>, _>("due_date"),
            "start_time":       row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("start_time"),
            "end_time":         row.get::<Option<chrono::DateTime<chrono::Utc>>, _>("end_time"),
            "priority":         row.get::<String, _>("priority"),
            "linked_module":    row.get::<Option<String>, _>("linked_module"),
            "linked_record_id": row.get::<Option<Uuid>, _>("linked_record_id"),
            "created_at":       row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "assignee": {
                "id":         row.get::<Option<Uuid>, _>("assigned_to"),
                "name":       fmt_name(first.as_deref(), last.as_deref()),
                "avatar_url": row.get::<Option<String>, _>("assigned_avatar"),
            }
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": activities
    })))
}

// ─── POST /api/v1/activities ──────────────────────────────────────────────────

pub async fn create_activity(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateActivityRequest>,
) -> AppResult<impl IntoResponse> {
    if body.subject.trim().is_empty() {
        return Err(AppError::Validation("Subject is required".into()));
    }

    let assigned_id = body.assigned_to.unwrap_or(auth.user_id);

    let activity = sqlx::query!(
        r#"
        INSERT INTO activities (
            org_id, activity_type, status, subject, description, due_date, start_time, end_time,
            linked_module, linked_record_id, assigned_to, created_by, priority
        )
        VALUES (
            $1, CAST($2::text as activity_type), 'planned', $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12
        )
        RETURNING id, created_at
        "#,
        auth.org_id,
        body.activity_type.to_lowercase(),
        body.subject.trim(),
        body.description.as_deref(),
        body.due_date,
        body.start_time,
        body.end_time,
        body.linked_module.as_deref(),
        body.linked_record_id,
        assigned_id,
        auth.user_id,
        body.priority.as_deref().unwrap_or("normal")
    )
    .fetch_one(&state.db)
    .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": activity.id,
                "created_at": activity.created_at
            }
        }))
    ))
}

// ─── PATCH /api/v1/activities/:id ─────────────────────────────────────────────

pub async fn update_activity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateActivityRequest>,
) -> AppResult<impl IntoResponse> {
    // Basic existence check
    let existing = sqlx::query_scalar!(
        "SELECT id FROM activities WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Activity"))?;

    let activity = sqlx::query!(
        r#"
        UPDATE activities
        SET 
            status = COALESCE(CAST($3::text as activity_status), status),
            subject = COALESCE($4, subject),
            description = COALESCE($5, description),
            outcome = COALESCE($6, outcome),
            due_date = COALESCE($7, due_date),
            start_time = COALESCE($8, start_time),
            end_time = COALESCE($9, end_time),
            assigned_to = COALESCE($10, assigned_to),
            priority = COALESCE($11, priority),
            updated_at = NOW(),
            completed_at = CASE 
                WHEN CAST($3::text as activity_status) = 'completed' AND status != 'completed' THEN NOW()
                ELSE completed_at
            END,
            completed_by = CASE
                WHEN CAST($3::text as activity_status) = 'completed' AND status != 'completed' THEN $12
                ELSE completed_by
            END
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, updated_at
        "#,
        existing,
        auth.org_id,
        body.status.as_deref(),
        body.subject.as_deref(),
        body.description.as_deref(),
        body.outcome.as_deref(),
        body.due_date,
        body.start_time,
        body.end_time,
        body.assigned_to,
        body.priority.as_deref(),
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": activity.id,
            "updated_at": activity.updated_at
        }
    })))
}

// ─── DELETE /api/v1/activities/:id ────────────────────────────────────────────

pub async fn delete_activity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT id FROM activities WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Activity"))?;

    sqlx::query!(
        "UPDATE activities SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        existing, auth.org_id
    ).execute(&state.db).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Activity deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, patch};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_activities).post(create_activity))
        .route("/:id", patch(update_activity).delete(delete_activity))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
