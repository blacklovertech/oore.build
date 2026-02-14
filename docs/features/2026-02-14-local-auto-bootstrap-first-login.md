# Local Auto-Bootstrap on First Login

## Status

`implemented`

## Problem

Local-first onboarding still required manual setup-token entry and owner email submission even when backend and UI were both on loopback. This added friction and confused first-time operators.

## User Impact

- Local mode first-run no longer requires token copy/paste.
- Local mode first-run no longer requires owner email form completion.
- First local entry can auto-detect known localhost daemon ports, auto-sign-in, and land on dashboard.
- Remote/manual setup token flow remains available.

## UI Changes

- Dashboard route probes known local daemon ports (`127.0.0.1:8787`, `:8788`, `:8790`) and auto-selects the first reachable instance.
- Setup route redirects local pending instances to `/`.
- Dashboard auto-attempts local login and bootstrap finalization in local mode when no valid session exists.
- If local daemon detection or auto-sign-in fails, existing manual add-instance/login flow remains unchanged.

## API Changes

- `POST /v1/auth/local/login` now auto-finalizes local bootstrap when runtime mode is `local` and setup is not yet `ready`.
- No new endpoint added.

## Security Considerations

- Runtime mode gate remains enforced: local login still returns `mode_restricted` in remote mode.
- Setup-token endpoints and TTL semantics remain unchanged for token-based setup flows.
- Setup endpoints remain disabled after `ready`.

## Migration and Rollout

1. Deploy backend and web changes together.
2. Existing instances already in `ready` are unaffected.
3. New local instances can authenticate directly through local login.

## Acceptance Criteria

- [x] Local first login succeeds when setup is pending and runtime mode is local.
- [x] Local first login transitions setup status to `ready`.
- [x] Local first login creates/ensures an active owner user.
- [x] Local first-run UX does not require token or email entry by default.
- [x] Remote mode continues rejecting `POST /v1/auth/local/login`.

## Owner

Platform team

## Last Updated

`2026-02-14`
