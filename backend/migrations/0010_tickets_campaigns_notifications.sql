-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0010: Tickets + Campaigns + Notifications + Audit Logs
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE ticket_status AS ENUM (
    'open', 'in_progress', 'pending_customer', 'resolved', 'closed'
);
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE campaign_status AS ENUM (
    'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'
);

-- ─── Tickets ──────────────────────────────────────────────────────────────────

CREATE TABLE tickets (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Ticket number (auto-generated: TKT-0001)
    ticket_number   TEXT            NOT NULL UNIQUE,

    subject         TEXT            NOT NULL,
    description     TEXT,

    -- Status + Priority
    status          ticket_status   NOT NULL DEFAULT 'open',
    priority        ticket_priority NOT NULL DEFAULT 'medium',

    -- Relationships
    contact_id      UUID            REFERENCES contacts(id) ON DELETE SET NULL,
    account_id      UUID            REFERENCES accounts(id) ON DELETE SET NULL,

    -- Assignment
    assigned_to     UUID            REFERENCES users(id) ON DELETE SET NULL,
    assigned_team   TEXT,

    -- SLA
    sla_due_at      TIMESTAMPTZ,
    sla_breached    BOOLEAN         NOT NULL DEFAULT false,

    -- Resolution
    resolved_at     TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    resolution_note TEXT,

    -- Satisfaction
    csat_score      INTEGER         CHECK (csat_score BETWEEN 1 AND 5),
    csat_comment    TEXT,

    tags            TEXT[]          NOT NULL DEFAULT '{}',

    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tickets_org_id         ON tickets(org_id);
CREATE INDEX idx_tickets_status         ON tickets(org_id, status);
CREATE INDEX idx_tickets_priority       ON tickets(org_id, priority);
CREATE INDEX idx_tickets_assigned_to    ON tickets(assigned_to);
CREATE INDEX idx_tickets_contact_id     ON tickets(contact_id);
CREATE INDEX idx_tickets_sla            ON tickets(sla_due_at) WHERE sla_breached = false;
CREATE INDEX idx_tickets_active         ON tickets(org_id) WHERE deleted_at IS NULL;

-- Ticket comments
CREATE TABLE ticket_comments (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id   UUID    NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    content     TEXT    NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,  -- internal notes vs customer-visible
    created_by  UUID    REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);

-- ─── Campaigns ────────────────────────────────────────────────────────────────

CREATE TABLE campaigns (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name            TEXT            NOT NULL,
    description     TEXT,
    status          campaign_status NOT NULL DEFAULT 'draft',
    campaign_type   TEXT            NOT NULL DEFAULT 'email',   -- "email"|"sms"|"whatsapp"

    -- Template
    template_id     UUID            REFERENCES email_templates(id) ON DELETE SET NULL,
    subject         TEXT,
    from_email      TEXT,
    from_name       TEXT,

    -- Schedule
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Stats (updated by background job)
    total_contacts  INTEGER         NOT NULL DEFAULT 0,
    sent_count      INTEGER         NOT NULL DEFAULT 0,
    open_count      INTEGER         NOT NULL DEFAULT 0,
    click_count     INTEGER         NOT NULL DEFAULT 0,
    unsubscribed    INTEGER         NOT NULL DEFAULT 0,
    bounced_count   INTEGER         NOT NULL DEFAULT 0,

    owner_id        UUID            REFERENCES users(id),
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_campaigns_org_id       ON campaigns(org_id);
CREATE INDEX idx_campaigns_status       ON campaigns(org_id, status);

-- Campaign contacts (target list)
CREATE TABLE campaign_contacts (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id     UUID    NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id      UUID    NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    email_id        UUID    REFERENCES emails(id) ON DELETE SET NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    sent_at         TIMESTAMPTZ,
    UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_contact  ON campaign_contacts(contact_id);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    type            TEXT    NOT NULL,
    -- "note_mention" | "task_assigned" | "deal_won" | "email_opened" | "ticket_assigned"

    title           TEXT    NOT NULL,
    body            TEXT,

    -- Link to the relevant entity
    entity_type     TEXT,
    entity_id       UUID,
    action_url      TEXT,

    is_read         BOOLEAN NOT NULL DEFAULT false,
    read_at         TIMESTAMPTZ,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id  ON notifications(user_id);
CREATE INDEX idx_notifications_unread   ON notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_notifications_created  ON notifications(user_id, created_at DESC);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────
-- Immutable log of all data changes. Never deleted.

CREATE TABLE audit_logs (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID    REFERENCES users(id),

    -- What changed
    action          TEXT    NOT NULL,   -- "created" | "updated" | "deleted"
    entity_type     TEXT    NOT NULL,   -- "contact" | "opportunity" | "quote"
    entity_id       UUID    NOT NULL,
    entity_name     TEXT,              -- display name at time of action

    -- Change details
    -- { "before": {"name": "Old"}, "after": {"name": "New"} }
    changes         JSONB,

    -- Context
    ip_address      TEXT,
    user_agent      TEXT,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org_id      ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user_id     ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(org_id, created_at DESC);

-- ─── API Keys (for public REST API) ──────────────────────────────────────────

CREATE TABLE api_keys (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    name            TEXT    NOT NULL,
    key_hash        TEXT    NOT NULL UNIQUE,    -- SHA-256 hash of the actual key
    key_prefix      TEXT    NOT NULL,           -- First 8 chars for display: "orb_live_"
    scopes          TEXT[]  NOT NULL DEFAULT '{}',
    -- ["contacts:read", "contacts:write", "deals:read"]

    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT true,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_org_id    ON api_keys(org_id);
CREATE INDEX idx_api_keys_key_hash  ON api_keys(key_hash);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
