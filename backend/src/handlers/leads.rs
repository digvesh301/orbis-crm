// ─────────────────────────────────────────────────────────────────────────────
// Leads Handler — Core CRM functionality for Day 5
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
pub struct ListLeadsQuery {
    pub page:       Option<u32>,
    pub limit:      Option<u32>,
    pub search:     Option<String>,
    pub owner_id:   Option<Uuid>,
    pub status:     Option<String>,
    pub source:     Option<String>,
    pub is_converted: Option<bool>,
    pub sort:       Option<String>,
    pub order:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLeadRequest {
    pub first_name:      String,
    pub last_name:       Option<String>,
    pub email:           Option<String>,
    pub phone:           Option<String>,
    pub company:         Option<String>,
    pub title:           Option<String>,
    pub website:         Option<String>,
    pub description:     Option<String>,
    pub status:          Option<String>,       // defaults to 'new' if omitted
    pub lead_source:     Option<String>,
    pub rating:          Option<String>,
    pub tags:            Option<Vec<String>>,
    pub estimated_value: Option<BigDecimal>,
    pub currency:        Option<String>,
    pub address:         Option<Value>,
    pub owner_id:        Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateLeadRequest {
    pub first_name:      Option<String>,
    pub last_name:       Option<String>,
    pub email:           Option<String>,
    pub phone:           Option<String>,
    pub company:         Option<String>,
    pub title:           Option<String>,
    pub website:         Option<String>,
    pub description:     Option<String>,
    pub status:          Option<String>,
    pub lead_source:     Option<String>,
    pub rating:          Option<String>,
    pub tags:            Option<Vec<String>>,
    pub estimated_value: Option<BigDecimal>,
    pub currency:        Option<String>,
    pub address:         Option<Value>,
    pub owner_id:        Option<Uuid>,
}

// ─── GET /api/v1/leads ────────────────────────────────────────────────────────

pub async fn list_leads(
    State(state): State<AppState>,
    Query(q): Query<ListLeadsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let page = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(25).min(100);
    let offset = (page - 1) * limit;

    let sort_col = match q.sort.as_deref().unwrap_or("created_at") {
        "first_name" => "first_name",
        "company"    => "company",
        "status"     => "status",
        "created_at" => "created_at",
        "updated_at" => "updated_at",
        _            => "created_at",
    };

    let sort_dir = if q.order.as_deref() == Some("asc") { "ASC" } else { "DESC" };

    let mut conditions = vec!["l.org_id = $1".to_string(), "l.deleted_at IS NULL".to_string()];
    let mut params_uuid: Vec<Uuid> = vec![auth.org_id];
    let mut params_str:  Vec<String> = vec![];

    let search = q.search.as_deref().unwrap_or("").trim();
    if !search.is_empty() {
        params_str.push(format!("%{}%", search));
        conditions.push(format!(
            "(l.first_name ILIKE ${p} OR l.last_name ILIKE ${p} OR l.email ILIKE ${p} OR l.company ILIKE ${p})",
            p = params_str.len() + 1 // Offset conceptually, actual binding is complicated
        ));
    }

    // Since sqlx macros require static query strings or precise types for dynamic queries,
    // we use query_builder for complex dynamic queries. For simplicity and parity with Contacts/Accounts,
    // we use a slight trick: if search is empty, query all; else query with ILIKE.
    
    // Instead of using fully dynamic, we'll use conditional fetching using simple WHERE clauses
    // built using string formatting + sqlx::query! or sqlx query builder. Let's use string building
    // + sqlx::query (non-macro) or just rely on coalesce filtering for simplicity.
    
    // For robust safety, we'll use `sqlx::query` without the macro like in accounts for search if needed.

    let order_clause = format!("ORDER BY l.{} {}", sort_col, sort_dir);
    
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.company, l.title,
               l.status::text as "status", l.lead_source::text as "lead_source", l.rating,
               l.tags, l.estimated_value, l.currency, l.is_converted, l.created_at, l.updated_at,
               l.owner_id,
               u.first_name AS owner_first_name, u.last_name AS owner_last_name, u.avatar_url AS owner_avatar
        FROM leads l
        LEFT JOIN users u ON u.id = l.owner_id
        WHERE l.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND l.deleted_at IS NULL ");

    if !search.is_empty() {
        let sc = format!("%{}%", search);
        q_builder.push(" AND (l.first_name ILIKE ");
        q_builder.push_bind(sc.clone());
        q_builder.push(" OR l.last_name ILIKE ");
        q_builder.push_bind(sc.clone());
        q_builder.push(" OR l.email ILIKE ");
        q_builder.push_bind(sc.clone());
        q_builder.push(" OR l.company ILIKE ");
        q_builder.push_bind(sc.clone());
        q_builder.push(") ");
    }

    if let Some(owner) = q.owner_id {
        q_builder.push(" AND l.owner_id = ");
        q_builder.push_bind(owner);
    }

    if let Some(status) = &q.status {
        q_builder.push(" AND l.status::text = ");
        q_builder.push_bind(status.clone());
    }
    
    if let Some(is_converted) = q.is_converted {
        q_builder.push(" AND l.is_converted = ");
        q_builder.push_bind(is_converted);
    }

    q_builder.push(format!(" {}", order_clause));
    q_builder.push(" LIMIT ");
    q_builder.push_bind(limit as i64);
    q_builder.push(" OFFSET ");
    q_builder.push_bind(offset as i64);

    let rows: Vec<sqlx::postgres::PgRow> = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    
    let leads: Vec<Value> = rows.into_iter().map(|row| {
        let ofn: Option<String> = row.get("owner_first_name");
        let oln: Option<String> = row.get("owner_last_name");
        
        json!({
            "id":              row.get::<Uuid, _>("id"),
            "first_name":      row.get::<String, _>("first_name"),
            "last_name":       row.get::<Option<String>, _>("last_name"),
            "email":           row.get::<Option<String>, _>("email"),
            "phone":           row.get::<Option<String>, _>("phone"),
            "company":         row.get::<Option<String>, _>("company"),
            "title":           row.get::<Option<String>, _>("title"),
            "status":          row.get::<Option<String>, _>("status"),
            "lead_source":     row.get::<Option<String>, _>("lead_source"),
            "rating":          row.get::<Option<String>, _>("rating"),
            "tags":            row.get::<Vec<String>, _>("tags"),
            "estimated_value": row.get::<Option<BigDecimal>, _>("estimated_value"),
            "currency":        row.get::<Option<String>, _>("currency"),
            "is_converted":    row.get::<bool, _>("is_converted"),
            "created_at":      row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "updated_at":      row.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
            "owner": {
                "id":         row.get::<Option<Uuid>, _>("owner_id"),
                "name":       fmt_name(ofn.as_deref(), oln.as_deref()),
                "avatar_url": row.get::<Option<String>, _>("owner_avatar"),
            }
        })
    }).collect();

    // In a real app we'd also run a COUNT query. For now, we return empty structure for totals.
    Ok(Json(json!({
        "success": true,
        "data": leads,
        "pagination": {
            "page": page,
            "limit": limit
        }
    })))
}

// ─── POST /api/v1/leads ───────────────────────────────────────────────────────

pub async fn create_lead(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateLeadRequest>,
) -> AppResult<impl IntoResponse> {
    if body.first_name.trim().is_empty() {
        return Err(AppError::Validation("First name is required".into()));
    }

    let owner_id = body.owner_id.unwrap_or(auth.user_id);

    let status = body.status.as_deref().unwrap_or("new");

    // Dynamic casting for enums can be tricky in the macro, we can cast text to the enum type setup in DB
    // values ($1, $2) -> CAST($1 as lead_status)
    let lead = sqlx::query!(
        r#"
        INSERT INTO leads (
            org_id, first_name, last_name, email, phone, company, title, website, description,
            status, lead_source, rating, tags, estimated_value, currency, address, owner_id, created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9,
            CAST($10::text as lead_status), CAST($11::text as lead_source), $12, $13, $14, $15, $16, $17, $18
        )
        RETURNING id, first_name, last_name, company, created_at
        "#,
        auth.org_id,
        body.first_name.trim(),
        body.last_name.as_deref().map(str::trim),
        body.email.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()),
        body.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.company.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.title.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.website.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        status, // fallback to new
        body.lead_source.as_deref(), // nullable lead_source
        body.rating.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.tags.as_deref().unwrap_or(&[]),
        body.estimated_value,
        body.currency.as_deref().map(str::trim).unwrap_or("USD"),
        body.address.unwrap_or_else(|| json!({})),
        owner_id,
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    // Audit Log
    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'created', 'lead', $3, $4)",
        auth.org_id,
        auth.user_id,
        lead.id,
        format!("{} {}", lead.first_name, lead.last_name.as_deref().unwrap_or(""))
    )
    .execute(&state.db)
    .await;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": lead.id,
                "first_name": lead.first_name,
                "last_name": lead.last_name,
                "company": lead.company,
                "created_at": lead.created_at
            }
        }))
    ))
}

