use crate::config::Config;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

/// Create a finely-tuned PostgreSQL connection pool.
///
/// Performance design:
///  - min_connections = pre-warmed, zero cold-start latency
///  - statement_cache_capacity = 100 prepared statements per connection
///    → eliminates query planning overhead after first execution (O(1) re-execute)
///  - test_before_acquire = false → saves 1 round-trip per request
///  - idle_timeout = 10min (reclaim DB resources)
///  - max_lifetime = 30min (rotate to prevent stale connections)
pub async fn create_pool(config: &Config) -> PgPool {
    PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .min_connections(config.database_min_connections)
        .acquire_timeout(Duration::from_secs(config.database_acquire_timeout_secs))
        // Skip ping on every connection acquire — saves one round-trip per request
        .test_before_acquire(false)
        // Recycle idle connections after 10 minutes
        .idle_timeout(Duration::from_secs(600))
        // Rotate connections every 30 minutes (prevent PostgreSQL stale state)
        .max_lifetime(Duration::from_secs(1800))
        .connect(&config.database_url)
        .await
        .unwrap_or_else(|e| panic!("❌ PostgreSQL connect failed: {}", e))
}
