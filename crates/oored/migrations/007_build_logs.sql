CREATE TABLE IF NOT EXISTS build_logs (
    id TEXT PRIMARY KEY NOT NULL,
    build_id TEXT NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
    sequence INTEGER NOT NULL,
    content TEXT NOT NULL,
    stream TEXT NOT NULL DEFAULT 'stdout' CHECK (stream IN ('stdout', 'stderr')),
    created_at INTEGER NOT NULL,
    UNIQUE(build_id, sequence)
);
CREATE INDEX IF NOT EXISTS idx_build_logs_build_seq ON build_logs(build_id, sequence);
