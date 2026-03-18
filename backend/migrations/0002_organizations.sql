-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002: Organizations
-- Every CRM tenant is an Organization. All data is scoped by org_id.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE org_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

CREATE TABLE organizations (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    name        TEXT        NOT NULL,
    slug        TEXT        NOT NULL UNIQUE,  -- URL-safe name, e.g. "acme-pharma"
    logo_url    TEXT,
    website     TEXT,
    phone       TEXT,
    email       TEXT,

    -- Subscription
    plan        org_plan    NOT NULL DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,

    -- Localization
    timezone        TEXT    NOT NULL DEFAULT 'Asia/Kolkata',
    date_format     TEXT    NOT NULL DEFAULT 'DD/MM/YYYY',
    currency        TEXT    NOT NULL DEFAULT 'INR',
    currency_symbol TEXT    NOT NULL DEFAULT '₹',
    language        TEXT    NOT NULL DEFAULT 'en',

    -- Address
    address     JSONB       DEFAULT '{}',
    -- { "line1": "...", "city": "Mumbai", "state": "MH", "country": "India", "zip": "400001" }

    -- Settings (flexible key-value store for org preferences)
    settings    JSONB       NOT NULL DEFAULT '{}',
    -- { "logo_position": "left", "default_module": "contacts", "fiscal_year_start": 4 }

    -- Status
    is_active   BOOLEAN     NOT NULL DEFAULT true,

    -- Timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT organizations_name_length CHECK (char_length(name) BETWEEN 1 AND 200),
    CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_organizations_slug         ON organizations(slug);
CREATE INDEX idx_organizations_plan         ON organizations(plan);
CREATE INDEX idx_organizations_is_active    ON organizations(is_active) WHERE is_active = true;

-- ─── Permission Profiles ──────────────────────────────────────────────────────
-- Role-based access control: each user is assigned one profile per org.
-- Profiles define what modules/records/fields the user can access.

CREATE TABLE profiles (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    name            TEXT    NOT NULL,           -- "Admin", "Sales Manager", "Viewer"
    description     TEXT,
    is_system       BOOLEAN NOT NULL DEFAULT false,  -- system profiles cannot be deleted

    -- Permissions stored as structured JSONB
    -- {
    --   "contacts": { "view": true, "create": true, "edit": "own", "delete": false, "export": true },
    --   "deals":    { "view": true, "create": true, "edit": "team", "delete": false },
    --   "settings": { "view": false },
    --   "features": { "import": true, "export": true, "api_keys": false }
    -- }
    permissions     JSONB   NOT NULL DEFAULT '{}',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(org_id, name)
);

CREATE INDEX idx_profiles_org_id ON profiles(org_id);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
