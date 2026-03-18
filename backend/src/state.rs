use crate::config::Config;
use sqlx::PgPool;
use std::sync::Arc;

/// Shared application state — passed to every route handler via Axum's State extractor.
/// Wrapped in Arc so it can be cloned cheaply across async tasks.
#[derive(Clone)]
pub struct AppState {
    /// Database connection pool (SQLx + PostgreSQL)
    pub db: PgPool,

    /// Redis connection manager
    pub redis: redis::aio::ConnectionManager,

    /// Application configuration (loaded from .env)
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(db: PgPool, redis: redis::aio::ConnectionManager, config: Config) -> Self {
        Self {
            db,
            redis,
            config: Arc::new(config),
        }
    }

}
