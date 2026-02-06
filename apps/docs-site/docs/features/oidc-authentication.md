# OIDC Authentication

oore.build uses OpenID Connect (OIDC) as its sole authentication mechanism. There are no local usernames or passwords in V1.

## Overview

After [setup is complete](/features/setup-wizard), users authenticate through the configured OIDC identity provider (e.g., Google, Okta, Auth0). The authentication flow uses the Authorization Code grant with PKCE (Proof Key for Code Exchange) for security.

::: info
Auth endpoints are only available when the instance is in `ready` state. They return `409 Conflict` if setup is not complete.
:::

## Authentication Flow

```
Browser                  oore daemon              Identity Provider
  |                          |                          |
  |-- GET /auth/oidc/start ->|                          |
  |                          |-- OIDC Discovery ------->|
  |                          |<- Provider metadata -----|
  |                          |                          |
  |<- authorization_url -----|                          |
  |                          |                          |
  |-- Redirect to IdP ------------------------------>|
  |                          |                          |
  |<- Redirect with code, state -----------------------|
  |                          |                          |
  |-- GET /auth/oidc/callback ->|                       |
  |                          |-- Exchange code -------->|
  |                          |<- ID token + tokens -----|
  |                          |                          |
  |                          |-- Verify ID token        |
  |                          |-- Extract email, subject |
  |                          |-- Create session         |
  |                          |                          |
  |<- session_token, user ---|                          |
```

### Step 1: Initiate

The client calls `GET /v1/auth/oidc/start` with an optional `redirect_uri` query parameter. The daemon:

1. Loads the OIDC configuration from the state file
2. Performs OIDC discovery to fetch provider metadata
3. Generates a PKCE challenge (S256 method)
4. Generates a random CSRF state token and nonce
5. Builds the authorization URL with scopes: `openid`, `email`, `profile`
6. Stores the PKCE verifier, nonce, and redirect URI keyed by the CSRF state token
7. Returns the authorization URL and state token

### Step 2: User Authenticates

The client redirects the user to the `authorization_url`. The user authenticates with their identity provider and authorizes the requested scopes.

### Step 3: Callback

The IdP redirects back to the callback URL with `code` and `state` query parameters. The daemon handles `GET /v1/auth/oidc/callback`:

1. Validates the CSRF state parameter against stored pending auth entries
2. Checks that the pending auth request has not expired (10-minute TTL)
3. Exchanges the authorization code for tokens using the stored PKCE verifier
4. Extracts and verifies the ID token:
   - Signature verification against the provider's JWKS
   - Nonce validation
   - Standard claim validation
5. Extracts `email` and `subject` from the ID token claims
6. Creates a session with a 24-hour TTL
7. Returns the session token, expiry, and user info

## Session Management

### Session Creation

Sessions are created after a successful OIDC callback. Each session contains:

| Field | Description |
|---|---|
| `user_email` | Email address from the ID token |
| `oidc_subject` | OIDC subject identifier |
| `created_at` | Unix timestamp of session creation |
| `expires_at` | Unix timestamp of session expiry (24 hours from creation) |

### Session Storage

- Sessions are stored **in-memory** using a `HashMap` behind a `Mutex`
- Session tokens are hashed with SHA-256 before use as map keys
- The plaintext session token is returned to the client and never stored
- Sessions do not survive daemon restarts (by design in V1)

### Session Validation

To validate a session, the client includes the session token as a Bearer token:

```
Authorization: Bearer <session_token>
```

The daemon hashes the provided token and looks up the session in the store. The session is valid if it exists and has not expired.

### Session Revocation

Sessions can be explicitly revoked via `POST /v1/auth/logout`. This removes the session entry from the in-memory store. The session token becomes immediately invalid.

## Scopes Requested

The OIDC flow requests the following scopes:

| Scope | Purpose |
|---|---|
| `openid` | Required for OIDC (returns an ID token) |
| `email` | Access the user's email address claim |
| `profile` | Access the user's profile information |

## Security Considerations

- **PKCE (S256)**: Every auth request uses a fresh random PKCE challenge. The verifier is stored server-side and never exposed to the client. See [PKCE Flow](/security/overview#pkce-flow).
- **CSRF protection**: A random state token is generated per request and validated on callback. Unknown or expired states are rejected.
- **Pending auth TTL**: Authorization requests expire after 10 minutes. Stale entries are cleaned up on each new `/start` call.
- **Token hashing**: Session tokens are SHA-256 hashed before storage. Plaintext tokens are never persisted. See [Token Hashing](/security/overview#token-hashing).
- **Session TTL**: Sessions expire after 24 hours (86,400 seconds).
- **No-redirect HTTP client**: The HTTP client used for OIDC discovery and token exchange does not follow redirects to prevent SSRF attacks.
- **ID token verification**: The ID token signature is verified against the provider's JWKS, and the nonce is validated to prevent replay attacks.

## Supported Identity Providers

Any OIDC-compliant identity provider that supports the Authorization Code flow with PKCE should work. Common providers include:

- Google Workspace
- Okta
- Auth0
- Azure AD / Entra ID
- Keycloak

The provider must:
- Support OIDC discovery (`.well-known/openid-configuration`)
- Return an `email` claim in the ID token
- Support the `authorization_code` grant type
