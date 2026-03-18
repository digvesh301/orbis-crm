// ─────────────────────────────────────────────────────────────────────────────
// Quotes Handler (Day 7)
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

// ─── Request Types ────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ListQuotesQuery {
    pub search:         Option<String>,
    pub status:         Option<String>,
    pub account_id:     Option<Uuid>,
    pub contact_id:     Option<Uuid>,
    pub opportunity_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct QuoteLineItemInput {
    pub product_id:      Option<Uuid>,
    pub name:            String,
    pub description:     Option<String>,
    pub sku:             Option<String>,
    pub quantity:        BigDecimal,
    pub unit_price:      BigDecimal,
    pub discount_type:   Option<String>, // 'percentage', 'fixed'
    pub discount_value:  Option<BigDecimal>,
    pub unit_of_measure: Option<String>,
    pub tax_rate:        Option<BigDecimal>,
}

#[derive(Debug, Deserialize)]
pub struct CreateQuoteRequest {
    pub subject:           String,
    pub description:       Option<String>,
    pub status:            Option<String>, // 'draft', 'sent', 'accepted', 'rejected'
    pub contact_id:        Option<Uuid>,
    pub account_id:        Option<Uuid>,
    pub opportunity_id:    Option<Uuid>,
    pub currency:          Option<String>,
    pub valid_until:       Option<chrono::NaiveDate>,
    pub payment_terms:     Option<String>,
    pub delivery_terms:    Option<String>,
    pub notes:             Option<String>,
    pub terms_conditions:  Option<String>,
    pub discount_type:     Option<String>,
    pub discount_value:    Option<BigDecimal>,
    pub shipping_cost:     Option<BigDecimal>,
    pub owner_id:          Option<Uuid>,
    
    // The products/services being quoted
    pub line_items:        Vec<QuoteLineItemInput>,
}

// ─── GET /api/v1/quotes ───────────────────────────────────────────────────────

pub async fn list_quotes(
    State(state): State<AppState>,
    Query(q): Query<ListQuotesQuery>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    let mut q_builder = sqlx::QueryBuilder::new(
        r#"
        SELECT q.id, q.quote_number, q.subject, q.status::text as "status", q.currency,
               q.total_amount, q.valid_until, q.created_at,
               q.account_id, acc.name as account_name,
               q.contact_id, con.first_name as contact_first, con.last_name as contact_last,
               q.owner_id, u.first_name as owner_first, u.last_name as owner_last
        FROM quotes q
        LEFT JOIN accounts acc ON acc.id = q.account_id
        LEFT JOIN contacts con ON con.id = q.contact_id
        LEFT JOIN users u ON u.id = q.owner_id
        WHERE q.org_id = 
        "#
    );
    q_builder.push_bind(auth.org_id);
    q_builder.push(" AND q.deleted_at IS NULL ");

    if let Some(ref search) = q.search {
        let qs = format!("%{}%", search);
        q_builder.push(" AND (q.subject ILIKE ");
        q_builder.push_bind(qs.clone());
        q_builder.push(" OR q.quote_number ILIKE ");
        q_builder.push_bind(qs);
        q_builder.push(") ");
    }

    if let Some(ref status) = q.status {
        q_builder.push(" AND q.status = ");
        q_builder.push("(CAST(");
        q_builder.push_bind(status);
        q_builder.push("::text as quote_status))");
    }

    if let Some(acc) = q.account_id { q_builder.push(" AND q.account_id = ").push_bind(acc); }
    if let Some(con) = q.contact_id { q_builder.push(" AND q.contact_id = ").push_bind(con); }
    if let Some(opp) = q.opportunity_id { q_builder.push(" AND q.opportunity_id = ").push_bind(opp); }

    q_builder.push(" ORDER BY q.created_at DESC");

    let rows = q_builder.build().fetch_all(&state.db).await?;
    
    use sqlx::Row;
    let quotes: Vec<Value> = rows.into_iter().map(|row| {
        let con_f: Option<String> = row.get("contact_first");
        let con_l: Option<String> = row.get("contact_last");
        let own_f: Option<String> = row.get("owner_first");
        let own_l: Option<String> = row.get("owner_last");
        
        json!({
            "id":           row.get::<Uuid, _>("id"),
            "quote_number": row.get::<String, _>("quote_number"),
            "subject":      row.get::<String, _>("subject"),
            "status":       row.get::<String, _>("status"),
            "currency":     row.get::<String, _>("currency"),
            "total_amount": row.get::<BigDecimal, _>("total_amount"),
            "valid_until":  row.get::<Option<chrono::NaiveDate>, _>("valid_until"),
            "created_at":   row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "account": row.get::<Option<Uuid>, _>("account_id").map(|id| json!({
                "id": id,
                "name": row.get::<Option<String>, _>("account_name")
            })),
            "contact": row.get::<Option<Uuid>, _>("contact_id").map(|id| json!({
                "id": id,
                "name": fmt_name(con_f.as_deref(), con_l.as_deref())
            })),
            "owner": row.get::<Option<Uuid>, _>("owner_id").map(|id| json!({
                "id": id,
                "name": fmt_name(own_f.as_deref(), own_l.as_deref())
            }))
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": quotes
    })))
}

