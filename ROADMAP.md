# Orbis CRM - Development Roadmap & Status

## Project Overview
A modern, performant CRM application built with a **Rust (Axum)** backend and a **React (Vite, TypeScript)** frontend.

## Phase 1: Completed Milestones (Days 1 - 15)
- **Database Architecture**: PostgreSQL using SQLx migrations.
- **Backend Infrastructure**: Robust structure with Axum routers, JWT Authentication, custom **RBAC (Role-Based Access Control)**, and Redis for caching and rate-limiting.
- **Core App Modules (APIs & UI)**: Contacts, Leads, Deals (PipelineBoard with `@dnd-kit`), NotesTimeline, Products, Quotes, Admin Settings, Email Integration.
- **Security & Reporting**: Visual RBAC Builder, Advanced Dashboard & Reporting with deep analytics using Recharts.
- **Data & Deployment**: Data Entry/Form Modals via API, CSV Export utility, multi-stage Dockerfiles, and `docker-compose.yml` for cloud deployment.
- **Progress:** 15 / 15 Days Completed (~100% of Phase 1 Framework)

---

## Phase 2: Salesmate-Inspired Enterprise Architecture 🚀

Based on our exploration of the **Salesmate CRM**, we are officially launching Phase 2 of the roadmap. The goal is to aggressively upgrade our application architecture to match and exceed the modular, highly dynamic, and data-dense enterprise experience observed.

### Module Breakdown & Feature Depth

#### 1. Global Navigation & Workspace Layout
- **Sidebar Modules**: The navigation must expand to support a comprehensive suite: `Dashboard`, `Contacts`, `Companies`, `Activities (Tasks/Calls)`, `Deals`, `Products`, `Tickets`, `Quotes`, `Messenger`, `Smart Flow (Automation)`, `Execution Flows`, `Survey`, `Reports`, `Knowledge Base`, and `Settings`.
- **Intelligent Header**: 
  - Quick Search bar spanning all entities (Contacts, Deals, etc.).
  - Notification Center (Bell icon).
  - "Sandy" / AI Chatbot shortcut for actionable AI insight.
  - Theme customizer ("System Default") and user availability ("Away + Reassign conversations").

#### 2. Advanced Data Grid (The Listing Screen)
*Reference: `/app/contacts/list`*
- **Saved Views System**: Implement user-specific saved tab views (e.g., "All Contacts", "My Contacts", "New this week").
- **Robust Table Controls**:
  - **Column Management** ("View Settings"): Re-order, hide, and pin columns dynamically.
  - **Inline Editing**: Double-click data grid cells to update fields seamlessly without opening modals.
  - **Dynamic Columns**: Tags/Select modules with color-coordinated badges (e.g., Deal, Company, Create Activity).
- **Advanced Filtering Engine**: A slide-out "Filters" sidebar supporting complex `AND/OR` criteria across custom and standard fields.
- **Mass Actions Architecture**: Checkboxes enabling bulk functionalities hidden behind an "Actions" dropdown:
  - Mass Transfer, Mass Delete, Mass Update.
  - Merge Duplicates.
  - Excel/CSV Import and Google Export.
- **Pagination & Scaling**: 25/50/100 items per page with instantaneous lazy loading and skeleton states.

#### 3. The 360° Detail Dashboard Container
- **Modular 3-Column Grid**: Moving away from single-column scrolling to a densely packed, information-rich view.
- **Left Panel (Profile Context)**:
  - Account/Company linkage.
  - Granular details (Location, Status, Timezone, Social Links, Custom Fields).
  - Tags and tracking (Surveys/Forms).
- **Center Engine (Action & History)**:
  - **Multi-tab Composer**: A unified widget to type a `Note`, compose an `Email`, `Log a Call`, or set a `Task` instantaneously.
  - **Unified Timeline Activity Stream**: A filterable timeline blending notes, emails, field updates, and lifecycle stage changes.
