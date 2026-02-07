# Triggering and Concurrency Policy

## Status

`released`

## Problem

Without a deterministic trigger and concurrency policy, builds pile up on busy branches. Developers pushing rapidly create redundant builds that waste resources. The system needs automated stale-build cancellation and clear trigger sourcing for auditability.

## User Impact

- **Developers** see faster feedback because stale builds on the same branch are automatically canceled when a new push arrives.
- **Admins** can configure per-pipeline concurrency policies (cancel_previous) to control build queuing behavior.
- **All users** can trace any build back to its trigger source (manual, API, webhook, or schedule) with actor and event metadata.

## UI Changes

No new UI pages for concurrency configuration in Phase 2. Concurrency policy is configured via pipeline settings (Phase 5 scope). The build list and detail pages show:

- Trigger type badge (manual, api, webhook, schedule)
- Trigger actor (who or what triggered the build)
- Auto-cancellation reason in build events timeline ("superseded by new build")

## API Changes

### Trigger Types

All builds record their trigger source:

- `manual` — created via `POST /v1/projects/{project_id}/builds` by an authenticated user
- `webhook` — created by `trigger_build_from_webhook()` after webhook normalization
- `api` — reserved for future programmatic triggers
- `schedule` — reserved for future cron-style triggers

### Webhook-to-Build Pipeline

1. Webhook arrives at `POST /v1/webhooks/{github|gitlab}`
2. Signature/token verified, idempotency checked, payload stored
3. Payload normalized into `NormalizedWebhookEvent` (provider-agnostic)
4. `trigger_build_from_webhook()` resolves repository → project → pipeline
5. Concurrency policy applied (cancel_previous on same pipeline+branch)
6. Build record created with immutable trigger metadata

Actionable webhook events:
- GitHub: `push`, `pull_request`
- GitLab: `Push Hook`, `Merge Request Hook`

### Concurrency Policy

Stored in `pipelines.concurrency` JSON column:

```json
{
  "cancel_previous": true,
  "max_concurrent": null
}
```

**`cancel_previous`** behavior:
- When creating a new build, if the pipeline has `cancel_previous: true` and a branch is set:
  - Find all non-terminal builds on the same pipeline + branch
  - Auto-cancel each via `transition_build(..., Canceled, "superseded by new build")`
  - Log cancellation in build events with actor and reason
- Deterministic: all matching builds are canceled before the new build is created
- Branch-scoped: only affects builds on the same branch

### Trigger Metadata (Immutable)

Every build stores:

| Field | Source |
|-------|--------|
| `trigger_type` | manual, api, webhook, schedule |
| `trigger_actor` | user email (manual) or webhook sender login |
| `trigger_event` | webhook event type (push, pull_request, etc.) |
| `trigger_ref` | git ref or branch name |
| `commit_sha` | HEAD commit at trigger time |
| `webhook_id` | FK to integration_webhooks for traceability |
| `config_snapshot` | pipeline config + trigger context captured at creation |

## Security Considerations

- Trigger metadata is immutable after build creation — cannot be altered post-fact.
- Webhook-triggered builds include the webhook_id FK for full traceability back to the raw provider payload.
- Auto-cancellation is audited: each canceled build gets a build_event with reason "superseded by new build".
- Concurrency policy is per-pipeline, not global — prevents one pipeline's policy from affecting another.
- Only actionable webhook events trigger builds (push/pull_request), preventing spam from other event types.

## Migration and Rollout

- No separate migration — concurrency policy stored in `pipelines.concurrency` JSON column (migration 005).
- Webhook-to-build pipeline is wired in `webhooks.rs` and `builds.rs`.
- `cancel_previous` defaults to `false` — no behavior change for existing pipelines.
- Future `max_concurrent` field reserved but not enforced in Phase 2.

## Acceptance Criteria

- [x] Manual trigger creates immutable build with actor and trigger metadata.
- [x] Webhook trigger normalizes GitHub/GitLab events and creates builds.
- [x] `cancel_previous` policy auto-cancels stale builds on same pipeline+branch.
- [x] Auto-cancellation is deterministic (all matching builds canceled before new build created).
- [x] Every trigger source is auditable via build_events and trigger metadata.
- [x] Duplicate webhook deliveries are idempotent (200 OK, no duplicate builds).
- [x] Only actionable events (push, pull_request) trigger builds.
- [x] Webhook-to-build resolution follows repository → project → pipeline chain.

## Owner

Platform Team

## Last Updated

`2026-02-07`
