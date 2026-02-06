# Frontend Architecture

The oore.build web UI is a standalone React 19 application built with Vite. It communicates with the `oored` daemon over HTTPS APIs and can be served from `ci.oore.build` (hosted) or self-hosted alongside the backend.

## Project structure

```
apps/web/
├── src/
│   ├── routes/           # TanStack Router file-based routes
│   │   ├── __root.tsx    # Root layout (QueryClientProvider, Header)
│   │   ├── index.tsx     # Dashboard / home
│   │   └── setup/        # Setup wizard routes
│   ├── components/
│   │   ├── Header.tsx            # Navigation header
│   │   ├── InstanceSwitcher.tsx  # Instance dropdown switcher
│   │   ├── AddInstanceDialog.tsx # Modal for adding new instances
│   │   └── ui/                   # shadcn component library
│   ├── hooks/            # Custom React hooks
│   ├── stores/
│   │   ├── instance-store.ts  # Instance registry (Zustand + persist)
│   │   └── ...                # Other Zustand stores (UI-local state only)
│   ├── lib/
│   │   ├── api.ts              # API client utilities
│   │   ├── types.ts            # TypeScript type definitions
│   │   ├── instance-context.ts # Route guard helpers
│   │   └── query-client.ts     # Shared QueryClient singleton
│   └── main.tsx          # Application entry point
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## Routing

oore.build uses **TanStack Router with file-based routing**. Routes are defined as files in the `src/routes/` directory, and the route tree is automatically generated.

::: warning
TanStack Router is a non-negotiable V1 decision. Next.js is explicitly not used.
:::

The root layout (`__root.tsx`) wraps the entire application with:

- `QueryClientProvider` for TanStack Query
- Conditional `Header` component (hidden on setup routes)
- Development tools (TanStack DevTools, loaded lazily in dev mode)

```tsx
export const Route = createRootRoute({
  beforeLoad: () => {
    // Sync setup store instance context before child route guards
    const activeId = useInstanceStore.getState().activeInstanceId
    if (activeId) {
      syncSetupStoreContext(activeId)
    }
  },
  component: RootLayout,
})

function RootLayout() {
  const matches = useMatches()
  const isSetupRoute = matches.some((m) => m.fullPath.startsWith('/setup'))
  const activeInstanceId = useInstanceStore((s) => s.activeInstanceId)

  useEffect(() => {
    useSetupStore.getState().setInstanceContext(activeInstanceId)
  }, [activeInstanceId])

  return (
    <QueryClientProvider client={queryClient}>
      {isSetupRoute ? null : <Header />}
      <Outlet />
    </QueryClientProvider>
  )
}
```

## State management

oore.build enforces a clear separation between server state and UI state:

### Server state -- TanStack Query

All data fetched from the backend API is managed by TanStack Query. This includes:

- Setup status polling
- OIDC configuration
- Project and build data
- User session information

TanStack Query handles caching, background refetching, and cache invalidation.

The `QueryClient` is exported as a shared singleton from `lib/query-client.ts`:

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: 1,
    },
  },
})
```

Query keys are prefixed with the active instance ID to partition caches between instances. For example, the setup status query uses `[instanceId, 'setup-status']` as its key. When an instance is removed, its query cache entries are evicted via `queryClient.removeQueries({ queryKey: [instanceId] })`.

### UI state -- Zustand

Zustand manages UI-local state only. It is never used for server data.

Examples of UI-local state:

- Active setup wizard step
- Panel layout preferences
- Instance registry (add, remove, switch active backend)
- Per-instance setup session context

::: danger
Server data must never be duplicated in Zustand. This is a strict rule from the platform contract.
:::

## UI component system

### shadcn with Base UI

The component library uses shadcn with **Base UI primitives** (not Radix). This is a locked V1 decision.

The shared preset configuration:

| Setting | Value |
|---------|-------|
| `style` | `base-vega` |
| `iconLibrary` | `hugeicons` |
| `theme` | `amber` |
| `baseColor` | `neutral` |
| `menuAccent` | `subtle` |
| `menuColor` | `default` |
| `radius` | `none` |
| `font` | `inter` |

To re-initialize the shadcn configuration:

```bash
make ui-init
```

### Styling

- **Tailwind CSS v4** for utility-first styling
- **Hugeicons** for icons
- **Inter** font family via `@fontsource-variable/inter`

## Multi-instance support

The frontend supports connecting to multiple backend instances simultaneously. This is a V1 requirement from the [platform contract](/guide/overview).

### Instance registry

The `useInstanceStore` (Zustand with `persist` middleware) manages the list of known instances in `localStorage`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Client-generated UUID |
| `label` | `string` | User-facing display name |
| `url` | `string` | Backend base URL (empty string = same origin / Vite proxy) |
| `addedAt` | `number` | Timestamp when instance was added |

Actions: `addInstance`, `removeInstance`, `setActiveInstance`, `updateInstanceLabel`.

When an instance is removed:
1. Instance metadata is deleted from the registry
2. Namespaced `sessionStorage` keys are cleared (`oore_setup_session_{id}`, `oore_setup_session_expires_{id}`)
3. Query cache entries scoped to that instance are evicted
4. If the removed instance was active, the next available instance is auto-selected (or `null` if none remain)

### API client scoping

All API functions accept `baseUrl` as their first parameter:
- **Empty string** (`''`): requests use relative paths, hitting the Vite dev proxy in development
- **Full URL** (e.g. `https://ci.example.com`): requests are routed to that backend

### Query cache partitioning

Query keys are prefixed with the active instance ID:
```ts
// Example: setup status query
queryKey: [instanceId, 'setup-status']
```

Queries are automatically disabled when no instance is active (`enabled: !!instance`).

### Route guards

Setup routes use **guard-first** helpers in `lib/instance-context.ts` that run synchronously in TanStack Router's `beforeLoad`:

- `getActiveInstanceOrRedirect()` — returns the active instance or redirects to `/`
- `requireSetupSessionOrRedirect(instanceId)` — returns the session token or redirects to `/setup`

These read directly from Zustand stores and `sessionStorage` (not React hooks). On full-page reloads (e.g. after OIDC redirects), a `localStorage` fallback handles the Zustand persist rehydration race.

### Instance switcher

The `InstanceSwitcher` component in the header provides:
- Active instance label with dropdown toggle
- List of all instances with click-to-switch
- "Add Instance" action that opens the `AddInstanceDialog` modal

## Forms and validation

- **React Hook Form** for form management
- **Zod** for schema validation
- Forms are used extensively in the setup wizard (bootstrap token, OIDC configuration, owner verification)

## Testing

| Tool | Purpose |
|------|---------|
| Vitest | Unit and integration tests |
| Testing Library | Component testing |
| Playwright | E2E tests (planned) |

Run tests:

```bash
make test-web
```

## Key dependencies

| Package | Purpose |
|---------|---------|
| `react` 19 | UI framework |
| `@tanstack/react-router` | File-based routing |
| `@tanstack/react-query` | Server state management |
| `zustand` | UI-local state |
| `@base-ui/react` | Unstyled component primitives |
| `shadcn` | Component library |
| `tailwindcss` v4 | Utility-first CSS |
| `@hugeicons/react` | Icon library |
| `zod` | Schema validation |
| `react-hook-form` | Form management |
| `vite` | Build tool and dev server |
