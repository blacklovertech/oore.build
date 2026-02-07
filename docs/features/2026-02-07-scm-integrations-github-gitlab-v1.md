# SCM Integrations for V1 (GitHub + GitLab)

## Status

`released`

## Problem

The integration flow for source providers was not clearly defined across deployment modes.
Without a strict pattern, webhook delivery, token handling, and trigger reliability become inconsistent, especially when using hosted UI (`ci.oore.build`) with customer-owned backends.

## User Impact

Owners/Admins get a reliable and predictable onboarding path for GitHub and GitLab:

- They can connect providers regardless of whether UI is hosted or self-hosted.
- Webhooks trigger builds reliably because delivery targets the customer backend.
- They can add multiple integrations (multiple accounts/groups/providers) without artificial limits.

## UI Changes

Integrations management UI at `/settings/integrations` (admin-only):

- Provider cards for GitHub and GitLab with "Add Integration" actions
- Connected integrations list with status badges, provider type, host URL, and "Details" link to integration detail page
- Disconnect action with confirmation dialog (cascades all credentials/installations/repos)
- GitHub setup flow: automated manifest flow (click "Connect GitHub", redirected to GitHub to create app, then redirected to install on org/account, then redirected back to integration detail page)
- GitLab setup flow: host URL selector (gitlab.com or custom), auth mode (personal token or OAuth), credential input

Integration detail page at `/settings/integrations/$integrationId`:

- App Info card showing provider, host URL, auth mode, App ID, and creation date
- Actions card with context-sensitive buttons:
  - "Install on GitHub" when no installations exist, "Manage on GitHub" when installations exist (links to GitHub App settings)
  - "Sync Installations" to refresh installations and repos from the provider
  - "Disconnect" with confirmation dialog
- Installations table showing account name, type, and external ID
- Repositories table showing full name, default branch, and visibility badge
- Success toast on redirect from GitHub App installation (`?installed=true` query param)

Navigation: "Integrations" item in Management sidebar group (admin-only visibility). "Builds" item in Platform sidebar group.

Flow behavior by deployment mode:

- Hosted UI (`ci.oore.build`): user starts from hosted frontend, but callback, install, and webhook endpoints are customer-backend endpoints.
- Self-hosted UI: user starts and finishes within self-hosted UI/backend; callback and webhooks terminate on the same backend.

## API Changes

Implemented API surface:

Authenticated endpoints (CORS, session middleware):

- `POST /v1/integrations/github/start` — generate encrypted state token and return `create_url` for GitHub App manifest flow
- `POST /v1/integrations/github/complete` — exchange manifest code for app credentials (JSON API fallback for CLI use)
- `POST /v1/integrations/{id}/installations` — sync GitHub App installations and repos from GitHub API, removes stale installations and repos
- `GET /v1/integrations/{id}/installations` — list installations for an integration
- `POST /v1/integrations/gitlab/start` — create GitLab integration (OAuth or token mode), validates credentials via GitLab API, auto-syncs projects for token mode
- `GET /v1/integrations` — list integrations (paginated, filterable by provider)
- `GET /v1/integrations/{id}` — integration detail with installation count, repository count, last webhook timestamp, `app_id`, and `app_slug`
- `DELETE /v1/integrations/{id}` — disconnect integration (cascades all related data via ON DELETE CASCADE)
- `GET /v1/integrations/{id}/repositories` — list repos for an integration

Browser-navigated endpoints (no auth middleware, no CORS — authentication via encrypted state token):

- `GET /v1/integrations/github/create?state=...` — serves HTML page with auto-submitting form that POSTs the GitHub App manifest to GitHub
- `GET /v1/integrations/github/callback?code=...&state=...` — GitHub redirects here after app creation; exchanges manifest code for credentials, stores encrypted secrets, redirects to GitHub App install page
- `GET /v1/integrations/github/installed?installation_id=...&setup_action=...` — GitHub redirects here after app installation via `setup_url`; resolves integration via installation mapping or signed browser cookie set during callback (no "latest integration" fallback), auto-syncs, then redirects to frontend

Webhook endpoints (no auth middleware, no CORS — provider-called):

- `POST /v1/webhooks/github` — GitHub webhook receiver
- `POST /v1/webhooks/gitlab` — GitLab webhook receiver

Provider strategy:

- GitHub: GitHub Apps via manifest flow with `setup_url` and `setup_on_update: true` in the manifest. After app creation, the callback redirects the user to install the app on their org/account. After installation, GitHub's `setup_url` redirects to the `github_installed` endpoint which auto-syncs installations and repos before redirecting to the frontend. App private key, webhook secret, client secret encrypted at rest. JWT auth (RS256) for GitHub API calls. Installation access tokens for repo enumeration.
- GitLab: Personal access token or OAuth application modes. Supports gitlab.com and self-managed instances (custom host URL). Requires explicit webhook secret input for both modes and stores it encrypted. Token mode validates token via `GET /api/v4/user` and syncs projects via `GET /api/v4/projects?membership=true`. OAuth mode is created as `inactive` until full OAuth completion is implemented.

