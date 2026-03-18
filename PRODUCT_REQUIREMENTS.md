# Orbis CRM - Deep Product Requirements

This document captures the business requirements, feature scope, and workflows for the Orbis CRM system, enabling consistent execution by agents.

## Primary Objective
Provide sales, marketing, and support teams a unified SaaS platform to manage customer relationships efficiently. Support full data visibility through a "360-degree" view of every Account, Contact, and active Deal.

## 1. Organizations & Team Setup (Admin Module)
- **Organizations**: Users are grouped into isolated Multi-tenant Orgs. Data is strictly cordoned off per org.
- **Users**: Employees invited to the org platform.
- **Profiles & RBAC (Role-Based Access Control)**: Admins create dynamic "Profiles" (e.g., "Sales Rep", "Manager"). Each profile defines granular access combinations across every module (e.g., Read Deals, Write Contacts, Delete Products). Users are mapped to precisely one Profile per Org.

## 2. Pre-Sales: Lead Management
- **Leads**: Raw prospects, individuals, or businesses that have shown interest but haven't been qualified. Fields include source, status (new, working, qualified, unqualified), and basic contact info.
- **Lead Qualification Workflow**: When a lead is "qualified", it goes through a conversion endpoint that:
  a. Transforms the Lead into a formal `Contact`.
  b. Links that Contact to a new or existing `Account`.
  c. (Optionally) creates an `Opportunity/Deal` tied to the Account.
  - Doing this marks the original Lead record as "converted".

## 3. Core CRM Data: Accounts & Contacts
- **Accounts**: B2B entities tracking company domains, physical addresses, size, and industry.
- **Contacts**: Individual people linked to an Account. A Contact has personal contact details (phone, email) and a complete timeline view grouping everything related to them.
- **Contact Details (360-View)**: Selecting a Contact opens a specialized UI that organizes data via Tabs (Details, Deals linked to that contact, Notes, Emails).

## 4. Sales Pipeline: Opportunities & Deals
- **Opportunities (Deals)**: Qualified sales projects with an estimated `amount`, `close_date`, `probability`, and `stage_id`.
- **Pipeline Stages (Kanban)**: Highly visual drag-and-drop board where Deals sit inside user/admin-defined stages (e.g., Discovery -> Demo -> Proposal -> Negotiation -> Closed Won/Lost). Moving a card triggers a backend update on `stage_id`.
- **Deal Detail View**: Every Deal acts as a collaborative hub containing a timeline, associated contacts, attached products, and internal team Notes.

## 5. Cataloging & Invoicing: Products & Quotes
- **Products**: The master catalog for goods/services the Org sells, complete with SKU tracking, categorization, and default pricing.
- **Quotes (Proposals)**: Standardized pricing documents assembled from Product lines. Quotes are tied to Deals and Accounts and track statuses (Draft -> Sent -> Approved).

## 6. Unified Communications
- **Emails**: Integration capabilities tracking sent/received external comms tied directly to the relevant deal, lead, or contact natively within the platform.
- **Internal Notes**: A timeline built into most major views (Leads, Contacts, Deals). Allows users to `@mention` colleagues and log chronologically sorted progress updates without generating email clutter. Support pinning priority notes.

## Future Phases (See `ROADMAP.md`)
- Advanced Reporting and forecasting matrices.
- Automation triggers and bulk workflows.
- Extensibility via Custom App Modules.
