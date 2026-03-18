use axum::{routing::get, Json, Router};
use serde_json::{json, Value};
use crate::state::AppState;


/// Central router — adding a module = one `.nest()` line
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/", get(root))
        .nest("/api/v1", api_v1_router(state.clone()))
        .with_state(state)
}

fn api_v1_router(state: AppState) -> Router<AppState> {
    Router::<AppState>::new()
        .route("/ping", get(ping))
        // ─── Day 3: Auth ────────────────────────────────────────
        .nest("/auth",     crate::handlers::auth::router(state.clone()))
        // ─── Day 4: Contacts & Accounts ─────────────────────────
        .nest("/contacts", crate::handlers::contacts::router(state.clone()))
        .nest("/accounts", crate::handlers::accounts::router(state.clone()))
        // ─── Day 5: Leads & Pipeline ────────────────────────────
        .nest("/leads",       crate::handlers::leads::router(state.clone()))
        .nest("/pipeline",    crate::handlers::pipeline::router(state.clone()))
        .nest("/deals",       crate::handlers::deals::router(state.clone()))
        // ─── Day 6: Tasks, Notes & Activities ───────────────────
        .nest("/notes",       crate::handlers::notes::router(state.clone()))
        .nest("/activities",  crate::handlers::activities::router(state.clone()))
        // ─── Day 7: Quotes & Products ───────────────────────────
        .nest("/products",    crate::handlers::products::router(state.clone()))
        .nest("/quotes",      crate::handlers::quotes::router(state.clone()))
        // ─── Day 8: Emails ──────────────────────────────────────
        .nest("/emails",      crate::handlers::emails::router(state.clone()))
        // ─── Day 9: Admin & Team Management ────────────────────
        .nest("/admin",       crate::handlers::admin::router(state.clone()))
        // ─── Day 14: Settings ──────────────────────────────────
        .nest("/settings",    crate::handlers::settings::router(state.clone()))
        // ─── Phase 2: Custom Views (Saved Filters) ─────────────
        .nest("/views",       crate::handlers::views::router(state.clone()))
}

async fn root() -> Json<Value> {
    Json(json!({ "app": "Orbis CRM", "version": env!("CARGO_PKG_VERSION"), "status": "running" }))
}

async fn health_check() -> Json<Value> {
    Json(json!({ "status": "healthy", "timestamp": chrono::Utc::now().to_rfc3339() }))
}

async fn ping() -> Json<Value> {
    Json(json!({ "message": "pong", "timestamp": chrono::Utc::now().to_rfc3339() }))
}
