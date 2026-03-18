// ─────────────────────────────────────────────────────────────────────────────
// Deals / Opportunities Handler for Day 5
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use bigdecimal::BigDecimal;
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

// ─── Request / Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListDealsQuery {
    pub page:       Option<u32>,
    pub limit:      Option<u32>,
    pub search:     Option<String>,
    pub owner_id:   Option<Uuid>,
    pub stage_id:   Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub contact_id: Option<Uuid>,
    pub sort:       Option<String>,
    pub order:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDealRequest {
    pub name:              String,
    pub description:       Option<String>,
    pub contact_id:        Option<Uuid>,
    pub account_id:        Option<Uuid>,
    pub stage_id:          Uuid,               // Stage is mandatory
    pub amount:            Option<BigDecimal>,
    pub currency:          Option<String>,
    pub probability:       Option<i32>,
    pub close_date:        Option<chrono::NaiveDate>,
    pub lead_source:       Option<String>,
    pub tags:              Option<Vec<String>>,
    pub owner_id:          Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDealRequest {
    pub name:              Option<String>,
    pub description:       Option<String>,
    pub contact_id:        Option<Uuid>,
    pub account_id:        Option<Uuid>,
    pub stage_id:          Option<Uuid>,       // Changing stage is handled properly
    pub amount:            Option<BigDecimal>,
    pub currency:          Option<String>,
    pub probability:       Option<i32>,
    pub close_date:        Option<chrono::NaiveDate>,
    pub actual_close_date: Option<chrono::NaiveDate>, // Only if closed won
    pub lead_source:       Option<String>,
    pub tags:              Option<Vec<String>>,
    pub owner_id:          Option<Uuid>,
    pub lost_reason:       Option<String>,
}

// ─── GET /api/v1/deals ────────────────────────────────────────────────────────

pub async fn list_deals(
    State(state): State<AppState>,
    Query(q): Query<ListDealsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(25).min(100);
    let offset = (page - 1) * limit;

    let search = q.search.as_deref().unwrap_or("").trim();
    
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT d.id, d.name, d.description, d.amount, d.currency, d.probability, d.expected_revenue,
               d.close_date, d.actual_close_date, d.lead_source::text as "lead_source", d.tags, d.stage_type::text as "stage_type",
               d.created_at, d.updated_at,
               d.stage_id,
               d.contact_id, c.first_name as contact_first, c.last_name as contact_last,
               d.account_id, a.name as account_name,
               d.owner_id, u.first_name as owner_first, u.last_name as owner_last, u.avatar_url as owner_avatar
        FROM opportunities d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        LEFT JOIN contacts c ON c.id = d.contact_id
        LEFT JOIN accounts a ON a.id = d.account_id
        LEFT JOIN users u ON u.id = d.owner_id
        WHERE d.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND d.deleted_at IS NULL ");

    if !search.is_empty() {
        let sc = format!("%{}%", search);
        q_builder.push(" AND (d.name ILIKE ");
        q_builder.push_bind(sc);
        q_builder.push(") ");
    }

    if let Some(owner) = q.owner_id {
        q_builder.push(" AND d.owner_id = ");
        q_builder.push_bind(owner);
    }
    
    if let Some(stage) = q.stage_id {
        q_builder.push(" AND d.stage_id = ");
        q_builder.push_bind(stage);
    }

    if let Some(acc) = q.account_id {
        q_builder.push(" AND d.account_id = ");
        q_builder.push_bind(acc);
    }
    
    if let Some(contact) = q.contact_id {
        q_builder.push(" AND d.contact_id = ");
        q_builder.push_bind(contact);
    }

    q_builder.push(" ORDER BY d.created_at DESC"); // Basic default sorting
    q_builder.push(" LIMIT ");
    q_builder.push_bind(limit as i64);
    q_builder.push(" OFFSET ");
    q_builder.push_bind(offset as i64);

    let rows = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    
    let deals: Vec<Value> = rows.into_iter().map(|row| {
        let c_first: Option<String> = row.get("contact_first");
        let c_last: Option<String> = row.get("contact_last");
        let o_first: Option<String> = row.get("owner_first");
        let o_last: Option<String> = row.get("owner_last");
        
        json!({
            "id":               row.get::<Uuid, _>("id"),
            "name":             row.get::<String, _>("name"),
            "description":      row.get::<Option<String>, _>("description"),
            "amount":           row.get::<Option<BigDecimal>, _>("amount"),
            "currency":         row.get::<Option<String>, _>("currency"),
            "probability":      row.get::<Option<i32>, _>("probability"),
            "expected_revenue": row.get::<Option<BigDecimal>, _>("expected_revenue"),
            "close_date":       row.get::<Option<chrono::NaiveDate>, _>("close_date"),
            "actual_close_date":row.get::<Option<chrono::NaiveDate>, _>("actual_close_date"),
            "lead_source":      row.get::<Option<String>, _>("lead_source"),
            "tags":             row.get::<Vec<String>, _>("tags"),
            "stage_type":       row.get::<Option<String>, _>("stage_type"),
            "created_at":       row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at":       row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "stage_id":         row.get::<Uuid, _>("stage_id"),
            "contact": row.get::<Option<Uuid>, _>("contact_id").map(|id| json!({
                "id": id,
                "name": fmt_name(c_first.as_deref(), c_last.as_deref())
            })),
            "account": row.get::<Option<Uuid>, _>("account_id").map(|id| json!({
                "id": id,
                "name": row.get::<Option<String>, _>("account_name")
            })),
            "owner": {
                "id":         row.get::<Option<Uuid>, _>("owner_id"),
                "name":       fmt_name(o_first.as_deref(), o_last.as_deref()),
                "avatar_url": row.get::<Option<String>, _>("owner_avatar"),
            }
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": deals,
        "pagination": { "page": page, "limit": limit }
    })))
}

// ─── POST /api/v1/deals ───────────────────────────────────────────────────────

pub async fn create_deal(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateDealRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Deal name is required".into()));
    }

    let owner_id = body.owner_id.unwrap_or(auth.user_id);
    
    let mut tx = state.db.begin().await?;

    // Check stage exists and grab its stage_type & default prob
    let stage = sqlx::query!(
        "SELECT probability, stage_type::text as stage_type FROM pipeline_stages WHERE id = $1 AND org_id = $2",
        body.stage_id, auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::Validation("Invalid pipeline stage".into()))?;

    let prob = body.probability.unwrap_or(stage.probability);

    let deal = sqlx::query!(
        r#"
        INSERT INTO opportunities (
            org_id, name, description, contact_id, account_id, stage_id,
            amount, currency, probability, close_date, lead_source, tags, owner_id, created_by,
            stage_type
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, CAST($11::text as lead_source), $12, $13, $14,
            CAST($15::text as opportunity_stage_type)
        )
        RETURNING id, name, created_at
        "#,
        auth.org_id,
        body.name.trim(),
        body.description.as_deref().map(str::trim),
        body.contact_id,
        body.account_id,
        body.stage_id,
        body.amount,
        body.currency.as_deref().unwrap_or("USD"),
        prob,
        body.close_date,
        body.lead_source.as_deref(),
        body.tags.as_deref().unwrap_or(&[]),
        owner_id,
        auth.user_id,
        stage.stage_type
    )
    .fetch_one(&mut *tx)
    .await?;

    // Log the stage history for its initial stage
    sqlx::query!(
        "INSERT INTO opportunity_stage_history (opportunity_id, org_id, to_stage_id, changed_by, note) VALUES ($1, $2, $3, $4, 'Deal created')",
        deal.id, auth.org_id, body.stage_id, auth.user_id
    )
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": deal.id,
                "name": deal.name,
                "created_at": deal.created_at
            }
        }))
    ))
}

