-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0004: Custom Field Engine
-- Powers EVERY module (core + custom) with custom fields & relationships.
-- O(log n) lookups guaranteed via indexes on all query columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- Field data types supported
CREATE TYPE field_type AS ENUM (
    'text',         -- single line text
    'textarea',     -- multi-line text
    'number',       -- integer or decimal
    'decimal',      -- precise decimal (for currency)
    'boolean',      -- yes/no toggle
    'date',         -- date only
    'datetime',     -- date + time
    'select',       -- single dropdown
    'multi_select', -- multiple choice
    'lookup',       -- relates to another module
    'multi_lookup', -- many-to-many relation
    'email',        -- validated email
    'phone',        -- phone number
    'url',          -- validated URL
    'currency',     -- number + currency code
    'percent',      -- 0-100 number
    'rating',       -- 1-5 stars
    'file',         -- file attachment reference
    'formula'       -- computed from other fields
);

CREATE TYPE module_type AS ENUM (
    'system',   -- built-in: contacts, accounts, leads, etc.
    'custom'    -- user-created modules
);

-- ─── Custom Modules ───────────────────────────────────────────────────────────
-- Stores BOTH system modules (contacts, accounts) and user-created ones.
-- System modules are pre-seeded on org creation.

CREATE TABLE custom_modules (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Identity
    name            TEXT        NOT NULL,           -- "Contacts", "Vendors"
    api_name        TEXT        NOT NULL,           -- "contacts", "vendors" (URL-safe)
    plural_name     TEXT        NOT NULL,           -- "Contacts", "Vendors"
    description     TEXT,
    icon            TEXT,                           -- emoji or icon name
    color           TEXT,                           -- "#6366f1"

    -- Type
    module_type     module_type NOT NULL DEFAULT 'custom',
    is_active       BOOLEAN     NOT NULL DEFAULT true,

    -- UI settings
    position        INTEGER     NOT NULL DEFAULT 0, -- sidebar order
    settings        JSONB       NOT NULL DEFAULT '{}',
    -- { "show_in_sidebar": true, "default_layout": "list", "quick_add": true }

    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(org_id, api_name),
    CONSTRAINT module_api_name_format CHECK (api_name ~ '^[a-z][a-z0-9_]*$'),
    CONSTRAINT module_position_positive CHECK (position >= 0)
);

CREATE INDEX idx_custom_modules_org_id      ON custom_modules(org_id);
CREATE INDEX idx_custom_modules_api_name    ON custom_modules(org_id, api_name);
CREATE INDEX idx_custom_modules_active      ON custom_modules(org_id) WHERE is_active = true;

-- ─── Custom Fields ────────────────────────────────────────────────────────────
-- Fields defined FOR a module. Each field = one column concept.

CREATE TABLE custom_fields (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    module_id       UUID        NOT NULL REFERENCES custom_modules(id) ON DELETE CASCADE,

    -- Identity
    name            TEXT        NOT NULL,           -- "Annual Revenue"
    api_name        TEXT        NOT NULL,           -- "annual_revenue"
    description     TEXT,
    placeholder     TEXT,

    -- Type configuration
    field_type      field_type  NOT NULL,
    is_required     BOOLEAN     NOT NULL DEFAULT false,
    is_unique       BOOLEAN     NOT NULL DEFAULT false,
    is_system       BOOLEAN     NOT NULL DEFAULT false,  -- system fields cannot be deleted

    -- Default value (stored as JSON to handle all types)
    default_value   JSONB,

    -- Type-specific options:
    -- For select/multi_select: { "options": ["Hot","Warm","Cold"], "colors": {"Hot":"red"} }
    -- For number/decimal:      { "min": 0, "max": 1000000, "decimal_places": 2 }
    -- For lookup:              { "target_module": "accounts", "display_field": "name" }
    -- For formula:             { "expression": "{{field_a}} * {{field_b}}", "output_type": "number" }
    -- For rating:              { "max": 5 }
    options         JSONB       NOT NULL DEFAULT '{}',

    -- UI display
    position        INTEGER     NOT NULL DEFAULT 0, -- field order in form
    section         TEXT,                           -- "Basic Info", "Deal Info"
    width           TEXT        NOT NULL DEFAULT 'full',  -- "full", "half"

    -- Visibility
    is_visible_in_list   BOOLEAN NOT NULL DEFAULT true,
    is_visible_in_detail BOOLEAN NOT NULL DEFAULT true,

    created_by      UUID        REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(module_id, api_name),
    CONSTRAINT field_api_name_format CHECK (api_name ~ '^[a-z][a-z0-9_]*$')
);

