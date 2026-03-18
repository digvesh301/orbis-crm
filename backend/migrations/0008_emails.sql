-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0008: Email System
-- Gmail/Outlook integration, email threads, tracking, and templates
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'smtp', 'resend');
CREATE TYPE email_direction AS ENUM ('outbound', 'inbound');
CREATE TYPE email_status AS ENUM (
    'draft', 'scheduled', 'queued', 'sent', 'delivered', 'bounced', 'failed'
);

-- ─── Email Integrations ───────────────────────────────────────────────────────

CREATE TABLE email_integrations (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    provider        email_provider  NOT NULL,
    email_address   TEXT            NOT NULL,
    display_name    TEXT,

    -- OAuth tokens (encrypted at app level before storing)
    access_token    TEXT,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,

    -- SMTP settings (for custom SMTP)
    smtp_host       TEXT,
    smtp_port       INTEGER,
    smtp_username   TEXT,
    smtp_password   TEXT,           -- encrypted
    smtp_use_tls    BOOLEAN NOT NULL DEFAULT true,

    is_active           BOOLEAN NOT NULL DEFAULT true,
    last_synced_at      TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, email_address)
);

CREATE INDEX idx_email_integrations_user_id ON email_integrations(user_id);
CREATE INDEX idx_email_integrations_org_id  ON email_integrations(org_id);

-- ─── Email Threads ────────────────────────────────────────────────────────────

CREATE TABLE email_threads (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    subject         TEXT    NOT NULL,

    -- Polymorphic link to CRM record
    linked_module   TEXT,
    linked_record_id UUID,

    participants    JSONB   NOT NULL DEFAULT '[]',
    -- [{"email": "...", "name": "..."}, ...]

    email_count     INTEGER NOT NULL DEFAULT 0,
    last_email_at   TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_threads_org_id   ON email_threads(org_id);
CREATE INDEX idx_email_threads_linked   ON email_threads(linked_module, linked_record_id);

-- ─── Emails ───────────────────────────────────────────────────────────────────

CREATE TABLE emails (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    thread_id       UUID            REFERENCES email_threads(id) ON DELETE SET NULL,
    integration_id  UUID            REFERENCES email_integrations(id) ON DELETE SET NULL,

    -- Direction and status
    direction       email_direction NOT NULL DEFAULT 'outbound',
    status          email_status    NOT NULL DEFAULT 'draft',

    -- Addressing
    from_email      TEXT            NOT NULL,
    from_name       TEXT,
    to_emails       JSONB           NOT NULL DEFAULT '[]',
    cc_emails       JSONB           NOT NULL DEFAULT '[]',
    bcc_emails      JSONB           NOT NULL DEFAULT '[]',
    reply_to        TEXT,

    -- Content
    subject         TEXT            NOT NULL,
    body_html       TEXT,
    body_text       TEXT,
    template_id     UUID,           -- FK added after email_templates table

    -- Scheduling
    scheduled_at    TIMESTAMPTZ,
    sent_at         TIMESTAMPTZ,

    -- Tracking (open/click via pixel)
    tracking_id     UUID            NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    open_count      INTEGER         NOT NULL DEFAULT 0,
    first_opened_at TIMESTAMPTZ,
    last_opened_at  TIMESTAMPTZ,
    click_count     INTEGER         NOT NULL DEFAULT 0,

    -- CRM link
    linked_module   TEXT,
    linked_record_id UUID,

    -- External mail system IDs (for threading)
    external_id     TEXT,           -- Gmail/Outlook message ID
    message_id      TEXT,           -- RFC 822 Message-ID header
    in_reply_to     TEXT,

    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_emails_org_id          ON emails(org_id);
CREATE INDEX idx_emails_thread_id       ON emails(thread_id);
CREATE INDEX idx_emails_linked          ON emails(linked_module, linked_record_id);
CREATE INDEX idx_emails_status          ON emails(org_id, status);
CREATE INDEX idx_emails_tracking_id     ON emails(tracking_id);
CREATE INDEX idx_emails_scheduled       ON emails(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_emails_created_at      ON emails(org_id, created_at DESC);

-- ─── Email Tracking Events ────────────────────────────────────────────────────

CREATE TABLE email_tracking_events (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id    UUID    NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    event_type  TEXT    NOT NULL,   -- "opened" | "clicked" | "bounced" | "unsubscribed"
    ip_address  TEXT,
    user_agent  TEXT,
    link_url    TEXT,               -- for click events
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tracking_email_id  ON email_tracking_events(email_id);
CREATE INDEX idx_tracking_type      ON email_tracking_events(email_id, event_type);
CREATE INDEX idx_tracking_occurred  ON email_tracking_events(occurred_at DESC);

-- ─── Email Attachments ────────────────────────────────────────────────────────

CREATE TABLE email_attachments (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id    UUID    NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    file_id     UUID    REFERENCES files(id) ON DELETE SET NULL,   -- existing CRM file

    name        TEXT    NOT NULL,
    mime_type   TEXT    NOT NULL,
    size_bytes  BIGINT  NOT NULL,
    storage_key TEXT    NOT NULL
);

CREATE INDEX idx_email_attachments_email_id ON email_attachments(email_id);

-- ─── Email Templates ──────────────────────────────────────────────────────────

CREATE TABLE template_categories (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,   -- "Follow Up", "Proposal"
    color       TEXT,
    icon        TEXT,
    is_system   BOOLEAN NOT NULL DEFAULT false,
    position    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(org_id, name)
);

CREATE INDEX idx_template_categories_org_id ON template_categories(org_id);

CREATE TABLE email_templates (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id     UUID    REFERENCES template_categories(id) ON DELETE SET NULL,

    -- Identity
    name            TEXT    NOT NULL,
    description     TEXT,
    thumbnail_url   TEXT,

    -- Content
    subject         TEXT    NOT NULL,
    body_html       TEXT    NOT NULL,
    body_text       TEXT,

    -- Variables used in this template: ["contact.first_name", "deal.name"]
    variables       JSONB   NOT NULL DEFAULT '[]',

    -- Visibility: personal | team | org_wide
    visibility      TEXT    NOT NULL DEFAULT 'personal',
    is_system       BOOLEAN NOT NULL DEFAULT false,

    -- Analytics (updated via trigger or background job)
    used_count      INTEGER NOT NULL DEFAULT 0,
    avg_open_rate   DECIMAL(5,4),
    avg_click_rate  DECIMAL(5,4),

    -- Versioning
    version         INTEGER NOT NULL DEFAULT 1,
    parent_id       UUID    REFERENCES email_templates(id) ON DELETE SET NULL,
    is_latest       BOOLEAN NOT NULL DEFAULT true,

    created_by      UUID    REFERENCES users(id),
    updated_by      UUID    REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_email_templates_org_id     ON email_templates(org_id);
CREATE INDEX idx_email_templates_category   ON email_templates(category_id);
CREATE INDEX idx_email_templates_creator    ON email_templates(created_by);
CREATE INDEX idx_email_templates_latest     ON email_templates(org_id) WHERE is_latest = true;
CREATE INDEX idx_email_templates_active     ON email_templates(org_id) WHERE deleted_at IS NULL;

-- Now add the FK from emails → email_templates
ALTER TABLE emails
    ADD CONSTRAINT fk_emails_template_id
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL;

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_email_integrations_updated_at
    BEFORE UPDATE ON email_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