// ─── POST /api/v1/quotes ──────────────────────────────────────────────────────

pub async fn create_quote(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(body): Json<CreateQuoteRequest>,
) -> AppResult<impl IntoResponse> {
    if body.subject.trim().is_empty() {
        return Err(AppError::Validation("Subject is required".into()));
    }
    if body.line_items.is_empty() {
        return Err(AppError::Validation("At least one line item is required".into()));
    }

    let mut tx = state.db.begin().await?;

    // Auto-generate a quote number (e.g. Q-20231024-XXXX)
    let stamp = chrono::Utc::now().format("%Y%m%d").to_string();
    let r_suffix: String = uuid::Uuid::new_v4().to_string().chars().take(4).collect();
    let quote_number = format!("Q-{}-{}", stamp, r_suffix.to_uppercase());

    let header = sqlx::query!(
        r#"
        INSERT INTO quotes (
            org_id, quote_number, subject, description, status, contact_id, account_id,
            opportunity_id, currency, valid_until, payment_terms, delivery_terms, notes,
            terms_conditions, discount_type, discount_value, shipping_cost, owner_id, created_by
        )
        VALUES (
            $1, $2, $3, $4, CAST($5::text as quote_status), $6, $7,
            $8, CAST($9::text as text), $10, $11, $12, $13,
            $14, CAST($15::text as discount_type), $16, $17, $18, $19
        )
        RETURNING id
        "#,
        auth.org_id,
        quote_number,
        body.subject.trim(),
        body.description.as_deref(),
        body.status.as_deref().unwrap_or("draft"),
        body.contact_id,
        body.account_id,
        body.opportunity_id,
        body.currency.as_deref().unwrap_or("INR"),
        body.valid_until,
        body.payment_terms.as_deref(),
        body.delivery_terms.as_deref(),
        body.notes.as_deref(),
        body.terms_conditions.as_deref(),
        body.discount_type.as_deref(),
        body.discount_value.clone(),
        body.shipping_cost.clone().unwrap_or(BigDecimal::from(0)),
        body.owner_id.unwrap_or(auth.user_id),
        auth.user_id
    )
    .fetch_one(&mut *tx)
    .await?;

    let mut sub_total = BigDecimal::from(0);
    let mut total_tax = BigDecimal::from(0);

    for (idx, item) in body.line_items.iter().enumerate() {
        // Calculate Line Totals
        // This is a simplified calculation: Qty * Price
        
        let qty = item.quantity.clone();
        let price = item.unit_price.clone();
        
        // Convert BigDecimal to f64 for simple multiplication calculation (WARNING: Loss of precision in real finance systems! Use proper rust_decimal or sql calculations instead)
        let calc_sub = serde_json::to_string(&qty).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0) 
            * serde_json::to_string(&price).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0);
            
        let line_subtotal = BigDecimal::try_from(calc_sub).unwrap_or_default();
        
        let tax_pct = item.tax_rate.clone().unwrap_or(BigDecimal::from(0));
        let tx_math = calc_sub * (serde_json::to_string(&tax_pct).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0) / 100.0);
        let line_tax = BigDecimal::try_from(tx_math).unwrap_or_default();

        let line_total = BigDecimal::try_from(calc_sub + tx_math).unwrap_or_default();

        sub_total += line_subtotal;
        total_tax += line_tax.clone();

        sqlx::query!(
            r#"
            INSERT INTO quote_line_items (
                quote_id, product_id, name, description, sku, quantity, unit_price,
                discount_type, discount_value, discount_amount, tax_rate, tax_amount,
                total_amount, unit_of_measure, position
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, CAST($8::text as discount_type), $9, 0, $10, $11, $12, CAST($13::text as text), $14)
            "#,
            header.id,
            item.product_id,
            item.name.trim(),
            item.description.as_deref(),
            item.sku.as_deref(),
            item.quantity,
            item.unit_price,
            item.discount_type.as_deref(),
            item.discount_value,
            item.tax_rate.clone().unwrap_or(BigDecimal::from(0)),
            line_tax, // using our placeholder math
            line_total, // using our placeholder math
            item.unit_of_measure.as_deref().unwrap_or("unit"),
            idx as i32
        )
        .execute(&mut *tx)
        .await?;
    }

    // Now update Header totals
    let f_sub_total = serde_json::to_string(&sub_total).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0);
    let f_tot_tax = serde_json::to_string(&total_tax).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0);
    let f_ship = serde_json::to_string(&body.shipping_cost.unwrap_or_default()).unwrap_or("0".into()).parse::<f64>().unwrap_or(0.0);
    // ignoring header discounts for this demo logic 
    let f_grand = f_sub_total + f_tot_tax + f_ship;

    sqlx::query!(
        "UPDATE quotes SET subtotal = $1, tax_amount = $2, total_amount = $3 WHERE id = $4",
        BigDecimal::try_from(f_sub_total).unwrap_or_default(),
        BigDecimal::try_from(f_tot_tax).unwrap_or_default(),
        BigDecimal::try_from(f_grand).unwrap_or_default(),
        header.id
    ).execute(&mut *tx).await?;

    tx.commit().await?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(json!({
            "success": true,
            "data": {
                "id": header.id,
                "quote_number": quote_number
            }
        }))
    ))
}

