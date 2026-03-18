CREATE TABLE IF NOT EXISTS custom_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module VARCHAR(50) NOT NULL, -- e.g. 'contacts', 'deals'
    name VARCHAR(255) NOT NULL, -- "My New Leads"
    is_default BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL, -- {"columns": [], "filters": {}, "sort": {}}
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_views_user_module ON custom_views(user_id, module);
