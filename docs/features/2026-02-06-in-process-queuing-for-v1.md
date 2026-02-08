# In-Process Queuing for V1

## Status

`ready`

## Problem

The platform contract originally specified NATS JetStream as the V1 queue/event bus. For a self-hosted, single-tenant, single-node deployment, NATS adds a separate server process that operators must install and maintain. The V1 runner protocol is already pull-based HTTP, and build log streaming uses SSE — neither requires an external message broker.

## User Impact

Operators benefit from a simpler installation — no external message broker required. Job queuing and event dispatch happen in-process within the `oored` daemon. There is no user-visible behavior change; runners still poll/claim jobs over HTTP, and build logs still stream via SSE.

## UI Changes

None. The queuing mechanism is an internal backend detail with no frontend visibility.

## API Changes

None. The runner HTTP API (`/v1/runners/{runner_id}/claim`, `/v1/builds/{build_id}/logs/stream`, etc.) is unchanged. Internally, job dispatch uses SQLite directly (runners claim via optimistic locking on the `builds` table) and the `tokio::sync::broadcast` channel provides build state event fan-out for SSE subscribers.

## Security Considerations

- No network-exposed message broker port, which reduces attack surface compared to NATS.
- In-process channels are not accessible from outside the daemon process.
- Job persistence relies on SQLite (pending jobs survive restarts); in-flight channel messages do not survive crashes, which is acceptable given the retry/stale-detection model.

## Migration and Rollout

- No migration needed — NATS was never implemented in the codebase.
- Contract section 10 updated to reflect in-process queuing.
- ADR-0003 documents the decision rationale and future migration path to NATS or another broker if needed.

## Acceptance Criteria

- [x] Contract section 10 updated from NATS JetStream to in-process (tokio channels) with ADR reference.
- [x] ADR-0003 created in `docs/adr/`.
- [x] `broadcast` channel provides `BuildEventBus` fan-out for SSE subscribers.
- [x] Job dispatch uses SQLite directly — runners claim via optimistic locking; no in-memory job queue needed.
- [x] Pending jobs persisted in SQLite; stale `scheduled` builds recovered to `queued` on daemon startup.

## Owner

arya

## Last Updated

`2026-02-06`
