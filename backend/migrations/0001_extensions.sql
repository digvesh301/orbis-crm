-- Orbis CRM — Initial Migration
-- Day 2 will add: organizations, users, custom_engine, contacts, accounts
-- For now, create the extensions needed by all future tables

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable full-text search improvements
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