CREATE INDEX idx_custom_fields_module_id    ON custom_fields(module_id);
CREATE INDEX idx_custom_fields_org_id       ON custom_fields(org_id);
CREATE INDEX idx_custom_fields_api_name     ON custom_fields(module_id, api_name);
CREATE INDEX idx_custom_fields_type         ON custom_fields(field_type);

-- ─── Custom Field Values ──────────────────────────────────────────────────────
-- Stores actual values for custom fields on any record in any module.
-- One row per (module, record, field). O(log n) via composite index.

CREATE TABLE record_custom_data (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    field_id    UUID    NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,

    -- Polymorphic link — which record this value belongs to
    module_api_name TEXT    NOT NULL,   -- "contacts", "vendors", etc.
    record_id       UUID    NOT NULL,   -- ID of the record in that module

    -- Typed value columns (only one will be set per row based on field_type)
    -- This avoids JSONB overhead for simple types while allowing complex ones
    value_text      TEXT,
    value_number    DECIMAL(20, 6),
    value_boolean   BOOLEAN,
    value_date      DATE,
    value_datetime  TIMESTAMPTZ,
    value_json      JSONB,      -- for select, multi_select, file, multi_lookup

    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One value per field per record
    UNIQUE(field_id, record_id)
);

-- Critical: primary lookup pattern — "give me all custom field values for record X"
CREATE INDEX idx_custom_data_record
    ON record_custom_data(module_api_name, record_id);

-- Secondary: "find all records where custom field X has value Y" (filtering)
CREATE INDEX idx_custom_data_field_text
    ON record_custom_data(field_id, value_text)
    WHERE value_text IS NOT NULL;

CREATE INDEX idx_custom_data_field_number
    ON record_custom_data(field_id, value_number)
    WHERE value_number IS NOT NULL;

CREATE INDEX idx_custom_data_field_date
    ON record_custom_data(field_id, value_date)
    WHERE value_date IS NOT NULL;

CREATE INDEX idx_custom_data_org_id ON record_custom_data(org_id);

-- ─── Module Relationships ─────────────────────────────────────────────────────
-- Defines relationships between any two modules (one-to-many, many-to-many)

CREATE TYPE relationship_type AS ENUM (
    'one_to_one',
    'one_to_many',
    'many_to_many'
);

CREATE TABLE custom_relationships (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Which modules are related
    from_module         TEXT    NOT NULL,   -- "contacts"
    to_module           TEXT    NOT NULL,   -- "accounts"

    -- Relationship type
    relationship_type   relationship_type NOT NULL,

    -- Display labels
    from_label          TEXT    NOT NULL,   -- "Contact's Account"
    to_label            TEXT    NOT NULL,   -- "Account's Contacts"

    -- Options
    is_required         BOOLEAN NOT NULL DEFAULT false,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationships_org_id
    ON custom_relationships(org_id);
CREATE INDEX idx_relationships_from
    ON custom_relationships(org_id, from_module);

-- ─── Lookup Values (actual relationship records) ───────────────────────────────

CREATE TABLE custom_lookup_values (
    id                  UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id              UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    relationship_id     UUID    NOT NULL REFERENCES custom_relationships(id) ON DELETE CASCADE,

    from_module         TEXT    NOT NULL,
    from_record_id      UUID    NOT NULL,
    to_module           TEXT    NOT NULL,
    to_record_id        UUID    NOT NULL,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(relationship_id, from_record_id, to_record_id)
);

-- O(log n) lookup: "give me all related records for contact X"
CREATE INDEX idx_lookup_from_record
    ON custom_lookup_values(from_module, from_record_id);
CREATE INDEX idx_lookup_to_record
    ON custom_lookup_values(to_module, to_record_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_custom_modules_updated_at
    BEFORE UPDATE ON custom_modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_custom_fields_updated_at
    BEFORE UPDATE ON custom_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_record_custom_data_updated_at
    BEFORE UPDATE ON record_custom_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
