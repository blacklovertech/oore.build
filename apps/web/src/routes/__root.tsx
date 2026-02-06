import { Suspense, lazy, useEffect } from 'react'
import { Outlet, createRootRoute, useMatches } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'

import Header from '../components/Header'
import { syncSetupStoreContext } from '@/lib/instance-context'
import { queryClient } from '@/lib/query-client'
import { useInstanceStore } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'

const DevTools = import.meta.env.DEV
  ? lazy(() =>
      Promise.all([
        import('@tanstack/react-devtools'),
        import('@tanstack/react-router-devtools'),
      ]).then(([devMod, routerDevMod]) => ({
        default: () => (
          <devMod.TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <routerDevMod.TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        ),
      })),
    )
  : () => null

export const Route = createRootRoute({
  beforeLoad: () => {
    // Sync setup store's instance context eagerly so that child route guards
    // and components have the correct sessionToken from namespaced sessionStorage.
    // This must run before child beforeLoad guards, not in a useEffect (which
    // fires after render and would leave child components with stale state).
    //
    // Read from localStorage directly as fallback — Zustand persist may not
    // have rehydrated the instance store yet on a full-page reload (e.g. after
    // an OIDC redirect back from an external IdP).
    let activeId = useInstanceStore.getState().activeInstanceId
    if (!activeId) {
      try {
        const raw = localStorage.getItem('oore_instances')
        if (raw) {
          const parsed = JSON.parse(raw) as { state?: { activeInstanceId?: string | null } }
          activeId = parsed.state?.activeInstanceId ?? null
        }
      } catch {
        // ignore
      }
    }
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

  // Re-sync when active instance changes at runtime (user switches or removes instance)
  useEffect(() => {
    useSetupStore.getState().setInstanceContext(activeInstanceId)
  }, [activeInstanceId])

  return (
    <QueryClientProvider client={queryClient}>
      {isSetupRoute ? null : <Header />}
      <Outlet />
      <Suspense>
        <DevTools />
      </Suspense>
    </QueryClientProvider>
  )
}