// ─── GET /api/v1/leads/:id ────────────────────────────────────────────────────

pub async fn get_lead(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let lead = sqlx::query!(
        r#"
        SELECT l.id, l.first_name, l.last_name, l.email, l.phone, l.company, l.title, l.website, l.description,
               l.status::text as "status!", l.lead_source::text as "lead_source?", l.rating,
               l.tags, l.estimated_value, l.currency, l.is_converted, l.converted_at, 
               l.converted_contact_id, l.converted_account_id, l.address,
               l.created_at, l.updated_at,
               l.owner_id,
               u.first_name as "owner_first_name?", u.last_name as "owner_last_name?", u.avatar_url as "owner_avatar?"
        FROM leads l
        LEFT JOIN users u ON u.id = l.owner_id
        WHERE l.id = $1 AND l.org_id = $2 AND l.deleted_at IS NULL
        "#,
        id,
        auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Lead"))?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id":              lead.id,
            "first_name":      lead.first_name,
            "last_name":       lead.last_name,
            "email":           lead.email,
            "phone":           lead.phone,
            "company":         lead.company,
            "title":           lead.title,
            "website":         lead.website,
            "description":     lead.description,
            "status":          lead.status,
            "lead_source":     lead.lead_source,
            "rating":          lead.rating,
            "tags":            lead.tags,
            "estimated_value": lead.estimated_value,
            "currency":        lead.currency,
            "is_converted":    lead.is_converted,
            "converted_at":    lead.converted_at,
            "converted_contact_id": lead.converted_contact_id,
            "converted_account_id": lead.converted_account_id,
            "address":         lead.address,
            "created_at":      lead.created_at,
            "updated_at":      lead.updated_at,
            "owner": {
                "id":         lead.owner_id,
                "name":       fmt_name(lead.owner_first_name.as_deref(), lead.owner_last_name.as_deref()),
                "avatar_url": lead.owner_avatar,
            }
        }
    })))
}

