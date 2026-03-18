-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0006: Leads + Pipeline + Opportunities
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'qualified', 'unqualified', 'converted'
);

CREATE TYPE opportunity_stage_type AS ENUM (
    'open', 'won', 'lost'
);

-- ─── Leads ────────────────────────────────────────────────────────────────────

CREATE TABLE leads (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    first_name      TEXT        NOT NULL,
    last_name       TEXT,
    email           TEXT,
    phone           TEXT,
    company         TEXT,
    title           TEXT,
    website         TEXT,
    description     TEXT,

    -- Classification
    status          lead_status NOT NULL DEFAULT 'new',
    lead_source     lead_source,
    rating          TEXT,           -- "Hot", "Warm", "Cold"
    tags            TEXT[]      NOT NULL DEFAULT '{}',

    -- Estimated value
    estimated_value DECIMAL(20,2),
    currency        TEXT        DEFAULT 'INR',

    -- Conversion
    is_converted        BOOLEAN     NOT NULL DEFAULT false,
    converted_at        TIMESTAMPTZ,
    converted_contact_id UUID       REFERENCES contacts(id) ON DELETE SET NULL,
    converted_account_id UUID       REFERENCES accounts(id) ON DELETE SET NULL,
    converted_by        UUID        REFERENCES users(id),

    -- Address
    address         JSONB       DEFAULT '{}',

    -- Ownership
    owner_id        UUID        REFERENCES users(id) ON DELETE SET NULL,

    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT leads_name_length CHECK (char_length(first_name) BETWEEN 1 AND 100)
);

CREATE INDEX idx_leads_org_id          ON leads(org_id);
CREATE INDEX idx_leads_owner_id        ON leads(owner_id);
CREATE INDEX idx_leads_status          ON leads(org_id, status);
CREATE INDEX idx_leads_converted       ON leads(org_id, is_converted);
CREATE INDEX idx_leads_active          ON leads(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_fts ON leads
    USING gin(to_tsvector('english',
        coalesce(first_name,'') || ' ' ||
        coalesce(last_name,'') || ' ' ||
        coalesce(email,'') || ' ' ||
        coalesce(company,'')
    ));

-- ─── Pipeline Stages ──────────────────────────────────────────────────────────

CREATE TABLE pipeline_stages (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name            TEXT        NOT NULL,       -- "Prospecting", "Proposal", "Closed Won"
    stage_type      opportunity_stage_type NOT NULL DEFAULT 'open',
    probability     INTEGER     NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
    position        INTEGER     NOT NULL DEFAULT 0,
    color           TEXT,

    is_default      BOOLEAN     NOT NULL DEFAULT false,
    is_system       BOOLEAN     NOT NULL DEFAULT false,

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(org_id, name)
);

CREATE INDEX idx_pipeline_stages_org_id     ON pipeline_stages(org_id);
CREATE INDEX idx_pipeline_stages_position   ON pipeline_stages(org_id, position);

-- ─── Opportunities (Deals) ────────────────────────────────────────────────────

CREATE TABLE opportunities (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    name            TEXT        NOT NULL,
    description     TEXT,

    -- Relationships
    contact_id      UUID        REFERENCES contacts(id) ON DELETE SET NULL,
    account_id      UUID        REFERENCES accounts(id) ON DELETE SET NULL,
    stage_id        UUID        NOT NULL REFERENCES pipeline_stages(id),

    -- Value
    amount          DECIMAL(20,2),
    currency        TEXT        DEFAULT 'INR',
    probability     INTEGER     CHECK (probability BETWEEN 0 AND 100),

    -- Dates
    close_date      DATE,
    actual_close_date DATE,

    -- Source
    lead_source     lead_source,
    lead_id         UUID        REFERENCES leads(id) ON DELETE SET NULL,

    -- Outcome
    stage_type      opportunity_stage_type NOT NULL DEFAULT 'open',
    lost_reason     TEXT,

    -- Tags
    tags            TEXT[]      NOT NULL DEFAULT '{}',

    -- Ownership
    owner_id        UUID        REFERENCES users(id) ON DELETE SET NULL,

    -- Expected revenue (amount * probability / 100)
    expected_revenue DECIMAL(20,2) GENERATED ALWAYS AS
        (CASE WHEN amount IS NOT NULL AND probability IS NOT NULL
              THEN amount * probability / 100
              ELSE NULL END) STORED,

    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT opportunities_name_length CHECK (char_length(name) BETWEEN 1 AND 255)
);

CREATE INDEX idx_opportunities_org_id       ON opportunities(org_id);
CREATE INDEX idx_opportunities_owner_id     ON opportunities(owner_id);
CREATE INDEX idx_opportunities_stage_id     ON opportunities(stage_id);
CREATE INDEX idx_opportunities_account_id   ON opportunities(account_id);
CREATE INDEX idx_opportunities_contact_id   ON opportunities(contact_id);
CREATE INDEX idx_opportunities_stage_type   ON opportunities(org_id, stage_type);
CREATE INDEX idx_opportunities_close_date   ON opportunities(org_id, close_date);
CREATE INDEX idx_opportunities_active       ON opportunities(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_opportunities_fts ON opportunities
    USING gin(to_tsvector('english', coalesce(name, '')));

-- ─── Stage History (Audit trail of stage changes) ─────────────────────────────

CREATE TABLE opportunity_stage_history (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id      UUID    NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    org_id              UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_stage_id       UUID    REFERENCES pipeline_stages(id),
    to_stage_id         UUID    NOT NULL REFERENCES pipeline_stages(id),
    changed_by          UUID    REFERENCES users(id),
    changed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note                TEXT
);

CREATE INDEX idx_stage_history_opportunity ON opportunity_stage_history(opportunity_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_opportunities_updated_at
    BEFORE UPDATE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
