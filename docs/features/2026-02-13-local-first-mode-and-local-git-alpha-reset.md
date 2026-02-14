# Local-First Alpha Reset (Mode Split + Local Git)

## Status

`implemented`

## Problem

First-run onboarding currently assumes internet exposure and OIDC readiness too early. This creates avoidable friction for alpha users, especially operators evaluating on a single local machine.

## User Impact

Operators can complete setup and first build fully locally, without exposing backend endpoints to the internet or configuring OIDC before value is proven.

Remote operation remains available through an explicit enable action with stronger guardrails.

## UI Changes

- Installer flow and setup copy become local-first by default.
- Setup UI presents mode-aware behavior:
- local mode path (no OIDC requirement)
- remote mode path (OIDC required)
- Integrations UI is mode-gated:
- local mode shows `local_git` integration flow
- GitHub/GitLab actions are disabled or hidden until remote mode is enabled
- Project creation and build trigger UX blocks source-missing states that would fail at runner checkout.

## API Changes

Implemented in this increment:

- `InstancePreferences` now includes `runtime_mode` (`local` | `remote`).
- `PUT /v1/settings/preferences` now accepts optional `runtime_mode`.
- Runtime mode defaults to `local` in persisted preferences.
- GitHub/GitLab integration setup and webhook ingestion now return `mode_restricted` when runtime mode is `local`.
- `GET /v1/public/setup-status` now includes `runtime_mode`.
- `POST /v1/setup/local-owner/create` enables local-mode owner creation without OIDC.
- `POST /v1/auth/local/login` enables local-mode session login without OIDC.
- `POST /v1/integrations/local-git` registers local git repositories.
- `GET /v1/integrations/local-git` lists local git integrations.
- `DELETE /v1/integrations/local-git/{id}` removes local git integrations.
- Build snapshot repo URL resolution now supports `local_git` repositories.
- `POST /v1/projects/{project_id}/builds` now blocks source-missing/unresolvable projects (`source_not_configured` / `source_unresolvable`) and rejects branch/SHA-empty requests without a project default branch.
- Webhook-triggered build creation now skips events that cannot resolve a repository URL or checkout target (missing branch and commit SHA), preventing queued builds that would fail at checkout.

Planned additive surface (next increments):

- mode management:
- `POST /v1/mode/enable-remote`

Existing OIDC and provider integration endpoints remain for remote mode.

## Security Considerations

- Local mode defaults to non-internet exposure and loopback-safe behavior.
- Remote mode activation is explicit and auditable.
- Existing webhook verification/idempotency controls remain mandatory in remote mode.
- Local repository paths require validation and path-safety checks.
- No new plaintext secret storage patterns are introduced.

## Migration and Rollout

1. [x] Ship mode primitive and local-first installer defaults.
2. [x] Add local auth and `local_git` integration support.
3. [x] Gate GitHub/GitLab integrations behind remote mode.
4. [ ] Add explicit remote-mode enable workflow and preflight checks.

No destructive migration is required; behavior changes are additive and mode-scoped.

## Acceptance Criteria

- [x] New install defaults to local mode and does not require internet exposure.
- [x] Local mode setup can complete without OIDC.
- [x] `local_git` repositories can be registered and used for successful builds.
- [x] GitHub/GitLab integrations are unavailable in local mode.
- [ ] Remote mode enablement is explicit, auditable, and unlocks OIDC + provider integrations.
- [x] Project/build UX prevents empty-source configuration that would cause checkout failure.

## Owner

Platform team

## Last Updated

`2026-02-14`
