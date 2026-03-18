// ─────────────────────────────────────────────────────────────────────────────
// Notes Handler (Day 6)
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    errors::{AppError, AppResult},
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Request Types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListNotesQuery {
    pub module_api_name: Option<String>,
    pub record_id:       Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNoteRequest {
    pub module_api_name: String,      // e.g. "contacts", "deals"
    pub record_id:       Uuid,        // the ID of the contact, deal, etc.
    pub content:         String,
    pub content_type:    Option<String>, // 'plain', 'html', 'markdown' (default: 'plain')
    pub is_pinned:       Option<bool>,
    pub is_private:      Option<bool>,
    pub mentioned_users: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNoteRequest {
    pub content:         Option<String>,
    pub content_type:    Option<String>,
    pub is_pinned:       Option<bool>,
    pub is_private:      Option<bool>,
    pub mentioned_users: Option<Vec<Uuid>>,
}

// ─── GET /api/v1/notes ────────────────────────────────────────────────────────

pub async fn list_notes(
    State(state): State<AppState>,
    Query(q): Query<ListNotesQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT n.id, n.module_api_name, n.record_id, n.content, n.content_type, n.is_pinned, n.is_private,
               n.mentioned_users, n.created_at, n.updated_at,
               n.created_by, u.first_name as author_first, u.last_name as author_last, u.avatar_url as author_avatar
        FROM notes n
        LEFT JOIN users u ON u.id = n.created_by
        WHERE n.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND n.deleted_at IS NULL ");

    if let Some(ref module) = q.module_api_name {
        q_builder.push(" AND n.module_api_name = ");
        q_builder.push_bind(module);
    }

    if let Some(record) = q.record_id {
        q_builder.push(" AND n.record_id = ");
        q_builder.push_bind(record);
    }

    q_builder.push(" ORDER BY n.is_pinned DESC, n.created_at DESC");

    let rows = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    
    let notes: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        let first: Option<String> = row.get("author_first");
        let last: Option<String> = row.get("author_last");
        let author_name = match (first.as_deref(), last.as_deref()) {
            (Some(f), Some(l)) if !f.is_empty() => Some(format!("{} {}", f, l)),
            (Some(f), _) if !f.is_empty() => Some(f.to_string()),
            _ => None,
        };
        
        json!({
            "id":              row.get::<Uuid, _>("id"),
            "module_api_name": row.get::<String, _>("module_api_name"),
            "record_id":       row.get::<Uuid, _>("record_id"),
            "content":         row.get::<String, _>("content"),
            "content_type":    row.get::<String, _>("content_type"),
            "is_pinned":       row.get::<bool, _>("is_pinned"),
            "is_private":      row.get::<bool, _>("is_private"),
            "mentioned_users": row.get::<Vec<Uuid>, _>("mentioned_users"),
            "created_at":      row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at":      row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "author": {
                "id":         row.get::<Option<Uuid>, _>("created_by"),
                "name":       author_name,
                "avatar_url": row.get::<Option<String>, _>("author_avatar"),
            }
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": notes
    })))
}

// ─── POST /api/v1/notes ───────────────────────────────────────────────────────

pub async fn create_note(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateNoteRequest>,
) -> AppResult<impl IntoResponse> {
    if body.content.trim().is_empty() {
        return Err(AppError::Validation("Note content cannot be empty".into()));
    }
    
    // Note: In a production CRM system, here you would check if the record_id actually exists 
    // within the module_api_name (e.g. SELECT id FROM contacts WHERE id=body.record_id)
    // To keep it generic across dynamic modules, we'll allow insertion freely assuming client sends correct ids

    let note = sqlx::query!(
        r#"
        INSERT INTO notes (
            org_id, module_api_name, record_id, content, content_type,
            is_pinned, is_private, mentioned_users, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, created_at
        "#,
        auth.org_id,
        body.module_api_name,
        body.record_id,
        body.content,
        body.content_type.unwrap_or_else(|| "plain".to_string()),
        body.is_pinned.unwrap_or(false),
        body.is_private.unwrap_or(false),
        body.mentioned_users.as_deref().unwrap_or(&[]),
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": note.id,
                "created_at": note.created_at
            }
        }))
    ))
}

// ─── PATCH /api/v1/notes/:id ──────────────────────────────────────────────────

pub async fn update_note(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateNoteRequest>,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query!(
        "SELECT created_by FROM notes WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Note"))?;

    // Typically, only the creator or an admin can edit a note
    if existing.created_by != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    let note = sqlx::query!(
        r#"
        UPDATE notes
        SET 
            content = COALESCE($3, content),
            content_type = COALESCE($4, content_type),
            is_pinned = COALESCE($5, is_pinned),
            is_private = COALESCE($6, is_private),
            mentioned_users = COALESCE($7, mentioned_users),
            updated_at = NOW(),
            updated_by = $8
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, updated_at
        "#,
        id,
        auth.org_id,
        body.content,
        body.content_type,
        body.is_pinned,
        body.is_private,
        body.mentioned_users.as_deref(),
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": note.id,
            "updated_at": note.updated_at
        }
    })))
}

// ─── DELETE /api/v1/notes/:id ─────────────────────────────────────────────────

pub async fn delete_note(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query!(
        "SELECT created_by FROM notes WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Note"))?;

    if existing.created_by != Some(auth.user_id) {
        return Err(AppError::Forbidden);
    }

    sqlx::query!(
        "UPDATE notes SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        id, auth.org_id
    ).execute(&state.db).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Note deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, patch};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_notes).post(create_note))
        .route("/:id", patch(update_note).delete(delete_note))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
