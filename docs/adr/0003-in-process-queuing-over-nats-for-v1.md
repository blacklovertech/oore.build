# ADR-0003: In-Process Queuing over NATS JetStream for V1

## Status

Accepted

## Date

2026-02-06

## Context

The platform contract (section 10) originally specified NATS JetStream via `async-nats` as the queue/event bus. The contract also specifies:

- Runners use **pull-based HTTPS JSON** scheduling — runners poll/claim jobs from the backend and push results back via HTTP APIs (section 16, runner protocol).
- Live build output uses **SSE** from the backend to the frontend (section 13).
- V1 is **single-tenant, single-node, macOS-only** (sections 10, 16).

Given these constraints, the role of NATS would be limited to internal daemon-side event coordination within a single `oored` process — routing build state changes to SSE subscribers, managing the job claim queue, and signaling between internal subsystems.

## Decision

Replace NATS JetStream with **in-process mechanisms** for V1.

The implementation uses:

- **`tokio::sync::broadcast`** — fan-out for build state change events. Multiple SSE connections subscribe to build updates; broadcast channels deliver each event to all active subscribers. This powers the `GET /v1/builds/{build_id}/logs/stream` SSE endpoint.
- **SQLite-direct job dispatch** — runners claim queued builds directly from SQLite via the `POST /v1/runners/{runner_id}/claim` endpoint. The claim query uses `SELECT ... WHERE status='queued' LIMIT 1` with two-step optimistic locking (queued → scheduled → assigned). SQLite's serialized writes prevent double-claims. No in-memory job queue is needed because the database is the single source of truth for build state, and runners pull work via HTTP polling.

No external process or dependency is required.

## Rationale

### Operational simplicity

NATS JetStream is a separate server process. For a self-hosted, single-node macOS deployment, requiring operators to install, configure, and maintain NATS adds significant operational burden. Tokio channels are in-process — zero additional infrastructure, same as the SQLite decision (ADR-0001).

### The runner protocol doesn't use NATS

The contract explicitly defines runners as HTTP pull-based (section 16). Runners poll `POST /v1/runners/{runner_id}/claim` to claim jobs and push results back via HTTP. There is no runner-side NATS subscription. Job dispatch goes directly through SQLite — runners claim from the database via optimistic locking, which is sufficient for V1's single-node concurrency.

### SSE doesn't need NATS

Build log streaming uses SSE from `oored` to the frontend. A `tokio::sync::broadcast` channel within the daemon process delivers log lines and status changes to all active SSE connections. No external pub/sub system is needed for single-process fan-out.

### Sufficient for V1 concurrency

V1 is single-tenant on a single host. The number of concurrent builds is bounded by the machine's runner capacity (typically 1-4 parallel jobs). Tokio channels handle this trivially.

### Durability is handled by the database

Job persistence (surviving daemon restarts) is the database's responsibility, not the queue's. Pending builds are stored in SQLite. On startup, the daemon transitions stale `scheduled` builds back to `queued` in the database; `queued` builds need no recovery since runners claim directly from SQLite. NATS JetStream's durability guarantees are redundant when the database is the source of truth.

### Migration path preserved

If future versions require distributed messaging (multi-node deployment, external event consumers), the internal channel abstraction can be replaced with NATS or another broker. The key interfaces are:

- A `BuildEventBus` trait with `publish()` and `subscribe()` methods for the broadcast channel.
- A job dispatch interface (currently SQLite-direct, replaceable with a distributed queue).

These abstractions keep the daemon's core logic decoupled from the transport.

## Consequences

- Contract section 10 is updated: `Queue/event bus: in-process (tokio channels)`.
- No `async-nats` dependency in V1.
- Operators do not need to install or manage NATS for V1.
- Build state change events (broadcast channel) do not survive daemon crashes mid-flight. This is acceptable because:
  - Pending jobs are persisted in SQLite and recovered on startup (stale `scheduled` builds are transitioned back to `queued`).
  - In-flight build steps can be detected as stale and retried/failed on restart via background monitors.
- Future multi-node deployment will require re-evaluating this decision (likely via a new ADR).

## Contract References

- Section 10 (Backend Technology Contract): queue/event bus line updated.
- Section 13 (API Boundary Contract): SSE for live build output — served by broadcast channels.
- Section 16 (Runner protocol): pull-based HTTPS JSON — no change, runners claim directly from SQLite via the claim endpoint.
- Section 16 (Tenant model): single organization per backend instance — supports the in-process choice.
