import { useCallback, useEffect, useRef, useState } from 'react'
import type { BuildLogChunk } from '@/lib/types'
import { createStreamToken, getBuildLogs } from '@/lib/api'
import { useActiveInstance } from '@/stores/instance-store'
import { useAuthStore } from '@/stores/auth-store'

interface UseLogStreamResult {
  logs: Array<BuildLogChunk>
  isStreaming: boolean
  isDone: boolean
  error: string | null
}

export function useLogStream(buildId: string, enabled: boolean): UseLogStreamResult {
  const [logs, setLogs] = useState<Array<BuildLogChunk>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const instance = useActiveInstance()
  const baseUrl = instance?.url ?? null
  const token = useAuthStore((s) => s.token)

  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSequenceRef = useRef(-1)
  const logsRef = useRef<Array<BuildLogChunk>>([])
  const abortRef = useRef<AbortController | null>(null)

  const appendLogs = useCallback((chunks: Array<BuildLogChunk>) => {
    if (chunks.length === 0) return
    const newChunks = chunks.filter((c) => c.sequence > lastSequenceRef.current)
    if (newChunks.length === 0) return
    const sorted = newChunks.sort((a, b) => a.sequence - b.sequence)
    lastSequenceRef.current = sorted[sorted.length - 1].sequence
    logsRef.current = [...logsRef.current, ...sorted]
    setLogs(logsRef.current)
  }, [])

  const startPolling = useCallback(() => {
    if (!baseUrl || !token || pollingRef.current) return
    pollingRef.current = setInterval(() => {
      void getBuildLogs(baseUrl, token, buildId, {
        after_sequence: lastSequenceRef.current >= 0 ? lastSequenceRef.current : undefined,
      }).then((res) => {
        appendLogs(res.logs)
      }).catch(() => {
        // Silently retry on next interval
      })
    }, 2000)
  }, [baseUrl, token, buildId, appendLogs])

  const cleanup = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!enabled || !baseUrl || !token) {
      cleanup()
      return
    }

    // Reset state when switching builds or re-enabling
    setLogs([])
    setIsStreaming(false)
    setIsDone(false)
    setError(null)
    lastSequenceRef.current = -1
    logsRef.current = []

    const abort = new AbortController()
    abortRef.current = abort

    // Fetch a short-lived streaming token, then connect EventSource
    void (async () => {
      let streamToken: string
      try {
        const resp = await createStreamToken(baseUrl, token, buildId)
        streamToken = resp.token
      } catch {
        // If stream token exchange fails, fall back to polling
        if (!abort.signal.aborted) {
          setError('Failed to obtain stream token, falling back to polling')
          startPolling()
        }
        return
      }

      if (abort.signal.aborted) return

      const url = `${baseUrl}/v1/builds/${buildId}/logs/stream?token=${encodeURIComponent(streamToken)}`

      try {
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.addEventListener('open', () => {
          setIsStreaming(true)
          setError(null)
        })

        es.addEventListener('log', (event: MessageEvent) => {
          try {
            const chunk = JSON.parse(event.data as string) as BuildLogChunk
            appendLogs([chunk])
          } catch {
            // Ignore malformed events
          }
        })

        es.addEventListener('done', () => {
          setIsStreaming(false)
          setIsDone(true)
          es.close()
          eventSourceRef.current = null
        })

        es.addEventListener('error', () => {
          es.close()
          eventSourceRef.current = null
          setIsStreaming(false)
          setError('Log stream disconnected, falling back to polling')
          startPolling()
        })
      } catch {
        if (!abort.signal.aborted) {
          setError('Failed to connect to log stream, falling back to polling')
          startPolling()
        }
      }
    })()

    return cleanup
  }, [enabled, baseUrl, token, buildId, appendLogs, startPolling, cleanup])

  return { logs, isStreaming, isDone, error }
}
