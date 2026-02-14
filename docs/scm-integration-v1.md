# SCM Integration Blueprint (V1, Mode-Aware)

Status: Active implementation guidance
Last updated: 2026-02-13

## Why this exists

This guide defines source integration strategy after the local-first reset:

- default onboarding is local-only and low-friction
- remote exposure is explicit operator opt-in
- source connection strategy must match runtime mode

## Runtime Modes

### Local mode (default)

- intended for localhost/private-network operation
- no hosted-provider webhook dependency
- source integration is `local_git`
- GitHub/GitLab integration setup is disabled

### Remote mode (opt-in)

- intended for internet-reachable backend operation
- OIDC is required for interactive sign-in
- GitHub/GitLab integration setup is enabled
- webhook ingestion endpoints are enabled

## Core Decision

Use **mode-gated integration providers**:

- `local_git` for local mode
- `github` and `gitlab` for remote mode

This removes first-run dependency on inbound webhooks and public callback reachability.

## Local Git (V1 Alpha Standard)

### Integration model

- A local integration stores:
- repository path (absolute path on host)
- display name
- default branch (optional)
- active state

### Trigger model

- Initial alpha: manual/API triggers only.
- Poll-based auto-triggering for GitHub/GitLab is deferred.

### Validation requirements

- Path must exist and be a git repository.
- Path must resolve to an operator-approved filesystem location.
- Symlink traversal outside allowed roots must be rejected.
- Build snapshot must include a resolvable local source URL/path.

## GitHub and GitLab (Remote-Only in V1)

### Availability

- Disabled in local mode.
- Enabled only after remote mode is explicitly activated.

### Delivery model

- Backend-owned callback and webhook endpoints.
- Hosted UI remains UI-only (`ci.oore.build`); backend receives provider traffic.
- Existing webhook security and idempotency constraints remain mandatory.

### Deferred item

- Provider polling (webhookless GitHub/GitLab automation) is explicitly out of current alpha scope.

## Data Model Direction

Minimum provider set becomes:

- `local_git`
- `github`
- `gitlab`

Integration metadata must include mode compatibility so backend enforcement is deterministic.

## Security Requirements

- Local mode must not silently expose backend to internet paths.
- Local mode must not require webhook secrets or external callback registration.
- Remote mode keeps current webhook verification requirements:
- GitHub HMAC verification
- GitLab token verification
- replay/idempotency controls
- Local repository path handling must guard against path traversal and unsafe root targeting.

## UX Rules

- Installer and first-run setup must default to local mode with local web UI.
- Integrations UI in local mode shows `local_git` flows only.
- GitHub/GitLab cards are hidden or disabled with clear “Enable Remote Mode first” guidance.
- Remote mode enable action is explicit and reversible only via operator-level flow.

## Rollout Order

1. Mode primitive and backend enforcement.
2. Local auth + local-first installer/setup flow.
3. `local_git` integration API + UI.
4. Build source resolution for local repositories.
5. Remote mode enable flow and provider integration re-enable.

## References

- `docs/platform-contract.md`
- `docs/strict-guidelines.md`
- `docs/v1-roadmap.md`
