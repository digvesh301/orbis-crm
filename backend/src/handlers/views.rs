use axum::{
    extract::{State, Path},
    routing::{get, put, delete, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};
use serde_json::Value as JsonValue;

use crate::{
    errors::{AppError, AppResult},
    state::AppState,
    middleware::auth::{AuthUser, auth_middleware},
};

pub fn router(state: AppState) -> Router<AppState> {
    use axum::middleware::from_fn_with_state;
    
    Router::new()
        .route("/", get(list_custom_views).post(create_custom_view))
        .route("/:id", put(update_custom_view).delete(delete_custom_view))
        .route_layer(from_fn_with_state(state.clone(), auth_middleware))
        .with_state(state)
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CustomView {
    pub id: Uuid,
    pub user_id: Uuid,
    pub module: String,
    pub name: String,
    pub is_default: Option<bool>,
    pub configuration: Option<JsonValue>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize, Debug)]
pub struct CreateCustomViewDto {
    pub module: String,
    pub name: String,
    pub is_default: Option<bool>,
    pub configuration: JsonValue,
}

#[derive(Deserialize, Debug)]
pub struct UpdateCustomViewDto {
    pub name: Option<String>,
    pub is_default: Option<bool>,
    pub configuration: Option<JsonValue>,
}

#[derive(Deserialize, Debug)]
pub struct FetchViewsQuery {
    pub module: Option<String>,
}

pub async fn list_custom_views(
    State(state): State<AppState>,
    user: AuthUser,
    axum::extract::Query(query): axum::extract::Query<FetchViewsQuery>,
) -> AppResult<Json<Vec<CustomView>>> {
    let views = if let Some(module) = query.module {
        sqlx::query_as!(
            CustomView,
            r#"SELECT id, user_id, module, name, is_default, configuration, created_at, updated_at
               FROM custom_views
               WHERE user_id = $1 AND module = $2
               ORDER BY created_at ASC"#,
            user.user_id,
            module
        )
        .fetch_all(&state.db)
        .await?
    } else {
        sqlx::query_as!(
            CustomView,
            r#"SELECT id, user_id, module, name, is_default, configuration, created_at, updated_at
               FROM custom_views
               WHERE user_id = $1
               ORDER BY created_at ASC"#,
            user.user_id
        )
        .fetch_all(&state.db)
        .await?
    };

    Ok(Json(views))
}

pub async fn create_custom_view(
    State(state): State<AppState>,
    user: AuthUser,
    Json(payload): Json<CreateCustomViewDto>,
) -> AppResult<Json<CustomView>> {
    let is_default = payload.is_default.unwrap_or(false);

    let view = sqlx::query_as!(
        CustomView,
        r#"INSERT INTO custom_views (user_id, module, name, is_default, configuration)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, user_id, module, name, is_default, configuration, created_at, updated_at"#,
        user.user_id,
        payload.module,
        payload.name,
        is_default,
        payload.configuration
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(view))
}

pub async fn update_custom_view(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateCustomViewDto>,
) -> AppResult<Json<CustomView>> {
    // Fetch the current view first to avoid nulling fields not provided
    let current = sqlx::query_as!(
        CustomView,
        r#"SELECT id, user_id, module, name, is_default, configuration, created_at, updated_at
           FROM custom_views WHERE id = $1 AND user_id = $2"#,
        id,
        user.user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Custom view not found"))?;

    let new_name = payload.name.unwrap_or(current.name);
    let new_is_default = payload.is_default.unwrap_or(current.is_default.unwrap_or(false));
    let new_config = payload.configuration
        .or(current.configuration)
        .unwrap_or(serde_json::json!({}));

    let view = sqlx::query_as!(
        CustomView,
        r#"UPDATE custom_views
           SET name = $1, is_default = $2, configuration = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4 AND user_id = $5
           RETURNING id, user_id, module, name, is_default, configuration, created_at, updated_at"#,
        new_name,
        new_is_default,
        new_config,
        id,
        user.user_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Custom view not found"))?;

    Ok(Json(view))
}

pub async fn delete_custom_view(
    State(state): State<AppState>,
    user: AuthUser,
    Path(id): Path<Uuid>,
) -> AppResult<Json<serde_json::Value>> {
    let result = sqlx::query!(
        r#"DELETE FROM custom_views WHERE id = $1 AND user_id = $2"#,
        id,
        user.user_id
    )
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound("Custom view not found"));
    }

    Ok(Json(serde_json::json!({ "message": "View deleted successfully" })))
}
