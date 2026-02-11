---
status: implemented
---

# Configure OIDC Authentication

oore.build uses OpenID Connect (OIDC) as its sole authentication mechanism. There are no local passwords — every user signs in through your identity provider.

## What you need

- An oore.build instance that is either being set up or already running
- Admin access to an OIDC-compatible identity provider
- The ability to create an OAuth 2.0 / OIDC application in your provider

## How OIDC works in oore.build

During setup, you provide three values:

| Value | Example | Where to get it |
|---|---|---|
| **Issuer URL** | `https://accounts.google.com` | Your provider's OIDC documentation |
| **Client ID** | `123456.apps.googleusercontent.com` | Created when you register an OAuth app |
| **Client secret** | `GOCSPX-...` | Created with the OAuth app (optional for some providers) |

oore.build uses the issuer URL to discover endpoints automatically via the [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) protocol. It fetches `{issuer_url}/.well-known/openid-configuration` to find the authorization, token, and JWKS endpoints.

The client secret, if provided, is encrypted with AES-256-GCM before storage.

## Required OAuth scopes

oore.build requests these scopes during authentication:

- `openid` — required by the OIDC spec
- `email` — used to identify users
- `profile` — used for display names and avatars

## Redirect URIs to configure

When creating your OAuth application, add these redirect URIs:

| Context | Redirect URI |
|---|---|
| Web UI (development) | `http://localhost:3000/auth/callback` |
| Web UI (production) | `https://ci.oore.build/auth/callback` (or your custom domain) |
| CLI setup (loopback) | `http://localhost:*` (the CLI uses a random port) |
| Setup wizard | `http://localhost:3000/setup/owner/callback` |

::: tip
Some providers don't support wildcard ports. In that case, the CLI will display the exact `http://localhost:<port>` URI before opening the browser — add it to your allowed redirect URIs at that point.
:::

## Provider guides

Follow the guide for your identity provider:

| Provider | Guide |
|---|---|
| Google Workspace / Cloud Identity | [Google OIDC setup](/guides/oidc/google) |
| Okta | Coming in Wave 4 |
| Azure AD / Entra ID | Coming in Wave 4 |
| Auth0 | Coming in Wave 4 |
| Keycloak | Coming in Wave 4 |

Any provider that supports [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) will work. If your provider isn't listed above, use the general configuration steps:

1. Create an OAuth 2.0 / OIDC application in your provider
2. Set the application type to "Web application"
3. Add the redirect URIs listed above
4. Enable the `openid`, `email`, and `profile` scopes
5. Copy the issuer URL, client ID, and client secret
6. Enter them during oore.build setup (see [Set Up Your Instance](/getting-started/first-instance))

## Verify OIDC discovery

You can test that your issuer URL is correct before running setup:

```bash
curl https://accounts.google.com/.well-known/openid-configuration | jq .issuer
```

The response should include an `issuer` field matching your issuer URL.
