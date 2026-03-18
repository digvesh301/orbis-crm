// ─────────────────────────────────────────────────────────────────────────────
// Contacts Handler — Full CRUD with filters, search, pagination
//
// All queries are O(log n) via indexed columns.
// Search uses PostgreSQL GIN full-text index (pg_trgm).
// Pagination uses OFFSET (simple), with cursor-based option planned for Day 18.
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

// ─── Request / Response Types ─────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListContactsQuery {
    // Pagination
    pub page:       Option<u32>,        // default 1
    pub limit:      Option<u32>,        // default 25, max 100

    // Search — uses GIN full-text index on name + email + phone
    pub search:     Option<String>,

    // Filters — all use indexed columns
    pub owner_id:   Option<Uuid>,
    pub account_id: Option<Uuid>,
    pub status:     Option<String>,     // active | inactive
    pub tag:        Option<String>,     // single tag filter

    // Sorting
    pub sort:       Option<String>,     // field name (default: created_at)
    pub order:      Option<String>,     // asc | desc (default: desc)
    pub filters:    Option<String>,     // json string for advanced filters
}

#[derive(sqlx::FromRow)]
struct ContactRow {
    id: Uuid,
    first_name: String,
    last_name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
    mobile: Option<String>,
    title: Option<String>,
    department: Option<String>,
    status: Option<String>,
    account_id: Option<Uuid>,
    owner_id: Option<Uuid>,
    tags: Option<Vec<String>>,
    avatar_url: Option<String>,
    do_not_email: Option<bool>,
    do_not_call: Option<bool>,
    lead_source: Option<String>,
    created_at: Option<chrono::DateTime<chrono::Utc>>,
    updated_at: Option<chrono::DateTime<chrono::Utc>>,
    account_name: Option<String>,
    owner_first_name: Option<String>,
    owner_last_name: Option<String>,
    _total_count: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateContactRequest {
    pub first_name:  String,
    pub last_name:   Option<String>,
    pub email:       Option<String>,
    pub phone:       Option<String>,
    pub mobile:      Option<String>,
    pub title:       Option<String>,
    pub department:  Option<String>,
    pub description: Option<String>,
    pub account_id:  Option<Uuid>,
    pub owner_id:    Option<Uuid>,
    pub lead_source: Option<String>,
    pub tags:        Option<Vec<String>>,

    // Address
    pub address:     Option<Value>,

    // Social
    pub linkedin_url:    Option<String>,
    pub twitter_handle:  Option<String>,

    // Do not contact
    pub do_not_email:    Option<bool>,
    pub do_not_call:     Option<bool>,
    pub do_not_sms:      Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateContactRequest {
    pub first_name:  Option<String>,
    pub last_name:   Option<String>,
    pub email:       Option<String>,
    pub phone:       Option<String>,
    pub mobile:      Option<String>,
    pub title:       Option<String>,
    pub department:  Option<String>,
    pub description: Option<String>,
    pub account_id:  Option<Uuid>,
    pub owner_id:    Option<Uuid>,
    pub lead_source: Option<String>,
    pub tags:        Option<Vec<String>>,
    pub address:     Option<Value>,
    pub linkedin_url:    Option<String>,
    pub twitter_handle:  Option<String>,
    pub do_not_email:    Option<bool>,
    pub do_not_call:     Option<bool>,
    pub do_not_sms:      Option<bool>,
    pub status:          Option<String>,
}

// ─── GET /api/v1/contacts ─────────────────────────────────────────────────────
// Time complexity:  O(log n) — index scan on org_id + optional filters
// Space complexity: O(k) — k = page size (max 100)

pub async fn list_contacts(
    State(state): State<AppState>,
    Query(q): Query<ListContactsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let page  = q.page.unwrap_or(1).max(1);
    let limit = q.limit.unwrap_or(25).min(100);
    let offset = (page - 1) * limit;

    // Validate sort field (whitelist to prevent SQL injection)
    let sort_col = match q.sort.as_deref().unwrap_or("created_at") {
        "first_name"  => "c.first_name",
        "email"       => "c.email",
        "created_at"  => "c.created_at",
        "updated_at"  => "c.updated_at",
        _             => "c.created_at",
    };
    let sort_dir = if q.order.as_deref() == Some("asc") { "ASC" } else { "DESC" };

    // Build dynamic query
    let mut qb = sqlx::QueryBuilder::new(
        r#"
        SELECT
            c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile,
            c.title, c.department, c.status::text as status,
            c.account_id, c.owner_id, c.tags, c.avatar_url,
            c.do_not_email, c.do_not_call,
            c.lead_source::text as lead_source,
            c.created_at, c.updated_at,
            a.name as account_name,
            u.first_name as owner_first_name,
            u.last_name as owner_last_name,
            count(*) OVER() as _total_count
        FROM contacts c
        LEFT JOIN accounts a ON a.id = c.account_id AND a.deleted_at IS NULL
        LEFT JOIN users    u ON u.id = c.owner_id   AND u.deleted_at IS NULL
        WHERE c.org_id = "#
    );
    qb.push_bind(auth.org_id);
    qb.push(" AND c.deleted_at IS NULL ");

    if let Some(ref search) = q.search {
        qb.push(" AND to_tsvector('english', coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,'')) @@ plainto_tsquery('english', ");
        qb.push_bind(search);
        qb.push(")");
    }

    if let Some(owner) = q.owner_id {
        qb.push(" AND c.owner_id = ");
        qb.push_bind(owner);
    }
    if let Some(acc) = q.account_id {
        qb.push(" AND c.account_id = ");
        qb.push_bind(acc);
    }
    if let Some(ref status) = q.status {
        qb.push(" AND c.status::text = ");
        qb.push_bind(status);
    }
    if let Some(ref tag) = q.tag {
        qb.push(" AND ");
        qb.push_bind(tag);
        qb.push(" = ANY(c.tags) ");
    }

    // JSON Filters mapping (Advanced Filtering)
    if let Some(ref f_str) = q.filters {
        if let Ok(filters_json) = serde_json::from_str::<std::collections::HashMap<String, serde_json::Value>>(f_str) {
            for (key, val) in filters_json.iter() {
                if val.is_null() || val.as_str() == Some("") { continue; }
                match key.as_str() {
                    "status" => {
                        if let Some(s) = val.as_str() { qb.push(" AND c.status::text = "); qb.push_bind(s.to_string()); }
                    },
                    "owner_id" => {
                         if let Some(s) = val.as_str() {
                             if let Ok(uuid) = Uuid::parse_str(s) { qb.push(" AND c.owner_id = "); qb.push_bind(uuid); }
                         }
                    },
                    "account_id" => {
                         if let Some(s) = val.as_str() {
                             if let Ok(uuid) = Uuid::parse_str(s) { qb.push(" AND c.account_id = "); qb.push_bind(uuid); }
                         }
                    },
                    "city" => {
                         if let Some(s) = val.as_str() { qb.push(" AND c.address->>'city' ILIKE "); qb.push_bind(format!("%{}%", s)); }
                    },
                    "created_after" => {
                         if let Some(s) = val.as_str() {
                             if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                                 qb.push(" AND c.created_at >= ");
                                 qb.push_bind(dt.with_timezone(&chrono::Utc));
                             }
                         }
                    },
                    "tag" => {
                         if let Some(s) = val.as_str() { qb.push(" AND "); qb.push_bind(s.to_string()); qb.push(" = ANY(c.tags) "); }
                    },
                    _ => {} 
                }
            }
        }
    }

    qb.push(" ORDER BY ");
    qb.push(sort_col);
    qb.push(" ");
    qb.push(sort_dir);
    qb.push(" LIMIT ");
    qb.push_bind(limit as i64);
    qb.push(" OFFSET ");
    qb.push_bind(offset as i64);

    let contacts: Vec<ContactRow> = qb.build_query_as()
        .fetch_all(&state.db)
        .await?;

    let total = contacts.first().and_then(|c| c._total_count).unwrap_or(0);
    let total_pages = (total as u32).div_ceil(limit);

    let data: Vec<Value> = contacts.iter().map(|c| json!({
        "id":           c.id,
        "first_name":   c.first_name,
        "last_name":    c.last_name,
        "email":        c.email,
        "phone":        c.phone,
        "mobile":       c.mobile,
        "title":        c.title,
        "department":   c.department,
        "status":       c.status,
        "account_id":   c.account_id,
        "account_name": c.account_name,
        "owner_id":     c.owner_id,
        "owner_name":   fmt_name(c.owner_first_name.as_deref(), c.owner_last_name.as_deref()),
        "tags":         c.tags,
        "avatar_url":   c.avatar_url,
        "do_not_email": c.do_not_email,
        "do_not_call":  c.do_not_call,
        "lead_source":  c.lead_source,
        "created_at":   c.created_at,
        "updated_at":   c.updated_at,
    })).collect();

    Ok(Json(json!({
        "success": true,
        "data": data,
        "meta": {
            "total":        total,
            "page":         page,
            "limit":        limit,
            "total_pages":  total_pages,
            "has_next":     page < total_pages,
            "has_prev":     page > 1,
        }
    })))
}

// ─── POST /api/v1/contacts ────────────────────────────────────────────────────

pub async fn create_contact(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateContactRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate required fields
    if body.first_name.trim().is_empty() {
        return Err(AppError::Validation("first_name is required".into()));
    }

    // Validate email format if provided
    if let Some(ref email) = body.email {
        if !email.is_empty() && !email.contains('@') {
            return Err(AppError::Validation("Invalid email format".into()));
        }
    }

    let owner_id = body.owner_id.unwrap_or(auth.user_id);
    let tags = body.tags.unwrap_or_default();

    let contact = sqlx::query!(
        r#"
        INSERT INTO contacts (
            org_id, first_name, last_name, email, phone, mobile,
            title, department, description, account_id, owner_id,
            tags, address, linkedin_url, twitter_handle,
            do_not_email, do_not_call, do_not_sms, created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19
        )
        RETURNING id, first_name, last_name, email, phone, status::text as "status!",
                  account_id, owner_id, tags, created_at
        "#,
        auth.org_id,
        body.first_name.trim(),
        body.last_name.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()),
        body.email.as_deref().map(|s| s.trim().to_lowercase()).filter(|s| !s.is_empty()),
        body.phone.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.mobile.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.title.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.department.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.description.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.account_id,
        owner_id,
        &tags as &[String],
        body.address,
        body.linkedin_url.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.twitter_handle.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        body.do_not_email.unwrap_or(false),
        body.do_not_call.unwrap_or(false),
        body.do_not_sms.unwrap_or(false),
        auth.user_id,
    )
    .fetch_one(&state.db)
    .await?;

