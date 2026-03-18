// ─────────────────────────────────────────────────────────────────────────────
// Accounts Handler — Full CRUD
// Accounts represent companies/organizations that Contacts belong to.
//
// Schema columns (from migration 0005_contacts_accounts.sql):
// id, org_id, name, website, phone, email, description, industry (text),
// account_type (text), annual_revenue (numeric), employee_count,
// rating, billing_address (jsonb), shipping_address (jsonb),
// parent_account_id (uuid), owner_id, is_active (bool),
// created_by, created_at, updated_at, deleted_at
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;
use bigdecimal::BigDecimal;

use crate::{
    errors::{AppError, AppResult},
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── Request Types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListAccountsQuery {
    pub page:     Option<u32>,
    pub limit:    Option<u32>,
    pub search:   Option<String>,
    pub owner_id: Option<Uuid>,
    pub industry: Option<String>,
    pub sort:     Option<String>,
    pub order:    Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub name:            String,
    pub website:         Option<String>,
    pub phone:           Option<String>,
    pub email:           Option<String>,
    pub industry:        Option<String>,
    pub account_type:    Option<String>,
    pub description:     Option<String>,
    pub employee_count:  Option<i32>,
    pub annual_revenue:  Option<BigDecimal>,
    pub rating:          Option<String>,
    pub owner_id:        Option<Uuid>,
    pub parent_account_id: Option<Uuid>,
    pub billing_address:   Option<Value>,
    pub shipping_address:  Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub name:            Option<String>,
    pub website:         Option<String>,
    pub phone:           Option<String>,
    pub email:           Option<String>,
    pub industry:        Option<String>,
    pub account_type:    Option<String>,
    pub description:     Option<String>,
    pub employee_count:  Option<i32>,
    pub annual_revenue:  Option<BigDecimal>,
    pub rating:          Option<String>,
    pub owner_id:        Option<Uuid>,
    pub parent_account_id: Option<Uuid>,
    pub billing_address:   Option<Value>,
    pub shipping_address:  Option<Value>,
    pub is_active:         Option<bool>,
}

// ─── GET /api/v1/accounts ────────────────────────────────────────────────────
// O(log n) — idx_accounts_active on org_id WHERE deleted_at IS NULL

pub async fn list_accounts(
    State(state): State<AppState>,
    Query(q): Query<ListAccountsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let page   = q.page.unwrap_or(1).max(1);
    let limit  = q.limit.unwrap_or(25).min(100);
    let offset = (page - 1) * limit;

    let search = q.search.as_deref().unwrap_or("");

    // Build account list — collect to Vec<Value> in each branch to unify types
    let data: Vec<Value> = if search.is_empty() {
        sqlx::query!(
            r#"
            SELECT
                a.id, a.name, a.website, a.phone, a.email,
                a.industry, a.account_type, a.employee_count,
                a.annual_revenue, a.rating, a.is_active,
                a.owner_id, a.created_at, a.updated_at,
                COALESCE(u.first_name, '') as "owner_first_name!",
                COALESCE(u.last_name,  '') as "owner_last_name!",
                (SELECT COUNT(*) FROM contacts c
                 WHERE c.account_id = a.id AND c.deleted_at IS NULL) as contact_count,
                (SELECT COUNT(*) FROM opportunities o
                 WHERE o.account_id = a.id AND o.deleted_at IS NULL) as deal_count
            FROM accounts a
            LEFT JOIN users u ON u.id = a.owner_id AND u.deleted_at IS NULL
            WHERE a.org_id = $1 AND a.deleted_at IS NULL
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            auth.org_id, limit as i64, offset as i64,
        )
        .fetch_all(&state.db)
        .await?
        .into_iter()
        .map(|a| json!({
            "id": a.id, "name": a.name, "website": a.website,
            "phone": a.phone, "email": a.email,
            "industry": a.industry, "account_type": a.account_type,
            "employee_count": a.employee_count, "annual_revenue": a.annual_revenue,
            "rating": a.rating, "is_active": a.is_active,
            "owner_id": a.owner_id,
            "owner_name": fmt_name(Some(&a.owner_first_name), Some(&a.owner_last_name)),
            "contact_count": a.contact_count, "deal_count": a.deal_count,
            "created_at": a.created_at, "updated_at": a.updated_at,
        }))
        .collect()
    } else {
        sqlx::query!(
            r#"
            SELECT
                a.id, a.name, a.website, a.phone, a.email,
                a.industry, a.account_type, a.employee_count,
                a.annual_revenue, a.rating, a.is_active,
                a.owner_id, a.created_at, a.updated_at,
                COALESCE(u.first_name, '') as "owner_first_name!",
                COALESCE(u.last_name,  '') as "owner_last_name!",
                (SELECT COUNT(*) FROM contacts c
                 WHERE c.account_id = a.id AND c.deleted_at IS NULL) as contact_count,
                (SELECT COUNT(*) FROM opportunities o
                 WHERE o.account_id = a.id AND o.deleted_at IS NULL) as deal_count
            FROM accounts a
            LEFT JOIN users u ON u.id = a.owner_id AND u.deleted_at IS NULL
            WHERE a.org_id = $1 AND a.deleted_at IS NULL
              AND to_tsvector('english', coalesce(a.name,'') || ' ' || coalesce(a.email,''))
                  @@ plainto_tsquery('english', $4)
            ORDER BY a.created_at DESC
            LIMIT $2 OFFSET $3
            "#,
            auth.org_id, limit as i64, offset as i64, search,
        )
        .fetch_all(&state.db)
        .await?
        .into_iter()
        .map(|a| json!({
            "id": a.id, "name": a.name, "website": a.website,
            "phone": a.phone, "email": a.email,
            "industry": a.industry, "account_type": a.account_type,
            "employee_count": a.employee_count, "annual_revenue": a.annual_revenue,
            "rating": a.rating, "is_active": a.is_active,
            "owner_id": a.owner_id,
            "owner_name": fmt_name(Some(&a.owner_first_name), Some(&a.owner_last_name)),
            "contact_count": a.contact_count, "deal_count": a.deal_count,
            "created_at": a.created_at, "updated_at": a.updated_at,
        }))
        .collect()
    };

    let total = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM accounts WHERE org_id = $1 AND deleted_at IS NULL",
        auth.org_id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    let total_pages = (total as u32).div_ceil(limit);

    Ok(Json(json!({
        "success": true,
        "data":    data,
        "meta": {
            "total": total, "page": page, "limit": limit,
            "total_pages": total_pages,
            "has_next": page < total_pages, "has_prev": page > 1,
        }
    })))
}

// ─── POST /api/v1/accounts ───────────────────────────────────────────────────

pub async fn create_account(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateAccountRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Account name is required".into()));
    }

    let owner_id = body.owner_id.unwrap_or(auth.user_id);

    let account = sqlx::query!(
        r#"
        INSERT INTO accounts (
            org_id, name, website, phone, email, industry,
            account_type, description, employee_count, annual_revenue,
            rating, owner_id, parent_account_id,
            billing_address, shipping_address, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING id, name, is_active, created_at
        "#,
        auth.org_id,
        body.name.trim(),
        body.website.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.email.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()),
        body.industry.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.account_type.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.employee_count,
        body.annual_revenue,
        body.rating.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        owner_id,
        body.parent_account_id,
        body.billing_address.unwrap_or_else(|| json!({})),
        body.shipping_address.unwrap_or_else(|| json!({})),
        auth.user_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Audit log (non-blocking)
    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'created', 'account', $3, $4)",
        auth.org_id, auth.user_id, account.id, account.name
    )
    .execute(&state.db)
    .await;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id":         account.id,
                "name":       account.name,
                "is_active":  account.is_active,
                "created_at": account.created_at,
            }
        })),
    ))
}

