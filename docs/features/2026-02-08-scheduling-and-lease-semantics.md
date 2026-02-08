# Scheduling and Lease Semantics

## Status

`ready`

## Problem

Queued builds need to be dispatched to available runners reliably. Without scheduling, lease management, and timeout enforcement, builds can be lost (never dispatched), double-claimed (two runners execute the same build), or stuck indefinitely (runner crashes mid-build with no recovery). The scheduling layer must bridge the gap between build creation (Phase 2) and runner execution, ensuring every queued build either completes or reaches a well-defined terminal state.

## User Impact

- **Developers** see builds automatically progress from queued to running when a runner is available. Abandoned builds are automatically requeued without manual intervention. Long-running builds are timed out with a clear terminal status.
- **Operators** can trust that the build queue is self-healing: stale runners are detected, abandoned leases are reclaimed, and the daemon recovers pending work on restart.
- **Admins** benefit from deterministic state transitions — every build follows the 9-state machine with no ambiguous intermediate states.

## UI Changes

No direct UI changes in this phase. Scheduling is internal daemon behavior. Build status transitions (queued, scheduled, assigned, running, and terminal states) are already visible in the existing build detail views from Phase 2.

## API Changes

No new API endpoints are introduced. Scheduling is implemented as internal daemon behavior using the existing endpoint surface:

- **Claim endpoint** (`POST /v1/runners/{runner_id}/claim`) uses a two-step optimistic locking transition (queued → scheduled → assigned via `transition_build`) to prevent double-claims. Each step uses `WHERE status = ?` for optimistic concurrency. At most one runner succeeds for any given build. The runner_id is set on the build after successful assignment.
- **Build state transitions** follow the 9-state machine defined in Phase 2:
  ```
  queued -> scheduled -> assigned -> running -> succeeded
    |          |            |          |
  canceled   canceled    canceled   canceled
    or         or       timed_out  timed_out
  expired    expired               or failed
  ```
- **Lease timeout** (5 minutes): builds in `assigned` state that do not transition to `running` within 5 minutes are automatically requeued by the background monitor. The `runner_id` is cleared on requeue to prevent the stale runner from mutating the build.
- **Build timeout** (60 minutes): builds in `running` state exceeding 60 minutes are transitioned to `timed_out` by the background monitor. Runners check for timeout between steps by polling `GET /v1/runners/{runner_id}/jobs/{job_id}`.
- **Runner heartbeat timeout** (2 minutes): runners that miss heartbeats for 2 minutes are marked `offline`.

Internal architecture (per ADR-0003):

- **Job dispatch**: Runners claim jobs directly from SQLite via the claim endpoint. The `claim_job` query uses `SELECT ... WHERE status='queued' LIMIT 1` with optimistic locking transitions (queued → scheduled → assigned). No in-memory job queue is needed because runners pull work via HTTP polling and SQLite serializes concurrent claims.
- **Event bus**: `tokio::sync::broadcast` channel for fan-out of build state change events to SSE subscribers (used in Phase 4 for live log streaming).
- **Background monitors**: Tokio tasks started with the daemon that periodically scan for lease timeouts, build timeouts, and stale runner heartbeats.
- **Startup recovery**: On daemon start, builds stuck in `scheduled` state (indicating a claim was in progress when the daemon shut down) are transitioned back to `queued` via SQLite. Builds already in `queued` state need no action since runners claim directly from the database.

## Security Considerations

- Optimistic locking on the claim query prevents race conditions when multiple runners attempt concurrent claims. The SQL `WHERE status = 'queued'` clause combined with SQLite's serialized writes ensures at most one runner wins.
- State machine transitions are validated server-side. Invalid transitions (e.g., `succeeded` to `running`) are rejected with 409 Conflict.
- Timeout enforcement prevents resource exhaustion from stuck or abandoned builds. Builds cannot remain in non-terminal states indefinitely.
- Runner heartbeat staleness detection marks unresponsive runners as `offline`, preventing work from being assigned to dead runners.
- All state transitions (including timeout-triggered and requeue operations) produce audit events in `build_events` with actor set to `system` and a descriptive reason.

## Migration and Rollout

- No schema migration required for scheduling. All tables and columns needed exist from migration 005 (Phase 2). Migration 006 adds `step_results` and `exit_code` columns to the `builds` table for runner-reported execution metadata.
- Job dispatch uses SQLite directly per ADR-0003 (revised). The broadcast channel provides event fan-out for SSE. No external infrastructure is required (no NATS, no Redis).
- On daemon startup, builds stuck in `scheduled` state are transitioned back to `queued` via SQLite, ensuring no builds are lost across restarts.
- Background monitor tasks (lease timeout, build timeout, heartbeat staleness) start automatically with the daemon and run on configurable intervals.
- The `cancel_previous` concurrency policy from Phase 2 operates on the database directly — no in-memory queue coordination is needed.

## Acceptance Criteria

- [ ] Queued builds are dispatched to claiming runners via atomic claim protocol
- [ ] No double-claim: concurrent claim attempts for the same build result in at most one success
- [ ] Lease timeout (5 min): abandoned assigned builds are automatically requeued
- [ ] Build timeout (60 min): long-running builds transition to timed_out
- [ ] Runner heartbeat timeout (2 min): stale runners marked offline
- [ ] Daemon restart recovers stale `scheduled` builds back to `queued` in DB
- [ ] Canceled builds in any pre-terminal state transition correctly to canceled
- [ ] All timeout and requeue operations produce audit events with actor and reason

## Owner

oore.build team

## Last Updated

`2026-02-08`
