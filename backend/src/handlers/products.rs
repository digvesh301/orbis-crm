// ─────────────────────────────────────────────────────────────────────────────
// Products & Catalog Handler (Day 7)
// ─────────────────────────────────────────────────────────────────────────────

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use bigdecimal::BigDecimal;
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
pub struct ListProductsQuery {
    pub search:      Option<String>,
    pub category_id: Option<Uuid>,
    pub status:      Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductRequest {
    pub name:            String,
    pub sku:             Option<String>,
    pub description:     Option<String>,
    pub category_id:     Option<Uuid>,
    pub image_url:       Option<String>,
    pub status:          Option<String>, // 'active', 'inactive', 'draft' (def: 'active')
    pub unit_price:      BigDecimal,
    pub currency:        Option<String>, // def: 'INR'
    pub unit_of_measure: Option<String>,
    pub tax_rate:        Option<BigDecimal>,
    pub tax_inclusive:   Option<bool>,
    pub track_inventory: Option<bool>,
    pub stock_quantity:  Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductRequest {
    pub name:            Option<String>,
    pub sku:             Option<String>,
    pub description:     Option<String>,
    pub category_id:     Option<Uuid>,
    pub image_url:       Option<String>,
    pub status:          Option<String>,
    pub unit_price:      Option<BigDecimal>,
    pub currency:        Option<String>,
    pub unit_of_measure: Option<String>,
    pub tax_rate:        Option<BigDecimal>,
    pub tax_inclusive:   Option<bool>,
    pub track_inventory: Option<bool>,
    pub stock_quantity:  Option<i32>,
}

// ─── GET /api/v1/products ─────────────────────────────────────────────────────

pub async fn list_products(
    State(state): State<AppState>,
    Query(q): Query<ListProductsQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT p.id, p.name, p.sku, p.description, p.image_url, 
               p.status::text as "status", p.unit_price, p.currency, 
               p.unit_of_measure, p.tax_rate, p.tax_inclusive, 
               p.track_inventory, p.stock_quantity, p.created_at,
               p.category_id, c.name as category_name
        FROM products p
        LEFT JOIN product_categories c ON c.id = p.category_id
        WHERE p.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND p.deleted_at IS NULL ");

    if let Some(ref search) = q.search {
        let qs = format!("%{}%", search);
        q_builder.push(" AND (p.name ILIKE ");
        q_builder.push_bind(qs.clone());
        q_builder.push(" OR p.sku ILIKE ");
        q_builder.push_bind(qs);
        q_builder.push(") ");
    }

    if let Some(cat_id) = q.category_id {
        q_builder.push(" AND p.category_id = ");
        q_builder.push_bind(cat_id);
    }

    if let Some(ref status) = q.status {
        q_builder.push(" AND p.status = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(status);
        q_builder.push("::text as product_status))");
    }

    q_builder.push(" ORDER BY p.name ASC");

    let rows = q_builder.build().fetch_all(&state.db).await?;

    use sqlx::Row;
    let products: Vec<serde_json::Value> = rows.into_iter().map(|row| {
        json!({
            "id":              row.get::<Uuid, _>("id"),
            "name":            row.get::<String, _>("name"),
            "sku":             row.get::<Option<String>, _>("sku"),
            "description":     row.get::<Option<String>, _>("description"),
            "image_url":       row.get::<Option<String>, _>("image_url"),
            "status":          row.get::<String, _>("status"),
            "unit_price":      row.get::<BigDecimal, _>("unit_price"),
            "currency":        row.get::<String, _>("currency"),
            "unit_of_measure": row.get::<String, _>("unit_of_measure"),
            "tax_rate":        row.get::<BigDecimal, _>("tax_rate"),
            "tax_inclusive":   row.get::<bool, _>("tax_inclusive"),
            "track_inventory": row.get::<bool, _>("track_inventory"),
            "stock_quantity":  row.get::<Option<i32>, _>("stock_quantity"),
            "created_at":      row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "category": row.get::<Option<Uuid>, _>("category_id").map(|id| json!({
                "id": id,
                "name": row.get::<Option<String>, _>("category_name")
            }))
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": products
    })))
}

// ─── POST /api/v1/products ────────────────────────────────────────────────────

pub async fn create_product(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateProductRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::Validation("Product name is required".into()));
    }

    // Check SKU uniqueness if provided
    if let Some(ref sku) = body.sku {
        let count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM products WHERE org_id = $1 AND sku = $2 AND deleted_at IS NULL",
            auth.org_id, sku
        ).fetch_one(&state.db).await?;
        if count.unwrap_or(0) > 0 {
            return Err(AppError::Validation("A product with this SKU already exists".into()));
        }
    }

