mod config;
mod db;
mod errors;
mod handlers;
mod middleware;
mod routes;
mod state;
mod utils;

use config::Config;
use db::create_pool;
use state::AppState;
use std::time::Duration;
use tower_http::{
    catch_panic::CatchPanicLayer,
    compression::CompressionLayer,
    cors::CorsLayer,
    request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer},
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // ─── 1. Load .env ─────────────────────────────────────────────────────────
    dotenvy::dotenv().ok();

    // ─── 2. Load config (fails fast if env vars missing) ──────────────────────
    let config = Config::load();

    // ─── 3. Structured logging ─────────────────────────────────────────────────
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "orbis=info,tower_http=warn,sqlx=warn".into()),
        )
        .with(tracing_subscriber::fmt::layer().with_target(false).compact())
        .init();

    tracing::info!("🌐 Starting {} CRM...", config.app_name);
    tracing::info!("📦 Environment: {:?}", config.app_env);

    // ─── 4. PostgreSQL connection pool ─────────────────────────────────────────
    tracing::info!("🔌 Connecting to PostgreSQL (max: {} connections)...", config.database_max_connections);
    let db_pool = create_pool(&config).await;
    tracing::info!("✅ PostgreSQL connected successfully");

    // ─── 5. Run migrations ─────────────────────────────────────────────────────
    tracing::info!("🔄 Running database migrations...");
    sqlx::migrate!("./migrations")
        .run(&db_pool)
        .await
        .unwrap_or_else(|e| panic!("❌ Migration failed: {}", e));
    tracing::info!("✅ Migrations complete");

    // ─── 6. Redis connection ───────────────────────────────────────────────────
    tracing::info!("🔌 Connecting to Redis...");
    let redis_client = redis::Client::open(config.redis_url.clone())
        .unwrap_or_else(|e| panic!("❌ Invalid Redis URL: {}", e));
    let redis_manager = redis::aio::ConnectionManager::new(redis_client)
        .await
        .unwrap_or_else(|e| panic!("❌ Redis connect failed: {}", e));
    tracing::info!("✅ Redis connected");

    // ─── 7. Build app state ────────────────────────────────────────────────────
    let state = AppState::new(db_pool, redis_manager, config.clone());

    // ─── 8. CORS — only allow known origin ────────────────────────────────────
    let cors = CorsLayer::new()
        .allow_origin([
            config.frontend_url.parse().expect("Invalid FRONTEND_URL"),
        ])
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
            axum::http::header::HeaderName::from_static("x-request-id"),
        ])
        .allow_credentials(true)
        // Preflight response cached for 1 hour — eliminates repeated OPTIONS calls
        .max_age(Duration::from_secs(3600));

    // ─── 9. Assemble middleware stack ──────────────────────────────────────────
    // Order matters: outermost = first to process request, last to process response
    let app = routes::create_router(state)
        // ① Panic guard — 500 instead of crash on handler panic
        .layer(CatchPanicLayer::new())
        // ② Gzip/Brotli/Deflate response compression — reduces payload 60-90%
        .layer(CompressionLayer::new())
        // ③ Request tracing — logs method, path, status, latency
        .layer(TraceLayer::new_for_http())
        // ④ Hard timeout — kills runaway requests
        .layer(TimeoutLayer::new(Duration::from_secs(config.request_timeout_secs)))
        // ⑤ CORS
        .layer(cors)
        // ⑥ Unique request-id header for distributed tracing
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid));

    // ─── 10. Start server ──────────────────────────────────────────────────────
    let addr = config.server_addr();
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .unwrap_or_else(|e| panic!("❌ Failed to bind to {}: {}", addr, e));

    tracing::info!("✅ {} CRM is running at http://{}", config.app_name, addr);
    tracing::info!("📖 Health check: http://{}/health", addr);
    tracing::info!("🔷 API Base:     http://{}/api/v1", addr);

    // Enable SO_REUSEPORT for zero-downtime restarts
    axum::serve(listener, app)
        .await
        .expect("Server crashed unexpectedly");
}
