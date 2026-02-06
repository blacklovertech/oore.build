# Auth API

The Auth API handles OIDC authentication and session management. These endpoints are only available after [setup is complete](/features/setup-wizard) (`setup_state == Ready`).

For an overview of the authentication flow, see the [OIDC Authentication](/features/oidc-authentication) feature documentation.

## OIDC Start {#oidc-start}

Initiate the OIDC authorization code flow with PKCE. Performs provider discovery, generates security parameters (PKCE challenge, CSRF state, nonce), and returns the authorization URL.

```
GET /v1/auth/oidc/start
```

**Authentication**: None (public)

**State requirement**: `ready` only

### Query Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `redirect_uri` | `string` | No | `http://127.0.0.1:8787/v1/auth/oidc/callback` | Override the redirect URI sent to the IdP |

### Response `200 OK`

```json
{
  "authorization_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&response_type=code&scope=openid+email+profile&state=...&nonce=...&code_challenge=...&code_challenge_method=S256",
  "state": "abc123-csrf-state-token"
}
```

| Field | Type | Description |
|---|---|---|
| `authorization_url` | `string` | Full authorization URL to redirect the user to. Includes PKCE challenge, scopes (`openid`, `email`, `profile`), state, and nonce. |
| `state` | `string` | CSRF state token. Store this to validate the callback. |

### Internal Behavior

The daemon stores a pending auth entry keyed by the state value containing:
- PKCE verifier (for the token exchange)
- Nonce (for ID token verification)
- Redirect URI
- Creation timestamp

Pending entries expire after **10 minutes**. Expired entries are cleaned up on each new `/start` call.

### Error Responses

| Status | Code | Description |
|---|---|---|
| 409 | `setup_incomplete` | Setup is not yet complete |
| 500 | `oidc_not_configured` | OIDC configuration is missing |
| 500 | `oidc_config_error` | Invalid issuer URL or redirect URI |
| 500 | `http_client_error` | Failed to create HTTP client |
| 502 | `oidc_discovery_error` | Failed to discover OIDC provider metadata |

### Example

::: code-group
```bash [curl]
curl "http://127.0.0.1:8787/v1/auth/oidc/start"
```

```bash [curl with redirect_uri]
curl "http://127.0.0.1:8787/v1/auth/oidc/start?redirect_uri=http://localhost:3000/auth/callback"
```
:::

---

## OIDC Callback {#oidc-callback}

Handle the OIDC callback. Validates the CSRF state, exchanges the authorization code for tokens using the PKCE verifier, verifies the ID token, looks up the user, and creates a session.

```
POST /v1/auth/oidc/callback
```

**Authentication**: None (public)

**State requirement**: `ready` only (enforced by the OIDC config loader)

### Request Body

```json
{
  "code": "4/0AX4XfWh...",
  "state": "abc123-csrf-state-token"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | Yes | Authorization code returned by the IdP |
| `state` | `string` | Yes | CSRF state token (must match a pending auth entry) |

### Response `200 OK`

```json
{
  "session_token": "f7e8d9c0b1a2...",
  "expires_at": 1738886400,
  "user": {
    "email": "user@example.com",
    "oidc_subject": "110123456789012345678",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "role": "developer"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `session_token` | `string` | User session token for authenticating API requests. Valid for 24 hours. |
| `expires_at` | `integer` | Session expiry as Unix epoch (seconds) |
| `user.email` | `string` | Email address from the ID token |
| `user.oidc_subject` | `string` | OIDC subject identifier from the ID token |
| `user.user_id` | `string` | User UUID from the `users` table |
| `user.role` | `string` | User's role (`owner`, `admin`, `developer`, `qa_viewer`) |

### User Lookup

After verifying the ID token, the callback performs user lookup:

1. Looks up the user by `oidc_subject` in the `users` table
2. If found and `active`, proceeds to create a session
3. If not found by subject, looks for an `invited` user with a matching email
4. If an invited user is found, activates them (sets `oidc_subject`, transitions to `active`)
5. If no matching user exists, rejects the login with `403 Forbidden`

This means only [invited users](/features/user-management) or the instance owner can log in. Unknown OIDC identities are rejected.

### ID Token Verification

The callback performs the following verification on the ID token:

1. Signature verification against the provider's JWKS (JSON Web Key Set)
2. Nonce validation (must match the nonce generated in `/start`)
3. Standard OIDC claim validation (issuer, audience, expiry)

### Error Responses

| Status | Code | Description |
|---|---|---|
| 400 | `invalid_state` | Unknown or expired OIDC state parameter (possible CSRF attempt) |
| 400 | `auth_expired` | OIDC authorization request has expired (10-minute TTL) |
| 403 | `unknown_user` | OIDC identity does not match any invited or active user |
| 403 | `user_disabled` | User account has been disabled |
| 409 | `setup_incomplete` | Setup is not yet complete |
| 500 | `oidc_config_error` | Invalid issuer URL, redirect URI, or missing token endpoint |
| 500 | `decryption_error` | Failed to decrypt OIDC client secret |
| 500 | `http_client_error` | Failed to create HTTP client |
| 502 | `oidc_discovery_error` | Failed to discover OIDC provider metadata |
| 502 | `token_exchange_error` | Failed to exchange authorization code for tokens |
| 502 | `missing_id_token` | Identity provider did not return an ID token |
| 502 | `id_token_verification_error` | Failed to verify identity provider's ID token |
| 502 | `missing_email` | Identity provider did not include an email claim |

### Example

::: code-group
```bash [curl]
curl -X POST http://127.0.0.1:8787/v1/auth/oidc/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "4/0AX4XfWh...", "state": "abc123-csrf-state-token"}'
```
:::

::: tip
In a typical browser flow, the frontend receives the authorization code from the IdP redirect and sends it to this endpoint via a POST request.
:::

---

## Logout {#logout}

Revoke the caller's session. The session token becomes immediately invalid.

```
POST /v1/auth/logout
```

**Authentication**: User session token (Bearer)

**State requirement**: None (but requires a valid session, which implies `ready`)

### Request Body

None.

### Request Headers

```
Authorization: Bearer <session_token>
```

### Response `200 OK`

```json
{
  "ok": true
}
```

| Field | Type | Description |
|---|---|---|
| `ok` | `boolean` | Always `true` on success |

### Error Responses

| Status | Code | Description |
|---|---|---|
| 401 | `missing_auth` | Authorization header not provided |
| 401 | `invalid_session` | Invalid or expired session token |

### Example

::: code-group
```bash [curl]
curl -X POST http://127.0.0.1:8787/v1/auth/logout \
  -H "Authorization: Bearer <session_token>"
```
:::