    let product = sqlx::query!(
        r#"
        INSERT INTO products (
            org_id, name, sku, description, category_id, image_url, status,
            unit_price, currency, unit_of_measure, tax_rate, tax_inclusive,
            track_inventory, stock_quantity, created_by
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, CAST($7::text as product_status),
            $8, CAST($9::text as text), CAST($10::text as text), $11, $12,
            $13, $14, $15
        )
        RETURNING id, created_at
        "#,
        auth.org_id,
        body.name.trim(),
        body.sku.as_deref(),
        body.description.as_deref(),
        body.category_id,
        body.image_url.as_deref(),
        body.status.as_deref().unwrap_or("active"),
        body.unit_price,
        body.currency.as_deref().unwrap_or("INR"),
        body.unit_of_measure.as_deref().unwrap_or("unit"),
        body.tax_rate.unwrap_or_else(|| BigDecimal::from(0)),
        body.tax_inclusive.unwrap_or(false),
        body.track_inventory.unwrap_or(false),
        body.stock_quantity,
        auth.user_id
    )
    .fetch_one(&state.db)
    .await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": product.id,
                "created_at": product.created_at
            }
        }))
    ))
}

// ─── PATCH /api/v1/products/:id ───────────────────────────────────────────────

pub async fn update_product(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
    Json(body): Json<UpdateProductRequest>,
) -> AppResult<impl IntoResponse> {
    if let Some(ref sku) = body.sku {
        let count = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM products WHERE org_id = $1 AND sku = $2 AND id != $3 AND deleted_at IS NULL",
            auth.org_id, sku, id
        ).fetch_one(&state.db).await?;
        if count.unwrap_or(0) > 0 {
            return Err(AppError::Validation("A product with this SKU already exists".into()));
        }
    }

    let existing = sqlx::query_scalar!(
        "SELECT id FROM products WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    ).fetch_optional(&state.db).await?.ok_or(AppError::NotFound("Product"))?;

    let product = sqlx::query!(
        r#"
        UPDATE products
        SET 
            name = COALESCE($3, name),
            sku = COALESCE($4, sku),
            description = COALESCE($5, description),
            category_id = COALESCE($6, category_id),
            image_url = COALESCE($7, image_url),
            status = COALESCE(CAST($8::text as product_status), status),
            unit_price = COALESCE($9, unit_price),
            currency = COALESCE($10, currency),
            unit_of_measure = COALESCE($11, unit_of_measure),
            tax_rate = COALESCE($12, tax_rate),
            tax_inclusive = COALESCE($13, tax_inclusive),
            track_inventory = COALESCE($14, track_inventory),
            stock_quantity = COALESCE($15, stock_quantity),
            updated_at = NOW()
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL
        RETURNING id, updated_at
        "#,
        existing,
        auth.org_id,
        body.name.as_deref().map(str::trim),
        body.sku.as_deref(),
        body.description.as_deref(),
        body.category_id,
        body.image_url.as_deref(),
        body.status.as_deref(),
        body.unit_price,
        body.currency.as_deref(),
        body.unit_of_measure.as_deref(),
        body.tax_rate,
        body.tax_inclusive,
        body.track_inventory,
        body.stock_quantity
    )
    .fetch_one(&state.db)
    .await?;

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": product.id,
            "updated_at": product.updated_at
        }
    })))
}

// ─── DELETE /api/v1/products/:id ──────────────────────────────────────────────

pub async fn delete_product(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let existing = sqlx::query_scalar!(
        "SELECT id FROM products WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL",
        id, auth.org_id
    ).fetch_optional(&state.db).await?.ok_or(AppError::NotFound("Product"))?;

    sqlx::query!(
        "UPDATE products SET deleted_at = NOW() WHERE id = $1 AND org_id = $2",
        existing, auth.org_id
    ).execute(&state.db).await?;

    Ok(Json(json!({
        "success": true,
        "message": "Product deleted successfully"
    })))
}

// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::{get, patch};
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_products).post(create_product))
        .route("/:id", patch(update_product).delete(delete_product))
        .route_layer(from_fn_with_state(state, auth_middleware))
}
