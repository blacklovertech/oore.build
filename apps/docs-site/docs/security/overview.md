# Security Overview

oore.build is designed with security as a core requirement. This page summarizes the security architecture and mechanisms used across the platform.

## Authentication Model

oore.build uses **OIDC-only authentication** in V1. There are no local usernames or passwords.

| Property | Value |
|---|---|
| Auth protocol | OpenID Connect (Authorization Code + PKCE) |
| Local passwords | Not supported in V1 |
| Session storage | In-memory (server-side), hashed tokens |
| Session TTL | 24 hours |
| Setup session TTL | 30 minutes (sliding window) |

See [OIDC Authentication](/features/oidc-authentication) for the full authentication flow.

## Token Hashing {#token-hashing}

All tokens (bootstrap tokens, setup session tokens, user session tokens) are hashed with **SHA-256** before storage. The plaintext token is returned to the client exactly once and never persisted on the server.

```
plaintext_token = random_bytes(32) |> hex_encode
stored_hash = SHA-256(plaintext_token) |> hex_encode
```

This means that even if the database or in-memory store is compromised, the attacker cannot recover usable tokens.

### Token Generation

Tokens are generated using `OsRng` (operating system cryptographic random number generator) and are 32 bytes (256 bits) of randomness, hex-encoded to 64 characters.

## Encryption at Rest {#encryption-at-rest}

OIDC client secrets are encrypted before storage using **AES-256-GCM** (Galois/Counter Mode).

### Encryption Key

- 256-bit key stored at `~/Library/Application Support/oore/encryption.key`
- Generated using `SystemRandom` (cryptographic RNG from the `ring` crate)
- File permissions set to `0o600` (owner read/write only)
- Auto-generated on first use if it does not exist

### Encryption Format

The encrypted payload is stored as a base64-encoded string containing:

```
base64( nonce[12 bytes] || ciphertext || GCM_tag[16 bytes] )
```

- A fresh 12-byte random nonce is generated for each encryption operation
- The same plaintext encrypted twice produces different ciphertext (due to random nonces)
- Decryption requires the correct key and validates both the nonce and authentication tag

::: warning
If the encryption key file is lost or deleted, encrypted OIDC client secrets cannot be recovered. The OIDC provider must be reconfigured.
:::

## PKCE Flow {#pkce-flow}

All OIDC authorization flows use **PKCE** (Proof Key for Code Exchange) with the **S256** challenge method to prevent authorization code interception attacks.

```
1. Generate random code_verifier
2. code_challenge = BASE64URL(SHA-256(code_verifier))
3. Send code_challenge to IdP in authorization request
4. Store code_verifier server-side (keyed by CSRF state)
5. On callback, send code_verifier with the token exchange request
6. IdP verifies: SHA-256(code_verifier) == code_challenge
```

The PKCE verifier is stored server-side in the `pending_auth` map and is never exposed to the client.

## CSRF Protection

Every OIDC authorization request generates a random CSRF state token. This token is:

1. Included in the authorization URL sent to the IdP
2. Returned by the IdP in the callback query parameters
3. Validated against the server-side `pending_auth` store

If the state parameter does not match any pending auth entry, the request is rejected with a `400 invalid_state` error.

Pending auth entries have a **10-minute TTL** and are cleaned up on each new auth request.

## Setup Security

### Bootstrap Token

The bootstrap token is the initial credential used to establish trust during first-run setup:

| Property | Value |
|---|---|
| Entropy | 256 bits (32 random bytes via `OsRng`) |
| Format | 64-character hex string |
| Storage | SHA-256 hash only (plaintext never persisted) |
| Lifetime | Configurable TTL (default: 15 minutes) |
| Usage | One-time (consumed on verification) |

### Setup Session

After bootstrap token verification, a setup session is created:

| Property | Value |
|---|---|
| Token entropy | 256 bits (same as bootstrap token) |
| Storage | SHA-256 hash in SQLite |
| TTL | 30 minutes, sliding window |
| Sliding window | TTL resets on each authenticated request |
| Cleared on | Setup completion (`ready` state) |

### Setup Endpoint Auto-Disable

All setup mutating endpoints check the setup state before processing. When the state is `ready`:

- All `POST /v1/setup/*` endpoints return `409 Conflict`
- The state check happens before any authentication check
- This is a permanent condition -- there is no API to re-enable setup

## Session Lifecycle

### User Sessions

```
OIDC Callback ──> Create Session ──> Valid (24h) ──> Expired
                                         |
                                    POST /logout
                                         |
                                         v
                                      Revoked
```

- Sessions are created on successful OIDC callback
- Sessions are stored in-memory (do not survive daemon restarts)
- Sessions expire after 24 hours
- Sessions can be explicitly revoked via `POST /v1/auth/logout`
- Expired sessions are cleaned up via `cleanup_expired()`

### Setup Sessions

```
Bootstrap Verify ──> Create Session ──> Valid (30m sliding) ──> Expired
                                              |
                                         Setup Complete
                                              |
                                              v
                                           Cleared
```

- Setup sessions are created when a bootstrap token is verified
- Sessions use a 30-minute sliding-window TTL (renewed on each authenticated request)
- Sessions are cleared when setup completes

## HTTP Security

### CORS Policy

| Setting | Value |
|---|---|
| Allowed origins | `http://localhost:3000` |
| Allowed methods | `GET`, `POST`, `OPTIONS` |
| Allowed headers | `Content-Type`, `Authorization` |

### OIDC HTTP Client

The HTTP client used for OIDC discovery and token exchange is configured with:

- **10-second timeout** to prevent hanging connections
- **No redirect following** (`redirect::Policy::none()`) to prevent SSRF via open redirects at the discovery endpoint

::: tip
The no-redirect policy follows the `openidconnect` crate's recommendation for preventing SSRF attacks through malicious issuer URLs.
:::

## Data Storage

| Data | Storage | Protection |
|---|---|---|
| Setup state | SQLite file | File system permissions |
| Bootstrap token | SQLite (SHA-256 hash) | Hash-only storage |
| Setup session | SQLite (SHA-256 hash) | Hash-only storage, TTL |
| OIDC config | SQLite (plaintext) | Issuer URL, client ID, endpoints |
| OIDC client secret | SQLite (AES-256-GCM encrypted) | Encryption at rest |
| Encryption key | File (`encryption.key`) | `0o600` permissions |
| User sessions | In-memory `HashMap` | SHA-256 hashed keys, TTL |
| Pending auth | In-memory `HashMap` | 10-minute TTL, auto-cleanup |
