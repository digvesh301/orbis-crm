use std::env;

/// Central application configuration loaded from environment variables.
/// ALL app name references come from here — rename in `.env` only.
#[derive(Debug, Clone)]
pub struct Config {
    // ─── App ──────────────────────────────────────────────
    pub app_name: String,
    pub app_env: AppEnv,
    pub app_url: String,
    pub frontend_url: String,

    // ─── Database ─────────────────────────────────────────
    pub database_url: String,
    pub database_max_connections: u32,
    pub database_min_connections: u32,
    pub database_acquire_timeout_secs: u64,

    // ─── Redis ────────────────────────────────────────────
    pub redis_url: String,

    // ─── JWT ──────────────────────────────────────────────
    pub jwt_secret: String,
    pub jwt_access_token_expiry_minutes: i64,
    pub jwt_refresh_token_expiry_days: i64,

    // ─── Email ────────────────────────────────────────────
    pub resend_api_key: String,
    pub email_from_address: String,
    pub email_from_name: String,

    // ─── Storage ──────────────────────────────────────────
    pub storage_provider: String,
    pub storage_local_path: String,

    // ─── Server ───────────────────────────────────────────
    pub server_host: String,
    pub server_port: u16,
    pub request_timeout_secs: u64,

    // ─── Rate Limits ──────────────────────────────────────
    pub rate_limit_unauth: u64,
    pub rate_limit_auth: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AppEnv {
    Development,
    Staging,
    Production,
}

impl AppEnv {
    pub fn is_production(&self) -> bool {
        *self == AppEnv::Production
    }

    pub fn is_development(&self) -> bool {
        *self == AppEnv::Development
    }
}

impl Config {
    /// Load config from environment variables.
    /// Panics early with a clear message if a required variable is missing.
    pub fn load() -> Self {
        Self {
            // ─── App ──────────────────────────────────────
            app_name: env_required("APP_NAME"),
            app_env: match env_optional("APP_ENV", "development").as_str() {
                "production" => AppEnv::Production,
                "staging" => AppEnv::Staging,
                _ => AppEnv::Development,
            },
            app_url: env_optional("APP_URL", "http://localhost:8080"),
            frontend_url: env_optional("FRONTEND_URL", "http://localhost:5173"),

            // ─── Database ─────────────────────────────────
            database_url: env_required("DATABASE_URL"),
            database_max_connections: env_parse("DATABASE_MAX_CONNECTIONS", 20),
            database_min_connections: env_parse("DATABASE_MIN_CONNECTIONS", 5),
            database_acquire_timeout_secs: env_parse("DATABASE_ACQUIRE_TIMEOUT_SECS", 3),

            // ─── Redis ────────────────────────────────────
            redis_url: env_required("REDIS_URL"),

            // ─── JWT ──────────────────────────────────────
            jwt_secret: env_required("JWT_SECRET"),
            jwt_access_token_expiry_minutes: env_parse("JWT_ACCESS_TOKEN_EXPIRY_MINUTES", 15),
            jwt_refresh_token_expiry_days: env_parse("JWT_REFRESH_TOKEN_EXPIRY_DAYS", 7),

            // ─── Email ────────────────────────────────────
            resend_api_key: env_optional("RESEND_API_KEY", ""),
            email_from_address: env_optional("EMAIL_FROM_ADDRESS", "no-reply@orbis.com"),
            email_from_name: env_optional("EMAIL_FROM_NAME", "Orbis CRM"),

            // ─── Storage ──────────────────────────────────
            storage_provider: env_optional("STORAGE_PROVIDER", "local"),
            storage_local_path: env_optional("STORAGE_LOCAL_PATH", "./uploads"),

            // ─── Server ───────────────────────────────────
            server_host: env_optional("SERVER_HOST", "0.0.0.0"),
            server_port: env_parse("SERVER_PORT", 8080),
            request_timeout_secs: env_parse("REQUEST_TIMEOUT_SECS", 30),

            // ─── Rate Limits ──────────────────────────────
            rate_limit_unauth: env_parse("RATE_LIMIT_PER_MINUTE_UNAUTH", 100),
            rate_limit_auth: env_parse("RATE_LIMIT_PER_MINUTE_AUTH", 300),
        }
    }

    /// Get the display name for the app (used in emails, UI responses, logs)
    pub fn app_display_name(&self) -> &str {
        &self.app_name
    }

    /// Get full server address for binding
    pub fn server_addr(&self) -> String {
        format!("{}:{}", self.server_host, self.server_port)
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn env_required(key: &str) -> String {
    env::var(key).unwrap_or_else(|_| {
        panic!(
            "❌ Required environment variable '{}' is not set. Check your .env file.",
            key
        )
    })
}

fn env_optional(key: &str, default: &str) -> String {
    env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_parse<T: std::str::FromStr>(key: &str, default: T) -> T
where
    T::Err: std::fmt::Debug,
{
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
