-- Pipeline-scoped Android signing profiles (debug/release).
-- Sensitive values are encrypted at rest using the instance encryption key.

CREATE TABLE IF NOT EXISTS pipeline_android_signing_profiles (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL,
    build_type TEXT NOT NULL CHECK (build_type IN ('debug', 'release')),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
    keystore_filename TEXT,
    keystore_encrypted TEXT,
    keystore_checksum TEXT,
    store_password_encrypted TEXT,
    key_alias_encrypted TEXT,
    key_password_encrypted TEXT,
    created_by TEXT,
    updated_by TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (pipeline_id, build_type)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_android_signing_pipeline
ON pipeline_android_signing_profiles(pipeline_id);