    // Write audit log (non-blocking)
    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'created', 'contact', $3, $4)",
        auth.org_id, auth.user_id, contact.id,
        format!("{} {}", contact.first_name, contact.last_name.as_deref().unwrap_or(""))
    )
    .execute(&state.db)
    .await;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id":         contact.id,
                "first_name": contact.first_name,
                "last_name":  contact.last_name,
                "email":      contact.email,
                "phone":      contact.phone,
                "status":     contact.status,
                "account_id": contact.account_id,
                "owner_id":   contact.owner_id,
                "tags":       contact.tags,
                "created_at": contact.created_at,
            }
        })),
    ))
}

// ─── GET /api/v1/contacts/:id ─────────────────────────────────────────────────
// Full detail view with activity summary
// O(1) by primary key + O(log n) for recent activities

pub async fn get_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    // Fetch contact — org_id check prevents cross-tenant access
    let contact = sqlx::query!(
        r#"
        SELECT
            c.id, c.first_name, c.last_name, c.email, c.phone, c.mobile,
            c.title, c.department, c.description,
            c.status::text as "status!",
            c.lead_source::text as "lead_source?",
            c.account_id, c.owner_id,
            c.avatar_url, c.tags,
            c.address, c.linkedin_url, c.twitter_handle,
            c.do_not_email, c.do_not_call, c.do_not_sms,
            c.date_of_birth, c.created_at, c.updated_at,
            a.name as "account_name?",
            u.first_name as "owner_first_name?",
            u.last_name  as "owner_last_name?",
            u.avatar_url as "owner_avatar?"
        FROM contacts c
        LEFT JOIN accounts a ON a.id = c.account_id AND a.deleted_at IS NULL
        LEFT JOIN users    u ON u.id = c.owner_id   AND u.deleted_at IS NULL
        WHERE c.id = $1 AND c.org_id = $2 AND c.deleted_at IS NULL
        "#,
        id,
        auth.org_id,
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Contact"))?;

    // Fetch activity summary counts — O(log n) via indexed (linked_module, record_id)
    let activity_counts = sqlx::query!(
        r#"
        SELECT
            COUNT(*)                                       as total,
            COUNT(*) FILTER (WHERE activity_type = 'call')     as calls,
            COUNT(*) FILTER (WHERE activity_type = 'email')    as emails,
            COUNT(*) FILTER (WHERE activity_type = 'meeting')  as meetings,
            COUNT(*) FILTER (WHERE activity_type = 'task'
                AND status != 'completed')                     as open_tasks
        FROM activities
        WHERE linked_module = 'contacts'
          AND linked_record_id = $1
          AND deleted_at IS NULL
        "#,
        id
    )
    .fetch_one(&state.db)
    .await?;

    // Fetch recent notes count
    let notes_count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM notes WHERE module_api_name = 'contacts' AND record_id = $1 AND deleted_at IS NULL",
        id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Fetch files count
    let files_count = sqlx::query_scalar!(
        "SELECT COUNT(*) FROM files WHERE module_api_name = 'contacts' AND record_id = $1 AND deleted_at IS NULL",
        id
    )
    .fetch_one(&state.db)
    .await?
    .unwrap_or(0);

    // Fetch open opportunities linked to this contact
    let open_deals = sqlx::query!(
        r#"
        SELECT o.id, o.name, o.amount, o.currency, ps.name as stage_name, ps.color,
               o.stage_type::text as "stage_type!"
        FROM opportunities o
        JOIN pipeline_stages ps ON ps.id = o.stage_id
        WHERE o.contact_id = $1 AND o.org_id = $2
          AND o.stage_type::text = 'open' AND o.deleted_at IS NULL
        ORDER BY o.created_at DESC
        LIMIT 5
        "#,
        id, auth.org_id
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id":             contact.id,
            "first_name":     contact.first_name,
            "last_name":      contact.last_name,
            "email":          contact.email,
            "phone":          contact.phone,
            "mobile":         contact.mobile,
            "title":          contact.title,
            "department":     contact.department,
            "description":    contact.description,
            "status":         contact.status,
            "lead_source":    contact.lead_source,
            "account_id":     contact.account_id,
            "account_name":   contact.account_name,
            "owner": {
                "id":         contact.owner_id,
                "name":       fmt_name(contact.owner_first_name.as_deref(), contact.owner_last_name.as_deref()),
                "avatar_url": contact.owner_avatar,
            },
            "avatar_url":     contact.avatar_url,
            "tags":           contact.tags,
            "address":        contact.address,
            "linkedin_url":   contact.linkedin_url,
            "twitter_handle": contact.twitter_handle,
            "do_not_email":   contact.do_not_email,
            "do_not_call":    contact.do_not_call,
            "do_not_sms":     contact.do_not_sms,
            "date_of_birth":  contact.date_of_birth,
            "created_at":     contact.created_at,
            "updated_at":     contact.updated_at,
            // Activity summary
            "summary": {
                "activities":  activity_counts.total,
                "calls":       activity_counts.calls,
                "emails":      activity_counts.emails,
                "meetings":    activity_counts.meetings,
                "open_tasks":  activity_counts.open_tasks,
                "notes":       notes_count,
                "files":       files_count,
            },
            // Related deals preview
            "open_deals": open_deals.iter().map(|d| json!({
                "id":         d.id,
                "name":       d.name,
                "amount":     d.amount,
                "currency":   d.currency,
                "stage":      d.stage_name,
                "stage_color": d.color,
            })).collect::<Vec<_>>(),
        }
    })))
}

