-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0007: Activities + Notes + Files
-- Universal — works on ANY module record (contacts, deals, accounts, etc.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE activity_type AS ENUM (
    'call', 'email', 'meeting', 'task', 'note', 'whatsapp', 'demo', 'other'
);

CREATE TYPE activity_status AS ENUM (
    'planned', 'in_progress', 'completed', 'cancelled', 'overdue'
);

-- ─── Activities ───────────────────────────────────────────────────────────────

CREATE TABLE activities (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Type + Status
    activity_type   activity_type   NOT NULL,
    status          activity_status NOT NULL DEFAULT 'planned',

    -- Content
    subject         TEXT            NOT NULL,
    description     TEXT,
    outcome         TEXT,           -- what happened after call/meeting

    -- Scheduling
    due_date        DATE,
    start_time      TIMESTAMPTZ,
    end_time        TIMESTAMPTZ,
    duration_mins   INTEGER,

    -- Call-specific
    call_duration_secs  INTEGER,
    call_direction      TEXT,       -- "inbound", "outbound"
    call_outcome        TEXT,       -- "connected", "voicemail", "no_answer"

    -- Polymorphic link — which record this activity belongs to
    linked_module   TEXT,           -- "contacts", "opportunities", "accounts"
    linked_record_id UUID,

    -- Participants
    assigned_to     UUID            REFERENCES users(id) ON DELETE SET NULL,
    attendees       JSONB           DEFAULT '[]',
    -- [{"user_id": "...", "name": "John", "email": "john@..."}]

    -- Reminder
    remind_at       TIMESTAMPTZ,
    reminder_sent   BOOLEAN         NOT NULL DEFAULT false,

    priority        TEXT            NOT NULL DEFAULT 'normal',  -- low, normal, high

    created_by      UUID            REFERENCES users(id),
    completed_by    UUID            REFERENCES users(id),
    completed_at    TIMESTAMPTZ,

    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_activities_org_id          ON activities(org_id);
CREATE INDEX idx_activities_assigned_to     ON activities(assigned_to);
CREATE INDEX idx_activities_linked          ON activities(linked_module, linked_record_id);
CREATE INDEX idx_activities_status          ON activities(org_id, status);
CREATE INDEX idx_activities_due_date        ON activities(org_id, due_date);
CREATE INDEX idx_activities_type            ON activities(org_id, activity_type);
CREATE INDEX idx_activities_active          ON activities(org_id) WHERE deleted_at IS NULL;
-- Overdue activities: status = planned AND due_date < now (partial index)
CREATE INDEX idx_activities_overdue
    ON activities(org_id, due_date)
    WHERE status = 'planned' AND due_date IS NOT NULL;

-- ─── Notes ────────────────────────────────────────────────────────────────────
-- Universal: one notes table serves all modules

CREATE TABLE notes (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Polymorphic link
    module_api_name TEXT    NOT NULL,   -- "contacts", "opportunities"
    record_id       UUID    NOT NULL,

    -- Content
    content         TEXT    NOT NULL,
    content_type    TEXT    NOT NULL DEFAULT 'plain',   -- plain | markdown

    -- Features
    is_pinned       BOOLEAN NOT NULL DEFAULT false,
    is_private      BOOLEAN NOT NULL DEFAULT false,     -- only visible to creator

    -- Mentions
    mentioned_users UUID[]  NOT NULL DEFAULT '{}',

    -- Metadata
    created_by      UUID    REFERENCES users(id),
    updated_by      UUID    REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_notes_record       ON notes(module_api_name, record_id);
CREATE INDEX idx_notes_org_id       ON notes(org_id);
CREATE INDEX idx_notes_created_by   ON notes(created_by);
CREATE INDEX idx_notes_pinned       ON notes(module_api_name, record_id) WHERE is_pinned = true;
CREATE INDEX idx_notes_active       ON notes(org_id) WHERE deleted_at IS NULL;

-- Note reactions (emoji reactions like Slack)
CREATE TABLE note_reactions (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id     UUID    NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    user_id     UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji       TEXT    NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(note_id, user_id, emoji)
);

CREATE INDEX idx_note_reactions_note_id ON note_reactions(note_id);

-- ─── Files ────────────────────────────────────────────────────────────────────
-- Universal: one files table serves all modules

CREATE TABLE files (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Polymorphic link
    module_api_name TEXT    NOT NULL,
    record_id       UUID    NOT NULL,

    -- File info
    name            TEXT    NOT NULL,           -- display name
    original_name   TEXT    NOT NULL,           -- original uploaded filename
    mime_type       TEXT    NOT NULL,
    extension       TEXT    NOT NULL,
    size_bytes      BIGINT  NOT NULL,

    -- Storage
    storage_key     TEXT    NOT NULL,           -- S3 / MinIO object key
    storage_url     TEXT,                       -- public URL (if public bucket)
    thumbnail_url   TEXT,                       -- for images: auto thumbnail

    -- Categorization
    category        TEXT    NOT NULL DEFAULT 'other',
    -- "contract" | "invoice" | "proposal" | "image" | "other"
    description     TEXT,

    -- Visibility
    is_private      BOOLEAN NOT NULL DEFAULT false,

    -- Versioning
    version         INTEGER NOT NULL DEFAULT 1,
    parent_file_id  UUID    REFERENCES files(id) ON DELETE SET NULL,
    is_latest       BOOLEAN NOT NULL DEFAULT true,

    -- Metadata
    uploaded_by     UUID    REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_files_record       ON files(module_api_name, record_id);
CREATE INDEX idx_files_org_id       ON files(org_id);
CREATE INDEX idx_files_uploaded_by  ON files(uploaded_by);
CREATE INDEX idx_files_active       ON files(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_files_latest       ON files(module_api_name, record_id) WHERE is_latest = true;

-- File access audit log
CREATE TABLE file_access_log (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id     UUID    NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    user_id     UUID    REFERENCES users(id),
    action      TEXT    NOT NULL,   -- "viewed" | "downloaded"
    ip_address  TEXT,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_file_access_file_id ON file_access_log(file_id);
CREATE INDEX idx_file_access_user_id ON file_access_log(user_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_activities_updated_at
    BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notes_updated_at
    BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
