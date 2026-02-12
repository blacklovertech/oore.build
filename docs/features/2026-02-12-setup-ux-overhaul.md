# Setup Journey UX Overhaul

## Status

`ready`

## Problem

The first-time setup journey had several critical UX issues:

1. **Hosted UI broken for OIDC flows** — redirect URI validation only allowed `http://localhost`, blocking `https://ci.oore.build`.
2. **Two separate callback URIs** — `/setup/owner` and `/auth/callback` both received OIDC redirects, forcing users to whitelist two URIs per origin.
3. **No predefined OIDC providers** — users had to manually type issuer URLs without guidance.
4. **No redirect URI guidance** — users had to guess what to whitelist in their identity provider.
5. **Docs redirect URI mismatch** — documentation referenced `/setup/owner/callback` which was incorrect.
6. **Complete step showed minimal info** — no way to verify OIDC configuration before irreversible finalization.
7. **No docs links from setup wizard** — no help acquiring OIDC credentials.
8. **Install script handoff was awkward** — required manual copy of URLs and separate browser navigation.

## User Impact

All new users setting up an oore.build instance benefit. The changes reduce setup friction by:

- Eliminating the need to whitelist multiple redirect URIs (now just one per origin)
- Providing predefined OIDC provider configurations with auto-filled issuer URLs
- Showing the exact redirect URI to copy into the identity provider, with a copy button
- Linking to provider-specific setup documentation from the wizard
- Displaying full configuration details (issuer URL, owner email) before the irreversible "Complete Setup" action
- Automating the terminal-to-browser handoff in the install script

## UI Changes

### OIDC Configuration Step (`/setup/oidc`)

- **Provider selector**: Select component with predefined providers (Google, Microsoft, Okta, Auth0, Keycloak, Custom). Google auto-fills and locks the issuer URL. Others show placeholder templates.
- **Redirect URI display**: Alert block showing the single `${origin}/auth/callback` URI with a copy-to-clipboard button.
- **Docs links**: Per-provider link to setup documentation on docs.oore.build.

### Unified OIDC Callback (`/auth/callback`)

- Single callback route handles both setup owner verification and regular authentication flows.
- Flow type determined by `sessionStorage` key (`oore_oidc_flow`): `setup_owner` or `auth`.
- `/setup/owner` no longer receives OIDC callbacks — it only shows the "Authenticate with OIDC Provider" button.

### Enriched Complete Step (`/setup/complete`)

- Configuration summary now shows: state, full instance ID, OIDC issuer URL, and owner email.
- Data sourced from new `GET /v1/setup/summary` endpoint.

### Setup Layout (`/setup`)

- Handles `?backend=` query parameter: auto-adds backend instance when store is empty, then scrubs the param from the URL.

### Login Page (`/login`)

- Stores `oore_oidc_flow: 'auth'` in sessionStorage before redirect for unified callback routing.

## API Changes

### New Endpoint: `GET /v1/setup/summary`

- **Auth**: Setup session token (Bearer)
- **Response**: `{ instance_id, state, issuer_url?, owner_email? }`
- Returns the current setup configuration for review before finalization.

### Modified: `validate_redirect_uri`

- Now accepts an `allowed_origins` parameter derived from CORS configuration.
- Rules:
  - `http://localhost` and `http://127.0.0.1` (any port) always allowed.
  - Non-localhost origins must use `https`.
  - Path must be `/auth/callback`.
  - Origin must be in the CORS allowed origins list.

## Security Considerations

1. **No `?token=` in URLs** — bootstrap tokens are not passed via URL parameters. They are copied from the terminal to prevent leaks via browser history, referrer headers, and CDN logs.
2. **Redirect URI path validation** — not just origin-only matching. The path must be exactly `/auth/callback`.
3. **HTTPS enforced for non-localhost** — prevents protocol downgrade attacks on OIDC callbacks.
4. **`?backend=` guarded** — only auto-adds an instance if the store is empty, preventing phishing via crafted links that silently switch to an attacker-controlled backend. URL parameter is scrubbed immediately.
5. **CORS origins = redirect allowlist** — acceptable because the operator explicitly controls `OORE_CORS_ORIGINS`.
6. **Install script token guard** — skips bootstrap token generation if the instance is already configured (handles reinstall/upgrade).

## Migration and Rollout

- No database migrations required.
- Existing instances with `/setup/owner/callback` in their IdP redirect URIs should update to `/auth/callback`. The old path will no longer receive callbacks.
- CORS origins (`OORE_CORS_ORIGINS`) now also serve as the redirect URI allowlist. Operators should verify their CORS configuration includes all origins they want to allow for OIDC callbacks.

## Acceptance Criteria

- [x] `https://ci.oore.build/auth/callback` accepted as redirect URI when origin is in CORS config
- [x] `https://evil.com/auth/callback` rejected (origin not in CORS config)
- [x] `https://ci.oore.build/evil/path` rejected (path not `/auth/callback`)
- [x] `http://ci.oore.build/auth/callback` rejected (non-localhost must be https)
- [x] `http://localhost:3000/auth/callback` accepted
- [x] Single `/auth/callback` handles both setup and regular auth flows
- [x] OIDC provider combobox shows predefined providers with auto-fill
- [x] Redirect URI displayed with copy button in setup wizard
- [x] Complete step shows issuer URL and owner email from summary endpoint
- [x] Install script auto-starts daemon, generates token, opens browser with `?backend=`
- [x] `?backend=` only auto-adds instance when store is empty
- [x] All OIDC guide docs reference single `/auth/callback` URI

## Owner

Platform team

## Last Updated

`2026-02-12`