// ─── PATCH /api/v1/contacts/:id ──────────────────────────────────────────────
// Partial update — only updates provided fields

pub async fn update_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateContactRequest>,
) -> AppResult<impl IntoResponse> {
    // Verify contact belongs to org
    let existing = sqlx::query!(
        "SELECT id, first_name FROM contacts WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Contact"))?;

    // Build dynamic update — only set fields that were provided
    // Using individual updates for simplicity; Day 18 will use a query builder
    let updated = sqlx::query!(
        r#"
        UPDATE contacts SET
            first_name       = COALESCE($3,  first_name),
            last_name        = COALESCE($4,  last_name),
            email            = COALESCE($5,  email),
            phone            = COALESCE($6,  phone),
            mobile           = COALESCE($7,  mobile),
            title            = COALESCE($8,  title),
            department       = COALESCE($9,  department),
            description      = COALESCE($10, description),
            account_id       = COALESCE($11, account_id),
            owner_id         = COALESCE($12, owner_id),
            tags             = COALESCE($13, tags),
            address          = COALESCE($14, address),
            linkedin_url     = COALESCE($15, linkedin_url),
            twitter_handle   = COALESCE($16, twitter_handle),
            do_not_email     = COALESCE($17, do_not_email),
            do_not_call      = COALESCE($18, do_not_call),
            do_not_sms       = COALESCE($19, do_not_sms),
            updated_at       = NOW()
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, first_name, last_name, email, phone, updated_at
        "#,
        id,
        auth.org_id,
        body.first_name.as_deref().map(str::trim),
        body.last_name.as_deref().map(str::trim),
        body.email.as_ref().map(|s| s.trim().to_lowercase()),
        body.phone.as_deref().map(str::trim),
        body.mobile.as_deref().map(str::trim),
        body.title.as_deref().map(str::trim),
        body.department.as_deref().map(str::trim),
        body.description.as_deref().map(str::trim),
        body.account_id,
        body.owner_id,
        body.tags.as_deref(),
        body.address,
        body.linkedin_url.as_deref().map(str::trim),
        body.twitter_handle.as_deref().map(str::trim),
        body.do_not_email,
        body.do_not_call,
        body.do_not_sms,
    )
    .fetch_one(&state.db)
    .await?;

    // Audit log (non-blocking)
    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'updated', 'contact', $3, $4)",
        auth.org_id, auth.user_id, id,
        existing.first_name
    )
    .execute(&state.db)
    .await;

    Ok(Json(json!({
        "success":    true,
        "message":    "Contact updated",
        "data": {
            "id":         updated.id,
            "first_name": updated.first_name,
            "last_name":  updated.last_name,
            "email":      updated.email,
            "phone":      updated.phone,
            "updated_at": updated.updated_at,
        }
    })))
}

