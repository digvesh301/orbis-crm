-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0011: Seed Core Modules + Default Data
-- Auto-seeds system modules, pipeline stages, profiles, and template categories
-- when a new org is created (via application logic, not triggers)
-- ─────────────────────────────────────────────────────────────────────────────

-- This migration creates helper functions to seed default data for a new org.
-- Called from Rust backend during org creation.

-- ─── Function: Seed default pipeline stages for a new org ─────────────────────

CREATE OR REPLACE FUNCTION seed_pipeline_stages(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO pipeline_stages (org_id, name, stage_type, probability, position, color, is_default, is_system)
    VALUES
        (p_org_id, 'Qualification',     'open', 20,  0, '#6366f1', false, true),
        (p_org_id, 'Needs Analysis',    'open', 40,  1, '#8b5cf6', false, true),
        (p_org_id, 'Proposal Sent',     'open', 60,  2, '#f59e0b', false, true),
        (p_org_id, 'Negotiation',       'open', 80,  3, '#f97316', false, true),
        (p_org_id, 'Closed Won',        'won',  100, 4, '#10b981', true,  true),
        (p_org_id, 'Closed Lost',       'lost', 0,   5, '#ef4444', false, true);
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Seed default profiles (roles) for a new org ────────────────────

CREATE OR REPLACE FUNCTION seed_profiles(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO profiles (org_id, name, description, is_system, permissions)
    VALUES
        (p_org_id, 'Admin', 'Full access to all modules and settings', true,
         '{
           "contacts":      {"view": true, "create": true, "edit": "all", "delete": true, "export": true},
           "accounts":      {"view": true, "create": true, "edit": "all", "delete": true, "export": true},
           "leads":         {"view": true, "create": true, "edit": "all", "delete": true, "export": true},
           "opportunities": {"view": true, "create": true, "edit": "all", "delete": true, "export": true},
           "activities":    {"view": true, "create": true, "edit": "all", "delete": true},
           "tickets":       {"view": true, "create": true, "edit": "all", "delete": true},
           "quotes":        {"view": true, "create": true, "edit": "all", "delete": true},
           "products":      {"view": true, "create": true, "edit": "all", "delete": true},
           "campaigns":     {"view": true, "create": true, "edit": "all", "delete": true},
           "settings":      {"view": true, "edit": true},
           "features":      {"import": true, "export": true, "api_keys": true, "custom_modules": true}
         }'::jsonb),

        (p_org_id, 'Sales Manager', 'Manage all deals and team activities', true,
         '{
           "contacts":      {"view": true, "create": true, "edit": "all", "delete": false, "export": true},
           "accounts":      {"view": true, "create": true, "edit": "all", "delete": false, "export": true},
           "leads":         {"view": true, "create": true, "edit": "all", "delete": false, "export": true},
           "opportunities": {"view": true, "create": true, "edit": "all", "delete": false, "export": true},
           "activities":    {"view": true, "create": true, "edit": "all", "delete": false},
           "tickets":       {"view": true, "create": true, "edit": "all", "delete": false},
           "quotes":        {"view": true, "create": true, "edit": "all", "delete": false},
           "products":      {"view": true, "create": false, "edit": false, "delete": false},
           "campaigns":     {"view": true, "create": true, "edit": "all", "delete": false},
           "settings":      {"view": false, "edit": false},
           "features":      {"import": true, "export": true, "api_keys": false, "custom_modules": false}
         }'::jsonb),

        (p_org_id, 'Sales Rep', 'Manage own contacts, leads and deals', true,
         '{
           "contacts":      {"view": true, "create": true, "edit": "own", "delete": false, "export": false},
           "accounts":      {"view": true, "create": true, "edit": "own", "delete": false, "export": false},
           "leads":         {"view": true, "create": true, "edit": "own", "delete": false, "export": false},
           "opportunities": {"view": true, "create": true, "edit": "own", "delete": false, "export": false},
           "activities":    {"view": true, "create": true, "edit": "own", "delete": false},
           "tickets":       {"view": true, "create": true, "edit": "own", "delete": false},
           "quotes":        {"view": true, "create": true, "edit": "own", "delete": false},
           "products":      {"view": true, "create": false, "edit": false, "delete": false},
           "campaigns":     {"view": false, "create": false, "edit": false, "delete": false},
           "settings":      {"view": false, "edit": false},
           "features":      {"import": false, "export": false, "api_keys": false, "custom_modules": false}
         }'::jsonb),

        (p_org_id, 'Viewer', 'Read-only access', true,
         '{
           "contacts":      {"view": true, "create": false, "edit": false, "delete": false, "export": false},
           "accounts":      {"view": true, "create": false, "edit": false, "delete": false, "export": false},
           "leads":         {"view": true, "create": false, "edit": false, "delete": false, "export": false},
           "opportunities": {"view": true, "create": false, "edit": false, "delete": false, "export": false},
           "activities":    {"view": true, "create": false, "edit": false, "delete": false},
           "settings":      {"view": false, "edit": false},
           "features":      {"import": false, "export": false, "api_keys": false, "custom_modules": false}
         }'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Seed core system modules for a new org ─────────────────────────

CREATE OR REPLACE FUNCTION seed_system_modules(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO custom_modules
        (org_id, name, api_name, plural_name, description, icon, color, module_type, position)
    VALUES
        (p_org_id, 'Contact',      'contacts',      'Contacts',      'People you do business with',        '👤', '#6366f1', 'system', 0),
        (p_org_id, 'Account',      'accounts',      'Accounts',      'Companies and organizations',        '🏢', '#8b5cf6', 'system', 1),
        (p_org_id, 'Lead',         'leads',         'Leads',         'Potential customers',                '🎯', '#f59e0b', 'system', 2),
        (p_org_id, 'Opportunity',  'opportunities', 'Opportunities', 'Deals in your pipeline',            '💼', '#10b981', 'system', 3),
        (p_org_id, 'Activity',     'activities',    'Activities',    'Calls, tasks and meetings',         '📅', '#3b82f6', 'system', 4),
        (p_org_id, 'Ticket',       'tickets',       'Tickets',       'Customer support requests',         '🎫', '#ef4444', 'system', 5),
        (p_org_id, 'Quote',        'quotes',        'Quotes',        'Sales proposals and quotations',    '📋', '#f97316', 'system', 6),
        (p_org_id, 'Product',      'products',      'Products',      'Items and services you sell',       '📦', '#06b6d4', 'system', 7),
        (p_org_id, 'Campaign',     'campaigns',     'Campaigns',     'Marketing campaigns',              '📢', '#84cc16', 'system', 8);
END;
$$ LANGUAGE plpgsql;

-- ─── Function: Seed template categories ───────────────────────────────────────

CREATE OR REPLACE FUNCTION seed_template_categories(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO template_categories (org_id, name, color, icon, is_system, position)
    VALUES
        (p_org_id, 'Introduction',    '#6366f1', '👋', true, 0),
        (p_org_id, 'Follow Up',       '#10b981', '🔄', true, 1),
        (p_org_id, 'Proposal',        '#f59e0b', '📋', true, 2),
        (p_org_id, 'Onboarding',      '#3b82f6', '🚀', true, 3),
        (p_org_id, 'Support',         '#ef4444', '🎫', true, 4),
        (p_org_id, 'Re-engagement',   '#8b5cf6', '💫', true, 5);
END;
$$ LANGUAGE plpgsql;

-- ─── Master Seed Function: Call all seed functions for a new org ───────────────

CREATE OR REPLACE FUNCTION seed_new_organization(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
    PERFORM seed_pipeline_stages(p_org_id);
    PERFORM seed_profiles(p_org_id);
    PERFORM seed_system_modules(p_org_id);
    PERFORM seed_template_categories(p_org_id);
END;
$$ LANGUAGE plpgsql;

-- Usage from Rust backend after org creation:
-- SELECT seed_new_organization($1);  -- pass the new org_id