// ─── GET /api/v1/deals/:id ────────────────────────────────────────────────────

pub async fn get_deal(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let deal = sqlx::query!(
        r#"
        SELECT d.id, d.name, d.description, d.amount, d.currency, d.probability, d.expected_revenue,
               d.close_date, d.actual_close_date, d.lead_source::text as "lead_source", d.tags, d.stage_type::text as "stage_type",
               d.lost_reason, d.created_at, d.updated_at,
               d.stage_id, ps.name as "stage_name?",
               d.contact_id, c.first_name as "contact_first?", c.last_name as "contact_last?", c.email as "contact_email?",
               d.account_id, a.name as "account_name?",
               d.owner_id, u.first_name as "owner_first?", u.last_name as "owner_last?", u.avatar_url as "owner_avatar?"
        FROM opportunities d
        LEFT JOIN pipeline_stages ps ON ps.id = d.stage_id
        LEFT JOIN contacts c ON c.id = d.contact_id
        LEFT JOIN accounts a ON a.id = d.account_id
        LEFT JOIN users u ON u.id = d.owner_id
        WHERE d.id = $1 AND d.org_id = $2 AND d.deleted_at IS NULL
        "#,
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Deal"))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id":               deal.id,
            "name":             deal.name,
            "description":      deal.description,
            "amount":           deal.amount,
            "currency":         deal.currency,
            "probability":      deal.probability,
            "expected_revenue": deal.expected_revenue,
            "close_date":       deal.close_date,
            "actual_close_date":deal.actual_close_date,
            "lead_source":      deal.lead_source,
            "lost_reason":      deal.lost_reason,
            "tags":             deal.tags,
            "stage_type":       deal.stage_type,
            "created_at":       deal.created_at,
            "updated_at":       deal.updated_at,
            "stage": {
                "id": deal.stage_id,
                "name": deal.stage_name
            },
            "contact": deal.contact_id.map(|id| json!({
                "id": id,
                "name": fmt_name(deal.contact_first.as_deref(), deal.contact_last.as_deref()),
                "email": deal.contact_email
            })),
            "account": deal.account_id.map(|id| json!({
                "id": id,
                "name": deal.account_name
            })),
            "owner": {
                "id":         deal.owner_id,
                "name":       fmt_name(deal.owner_first.as_deref(), deal.owner_last.as_deref()),
                "avatar_url": deal.owner_avatar,
            }
        }
    })))
}

