-- SCM integration schema: integrations, credentials, installations, repositories, webhooks

CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab')),
    host_url TEXT NOT NULL DEFAULT 'https://github.com',
    auth_mode TEXT NOT NULL CHECK (auth_mode IN ('github_app', 'oauth_app', 'personal_token')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    display_name TEXT,
    -- GitHub App specific fields
    app_id TEXT,
    app_slug TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_created_by ON integrations(created_by);

CREATE TABLE IF NOT EXISTS integration_credentials (
    id TEXT PRIMARY KEY NOT NULL,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    credential_type TEXT NOT NULL CHECK (credential_type IN (
        'app_private_key', 'webhook_secret', 'client_secret',
        'access_token', 'refresh_token', 'oauth_client_id', 'oauth_client_secret'
    )),
    encrypted_value TEXT NOT NULL,  -- AES-256-GCM encrypted
    expires_at INTEGER,             -- NULL for non-expiring credentials
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(integration_id, credential_type)
);

CREATE INDEX IF NOT EXISTS idx_integration_credentials_integration ON integration_credentials(integration_id);

CREATE TABLE IF NOT EXISTS integration_installations (
    id TEXT PRIMARY KEY NOT NULL,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,       -- GitHub installation_id or GitLab group/project id
    account_name TEXT NOT NULL,      -- org/user name
    account_type TEXT,               -- 'Organization' or 'User' (GitHub) / 'group' or 'project' (GitLab)
    permissions TEXT DEFAULT '{}',   -- JSON: granted permissions summary
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_installations_integration ON integration_installations(integration_id);

CREATE TABLE IF NOT EXISTS integration_repositories (
    id TEXT PRIMARY KEY NOT NULL,
    installation_id TEXT NOT NULL REFERENCES integration_installations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,       -- provider repo id
    full_name TEXT NOT NULL,         -- e.g. 'owner/repo'
    default_branch TEXT,
    is_private INTEGER NOT NULL DEFAULT 0,
    html_url TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(installation_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_repos_installation ON integration_repositories(installation_id);
CREATE INDEX IF NOT EXISTS idx_integration_repos_full_name ON integration_repositories(full_name);

CREATE TABLE IF NOT EXISTS integration_webhooks (
    id TEXT PRIMARY KEY NOT NULL,
    integration_id TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
    provider_delivery_id TEXT NOT NULL,
    event_type TEXT NOT NULL,        -- e.g. 'push', 'pull_request', 'merge_request'
    payload TEXT NOT NULL,           -- raw JSON payload (or normalized subset)
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
    processing_error TEXT,
    received_at INTEGER NOT NULL,
    processed_at INTEGER,
    UNIQUE(integration_id, provider_delivery_id)
);

CREATE INDEX IF NOT EXISTS idx_integration_webhooks_integration ON integration_webhooks(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_webhooks_received ON integration_webhooks(received_at);
