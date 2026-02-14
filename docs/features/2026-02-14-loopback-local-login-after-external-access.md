# Loopback Local Login After External Access Enablement

## Status

`ready`

## Problem

Enabling External Access immediately forced OIDC-only sign-in behavior in UX.
If OIDC account mapping was not ready, owners could hit `user_not_found` and
get blocked from administering the instance.

## User Impact

- Host-machine operators can still sign in locally from loopback after enabling
  External Access.
- Non-loopback users still use OIDC as before.
- This removes a lockout class during OIDC rollout/migration.

## UI Changes

- Login now prioritizes local sign-in when both UI host and backend host are
  loopback, even if runtime mode is `remote`.
- Sign-in method label reflects loopback local availability in `remote` mode.
- Local email input remains available on loopback in `remote` mode.

## API Changes

- `POST /v1/auth/local/login` behavior change:
  - loopback local login is allowed in both runtime modes once setup is `ready`
  - local-login bootstrap remains `local`-mode-only while setup is incomplete
- Error semantics updated:
  - `mode_restricted` now indicates setup-incomplete + remote-mode restriction
    (instead of blanket remote-mode denial).

## Security Considerations

- No change to non-loopback trust boundary:
  - local login remains loopback-only
  - non-loopback access still requires External Access + OIDC
- This is a host-local recovery/usability path, not a network auth bypass.

## Migration and Rollout

- No data migration required.
- Contract clarification added plus ADR for this MUST-level behavior update.

## Acceptance Criteria

- [x] Loopback local login succeeds when setup is `ready` and runtime mode is
  `remote`.
- [x] Loopback local login remains blocked during setup if runtime mode is
  `remote`.
- [x] Non-loopback local login remains impossible.

## Owner

Platform team

## Last Updated

`2026-02-14`