// ─── PATCH /api/v1/deals/:id ──────────────────────────────────────────────────

pub async fn update_deal(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateDealRequest>,
) -> AppResult<impl IntoResponse> {
    let mut tx = state.db.begin().await?;

    let existing = sqlx::query!(
        "SELECT id, stage_id FROM opportunities WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&mut *tx)
    .await?
    .ok_or(AppError::NotFound("Deal"))?;

    let mut new_stage_type: Option<String> = None;

    // Check and validate if stage logic changes
    if let Some(new_stage_id) = body.stage_id {
        if new_stage_id != existing.stage_id {
            // Validate the new stage
            let stage = sqlx::query!(
                "SELECT probability, stage_type::text as stage_type FROM pipeline_stages WHERE id = $1 AND org_id = $2",
                new_stage_id, auth.org_id
            )
            .fetch_optional(&mut *tx)
            .await?
            .ok_or(AppError::Validation("Invalid pipeline stage".into()))?;

            new_stage_type = stage.stage_type;

            sqlx::query!(
                "INSERT INTO opportunity_stage_history (opportunity_id, org_id, from_stage_id, to_stage_id, changed_by) VALUES ($1, $2, $3, $4, $5)",
                id, auth.org_id, existing.stage_id, new_stage_id, auth.user_id
            )
            .execute(&mut *tx)
            .await?;
        }
    }

    let deal = sqlx::query!(
        r#"
        UPDATE opportunities
        SET 
            name = COALESCE($3, name),
            description = COALESCE($4, description),
            contact_id = COALESCE($5, contact_id),
            account_id = COALESCE($6, account_id),
            stage_id = COALESCE($7, stage_id),
            amount = COALESCE($8, amount),
            currency = COALESCE($9, currency),
            probability = COALESCE($10, probability),
            close_date = COALESCE($11, close_date),
            actual_close_date = COALESCE($12, actual_close_date),
            lead_source = COALESCE(CAST($13::text as lead_source), lead_source),
            tags = COALESCE($14, tags),
            owner_id = COALESCE($15, owner_id),
            lost_reason = COALESCE($16, lost_reason),
            stage_type = COALESCE(CAST($17::text as opportunity_stage_type), stage_type),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, updated_at
        "#,
        id,
        auth.org_id,
        body.name.as_deref().map(str::trim),
        body.description.as_deref().map(str::trim),
        body.contact_id,
        body.account_id,
        body.stage_id,
        body.amount,
        body.currency.as_deref().map(str::trim),
        body.probability,
        body.close_date,
        body.actual_close_date,
        body.lead_source.as_deref(),
        body.tags.as_deref(),
        body.owner_id,
        body.lost_reason.as_deref(),
        new_stage_type.as_deref()
    )
    .fetch_one(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": deal.id,
            "updated_at": deal.updated_at
        }
    })))
}

// ─── DELETE /api/v1/deals/:id ─────────────────────────────────────────────────

pub async fn delete_deal(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT name FROM opportunities WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    ).fetch_optional(&state.db).await?.ok_or(AppError::NotFound("Deal"))?;

    sqlx::query!(
        "UPDATE opportunities SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        id, auth.org_id
    ).execute(&state.db).await?;

    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name) VALUES ($1, $2, 'deleted', 'opportunity', $3, $4)",
        auth.org_id, auth.user_id, id, existing
    ).execute(&state.db).await;

    Ok(Json(json!({
        "success": true,
        "message": "Deal deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::get;
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_deals).post(create_deal))
        .route("/:id", get(get_deal).patch(update_deal).delete(delete_deal))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