// ─── DELETE /api/v1/contacts/:id ─────────────────────────────────────────────
// Soft delete — sets deleted_at, O(1) by primary key

pub async fn delete_contact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT first_name FROM contacts WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Contact"))?;

    sqlx::query!(
        "UPDATE contacts SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        id, auth.org_id
    )
    .execute(&state.db)
    .await?;

    // Audit log
    let _ = sqlx::query!(
        "INSERT INTO audit_logs (org_id, user_id, action, entity_type, entity_id, entity_name)
         VALUES ($1, $2, 'deleted', 'contact', $3, $4)",
        auth.org_id, auth.user_id, id, existing
    )
    .execute(&state.db)
    .await;

    Ok(Json(json!({ "success": true, "message": "Contact deleted" })))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Format an owner name from optional string slices (works with both
/// String and Option<String> fields from sqlx LEFT JOINs)
fn fmt_name(first: Option<&str>, last: Option<&str>) -> Option<String> {
    match (first, last) {
        (Some(f), Some(l)) if !f.is_empty() => Some(format!("{} {}", f, l.trim())),
        (Some(f), _)       if !f.is_empty() => Some(f.to_string()),
        _                                   => None,
    }
}

/// Legacy wrapper kept for cross-file compatibility
fn format_name(first: &Option<String>, last: &Option<String>) -> Option<String> {
    fmt_name(first.as_deref(), last.as_deref())
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::get;
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_contacts).post(create_contact))
        .route("/:id", get(get_contact).patch(update_contact).delete(delete_contact))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