// ─── GET /api/v1/accounts/:id ────────────────────────────────────────────────

pub async fn get_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let account = sqlx::query!(
        r#"
        SELECT
            a.id, a.name, a.website, a.phone, a.email,
            a.industry, a.account_type, a.description,
            a.employee_count, a.annual_revenue, a.rating,
            a.is_active, a.owner_id,
            a.parent_account_id,
            a.billing_address, a.shipping_address,
            a.created_at, a.updated_at,
            u.first_name as "owner_first_name?",
            u.last_name  as "owner_last_name?",
            u.avatar_url as "owner_avatar?",
            p.name as "parent_name?"
        FROM accounts a
        LEFT JOIN users    u ON u.id = a.owner_id         AND u.deleted_at IS NULL
        LEFT JOIN accounts p ON p.id = a.parent_account_id AND p.deleted_at IS NULL
        WHERE a.id = $1 AND a.org_id = $2 AND a.deleted_at IS NULL
        "#,
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Account"))?;

    // Contacts in this account — O(log n) idx_contacts_account_id
    let contacts = sqlx::query!(
        r#"
        SELECT id, first_name, last_name, email, title, status::text as "status!"
        FROM contacts
        WHERE account_id = $1 AND org_id = $2 AND deleted_at IS NULL
        ORDER BY first_name LIMIT 20
        "#,
        id, auth.org_id
    )
    .fetch_all(&state.db)
    .await?;

    let contact_total = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM contacts WHERE account_id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    ).fetch_one(&state.db).await?.unwrap_or(0);

    // Open deals for this account
    let deals = sqlx::query!(
        r#"
        SELECT o.id, o.name, o.amount, ps.name as stage_name
        FROM opportunities o
        JOIN pipeline_stages ps ON ps.id = o.stage_id
        WHERE o.account_id = $1 AND o.org_id = $2 AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC LIMIT 5
        "#,
        id, auth.org_id
    )
    .fetch_all(&state.db)
    .await?;

    // Deal revenue summary
    let revenue = sqlx::query!(
        r#"
        SELECT
            COALESCE(SUM(o.amount), 0) as pipeline_value,
            COUNT(*) as total_deals
        FROM opportunities o
        WHERE o.account_id = $1 AND o.org_id = $2 AND o.deleted_at IS NULL
        "#,
        id, auth.org_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id":              account.id,
            "name":            account.name,
            "website":         account.website,
            "phone":           account.phone,
            "email":           account.email,
            "industry":        account.industry,
            "account_type":    account.account_type,
            "description":     account.description,
            "employee_count":  account.employee_count,
            "annual_revenue":  account.annual_revenue,
            "rating":          account.rating,
            "is_active":       account.is_active,
            "billing_address": account.billing_address,
            "shipping_address": account.shipping_address,
            "created_at":      account.created_at,
            "updated_at":      account.updated_at,
            "owner": {
                "id":         account.owner_id,
                "name":       fmt_name(account.owner_first_name.as_deref(), account.owner_last_name.as_deref()),
                "avatar_url": account.owner_avatar,
            },
            "parent": account.parent_account_id.map(|_| json!({
                "id":   account.parent_account_id,
                "name": account.parent_name,
            })),
            "summary": {
                "contacts":       contact_total,
                "total_deals":    revenue.total_deals,
                "pipeline_value": revenue.pipeline_value,
            },
            "contacts": contacts.iter().map(|c| json!({
                "id":         c.id,
                "first_name": c.first_name,
                "last_name":  c.last_name,
                "email":      c.email,
                "title":      c.title,
                "status":     c.status,
            })).collect::<Vec<_>>(),
            "deals": deals.iter().map(|d| json!({
                "id":     d.id,
                "name":   d.name,
                "amount": d.amount,
                "stage":  d.stage_name,
            })).collect::<Vec<_>>(),
        }
    })))
}

