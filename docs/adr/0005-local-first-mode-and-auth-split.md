# ADR-0005: Local-First Runtime Mode and Auth Split for V1 Alpha

## Status

Accepted

## Date

2026-02-13

## Context

Current onboarding assumes operators are ready to expose backend services over the internet early in setup. This creates high friction for first-time users and increases setup failure probability during alpha.

The previous contract locked V1 auth as OIDC-only. In practice, this forces local-only operators into identity-provider setup and callback-network constraints before they can complete a successful first-run experience.

The alpha objective has shifted to:

- make localhost-first onboarding the default path
- avoid internet exposure requirements during first-run
- provide a later, explicit path for remote/hardened operation

## Decision

1. Introduce explicit runtime modes:
   - `local` (default)
   - `remote` (operator opt-in)
2. Split auth policy by mode:
   - `local` mode: OIDC is not required for operator sign-in
   - `remote` mode: OIDC is required
3. Treat source integrations as mode-gated:
   - `local` mode: `local_git` integrations only
   - `remote` mode: GitHub/GitLab integrations enabled
4. Make remote exposure an explicit enable action, not an onboarding default.

## Rationale

### Lower onboarding risk

Local-first flow removes HTTPS callback/public reachability dependencies from initial setup.

### Better user trust progression

Operators first prove value on a local machine, then opt into remote/network complexity when ready.

### Cleaner threat boundaries

Mode-aware behavior clarifies which security controls are mandatory in each environment instead of mixing all concerns in first-run flow.

### Product focus for alpha

`local_git` source support enables fully local end-to-end operation without waiting for webhook topology choices.

## Consequences

- This ADR intentionally changes prior OIDC-only contract language.
- `docs/platform-contract.md` and `docs/strict-guidelines.md` are updated to mode-aware auth.
- Setup and auth endpoints will gain local-mode flows in addition to existing OIDC flows.
- Integrations UI/API must be mode-aware, with GitHub/GitLab blocked until remote mode is enabled.
- Existing webhook hardening remains required for remote mode.

## Migration/Compatibility Notes

- Existing remote-style setups remain valid.
- New installs default to local mode.
- Remote mode activation flow must include preflight checks (origins, callback path, reachability, operator intent).

## Contract References

- `docs/platform-contract.md` section 7 (Auth and Bootstrap Contract)
- `docs/platform-contract.md` section 13 (API Boundary Contract)
- `docs/strict-guidelines.md` product scope and integration rules
