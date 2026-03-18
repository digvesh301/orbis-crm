-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0009: Products + Quotes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE product_status AS ENUM ('active', 'inactive', 'discontinued');
CREATE TYPE quote_status AS ENUM (
    'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'invoiced'
);
CREATE TYPE discount_type AS ENUM ('percent', 'fixed');

-- ─── Product Categories ───────────────────────────────────────────────────────

CREATE TABLE product_categories (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT,
    parent_id   UUID    REFERENCES product_categories(id),
    position    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(org_id, name)
);

CREATE INDEX idx_product_categories_org_id ON product_categories(org_id);

-- ─── Products ─────────────────────────────────────────────────────────────────

CREATE TABLE products (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id     UUID            REFERENCES product_categories(id) ON DELETE SET NULL,

    name            TEXT            NOT NULL,
    sku             TEXT,
    description     TEXT,
    image_url       TEXT,

    status          product_status  NOT NULL DEFAULT 'active',

    -- Pricing
    unit_price      DECIMAL(20,2)   NOT NULL DEFAULT 0,
    currency        TEXT            NOT NULL DEFAULT 'INR',
    unit_of_measure TEXT            NOT NULL DEFAULT 'unit',    -- "unit", "kg", "hr"

    -- Tax
    tax_rate        DECIMAL(5,2)    NOT NULL DEFAULT 0,         -- percentage
    tax_inclusive   BOOLEAN         NOT NULL DEFAULT false,

    -- Inventory
    track_inventory BOOLEAN         NOT NULL DEFAULT false,
    stock_quantity  INTEGER,

    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(org_id, sku)
);

CREATE INDEX idx_products_org_id        ON products(org_id);
CREATE INDEX idx_products_category_id   ON products(category_id);
CREATE INDEX idx_products_status        ON products(org_id, status);
CREATE INDEX idx_products_active        ON products(org_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_fts ON products
    USING gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(sku,'')));

-- ─── Price Lists ──────────────────────────────────────────────────────────────

CREATE TABLE price_lists (
    id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id      UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT,
    currency    TEXT    NOT NULL DEFAULT 'INR',
    is_default  BOOLEAN NOT NULL DEFAULT false,
    valid_from  DATE,
    valid_until DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE price_list_items (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    price_list_id   UUID    NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id      UUID    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    unit_price      DECIMAL(20,2) NOT NULL,
    UNIQUE(price_list_id, product_id)
);

-- ─── Quotes ───────────────────────────────────────────────────────────────────

CREATE TABLE quotes (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          UUID            NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Quote number (auto-generated: ORB-2026-0001)
    quote_number    TEXT            NOT NULL UNIQUE,

    subject         TEXT            NOT NULL,
    description     TEXT,

    -- Status
    status          quote_status    NOT NULL DEFAULT 'draft',

    -- Relationships
    contact_id      UUID            REFERENCES contacts(id) ON DELETE SET NULL,
    account_id      UUID            REFERENCES accounts(id) ON DELETE SET NULL,
    opportunity_id  UUID            REFERENCES opportunities(id) ON DELETE SET NULL,

    -- Pricing
    currency        TEXT            NOT NULL DEFAULT 'INR',
    subtotal        DECIMAL(20,2)   NOT NULL DEFAULT 0,
    discount_type   discount_type,
    discount_value  DECIMAL(20,2),
    discount_amount DECIMAL(20,2)   NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(20,2)   NOT NULL DEFAULT 0,
    shipping_cost   DECIMAL(20,2)   NOT NULL DEFAULT 0,
    total_amount    DECIMAL(20,2)   NOT NULL DEFAULT 0,

    -- Dates
    valid_until     DATE,
    sent_at         TIMESTAMPTZ,
    accepted_at     TIMESTAMPTZ,
    rejected_at     TIMESTAMPTZ,

    -- Terms
    payment_terms   TEXT,
    delivery_terms  TEXT,
    notes           TEXT,
    terms_conditions TEXT,

    -- PDF
    pdf_url         TEXT,
    pdf_generated_at TIMESTAMPTZ,

    -- Approval
    requires_approval   BOOLEAN     NOT NULL DEFAULT false,
    approved_by         UUID        REFERENCES users(id),
    approved_at         TIMESTAMPTZ,

    owner_id        UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_quotes_org_id          ON quotes(org_id);
CREATE INDEX idx_quotes_status          ON quotes(org_id, status);
CREATE INDEX idx_quotes_account_id      ON quotes(account_id);
CREATE INDEX idx_quotes_contact_id      ON quotes(contact_id);
CREATE INDEX idx_quotes_opportunity_id  ON quotes(opportunity_id);
CREATE INDEX idx_quotes_active          ON quotes(org_id) WHERE deleted_at IS NULL;

-- ─── Quote Line Items ─────────────────────────────────────────────────────────

CREATE TABLE quote_line_items (
    id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id        UUID    NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    product_id      UUID    REFERENCES products(id) ON DELETE SET NULL,

    -- Item details (copied from product at time of quoting)
    name            TEXT    NOT NULL,
    description     TEXT,
    sku             TEXT,

    -- Pricing
    quantity        DECIMAL(20,4)   NOT NULL DEFAULT 1,
    unit_price      DECIMAL(20,2)   NOT NULL,
    discount_type   discount_type,
    discount_value  DECIMAL(20,2),
    discount_amount DECIMAL(20,2)   NOT NULL DEFAULT 0,
    tax_rate        DECIMAL(5,2)    NOT NULL DEFAULT 0,
    tax_amount      DECIMAL(20,2)   NOT NULL DEFAULT 0,
    total_amount    DECIMAL(20,2)   NOT NULL,

    unit_of_measure TEXT    NOT NULL DEFAULT 'unit',
    position        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_quote_line_items_quote_id ON quote_line_items(quote_id);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_quotes_updated_at
    BEFORE UPDATE ON quotes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