// ─── PATCH /api/v1/accounts/:id ─────────────────────────────────────────────

pub async fn update_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateAccountRequest>,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT name FROM accounts WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Account"))?;

    let updated = sqlx::query!(
        r#"
        UPDATE accounts SET
            name              = COALESCE($3,  name),
            website           = COALESCE($4,  website),
            phone             = COALESCE($5,  phone),
            email             = COALESCE($6,  email),
            industry          = COALESCE($7,  industry),
            account_type      = COALESCE($8,  account_type),
            description       = COALESCE($9,  description),
            employee_count    = COALESCE($10, employee_count),
            annual_revenue    = COALESCE($11, annual_revenue),
            rating            = COALESCE($12, rating),
            owner_id          = COALESCE($13, owner_id),
            parent_account_id = COALESCE($14, parent_account_id),
            is_active         = COALESCE($15, is_active),
            updated_at        = NOW()
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, name, updated_at
        "#,
        id, auth.org_id,
        body.name.as_deref().map(str::trim),
        body.website.as_deref().map(str::trim),
        body.phone.as_deref().map(str::trim),
        body.email.as_ref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()),
        body.industry.as_deref().map(str::trim),
        body.account_type.as_deref().map(str::trim),
        body.description.as_deref().map(str::trim),
        body.employee_count,
        body.annual_revenue,
        body.rating.as_deref().map(str::trim),
        body.owner_id,
        body.parent_account_id,
        body.is_active,
    )
    .fetch_one(&state.db)
    .await?;

    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'updated', 'account', $3, $4)",
        auth.org_id, auth.user_id, id, existing
    )
    .execute(&state.db)
    .await;

    Ok(Json(json!({
        "success": true,
        "message": "Account updated",
        "data": { "id": updated.id, "name": updated.name, "updated_at": updated.updated_at }
    })))
}

// ─── DELETE /api/v1/accounts/:id ────────────────────────────────────────────

pub async fn delete_account(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let name = sqlx::query_scalar!(
        "SELECT name FROM accounts WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Account"))?;

    sqlx::query!(
        "UPDATE accounts SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        id, auth.org_id
    )
    .execute(&state.db)
    .await?;

    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'deleted', 'account', $3, $4)",
        auth.org_id, auth.user_id, id, name
    )
    .execute(&state.db)
    .await;

    Ok(Json(json!({ "success": true, "message": "Account deleted" })))
}

fn fmt_name(first: Option<&str>, last: Option<&str>) -> Option<String> {
    match (first, last) {
        (Some(f), Some(l)) if !f.is_empty() => Some(format!("{} {}", f, l.trim())),
        (Some(f), _)       if !f.is_empty() => Some(f.to_string()),
        _                                   => None,
    }
}

fn format_name(first: &Option<String>, last: &Option<String>) -> Option<String> {
    fmt_name(first.as_deref(), last.as_deref())
}

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::get;
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_accounts).post(create_account))
        .route("/:id", get(get_account).patch(update_account).delete(delete_account))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
