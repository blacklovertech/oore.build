# ADR-0006: Local Auto-Bootstrap on First Login

## Status

Accepted

## Date

2026-02-14

## Context

Local-first onboarding still required two manual setup steps in local mode:

- copy/paste bootstrap token
- explicit owner email entry

For alpha this created avoidable friction and confusion, even when backend and UI were both running on the same machine over loopback.

## Decision

1. Keep runtime modes unchanged:
   - `local` (default)
   - `remote` (opt-in)
2. In `local` mode, first successful `POST /v1/auth/local/login` may auto-finalize bootstrap if setup is still pending.
3. Keep setup-token flow intact for remote/manual setup paths.
4. Keep setup endpoint lockout after `ready` unchanged.

## Rationale

### Reduce first-run friction

Local operators can move directly from daemon startup to login/dashboard.

### Preserve security boundaries

Remote/manual setup still uses one-time TTL-bound setup tokens and setup endpoint gating.

### Maintain mode clarity

Local and remote onboarding are intentionally different to match operator intent and risk profile.

## Consequences

- Local mode no longer requires token entry or owner email form in the default first-run path.
- Existing setup token commands remain supported for remote/manual operations.
- Contract/docs must reflect that token flow is not mandatory for default local first login.

## Contract References

- `docs/platform-contract.md` section 7 (Auth and Bootstrap Contract)
- `docs/strict-guidelines.md` bootstrap and local mode rules
