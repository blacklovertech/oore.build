# ADR-0008: Keep Loopback Local Login Available After Enabling External Access

## Status

Accepted

## Date

2026-02-14

## Context

After enabling External Access (`runtime_mode=remote`), operators could be
forced into OIDC-only sign-in immediately. If OIDC account mapping/invite setup
was incomplete, this could lock out owner operations and recovery from the host
machine.

This was reported as a practical onboarding and operations gap during alpha.

## Decision

1. `POST /v1/auth/local/login` remains loopback-only in all runtime modes.
2. During setup (`setup_state != ready`), local login bootstrap remains
   restricted to `local` mode only.
3. In `remote` mode, non-loopback interactive sign-in still requires OIDC.

## Rationale

### Preserve network security boundary

No non-loopback local auth is introduced. The trust boundary from ADR-0007
remains intact for LAN/Tailscale/public paths.

### Avoid owner lockout

Host operators retain a reliable loopback recovery/admin sign-in path while
finishing OIDC account mapping and user provisioning.

## Consequences

- External Access no longer hard-switches host operators to OIDC-only.
- Login UX must offer local sign-in on loopback even in `remote` mode.
- Contract language is clarified to distinguish non-loopback OIDC requirement
  from loopback local admin access.

## Contract References

- `docs/platform-contract.md` section 7
- `docs/strict-guidelines.md` product/scope + bootstrap/security rules
