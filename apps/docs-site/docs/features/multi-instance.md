# Multi-Instance Support

oore.build's frontend supports connecting to multiple backend instances simultaneously. Operators managing several oore.build deployments can add, switch between, and remove instances without losing in-progress setup state.

::: info Scope
Multi-instance **setup-session isolation** is fully implemented. Post-setup user auth-token isolation across instances is deferred to a follow-up release.
:::

## Instance Registry

Instances are managed by the `useInstanceStore` Zustand store, persisted to `localStorage` under the key `oore_instances`.

Each instance record contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Client-generated UUID (stable, available before backend is reachable) |
| `label` | `string` | User-facing display name |
| `url` | `string` | Backend base URL — empty string means same origin (Vite dev proxy) |
| `addedAt` | `number` | Timestamp when the instance was added |

### Adding an Instance

The **Add Instance** dialog validates:
- **Label**: required, non-empty
- **URL**: must be a valid HTTP or HTTPS URL, or empty for local development

Trailing slashes are stripped from URLs automatically.

### Removing an Instance

When an instance is removed:
1. Instance metadata is deleted from the registry
2. Namespaced `sessionStorage` keys are cleared (`oore_setup_session_{id}`, `oore_setup_session_expires_{id}`)
3. TanStack Query cache entries for that instance are evicted
4. If the removed instance was active, the next available instance is auto-selected (or `null` if none remain)

### Switching Instances

Clicking an instance in the switcher dropdown or navigation drawer updates the active instance. The setup store re-hydrates its session token and expiry from the new instance's namespaced `sessionStorage` keys. Query caches for the previous instance remain warm for fast switch-back.

## UI Components

### Instance Switcher

The instance switcher appears in the header bar and shows:
- The active instance label (truncated if long)
- A dropdown chevron that toggles the instance list
- All registered instances with a checkmark on the active one
- An "Add Instance" action at the bottom

The dropdown closes on outside click or Escape key.

### Navigation Drawer

The navigation drawer includes an "Instances" section listing all instances with:
- Click-to-switch buttons
- Remove buttons (with confirmation via icon)
- An "Add Instance" link

### No-Instance State

When no instances are registered (fresh install or all removed), the landing page shows an onboarding card prompting the user to add their first instance.

## API Routing

All API functions accept `baseUrl` as their first parameter:

```ts
getSetupStatus(instance.url)
verifyBootstrapToken(instance.url, token)
configureOidc(instance.url, sessionToken, data)
```

| `baseUrl` value | Behavior |
|-----------------|----------|
| `''` (empty string) | Relative fetch — hits Vite dev proxy in development |
| `https://ci.example.com` | Absolute fetch — routes to that backend |

## Session Isolation

Setup session tokens are stored in `sessionStorage` with instance-namespaced keys:

| Key pattern | Example |
|-------------|---------|
| `oore_setup_session_{instanceId}` | `oore_setup_session_a1b2c3d4-...` |
| `oore_setup_session_expires_{instanceId}` | `oore_setup_session_expires_a1b2c3d4-...` |

This ensures that setup progress on one instance cannot leak to or interfere with another.

## Query Cache Partitioning

TanStack Query keys are prefixed with the active instance ID:

```ts
queryKey: [instanceId, 'setup-status']
```

This provides automatic cache isolation between instances. Queries are disabled when no instance is active (`enabled: !!instance`).

## Route Guard Architecture

Setup routes use **guard-first** helpers that run synchronously in TanStack Router's `beforeLoad`:

| Helper | Purpose |
|--------|---------|
| `getActiveInstanceOrRedirect()` | Returns active instance or redirects to `/` |
| `requireSetupSessionOrRedirect(id)` | Returns session token or redirects to `/setup` |
| `syncSetupStoreContext(id)` | Hydrates setup store from namespaced sessionStorage |

These helpers read directly from Zustand stores and `sessionStorage` — no React hooks, no `useEffect`. On full-page reloads (e.g. after OIDC redirect), a `localStorage` fallback handles the Zustand persist rehydration race.

## Migration

On first load after upgrade, the instance list is empty. Users see an onboarding prompt to add their first instance. Old `sessionStorage` keys (non-namespaced `oore_setup_session`, `oore_setup_session_expires`) are orphaned but ephemeral — they are cleared when the browser tab closes.

For development, add an instance with an empty URL to continue using the Vite dev proxy.
