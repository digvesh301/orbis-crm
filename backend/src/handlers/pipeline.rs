// ─────────────────────────────────────────────────────────────────────────────
// Pipeline Handler — Pipeline Stages Management for Kanban Board (Day 5)
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, State},
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

// ─── Request / Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreatePipelineStageRequest {
    pub name:        String,
    pub stage_type:  Option<String>, // 'open', 'won', 'lost' (defaults to 'open')
    pub probability: Option<i32>,
    pub position:    Option<i32>,
    pub color:       Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePipelineStageRequest {
    pub name:        Option<String>,
    pub stage_type:  Option<String>,
    pub probability: Option<i32>,
    pub color:       Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReorderPipelineStagesRequest {
    pub stages: Vec<StagePosition>,
}

#[derive(Debug, Deserialize)]
pub struct StagePosition {
    pub id: Uuid,
    pub position: i32,
}

// ─── GET /api/v1/pipeline ─────────────────────────────────────────────────────

pub async fn list_pipeline_stages(
    State(state): State<AppState>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let rows = sqlx::query!(
        r#"
        SELECT id, name, stage_type::text as "stage_type", probability, position, color,
               is_default, is_system, created_at, updated_at
        FROM pipeline_stages
        WHERE org_id = $1
        ORDER BY position ASC
        "#,
        auth.org_id
    )
    .fetch_all(&state.db)
    .await?;

    let stages: Vec<Value> = rows.into_iter().map(|s| json!({
        "id": s.id,
        "name": s.name,
        "stage_type": s.stage_type,
        "probability": s.probability,
        "position": s.position,
        "color": s.color,
        "is_default": s.is_default,
        "is_system": s.is_system,
        "created_at": s.created_at,
        "updated_at": s.updated_at
    })).collect();

    Ok(Json(json!({
        "success": true,
        "data": stages
    })))
}

// ─── POST /api/v1/pipeline ────────────────────────────────────────────────────

pub async fn create_pipeline_stage(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreatePipelineStageRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Stage name is required".into()));
    }

    let existing = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM pipeline_stages WHERE org_id = $1 AND name = $2",
        auth.org_id,
        body.name.trim()
    )
    .fetch_one(&state.db)
    .await?;

    if existing.unwrap_or(0) > 0 {
        return Err(AppError::Validation("A stage with this name already exists".into()));
    }

    // Determine position if not provided
    let position = if let Some(p) = body.position {
        p
    } else {
        let max_pos = sqlx::query_scalar!(
            "SELECT COALESCE(MAX(position), 0) FROM pipeline_stages WHERE org_id = $1",
            auth.org_id
        )
        .fetch_one(&state.db)
        .await?
        .unwrap_or(0);
        max_pos + 1
    };

    let stage = sqlx::query!(
        r#"
        INSERT INTO pipeline_stages (org_id, name, stage_type, probability, position, color, is_default, is_system)
        VALUES ($1, $2, CAST($3::text as opportunity_stage_type), $4, $5, $6, false, false)
        RETURNING id, name, position, created_at
        "#,
        auth.org_id,
        body.name.trim(),
        body.stage_type.as_deref().unwrap_or("open"),
        body.probability.unwrap_or(0),
        position,
        body.color.as_deref()
    )
    .fetch_one(&state.db)
    .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": stage.id,
                "name": stage.name,
                "position": stage.position,
                "created_at": stage.created_at
            }
        }))
    ))
}

// ─── PATCH /api/v1/pipeline/reorder ───────────────────────────────────────────

pub async fn reorder_pipeline_stages(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<ReorderPipelineStagesRequest>,
) -> AppResult<impl IntoResponse> {
    let mut tx = state.db.begin().await?;

    for stage in body.stages {
        sqlx::query!(
            "UPDATE pipeline_stages SET position = $1, updated_at = NOW() WHERE id = $2 AND org_id = $3",
            stage.position,
            stage.id,
            auth.org_id
        )
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "message": "Pipeline stages reordered successfully"
    })))
}

// ─── PATCH /api/v1/pipeline/:id ───────────────────────────────────────────────

pub async fn update_pipeline_stage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdatePipelineStageRequest>,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query!(
        "SELECT id, is_system, name FROM pipeline_stages WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Pipeline Stage"))?;

    // Prevent fully renaming or changing types of system stages (e.g., 'Closed Won', 'Closed Lost')
    // We can allow changing colors and probability, but changing name on system could be tricky.
    // For now, we'll allow updating everything except it might break some predefined behaviors if name changes.

    if let Some(ref new_name) = body.name {
        let check_name = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM pipeline_stages WHERE org_id = $1 AND name = $2 AND id != $3",
            auth.org_id,
            new_name.trim(),
            id
        )
        .fetch_one(&state.db)
        .await?;

        if check_name.unwrap_or(0) > 0 {
            return Err(AppError::Validation("A stage with this name already exists".into()));
        }
    }

    let stage = sqlx::query!(
        r#"
        UPDATE pipeline_stages
        SET 
            name = COALESCE($3, name),
            stage_type = COALESCE(CAST($4::text as opportunity_stage_type), stage_type),
            probability = COALESCE($5, probability),
            color = COALESCE($6, color),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2
        RETURNING id, updated_at
        "#,
        id,
        auth.org_id,
        body.name.as_deref().map(str::trim),
        body.stage_type.as_deref(),
        body.probability,
        body.color.as_deref()
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": stage.id,
            "updated_at": stage.updated_at
        }
    })))
}

// ─── DELETE /api/v1/pipeline/:id ──────────────────────────────────────────────

pub async fn delete_pipeline_stage(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let stage = sqlx::query!(
        "SELECT id, is_system FROM pipeline_stages WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Pipeline Stage"))?;

    if stage.is_system {
        return Err(AppError::Validation("Cannot delete a system pipeline stage".into()));
    }

    // Check if there are any opportunities attached to this stage
    let count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM opportunities WHERE stage_id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id,
        auth.org_id
    )
    .fetch_one(&state.db)
    .await?;

    if count.unwrap_or(0) > 0 {
        return Err(AppError::Validation("Cannot delete stage: there are active deals in this stage. Move them first.".into()));
    }

    sqlx::query!(
        "DELETE FROM pipeline_stages WHERE id = $1 AND org_id = $2",
        id,
        auth.org_id
    )
    .execute(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "message": "Pipeline stage deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, patch};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/", get(list_pipeline_stages).post(create_pipeline_stage))
        .route("/reorder", patch(reorder_pipeline_stages))
        .route("/:id", patch(update_pipeline_stage).delete(delete_pipeline_stage))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
