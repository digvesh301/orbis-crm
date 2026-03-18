-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0005: Contacts + Accounts
-- Core CRM entities. System fields are columns; custom fields via the engine.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE contact_status AS ENUM ('active', 'inactive');
CREATE TYPE lead_source AS ENUM (
    'website', 'referral', 'social_media', 'cold_call',
    'email_campaign', 'trade_show', 'advertisement',
    'partner', 'other'
);

-- ─── Accounts (Companies) ─────────────────────────────────────────────────────

CREATE TABLE accounts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    name            TEXT        NOT NULL,
    website         TEXT,
    phone           TEXT,
    email           TEXT,
    description     TEXT,

    -- Classification
    industry        TEXT,           -- "Pharmaceuticals", "Healthcare"
    account_type    TEXT,           -- "Customer", "Partner", "Vendor"
    annual_revenue  DECIMAL(20,2),
    employee_count  INTEGER,
    rating          TEXT,           -- "Hot", "Warm", "Cold"

    -- Location
    billing_address     JSONB   DEFAULT '{}',
    shipping_address    JSONB   DEFAULT '{}',

    -- Hierarchy (parent company)
    parent_account_id   UUID    REFERENCES accounts(id) ON DELETE SET NULL,

    -- Ownership
    owner_id        UUID        REFERENCES users(id) ON DELETE SET NULL,

    -- Status
    is_active       BOOLEAN     NOT NULL DEFAULT true,

    -- Timestamps + soft delete
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT accounts_name_length CHECK (char_length(name) BETWEEN 1 AND 255)
);

CREATE INDEX idx_accounts_org_id       ON accounts(org_id);
CREATE INDEX idx_accounts_owner_id     ON accounts(owner_id);
CREATE INDEX idx_accounts_parent       ON accounts(parent_account_id);
CREATE INDEX idx_accounts_active       ON accounts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_name         ON accounts(org_id, name);

-- Full-text search on account name (O(log n) via GIN index)
CREATE INDEX idx_accounts_fts ON accounts
    USING gin(to_tsvector('english', coalesce(name, '') || ' ' || coalesce(email, '')));

-- ─── Contacts (People) ────────────────────────────────────────────────────────

CREATE TABLE contacts (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    first_name      TEXT        NOT NULL,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    mobile          TEXT,
    title           TEXT,           -- "VP of Sales"
    department      TEXT,
    description     TEXT,
    avatar_url      TEXT,
    date_of_birth   DATE,

    -- Company link
    account_id      UUID        REFERENCES accounts(id) ON DELETE SET NULL,

    -- Classification
    lead_source     lead_source,
    status          contact_status NOT NULL DEFAULT 'active',
    tags            TEXT[]      NOT NULL DEFAULT '{}',

    -- Social
    linkedin_url    TEXT,
    twitter_handle  TEXT,

    -- Address
    address         JSONB       DEFAULT '{}',

    -- Ownership
    owner_id        UUID        REFERENCES users(id) ON DELETE SET NULL,

    -- Do Not Contact flags
    do_not_email    BOOLEAN     NOT NULL DEFAULT false,
    do_not_call     BOOLEAN     NOT NULL DEFAULT false,
    do_not_sms      BOOLEAN     NOT NULL DEFAULT false,
    unsubscribed_at TIMESTAMPTZ,

    -- Timestamps + soft delete
    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT contacts_name_length CHECK (char_length(first_name) BETWEEN 1 AND 100)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_contacts_org_id        ON contacts(org_id);
CREATE INDEX idx_contacts_owner_id      ON contacts(owner_id);
CREATE INDEX idx_contacts_account_id    ON contacts(account_id);
CREATE INDEX idx_contacts_email         ON contacts(org_id, email);
CREATE INDEX idx_contacts_status        ON contacts(org_id, status);
CREATE INDEX idx_contacts_tags          ON contacts USING gin(tags);
CREATE INDEX idx_contacts_active        ON contacts(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_created_at    ON contacts(org_id, created_at DESC);

-- Full-text search: first_name + last_name + email (O(log n))
CREATE INDEX idx_contacts_fts ON contacts
    USING gin(to_tsvector('english',
        coalesce(first_name, '') || ' ' ||
        coalesce(last_name, '') || ' ' ||
        coalesce(email, '') || ' ' ||
        coalesce(phone, '')
    ));

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
