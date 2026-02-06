# Multi-Instance Frontend: Setup Session Isolation

## Status

`ready`

## Problem

The platform contract (section 12.1) requires multi-instance frontend support. Users who manage multiple oore.build backend instances need to add, remove, and switch between them without losing setup session state or mixing data across instances.

## User Impact

Operators managing multiple oore.build deployments can now connect the web UI to several backend instances simultaneously. Each instance maintains its own setup session, query cache, and API routing. Switching between instances preserves in-progress setup state via namespaced sessionStorage.

## UI Changes

- **Landing page (no instance):** When no instance is registered, the index page shows an onboarding card prompting the user to add their first instance.
- **Header bar:** An instance switcher dropdown appears on the right side showing the active instance label. Clicking reveals all registered instances and an "Add Instance" action.
- **Navigation drawer:** An "Instances" section between nav links and footer lists all instances with switch and remove actions, plus "Add Instance".
- **Add Instance dialog:** A modal form with label and URL fields. URL is optional (empty = local dev proxy). Validates HTTP/HTTPS format (HTTP allowed for self-hosted local network access).
- **Setup flow:** All setup routes require an active instance. Route guards redirect to `/` if no instance is selected. Session token guards use instance-namespaced sessionStorage keys.

## API Changes

All API functions now accept `baseUrl` as the first parameter. When `baseUrl` is `''` (empty string), requests use relative paths and hit the Vite dev proxy. When set to a URL like `https://ci.example.com`, requests are routed to that backend.

No backend API changes are required.

## Security Considerations

- Setup session tokens remain in `sessionStorage` (ephemeral, per-tab). They are now namespaced by instance ID (`oore_setup_session_{instanceId}`), preventing cross-instance token leakage.
- Instance metadata (label, URL, addedAt) is stored in `localStorage` via Zustand persist. This data is non-sensitive.
- Removing an instance clears its namespaced sessionStorage keys and evicts its query cache entries.
- **Scope boundary:** This feature covers setup-session isolation only. Post-setup user auth-token isolation across instances is deferred to a follow-up issue.

## Migration and Rollout

No automatic migration. On first load after upgrade, the instance list is empty and users see the onboarding prompt. Existing sessionStorage keys (`oore_setup_session`, `oore_setup_session_expires`) are orphaned but are ephemeral and will expire naturally. Dev mode users should add an instance with an empty URL to continue using the Vite proxy.

## Acceptance Criteria

- [x] Instance registry supports add/remove/switch with localStorage persistence
- [x] Setup session tokens are namespaced per instance in sessionStorage
- [x] Query keys are prefixed with instance ID; caches are isolated
- [x] All API calls include the active instance's base URL
- [x] Setup route guards are correct on hard refresh without useEffect dependency
- [x] Switching active instance cannot cause false redirects from stale store state
- [x] Removing an instance clears its setup session keys and evicts its query cache
- [x] Instance switcher visible in header with active instance label
- [x] Feature doc explicitly scopes: setup-session isolation complete; auth-token isolation deferred

## Owner

Frontend team

## Last Updated

`2026-02-06`