Sync behavior:

- Sync upserts installations and repos from the provider, using `ON CONFLICT DO UPDATE` for existing records.
- Stale cleanup: installations and repos that no longer exist on the provider are deleted during sync. When a user narrows their GitHub App's repository scope, the removed repos are cleaned up on next sync.
- The `github_installed` endpoint auto-triggers a sync so the frontend detail page shows fresh data immediately after installation.

Integration response includes `app_id` (GitHub App numeric ID) and `app_slug` (GitHub App URL slug) for GitHub integrations, enabling frontend to construct GitHub App management and install URLs.

Schema (migration 004):

- `integrations` — one row per provider connection (includes `app_id`, `app_slug` columns for GitHub)
- `integration_credentials` — encrypted secrets per integration (AES-256-GCM)
- `integration_installations` — GitHub App installations or GitLab group linkages
- `integration_repositories` — repos accessible through an installation
- `integration_webhooks` — delivery tracking with idempotency

RBAC: `integrations` resource added — owner/admin: read+write+delete, developer/qa_viewer: read.

## Security Considerations

- All provider secrets/tokens encrypted at rest using existing AES-256-GCM pattern.
- GitHub webhook verification: HMAC-SHA256 via `X-Hub-Signature-256` using `ring::hmac`.
- GitLab webhook verification: constant-time comparison of `X-Gitlab-Token`.
- Webhook-to-build trigger resolution is scoped by both repository and integration ID to prevent cross-integration collisions when repo names overlap.
- Idempotency: UNIQUE constraint on `(integration_id, provider_delivery_id)`, duplicate = 200 OK no-op.
- Replay window: reject GitLab events older than 5 minutes.
- Body size limit: 1 MB max on webhook routes.
- Webhook routes mounted outside CORS layer (provider-called, no browser origin).
- Webhook payload stored immediately, processing runs async via `tokio::spawn`.
- Credentials never returned in API responses.
- GitHub manifest flow browser routes (`/create`, `/callback`, `/installed`) use encrypted state tokens (AES-256-GCM) with 10-minute expiry instead of session auth. This allows the browser redirect chain to work without requiring the user to re-authenticate on the backend.
- State tokens are URL-encoded and include user identity, webhook URL, and redirect URL — all validated on use.
- GitHub install callback correlation uses an encrypted, short-lived HttpOnly cookie instead of selecting the most recent GitHub integration.

## Migration and Rollout

- No breaking migration for existing setup/auth flows.
- Migration 004 adds 5 new tables, all with ON DELETE CASCADE for clean disconnection.
- Integrations gated to `owner/admin` via RBAC.
- Rollout order completed:
  1. Integration schema and encrypted secret store
  2. GitHub App manifest flow
  3. GitLab flow (gitlab.com + self-managed base URL support)
  4. Webhook hardening + trigger pipeline hookup

## Acceptance Criteria

- [x] V1 integration architecture is documented for hosted-UI and self-hosted-UI modes.
- [x] GitHub and GitLab onboarding flows are defined with webhook delivery rules.
- [x] Multi-integration support is explicitly required (no fixed cap in model/UX/API).
- [x] Roadmap priority includes SCM integration as `P0` prerequisite to trigger reliability.
- [x] GitHub App manifest flow creates integration with encrypted credentials.
- [x] GitLab personal token and OAuth modes both work with self-managed instances.
- [x] Webhook HMAC/token verification prevents unauthorized deliveries.
- [x] Idempotent webhook processing prevents duplicate builds.
- [x] Disconnect cascades all credentials, installations, repos, and webhooks.
- [x] RBAC enforced on all integration endpoints.
- [x] GitHub App manifest includes `setup_url` and `setup_on_update` for post-install redirect.
- [x] `github_installed` endpoint auto-syncs installations and repos before redirecting to frontend.
- [x] Stale installations and repos are cleaned up during sync when provider scope narrows.
- [x] Integration detail page shows app info, installations, repos, sync, and disconnect actions.
- [x] "Manage on GitHub" vs "Install on GitHub" button shown conditionally based on installation count.
- [x] `app_id` and `app_slug` exposed in Integration API response for GitHub integrations.
- [x] GET endpoint for listing installations per integration.
- [x] GitLab setup requires webhook secret and stores it encrypted for webhook verification.
- [x] GitHub install callback no longer falls back to "most recent integration".
- [x] Webhook build triggers are integration-scoped (repo + integration), preventing cross-integration trigger bleed.

## Owner

Platform Team

## Last Updated

`2026-02-07`
