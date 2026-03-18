use axum::{
    routing::{get, post, put, delete},
    Router,
};
use crate::state::AppState;
use crate::handlers::views::{list_custom_views, create_custom_view, update_custom_view, delete_custom_view};

pub fn router(state: AppState) -> Router<AppState> {
    Router::new()
        .route("/", get(list_custom_views).post(create_custom_view))
        .route("/:id", put(update_custom_view).delete(delete_custom_view))
        .with_state(state)
}
