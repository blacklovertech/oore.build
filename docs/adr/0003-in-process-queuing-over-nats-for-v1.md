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

Replace NATS JetStream with **in-process queuing using `tokio` channels** for V1.

The two primary channel types:

- **`tokio::sync::broadcast`** — fan-out for build state change events. Multiple SSE connections subscribe to build updates; broadcast channels deliver each event to all active subscribers. This powers the `GET /v1/builds/{build_id}/logs/stream` SSE endpoint.
- **`tokio::sync::mpsc`** — point-to-point for internal job dispatch. Build requests are enqueued; the runner claim endpoint dequeues and assigns them. For V1's pull-based runner model, this is the internal half of the scheduling loop (the external half is the HTTP poll/claim API).

No external process or dependency is required.

## Rationale

### Operational simplicity

NATS JetStream is a separate server process. For a self-hosted, single-node macOS deployment, requiring operators to install, configure, and maintain NATS adds significant operational burden. Tokio channels are in-process — zero additional infrastructure, same as the SQLite decision (ADR-0001).

### The runner protocol doesn't use NATS

The contract explicitly defines runners as HTTP pull-based (section 16). Runners poll `POST /v1/runners/{runner_id}/claim` to claim jobs and push results back via HTTP. There is no runner-side NATS subscription. The queue is entirely internal to the daemon.

### SSE doesn't need NATS

Build log streaming uses SSE from `oored` to the frontend. A `tokio::sync::broadcast` channel within the daemon process delivers log lines and status changes to all active SSE connections. No external pub/sub system is needed for single-process fan-out.

### Sufficient for V1 concurrency

V1 is single-tenant on a single host. The number of concurrent builds is bounded by the machine's runner capacity (typically 1-4 parallel jobs). Tokio channels handle this trivially.

### Durability is handled by the database

Job persistence (surviving daemon restarts) is the database's responsibility, not the queue's. Pending builds are stored in SQLite. On startup, the daemon reloads pending jobs from the database and re-populates the in-memory channel. NATS JetStream's durability guarantees are redundant when the database is the source of truth.

### Migration path preserved

If future versions require distributed messaging (multi-node deployment, external event consumers), the internal channel abstraction can be replaced with NATS or another broker. The key interfaces are:

- A `JobQueue` trait with `enqueue()` and `claim()` methods.
- A `BuildEventBus` trait with `publish()` and `subscribe()` methods.

These abstractions keep the daemon's core logic decoupled from the transport.

## Consequences

- Contract section 10 is updated: `Queue/event bus: in-process (tokio channels)`.
- No `async-nats` dependency in V1.
- Operators do not need to install or manage NATS for V1.
- Build events and job state do not survive daemon crashes mid-flight (in-memory channels are lost). This is acceptable because:
  - Pending jobs are persisted in SQLite and reloaded on startup.
  - In-flight build steps can be detected as stale and retried/failed on restart.
- Future multi-node deployment will require re-evaluating this decision (likely via a new ADR).

## Contract References

- Section 10 (Backend Technology Contract): queue/event bus line updated.
- Section 13 (API Boundary Contract): SSE for live build output — served by broadcast channels.
- Section 16 (Runner protocol): pull-based HTTPS JSON — no change, internal queue feeds the claim endpoint.
- Section 16 (Tenant model): single organization per backend instance — supports the in-process choice.
