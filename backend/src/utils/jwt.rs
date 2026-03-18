use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{config::Config, errors::{AppError, AppResult}};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,          // user id
    pub org: Uuid,          // org id
    pub iat: i64,           // issued at
    pub exp: i64,           // expiry
}

pub fn create_access_token(config: &Config, user_id: Uuid, org_id: Uuid) -> AppResult<String> {
    let now = Utc::now().timestamp();
    let exp = now + (config.jwt_access_token_expiry_minutes * 60);

    let claims = Claims {
        sub: user_id,
        org: org_id,
        iat: now,
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {}", e)))
}

pub fn create_refresh_token(config: &Config, user_id: Uuid, org_id: Uuid) -> AppResult<String> {
    let now = Utc::now().timestamp();
    let exp = now + (config.jwt_refresh_token_expiry_days * 86400);

    let claims = Claims {
        sub: user_id,
        org: org_id,
        iat: now,
        exp,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|e| AppError::Internal(anyhow::anyhow!("JWT encode error: {}", e)))
}

pub fn verify_jwt(config: &Config, token: &str) -> AppResult<Claims> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .map(|d| d.claims)
    .map_err(|e| {
        tracing::warn!("JWT verification failed: {}", e);
        AppError::InvalidToken
    })
}

/// SHA-256 hash a token before storing in DB (never store raw tokens)
pub fn hash_token(token: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(token.as_bytes());
    format!("{:x}", hasher.finalize())
}
