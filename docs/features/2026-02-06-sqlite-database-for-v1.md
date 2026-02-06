# SQLite Database for V1

## Status

`ready`

## Problem

The platform contract originally specified PostgreSQL as the V1 database. For a self-hosted, single-tenant, single-node macOS deployment, PostgreSQL adds operational complexity (separate server installation, configuration, maintenance) without architectural benefit.

## User Impact

Operators benefit from a simpler installation — no external database server required. The database is an embedded SQLite file managed automatically by `oored`. Backup is a file copy.

## UI Changes

None. The database engine is an internal backend detail with no frontend visibility.

## API Changes

None. API contracts are unchanged; only the backing storage engine changes.

## Security Considerations

- SQLite database file permissions must restrict access to the `oored` process user.
- Encryption at rest relies on filesystem-level encryption (FileVault on macOS) rather than database-level encryption.
- No network-exposed database port (SQLite is embedded), which reduces attack surface compared to PostgreSQL.

## Migration and Rollout

- No migration needed — the current implementation already uses SQLite.
- Contract section 10 updated to reflect SQLite.
- ADR-0001 documents the decision rationale and future migration path if needed.

## Acceptance Criteria

- [x] `sqlx` SQLite feature is the only database dependency in `Cargo.toml`.
- [x] `SetupStore` uses SQLite connection and embedded migrations.
- [x] Contract section 10 updated from PostgreSQL to SQLite with ADR reference.
- [x] ADR-0001 created in `docs/adr/`.

## Owner

arya

## Last Updated

`2026-02-06`
