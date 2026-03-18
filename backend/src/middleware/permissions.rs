use axum::{
    async_trait,
    extract::{FromRequestParts, State},
    http::request::Parts,
};
use std::marker::PhantomData;

use crate::{
    errors::AppError,
    middleware::auth::AuthUser,
    state::AppState,
};

// ─── PermissionRequirement Trait ─────────────────────────────────────────────
// Define a trait that each permission struct will implement.
pub trait PermissionRequirement: Send + Sync + 'static {
    fn module() -> &'static str;
    fn action() -> &'static str;
}

// ─── Extractor Struct ────────────────────────────────────────────────────────
// This struct will be used as a parameter in route handlers to enforce RBAC.
pub struct RequirePermission<P: PermissionRequirement>(pub PhantomData<P>);

#[async_trait]
impl<P: PermissionRequirement> FromRequestParts<AppState> for RequirePermission<P> {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // 1. First ensure the user is authenticated via JWT middleware claims
        let auth = AuthUser::from_request_parts(parts, state).await?;

        // 2. Fetch the User's Profile JSON permissions from the DB
        let record = sqlx::query!(
            r#"
            SELECT p.is_system, p.permissions 
            FROM users u
            JOIN profiles p ON u.profile_id = p.id
            WHERE u.id = $1 AND u.org_id = $2 AND u.deleted_at IS NULL
            "#,
            auth.user_id,
            auth.org_id
        )
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch profile permissions: {}", e);
            AppError::Internal(anyhow::anyhow!("Database error fetching permissions"))
        })?
        .ok_or_else(|| {
            // User has no valid profile assigned or was deleted
            AppError::Forbidden
        })?;

        // 3. System profiles implicitly have full root access (e.g., initial Admin profile)
        if record.is_system {
            return Ok(RequirePermission(PhantomData));
        }

        // 4. Check JSONB permissions
        // The structure is expected to be: { "contacts": ["read", "write", "delete"], "deals": ["read"] }
        let module = P::module();
        let action = P::action();

        if let Some(mod_perms) = record.permissions.get(module) {
            if let Some(actions) = mod_perms.as_array() {
                // If the array contains the required action, or a wildcard "*"
                if actions.iter().filter_map(|v| v.as_str()).any(|v| v == action || v == "*") {
                    return Ok(RequirePermission(PhantomData));
                }
            }
        }

        // 5. If no match was found, reject access
        tracing::warn!("User {} rejected from '{}' action on '{}' module", auth.user_id, action, module);
        Err(AppError::Forbidden)
    }
}

// ─── Reusable Permission Definitions (Macros/Structs) ────────────────────────

macro_rules! define_permission {
    ($struct_name:ident, $module:expr, $action:expr) => {
        pub struct $struct_name;
        impl PermissionRequirement for $struct_name {
            fn module() -> &'static str { $module }
            fn action() -> &'static str { $action }
        }
    };
}

// Global Definitions for Core Entities
define_permission!(ContactsRead,   "contacts", "read");
define_permission!(ContactsWrite,  "contacts", "write");
define_permission!(ContactsDelete, "contacts", "delete");

define_permission!(AccountsRead,   "accounts", "read");
define_permission!(AccountsWrite,  "accounts", "write");
define_permission!(AccountsDelete, "accounts", "delete");

define_permission!(LeadsRead,      "leads", "read");
define_permission!(LeadsWrite,     "leads", "write");
define_permission!(LeadsConvert,   "leads", "convert"); // specific logic action
define_permission!(LeadsDelete,    "leads", "delete");

define_permission!(DealsRead,      "deals", "read");
define_permission!(DealsWrite,     "deals", "write");
define_permission!(DealsDelete,    "deals", "delete");

define_permission!(ProductsRead,   "products", "read");
define_permission!(ProductsWrite,  "products", "write");
define_permission!(ProductsDelete, "products", "delete");

define_permission!(QuotesRead,     "quotes", "read");
define_permission!(QuotesWrite,    "quotes", "write");
define_permission!(QuotesDelete,   "quotes", "delete");

define_permission!(NotesRead,      "notes", "read");
define_permission!(NotesWrite,     "notes", "write");
define_permission!(NotesDelete,    "notes", "delete");
