/// Redis Cache Utility
///
/// Wraps Redis get/set/del with typed, ergonomic helpers.
///
/// Time complexity: O(1) per get/set (Redis hash lookup)
/// Space complexity: O(n) where n = number of cached keys
///
/// Cache TTLs are chosen deliberately:
///   - user:{id}       → 5 min  (profile changes are rare)
///   - permissions:{id} → 1 min (permission changes must be near-instant)
///   - org:{id}        → 10 min (org settings rarely change)
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use crate::{errors::AppResult, state::AppState};

/// Get a cached value. Returns None on cache miss or deserialization error.
pub async fn cache_get<T: DeserializeOwned>(state: &AppState, key: &str) -> Option<T> {
    let mut conn = state.redis.clone();
    let raw: Option<String> = conn.get(key).await.ok()?;
    raw.as_deref().and_then(|s| serde_json::from_str(s).ok())
}

/// Set a cached value with TTL in seconds.
pub async fn cache_set<T: Serialize>(
    state: &AppState,
    key: &str,
    value: &T,
    ttl_secs: u64,      // redis 0.25 set_ex expects u64
) -> AppResult<()> {
    let serialized = serde_json::to_string(value)
        .map_err(|e| crate::errors::AppError::Internal(anyhow::anyhow!("Cache serialize: {}", e)))?;
    let mut conn = state.redis.clone();
    conn.set_ex::<_, _, ()>(key, serialized, ttl_secs).await
        .map_err(|e| crate::errors::AppError::Internal(anyhow::anyhow!("Cache set: {}", e)))?;
    Ok(())
}

/// Delete a cached key (call on update/delete to invalidate).
pub async fn cache_del(state: &AppState, key: &str) {
    let mut conn = state.redis.clone();
    let _: Result<(), _> = conn.del(key).await;
}

/// Delete multiple keys at once (batch invalidation).
pub async fn cache_del_many(state: &AppState, keys: &[&str]) {
    if keys.is_empty() { return; }
    let mut conn = state.redis.clone();
    let _: Result<(), _> = conn.del(keys).await;
}

// ─── Cache key builders ────────────────────────────────────────────────────────
// Centralized here so key format is consistent across the whole codebase

pub fn key_user(user_id: uuid::Uuid) -> String {
    format!("user:{}", user_id)
}

pub fn key_org(org_id: uuid::Uuid) -> String {
    format!("org:{}", org_id)
}

pub fn key_permissions(user_id: uuid::Uuid) -> String {
    format!("perms:{}", user_id)
}

pub fn key_rate_limit(ip: &str, endpoint: &str) -> String {
    format!("rl:{}:{}", endpoint, ip)
}