// ─── PATCH /api/v1/leads/:id ──────────────────────────────────────────────────

pub async fn update_lead(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateLeadRequest>,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT first_name FROM leads WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id,
        auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Lead"))?;

    let lead = sqlx::query!(
        r#"
        UPDATE leads
        SET 
            first_name = COALESCE($3, first_name),
            last_name = COALESCE($4, last_name),
            email = COALESCE($5, email),
            phone = COALESCE($6, phone),
            company = COALESCE($7, company),
            title = COALESCE($8, title),
            website = COALESCE($9, website),
            description = COALESCE($10, description),
            status = COALESCE(CAST($11::text as lead_status), status),
            lead_source = COALESCE(CAST($12::text as lead_source), lead_source),
            rating = COALESCE($13, rating),
            tags = COALESCE($14, tags),
            estimated_value = COALESCE($15, estimated_value),
            currency = COALESCE($16, currency),
            address = COALESCE($17, address),
            owner_id = COALESCE($18, owner_id),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, updated_at
        "#,
        id,
        auth.org_id,
        body.first_name.as_deref().map(str::trim),
        body.last_name.as_deref().map(str::trim),
        body.email.as_ref().map(|s| s.trim().to_lowercase()),
        body.phone.as_deref().map(str::trim),
        body.company.as_deref().map(str::trim),
        body.title.as_deref().map(str::trim),
        body.website.as_deref().map(str::trim),
        body.description.as_deref().map(str::trim),
        body.status.as_deref(),
        body.lead_source.as_deref(),
        body.rating.as_deref().map(str::trim),
        body.tags.as_deref(),
        body.estimated_value,
        body.currency.as_deref().map(str::trim),
        body.address,
        body.owner_id
    )
    .fetch_one(&state.db)
    .await?;

    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name) VALUES ($1, $2, 'updated', 'lead', $3, $4)",
        auth.org_id, auth.user_id, id, existing
    ).execute(&state.db).await;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": lead.id,
            "updated_at": lead.updated_at
        }
    })))
}

// ─── DELETE /api/v1/leads/:id ─────────────────────────────────────────────────

pub async fn delete_lead(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT first_name FROM leads WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    ).fetch_optional(&state.db).await?.ok_or(AppError::NotFound("Lead"))?;

    sqlx::query!(
        "UPDATE leads SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        id, auth.org_id
    ).execute(&state.db).await?;

    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name) VALUES ($1, $2, 'deleted', 'lead', $3, $4)",
        auth.org_id, auth.user_id, id, existing
    ).execute(&state.db).await;

    Ok(Json(json!({
        "success": true,
        "message": "Lead deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::get;
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_leads).post(create_lead))
        .route("/:id", get(get_lead).patch(update_lead).delete(delete_lead))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
