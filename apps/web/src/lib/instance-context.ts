import { redirect } from '@tanstack/react-router'
import type { Instance } from '@/lib/types'
import { useInstanceStore } from '@/stores/instance-store'
import { useSetupStore } from '@/stores/setup-store'

/**
 * Read the active instance directly from localStorage.
 *
 * Zustand persist may not have rehydrated the store yet when route guards
 * run on a full-page reload (e.g. after an OIDC redirect). This function
 * bypasses the store and reads the persisted value directly.
 */
function readActiveInstanceFromStorage(): Instance | null {
  try {
    const raw = localStorage.getItem('oore_instances')
    if (!raw) return null
    const parsed = JSON.parse(raw) as {
      state?: { instances?: Record<string, Instance>; activeInstanceId?: string | null }
    }
    const state = parsed.state
    if (!state?.activeInstanceId || !state.instances?.[state.activeInstanceId]) {
      return null
    }
    return state.instances[state.activeInstanceId]
  } catch {
    return null
  }
}

/**
 * Read the active instance from the store. If none is active, redirect to '/'.
 * Intended for use in route `beforeLoad` guards (synchronous, no hooks).
 *
 * Falls back to reading localStorage directly if the Zustand store hasn't
 * rehydrated yet (happens on full-page reloads like OIDC redirects).
 */
export function getActiveInstanceOrRedirect(): Instance {
  // Fast path: store is already hydrated
  const { activeInstanceId, instances } = useInstanceStore.getState()
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive: instances record may be stale
  if (activeInstanceId && instances[activeInstanceId]) {
    return instances[activeInstanceId]
  }

  // Fallback: read directly from localStorage (persist hasn't hydrated yet)
  const fromStorage = readActiveInstanceFromStorage()
  if (fromStorage) return fromStorage

  throw redirect({ to: '/' })
}

/**
 * Ensure the setup store has the correct instance context loaded.
 * Call this from route `beforeLoad` so that by the time components render,
 * the setup store's sessionToken/expiresAt are hydrated from the correct
 * namespaced sessionStorage keys.
 */
export function syncSetupStoreContext(instanceId: string): void {
  const current = useSetupStore.getState().instanceId
  if (current !== instanceId) {
    useSetupStore.getState().setInstanceContext(instanceId)
  }
}

/**
 * Read the setup session token for a given instance from sessionStorage.
 * Pure synchronous read — no hooks, no store subscription.
 */
export function getSetupSessionTokenForInstance(instanceId: string): string | null {
  try {
    return sessionStorage.getItem(`oore_setup_session_${instanceId}`) ?? null
  } catch {
    return null
  }
}

/**
 * Require a setup session token for the given instance.
 * If missing, redirect to '/setup'. For use in route `beforeLoad` guards.
 */
export function requireSetupSessionOrRedirect(instanceId: string): string {
  const token = getSetupSessionTokenForInstance(instanceId)
  if (!token) {
    throw redirect({ to: '/setup' })
  }
  return token
}