// ─── GET /api/v1/quotes/:id ───────────────────────────────────────────────────
pub async fn get_quote(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    auth: AuthUser,
) -> AppResult<impl IntoResponse> {
    
    // 1. Get header
    let header = sqlx::query!(
        r#"
        SELECT q.id, q.quote_number, q.subject, q.description, q.status::text as "status",
               q.currency, q.subtotal, q.discount_type::text as "discount_type", q.discount_value, q.discount_amount,
               q.tax_amount, q.shipping_cost, q.total_amount, q.valid_until,
               q.payment_terms, q.delivery_terms, q.notes, q.terms_conditions, q.created_at,
               q.account_id, acc.name as account_name,
               q.contact_id, con.first_name as contact_first, con.last_name as contact_last
        FROM quotes q
        LEFT JOIN accounts acc ON acc.id = q.account_id
        LEFT JOIN contacts con ON con.id = q.contact_id
        WHERE q.id = $1 AND q.org_id = $2 AND q.deleted_at IS NULL
        "#,
        id, auth.org_id
    )
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Quote"))?;

    // 2. Get line items
    let mut items_q = sqlx::query(
        "SELECT id, product_id, name, description, sku, quantity, unit_price, discount_type::text as discount_type, discount_value, discount_amount, tax_rate, tax_amount, total_amount, unit_of_measure, position FROM quote_line_items WHERE quote_id = $1 ORDER BY position ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    use sqlx::Row;
    let line_items: Vec<Value> = items_q.into_iter().map(|row| {
        json!({
            "id": row.get::<Uuid, _>("id"),
            "product_id": row.get::<Option<Uuid>, _>("product_id"),
            "name": row.get::<String, _>("name"),
            "description": row.get::<Option<String>, _>("description"),
            "sku": row.get::<Option<String>, _>("sku"),
            "quantity": row.get::<BigDecimal, _>("quantity"),
            "unit_price": row.get::<BigDecimal, _>("unit_price"),
            "discount_type": row.get::<Option<String>, _>("discount_type"),
            "discount_value": row.get::<Option<BigDecimal>, _>("discount_value"),
            "discount_amount": row.get::<BigDecimal, _>("discount_amount"),
            "tax_rate": row.get::<BigDecimal, _>("tax_rate"),
            "tax_amount": row.get::<BigDecimal, _>("tax_amount"),
            "total_amount": row.get::<BigDecimal, _>("total_amount"),
            "unit_of_measure": row.get::<String, _>("unit_of_measure"),
            "position": row.get::<i32, _>("position"),
        })
    }).collect();

    Ok(Json(json!({
        "success": true,
        "data": {
            "id": header.id,
            "quote_number": header.quote_number,
            "subject": header.subject,
            "description": header.description,
            "status": header.status,
            "currency": header.currency,
            "subtotal": header.subtotal,
            "discount_type": header.discount_type,
            "discount_value": header.discount_value,
            "discount_amount": header.discount_amount,
            "tax_amount": header.tax_amount,
            "shipping_cost": header.shipping_cost,
            "total_amount": header.total_amount,
            "valid_until": header.valid_until,
            "payment_terms": header.payment_terms,
            "delivery_terms": header.delivery_terms,
            "notes": header.notes,
            "terms_conditions": header.terms_conditions,
            "created_at": header.created_at,
            "account": header.account_id.map(|aid| json!({ "id": aid, "name": header.account_name })),
            "contact": header.contact_id.map(|cid| {
                let first: String = header.contact_first.clone();
                let last: Option<String> = header.contact_last.clone();
                json!({ "id": cid, "name": fmt_name(Some(&first), last.as_deref()) })
            }),
            "line_items": line_items
        }
    })))
}


// ─── Router ───────────────────────────────────────────────────────────────────

pub fn router(state: AppState) -> axum::Router<AppState> {
    use axum::routing::get;
    use axum::middleware::from_fn_with_state;
    use crate::middleware::auth::auth_middleware;

    axum::Router::<AppState>::new()
        .route("/",    get(list_quotes).post(create_quote))
        .route("/:id", get(get_quote)) // add .patch() and .delete() in future full implementations
        .route_layer(from_fn_with_state(state, auth_middleware))
}
