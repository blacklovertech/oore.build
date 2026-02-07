-- Build domain schema: projects, pipelines, builds, build_events, runners, artifacts
-- Depends on: 004_scm_integrations.sql (integration_repositories FK)

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    repository_id TEXT REFERENCES integration_repositories(id),
    settings TEXT NOT NULL DEFAULT '{}',  -- JSON: concurrency policy, etc.
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config_path TEXT NOT NULL DEFAULT '.oore.yml',
    trigger_config TEXT NOT NULL DEFAULT '{}',  -- JSON: event filters, branch patterns
    concurrency TEXT NOT NULL DEFAULT '{}',     -- JSON: cancel_previous, max_concurrent
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pipelines_project ON pipelines(project_id);

CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT NOT NULL REFERENCES projects(id),
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id),
    build_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN (
        'queued', 'scheduled', 'assigned', 'running',
        'succeeded', 'failed', 'canceled', 'timed_out', 'expired'
    )),
    -- Immutable trigger metadata
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'api', 'webhook', 'schedule')),
    trigger_actor TEXT,
    trigger_event TEXT,
    trigger_ref TEXT,
    commit_sha TEXT,
    branch TEXT,
    -- Config snapshot (immutable after creation)
    config_snapshot TEXT NOT NULL DEFAULT '{}',  -- JSON: pipeline config + commit + trigger metadata
    -- Webhook linkage (nullable for manual/API triggers)
    webhook_id TEXT REFERENCES integration_webhooks(id),
    -- Runner assignment
    runner_id TEXT REFERENCES runners(id),
    -- Timing
    queued_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    -- Per-project sequential build number
    UNIQUE(project_id, build_number)
);

CREATE INDEX IF NOT EXISTS idx_builds_project ON builds(project_id);
CREATE INDEX IF NOT EXISTS idx_builds_pipeline ON builds(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_builds_status ON builds(status);
CREATE INDEX IF NOT EXISTS idx_builds_branch ON builds(branch);
CREATE INDEX IF NOT EXISTS idx_builds_project_branch_status ON builds(project_id, branch, status);

CREATE TABLE IF NOT EXISTS build_events (
    id TEXT PRIMARY KEY NOT NULL,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    from_status TEXT,
    to_status TEXT NOT NULL,
    actor TEXT,
    reason TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_events_build ON build_events(build_id);

CREATE TABLE IF NOT EXISTS runners (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy', 'draining')),
    capabilities TEXT NOT NULL DEFAULT '{}',  -- JSON: os, arch, labels
    last_heartbeat_at INTEGER,
    registered_by TEXT REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY NOT NULL,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    artifact_type TEXT NOT NULL DEFAULT 'generic' CHECK (artifact_type IN ('apk', 'ipa', 'app', 'generic')),
    file_path TEXT NOT NULL,  -- S3 key or local path
    file_size INTEGER,
    checksum TEXT,            -- SHA-256 hash
    metadata TEXT NOT NULL DEFAULT '{}',  -- JSON: additional metadata
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_artifacts_build ON artifacts(build_id);
