-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003: Users + Auth Tables
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'invited', 'suspended');

CREATE TABLE users (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    profile_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,

    -- Identity
    first_name      TEXT        NOT NULL,
    last_name       TEXT,
    email           TEXT        NOT NULL,
    phone           TEXT,
    avatar_url      TEXT,
    title           TEXT,           -- "Sales Manager", "Account Executive"

    -- Auth
    password_hash   TEXT,           -- NULL for social login / invited users
    status          user_status NOT NULL DEFAULT 'invited',

    -- Email verification
    is_email_verified       BOOLEAN NOT NULL DEFAULT false,

    -- Two-factor auth
    totp_secret     TEXT,           -- NULL if 2FA not enabled (encrypted)
    is_2fa_enabled  BOOLEAN NOT NULL DEFAULT false,

    -- Activity
    last_login_at   TIMESTAMPTZ,
    last_active_at  TIMESTAMPTZ,

    -- Owner/team assignments
    direct_manager_id UUID    REFERENCES users(id) ON DELETE SET NULL,

    -- Preferences (per-user settings)
    preferences     JSONB   NOT NULL DEFAULT '{}',
    -- { "theme": "dark", "notifications": {...}, "default_view": "list" }

    -- Timestamps + soft delete
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,

    -- Each email must be unique within an org
    UNIQUE(org_id, email),
    CONSTRAINT users_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_name_length CHECK (char_length(first_name) BETWEEN 1 AND 100)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX idx_users_org_id          ON users(org_id);
CREATE INDEX idx_users_email           ON users(org_id, email);
CREATE INDEX idx_users_profile_id      ON users(profile_id);
CREATE INDEX idx_users_status          ON users(org_id, status);
CREATE INDEX idx_users_active          ON users(org_id) WHERE deleted_at IS NULL;

-- ─── Sessions (Refresh Tokens) ────────────────────────────────────────────────
-- Stored in DB for invalidation support (logout from all devices, etc.)
-- Access tokens are short-lived JWTs (not stored in DB).

CREATE TABLE sessions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Token (hashed before storage — never store raw tokens)
    token_hash      TEXT        NOT NULL UNIQUE,

    -- Device info
    ip_address      TEXT,
    user_agent      TEXT,
    device_name     TEXT,           -- "Chrome on MacBook", "iPhone 15"

    -- Expiry
    expires_at      TIMESTAMPTZ NOT NULL,
    last_used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id      ON sessions(user_id);
CREATE INDEX idx_sessions_token_hash   ON sessions(token_hash);
CREATE INDEX idx_sessions_expires_at   ON sessions(expires_at);

-- ─── Email Verifications ──────────────────────────────────────────────────────

CREATE TABLE email_verifications (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,        -- hashed OTP / link token
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,                        -- NULL = not used yet
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verifications_user_id    ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_token      ON email_verifications(token_hash);

-- ─── Password Resets ──────────────────────────────────────────────────────────

CREATE TABLE password_resets (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    ip_address  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_resets_token ON password_resets(token_hash);

-- ─── Organization Invitations ─────────────────────────────────────────────────

CREATE TABLE org_invitations (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by      UUID        NOT NULL REFERENCES users(id),
    profile_id      UUID        REFERENCES profiles(id),

    email           TEXT        NOT NULL,
    token_hash      TEXT        NOT NULL UNIQUE,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,                    -- NULL = pending

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(org_id, email)
);

CREATE INDEX idx_org_invitations_org_id ON org_invitations(org_id);
CREATE INDEX idx_org_invitations_email  ON org_invitations(email);
CREATE INDEX idx_org_invitations_token  ON org_invitations(token_hash);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
