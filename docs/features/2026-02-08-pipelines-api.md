# Pipelines CRUD API and Configuration Validation

## Status

`ready`

## Problem

Pipeline configuration had no API surface or validation. Invalid trigger configurations (wrong event names, invalid branch patterns, unreasonable concurrency limits) could cause silent runtime failures during build execution. Developers needed to configure pipelines through direct database access, and there was no way to verify a configuration before committing it.

## User Impact

- **Developers** can create and configure pipelines with validated trigger and concurrency settings through the API and UI.
- **Trigger configuration** (events, branch filters) is validated before save, preventing invalid configs from reaching the execution engine.
- **Concurrency policies** (`cancel_previous`, `max_concurrent`) are configurable per pipeline, giving teams control over build queuing behavior.
- **Pipeline enable/disable** allows pausing a pipeline without deletion, preserving configuration and build history.
- A **dry-run validation endpoint** lets developers pre-check pipeline configs before submitting, reducing trial-and-error cycles.

## UI Changes

- **Pipeline detail page** at `/projects/{pid}/pipelines/{id}` showing pipeline info with enabled/disabled badge, trigger configuration card (events and branch patterns), concurrency policy card (cancel_previous toggle and max_concurrent value), and recent builds filtered to the pipeline.
- **Create pipeline dialog** with fields for name, config path, trigger event checkboxes (push, pull_request, tag_push), branch pattern input, and concurrency settings (cancel_previous toggle, max_concurrent number input).
- **Edit pipeline dialog** pre-filled with existing configuration for updating settings.
- **Enable/disable toggle** on the pipeline detail page, allowing operators to pause and resume pipelines.
- **Inline validation errors** surfaced from the dry-run validation endpoint, shown within the form before submission.

## API Changes

New endpoints:

- `POST /v1/projects/{project_id}/pipelines` -- Create a pipeline with validation. Request body includes `name` (string, required), `config_path` (string, optional, defaults to `.oore.yml`), `trigger_config` (object with `events` array and `branches` array), and `concurrency` (object with `cancel_previous` boolean and `max_concurrent` integer). Returns the created pipeline (enabled by default). RBAC: `pipelines:write`.
- `GET /v1/projects/{project_id}/pipelines` -- List pipelines for a project. Returns `{ "pipelines": [...], "total": <count> }`. RBAC: `pipelines:read`.
- `GET /v1/pipelines/{pipeline_id}` -- Pipeline detail including `build_count` aggregate. RBAC: `pipelines:read`.
- `PATCH /v1/pipelines/{pipeline_id}` -- Partial update with validation. Only provided fields are updated. RBAC: `pipelines:write`.
- `DELETE /v1/pipelines/{pipeline_id}` -- Delete a pipeline. Blocked with 409 Conflict if the pipeline has non-terminal builds. RBAC: `pipelines:delete`.
- `POST /v1/pipelines/validate` -- Dry-run validation of `trigger_config` and `concurrency` objects. Returns `{ "valid": true }` or `{ "valid": false, "errors": [...] }` with structured error list. Does not persist anything. RBAC: `pipelines:read`.

Validation rules:

- `trigger_config.events`: each entry must be one of `push`, `pull_request`, `tag_push`. Empty array means all events.
- `trigger_config.branches`: each entry must be a non-empty string.
- `concurrency.max_concurrent`: if provided, must be an integer in the range 1-100.

RBAC enforcement per role:

- **owner/admin**: read, write, delete
- **developer**: read, write
- **qa_viewer**: read only

## Security Considerations

- RBAC enforcement via Casbin middleware on all pipeline endpoints. Unauthorized requests receive 403 Forbidden.
- Audit logging for pipeline lifecycle actions (create, update, delete, enable/disable) with actor attribution.
- Input validation on trigger_config and concurrency fields prevents invalid configurations from reaching the execution engine, avoiding silent runtime failures.
- Pipeline delete protected against active builds (409 Conflict when non-terminal builds exist).
- The dry-run validation endpoint is non-destructive and does not modify any state.

## Migration and Rollout

- No schema migration needed -- the `pipelines` table already exists from migration 005.
- New API endpoints are additive with no breaking changes to existing endpoints.
- The validation endpoint is entirely non-destructive and safe to call at any time.
- No feature flags or gradual rollout required.

## Acceptance Criteria

- [x] Pipeline CRUD endpoints work for authorized roles
- [x] Trigger config validation rejects invalid event names with actionable errors
- [x] Concurrency policy validation enforces max_concurrent bounds (1-100)
- [x] Dry-run validation endpoint returns structured error list
- [x] Pipeline enable/disable works without deletion
- [x] Delete blocked when pipeline has non-terminal builds
- [x] Pipeline detail includes build count

## Owner

Phase 5 team

## Last Updated

`2026-02-08`
