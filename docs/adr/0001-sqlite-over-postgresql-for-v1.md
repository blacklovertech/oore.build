# ADR-0001: SQLite over PostgreSQL for V1 Database

## Status

Accepted

## Date

2026-02-06

## Context

The platform contract (section 10) originally specified PostgreSQL with `sqlx` as the V1 database. The current implementation already uses SQLite with `sqlx`, and this ADR formalizes that choice.

V1 constraints that inform this decision:

- **Single-tenant**: one organization per backend instance (contract section 16, tenant model).
- **Single-node**: backend runs on a single macOS host (contract section 10).
- **Self-hosted**: operators install and maintain their own instance (contract section 4).
- **macOS-only runtime**: no containerized or multi-host deployment in V1 (contract section 10).

## Decision

Use **SQLite** (via `sqlx` with the `sqlite` feature) as the V1 database engine instead of PostgreSQL.

## Rationale

### Operational simplicity for self-hosted operators

PostgreSQL requires operators to install, configure, and maintain a separate database server. For a single-tenant, single-node macOS deployment, this adds significant operational burden with no architectural benefit. SQLite is embedded — zero additional infrastructure.

### Sufficient for V1 workload

V1 serves one organization on one host. The data model (setup state, OIDC config, users/roles, build records, project metadata) fits comfortably within SQLite's capabilities. WAL mode handles concurrent reads from the Axum HTTP server without contention issues at this scale.

### Simpler backup and recovery

SQLite backup is a file copy. For self-hosted operators who may not have database administration expertise, this is a meaningful advantage over PostgreSQL backup tooling.

### Migration path preserved

The `sqlx` abstraction layer is already in use. If future versions require PostgreSQL (multi-node, multi-tenant, higher concurrency), the migration path is straightforward:

1. `sqlx` supports both SQLite and PostgreSQL with the same query macros.
2. SQL migrations can be translated or versioned per backend.
3. The `SetupStore` API boundary (`connect`, `load`, `save`) does not leak SQLite-specific details.

### What does NOT change

- `sqlx` remains the database access layer (same crate, different feature flag).
- Embedded migrations via `sqlx::migrate!()` remain the migration strategy.
- All other contract items (RBAC via `casbin-rs`, artifact storage via S3, observability, NATS) are unaffected by this decision.

## Consequences

- Contract section 10 is updated: `Database: SQLite with sqlx`.
- Operators do not need to install or manage PostgreSQL for V1.
- Future multi-node or multi-tenant deployment will require re-evaluating this decision (likely via a new ADR).
- Performance ceiling is lower than PostgreSQL for high-concurrency writes, which is acceptable for V1's single-tenant model.

## Contract References

- Section 10 (Backend Technology Contract): database line updated.
- Section 16 (Tenant model): V1 is single organization per backend instance — supports the single-file database choice.
