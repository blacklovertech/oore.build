import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { OidcCallbackResponse } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { useInstanceStore } from '@/stores/instance-store'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function cleanupOidcSessionStorage() {
  try {
    sessionStorage.removeItem('oore_oidc_state')
    sessionStorage.removeItem('oore_oidc_instance')
  } catch {
    // ignore
  }
}

function AuthCallbackPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Authenticating... - oore.build'
  }, [])

  useEffect(() => {
    let cancelled = false

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')

    if (!code || !state) {
      setError('Missing authorization code or state parameter.')
      return
    }

    // Retrieve stored OIDC state
    let storedState: string | null = null
    let instanceId: string | null = null
    try {
      storedState = sessionStorage.getItem('oore_oidc_state')
      instanceId = sessionStorage.getItem('oore_oidc_instance')
    } catch {
      // sessionStorage unavailable
    }

    if (storedState !== state) {
      cleanupOidcSessionStorage()
      setError('OIDC state mismatch. Please try logging in again.')
      return
    }

    // Resolve the instance URL
    const instances = useInstanceStore.getState().instances
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- instanceId may not exist in record
    const instance = instanceId ? instances[instanceId] : undefined
    if (!instance) {
      cleanupOidcSessionStorage()
      setError('Could not find the instance you were logging into.')
      return
    }

    // Sync auth store context before storing the token
    useAuthStore.getState().setInstanceContext(instance.id)

    // Exchange code for token via POST (keeps auth code out of URL/logs)
    const callbackUrl = `${instance.url}/v1/auth/oidc/callback`

    fetch(callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then(async (res) => {
        if (cancelled) return
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string
          }
          throw new Error(body.error ?? `Authentication failed (${res.status})`)
        }
        return res.json() as Promise<OidcCallbackResponse>
      })
      .then((data) => {
        if (cancelled || !data) return

        if (!data.user.user_id || !data.user.role) {
          throw new Error('Incomplete user profile received from server')
        }

        // Store auth token
        setAuth(data.session_token, data.expires_at, {
          email: data.user.email,
          oidc_subject: data.user.oidc_subject,
          user_id: data.user.user_id,
          role: data.user.role,
        })

        cleanupOidcSessionStorage()
        void navigate({ to: '/' })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        cleanupOidcSessionStorage()
        setError(e instanceof Error ? e.message : 'Authentication failed')
      })

    return () => { cancelled = true }
  }, [navigate, setAuth])

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Authentication Failed</h1>
          <p className="text-sm text-destructive">{error}</p>
          <button
            onClick={() => void navigate({ to: '/login' })}
            className="text-sm text-primary underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground text-sm">Completing sign-in...</p>
    </div>
  )
}
