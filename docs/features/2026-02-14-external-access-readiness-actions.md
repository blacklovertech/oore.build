# External Access Readiness Actions in Settings

## Status

`ready`

## Problem

External Access readiness checks surfaced failures, but key failures were not
resolvable from the product UI. In local-first instances, `oidc_configured`
could be a dead end after setup reached `ready`, blocking External Access
enablement without a clear in-product fix path.

## User Impact

- Owners can now configure OIDC for External Access directly from
  Preferences after setup is complete.
- Readiness rows now include direct actions (configure OIDC, copy env
  templates, open docs), reducing trial-and-error and setup confusion.
- External Access activation remains fail-closed but is now operationally
  actionable.

## UI Changes

- `apps/web/src/routes/settings/preferences.tsx`
  - External Access readiness rows now include check-specific actions.
  - Added owner-only OIDC configuration dialog in Preferences.
  - Added copy helpers for `OORE_PUBLIC_URL` and `OORE_CORS_ORIGINS`
    templates.
  - Added direct guide links for OIDC/env configuration.

## API Changes

- Added `PUT /v1/settings/external-access/oidc`
  - Owner-only.
  - Request: `ConfigureExternalAccessOidcRequest`
  - Response: `ConfigureExternalAccessOidcResponse`
  - Performs OIDC provider discovery and persists runtime OIDC settings.
- Existing External Access preflight endpoint unchanged:
  - `GET /v1/settings/external-access/preflight`

## Security Considerations

- New OIDC config endpoint is explicitly owner-only and still protected by
  `instance_settings:write` permission checks.
- Endpoint is state-gated to `setup_state == ready` to avoid setup-flow
  policy conflicts.
- Client secret is encrypted at rest using the existing encryption key path.
- Privileged changes are audit logged (`external_access_oidc_configured`).
- External Access enablement remains separate and fail-closed behind preflight
  checks and owner-only mode mutation.

## Migration and Rollout

- No schema migration required.
- No breaking API changes.
- OpenAPI spec regenerated to include the new endpoint and types.
- Settings API docs updated with request/response/error contract.

## Acceptance Criteria

- [x] Owner can configure OIDC for External Access from Preferences after setup is `ready`.
- [x] Non-owner receives `external_access_owner_required` when calling the new endpoint.
- [x] Readiness UI provides direct actions for failed checks.
- [x] External Access enablement behavior remains fail-closed and owner-only.

## Owner

Platform team

## Last Updated

`2026-02-14`
