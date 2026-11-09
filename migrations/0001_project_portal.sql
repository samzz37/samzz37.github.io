PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  portal_token_hash TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  project_type TEXT NOT NULL,
  project_brief TEXT NOT NULL,
  project_budget_paise INTEGER,
  requested_advance_paise INTEGER NOT NULL CHECK (requested_advance_paise >= 30000),
  total_price_paise INTEGER CHECK (total_price_paise IS NULL OR total_price_paise > 0),
  preview_object_key TEXT,
  final_object_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_payments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('advance', 'balance')),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  utr TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('awaiting_transfer', 'reported', 'verified', 'rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_payments_project ON project_payments(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_payments_status ON project_payments(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_reported_payment_per_project ON project_payments(project_id) WHERE status = 'reported';
