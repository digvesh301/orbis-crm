# Orbis CRM - Architecture & Technical Design

## 1. Technology Stack
- **Backend Environment**: Rust (1.x+)
  - **Framework**: Axum (web framework) & Tokio (async runtime)
  - **Database**: PostgreSQL (via SQLx for async, compile-time checked queries)
  - **Caching/Rate-Limiting**: Redis (via `redis` crate)
  - **Authentication**: JWT (JSON Web Tokens via `jsonwebtoken` crate)
  - **Email**: `lettre` (stubbed/SMTP)
- **Frontend Environment**: Node & npm
  - **Framework**: React 18+ via Vite (TypeScript)
  - **Styling**: Tailwind CSS & Lucide React (Icons)
  - **State Management & Data Fetching**: TanStack Query (React Query)
  - **Routing**: React Router DOM (`react-router-dom`)
  - **Data Visualization**: Recharts (for Dashboard KPIs)
  - **Complex UI**: `@dnd-kit/core` (for Kanban board drag-and-drop)

## 2. Multi-Tenancy Engine
Orbis is a multi-tenant B2B application.
- All core tables contain an `org_id` column referencing the `organizations` table.
- Row-level isolation is enforced via the Rust Backend in every SQLx query (e.g., `WHERE ... AND org_id = $auth.org_id`).
- Incoming requests provide a JWT containing both `user_id` and `org_id`.

## 3. Backend Architecture
The backend is structured to promote separation of concerns:
- **`src/main.rs`**: Application entry point. Configures DB pools, Redis, standard middlewares (CORS, TraceLayer), and binds the server.
- **`src/state.rs`**: Holds the `AppState` struct (Postgres Pool, Redis Pool, config) passed to all handlers.
- **`src/routes/mod.rs`**: Central router definition splitting into modules (e.g., `/api/v1/deals`, `/api/v1/auth`).
- **`src/handlers/`**: Core API logic categorized by CRM module (e.g., `deals.rs`, `contacts.rs`, `admin.rs`). Handlers parse requests, execute SQLx queries, and return standardized JSON responses.
- **`src/middleware/`**:
  - `auth.rs`: Validates JWTs and injects `AuthUser` extractor into request state.
  - `permissions.rs`: RBAC (Role-Based Access Control) macro generator. Extracts user permissions from the DB (or Cache) and blocks unauthorized requests.
- **`src/errors/`**: Centralized `AppError` enum handling SQL constraints, internal errors, validation formatting, and `IntoResponse` logic.

## 4. Frontend Architecture
The Vite React app is built around modular pages and shared components:
- **`src/App.tsx`**: Top-level routing. Private routes are gated by auth checks. Top-level routes include `/dashboard`, `/pipeline`, `/deals/:id`, `/contacts`, etc., dynamically lazy-loaded.
- **`src/components/layout/AppLayout.tsx`**: A responsive, sidebar-driven navigation wrapper surrounding page content.
- **`src/pages/`**: Feature-specific views.
  - E.g., `pipeline/PipelineBoard.tsx` holds the complex drag-and-drop logic for deal progression.
  - `deals/DealDetail.tsx` provides the specialized 360-degree view containing tabs for Notes, Quotes, and Emails.
- **`src/lib/api.ts`**: The Axios instance wrapper pre-configured to handle authorization headers/cookies and basic error interception.

## 5. Database Schema Overview
- **Core Entities**: `organizations`, `users`, `profiles` (Roles).
- **CRM Data**: `accounts` (Businesses), `contacts` (People), `leads` (Prospects), `opportunities` (Deals), `pipeline_stages`.
- **Sales Flow**: `products`, `quotes`, `quote_line_items`.
- **Communications/History**: `notes`, `emails`, `activities`.
- **Migrations**: Standard SQLx migration files (`migrations/xxx_name.sql`) manage schema state changes.

## 6. Security Implementation
- Password Hashing via Argon2.
- Hardcoded or dynamic permission profiles dictate what endpoint methods users can access (e.g., `#[route_layer(middleware::from_fn_with_state(state.clone(), require_permissions!(ContactsWrite)))]`).
- Extracted JWT yields standard state context ensuring cross-tenant data leaks are impossible at the framework level.
