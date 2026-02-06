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
│   │   ├── Header.tsx    # Navigation header
│   │   └── ui/           # shadcn component library
│   ├── hooks/            # Custom React hooks
│   ├── stores/           # Zustand stores (UI-local state only)
│   ├── lib/
│   │   ├── api.ts        # API client utilities
│   │   └── types.ts      # TypeScript type definitions
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
function RootLayout() {
  const matches = useMatches()
  const isSetupRoute = matches.some((m) => m.fullPath.startsWith('/setup'))

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

### UI state -- Zustand

Zustand manages UI-local state only. It is never used for server data.

Examples of UI-local state:

- Active setup wizard step
- Panel layout preferences
- Selected backend instance context
- Sidebar open/closed state

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

The frontend is designed to support connecting to multiple backend instances. This is a V1 requirement.

Key constraints:

- Frontend must support add, remove, and switch operations for backend instances
- Auth/session tokens are **isolated per instance**
- TanStack Query caches are **partitioned by instance identifier**
- Every API request is scoped to the currently active instance context
- The UI must clearly show which instance is active in the navigation/header

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
