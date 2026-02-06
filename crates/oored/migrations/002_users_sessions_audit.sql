-- Phase 1: Users, persistent sessions, and audit logging.

-- Users table for RBAC and identity.
CREATE TABLE IF NOT EXISTS users (
    id              TEXT    PRIMARY KEY,  -- UUID v4
    email           TEXT    NOT NULL UNIQUE,
    oidc_subject    TEXT    NOT NULL UNIQUE,
    display_name    TEXT,
    role            TEXT    NOT NULL DEFAULT 'developer'
                            CHECK (role IN ('owner', 'admin', 'developer', 'qa_viewer')),
    status          TEXT    NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'disabled', 'invited')),
    invited_by      TEXT    REFERENCES users(id),
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- Persistent sessions (replaces in-memory HashMap).
CREATE TABLE IF NOT EXISTS sessions (
    token_hash      TEXT    PRIMARY KEY,  -- SHA-256 hex of session token
    user_id         TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      INTEGER NOT NULL,
    expires_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Audit log for security-relevant actions.
CREATE TABLE IF NOT EXISTS audit_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id        TEXT    REFERENCES users(id),
    action          TEXT    NOT NULL,
    resource_type   TEXT    NOT NULL,
    resource_id     TEXT,
    details         TEXT,   -- JSON
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id   ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