- **Right Panel (Related Ecosystem)**:
  - Active Pipeline (Deals summary).
  - Related Products / Purchases.
  - Duplicate Contact detection alerts.

#### 4. Enterprise Field & Module Customization (Setup Engine)
*Reference: `/app/setup/modules`*
- **Advanced Data Types**: System must support structured data fields including Text, Integer, Decimal, Multi-Select Picklists, Boolean, Currency, Formula fields, and Relational Lookups.
- **Field Dependency Logic**: Ability to link parent/child picklist fields (e.g., selecting "Country" filters the "State" options).
- **Validation Rules Builder**: Define constraints to prevent saving invalid records (e.g., "Deal Value cannot be less than 0") with custom error messages.
- **Drag-and-Drop Page Layout Builder**: Provide Admins an interface to construct visual layouts using a Widget ecosystem. Allow assigning specific visual layouts mapped to specific User Roles or Teams.

#### 5. Workflow & "Smart Flow" Automation (New)
- Define triggers and actions to automate repetitive tasks (e.g., "When Lead status changes to 'Qualified', create a Deal and assign a Task").
- Build "Execution Flows" for multi-step drip campaigns.

---

### Phase 2 Implementation Roadmap (Next Steps)

#### Sprint 1: The Enterprise Data Grid Ecosystem
- [ ] **Data Grid Core Upgrade**: Integrate a robust virtualized table (e.g., TanStack Table) capable of handling inline editing, dynamic column sorting, and pinned columns.
- [ ] **Views API**: Create backend endpoints (`GET /api/views`) to save, fetch, and load tabbed Filter conditions specific to users.
- [ ] **Mass Actions Hook**: Implement custom React hooks to process bulk IDs for `DELETE` and `PUT` (transfer) operations securely.

#### Sprint 2: The Universal Filter & Search Engine
- [ ] **Advanced Filter Sidebar**: Build the UI for nested `AND/OR` logical querying.
- [ ] **Backend Query Parser**: Revamp Rust SQL handlers to accept dynamic JSON filter logic and translate it safely into SQL `WHERE` clauses (SQLx QueryBuilder).
- [ ] **Global Quick Search**: Implement a Redis-backed or Postgres Full-Text Search index spanning `Contacts`, `Accounts`, and `Deals` searchable from the top header.

#### Sprint 3: The 360° Detail Dashboard & Composer
- [ ] **Component Refactor**: Implement the 3-column masonry grid across `DealDetail`, `AccountDetail`, and `ContactDetail`.
- [ ] **Multi-Tab Composer**: Merge the Email modal, Notes input, and Call logging into a single, snappy inline component.
- [ ] **Unified Activity API**: Create a backend endpoint that aggregates rows from `notes`, `emails`, `audit_logs`, and `activities` sorted by timestamp to feed the Timeline stream.

#### Sprint 4: Smart Activities & Messenger
- [ ] **Task/Activity Module**: Build out the CRUD and UI for assigning Tasks and logging Calls.
- [ ] **Messenger Setup**: Scaffold real-time chat/notification functionality using WebSockets in Axum.
- [ ] **Duplicate Detection**: Write a background Rust job to flag potentially duplicate contacts based on fuzzy matching (Names/Emails).

#### Sprint 5: Enterprise Module Customization (The Setup Engine)
- [ ] **Custom Fields DB Architecture**: Design PostgreSQL relational tables allowing Admins to define new Data Types mapped to existing core modules dynamically (`custom_fields`, `field_dependencies`, `module_layouts`).
- [ ] **Validation Engine**: Build a rule engine in Rust to pre-validate incoming JSON payloads against user-defined business constraints (Validation Rules).
- [ ] **Visual Layout Builder**: Create a drag-and-drop workspace in React allowing Role-based assignment of components and data-fields to custom module views.

---

## How to Resume
1. Start PostgreSQL & Redis (`docker compose up -d`).
2. Backend: `cd backend && cargo run`.
3. Frontend: `cd frontend && npm run dev`.
