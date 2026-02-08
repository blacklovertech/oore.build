import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  Download04Icon,
  File01Icon,
  InformationCircleIcon,
  Loading03Icon,
  TimeQuarterPassIcon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import type { Artifact, BuildLogChunk } from '@/lib/types'
import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import {
  isTerminalStatus,
  useArtifactDownloadLink,
  useArtifacts,
  useBuild,
  useBuildLogs,
  useCancelBuild,
} from '@/hooks/use-builds'
import { useLogStream } from '@/hooks/use-log-stream'
import { getStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PageLayout from '@/components/page-layout'
import PageHeader from '@/components/page-header'
import { webPageTitle } from '@/lib/seo'

export const Route = createFileRoute('/builds/$buildId')({
  staticData: { breadcrumbLabel: 'Details' },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: BuildDetailPage,
})

// ── Helpers ─────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  if (mins < 60) return `${mins}m ${secs}s`
  const hrs = Math.floor(mins / 60)
  const remainMins = mins % 60
  return `${hrs}h ${remainMins}m`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function relativeTime(epochSecs: number): string {
  const diffSecs = Math.floor(Date.now() / 1000) - epochSecs
  if (diffSecs < 5) return 'just now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  const mins = Math.floor(diffSecs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function artifactTypeBadgeVariant(type: Artifact['artifact_type']) {
  switch (type) {
    case 'apk':
      return 'info' as const
    case 'ipa':
      return 'success' as const
    case 'app':
      return 'warning' as const
    default:
      return 'secondary' as const
  }
}

// ── Main component ──────────────────────────────────────────

function BuildDetailPage() {
  const { buildId } = Route.useParams()
  const [knownTerminal, setKnownTerminal] = useState(false)
  const { data, isLoading, error } = useBuild(buildId, {
    refetchInterval: knownTerminal ? false : 3000,
  })
  const cancelMutation = useCancelBuild()

  const buildStatus = data?.build.status
  const isTerminal = buildStatus ? isTerminalStatus(buildStatus) : false

  useEffect(() => {
    if (isTerminal) setKnownTerminal(true)
  }, [isTerminal])

  useEffect(() => {
    const label = data?.build.build_number
      ? `Build #${data.build.build_number}`
      : 'Build Details'
    document.title = webPageTitle(label)
  }, [data?.build.build_number])

  function handleCancel() {
    cancelMutation.mutate(buildId, {
      onSuccess: () => {
        toast.success('Build canceled')
      },
      onError: (err) => {
        toast.error(`Failed to cancel: ${err.message}`)
      },
    })
  }

  if (isLoading) {
    return (
      <PageLayout>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout>
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load build: {error.message}
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (!data) return null

  const { build, events } = data
  const canCancel = !isTerminal

  const duration =
    build.started_at
      ? ((build.finished_at ?? Math.floor(Date.now() / 1000)) - build.started_at)
      : null

  return (
    <PageLayout>
      <PageHeader
        title={`Build #${build.build_number}`}
        back={{ to: '/builds', label: 'Builds' }}
        meta={
          <>
            <Badge variant={getStatusVariant(build.status)}>
              {build.status}
            </Badge>
            <Badge variant="outline">{build.trigger_type}</Badge>
            {duration != null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <HugeiconsIcon icon={TimeQuarterPassIcon} size={12} />
                {formatDuration(duration)}
              </span>
            )}
          </>
        }
        actions={
          canCancel ? (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? 'Canceling...' : 'Cancel Build'}
            </Button>
          ) : undefined
        }
      />

      {/* Build Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {build.branch && (
              <>
                <dt className="text-muted-foreground">Branch</dt>
                <dd>{build.branch}</dd>
              </>
            )}
            {build.commit_sha && (
              <>
                <dt className="text-muted-foreground">Commit</dt>
                <dd className="font-mono">{build.commit_sha}</dd>
              </>
            )}
            {build.trigger_actor && (
              <>
                <dt className="text-muted-foreground">Actor</dt>
                <dd>{build.trigger_actor}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Queued</dt>
            <dd>{new Date(build.queued_at * 1000).toLocaleString()}</dd>
            {build.started_at && (
              <>
                <dt className="text-muted-foreground">Started</dt>
                <dd>{new Date(build.started_at * 1000).toLocaleString()}</dd>
              </>
            )}
            {build.finished_at && (
              <>
                <dt className="text-muted-foreground">Finished</dt>
                <dd>{new Date(build.finished_at * 1000).toLocaleString()}</dd>
              </>
            )}
            {build.runner_id && (
              <>
                <dt className="text-muted-foreground">Runner</dt>
                <dd className="font-mono text-xs">{build.runner_id}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Build Logs */}
      <BuildLogsCard buildId={buildId} isTerminal={isTerminal} />

      {/* Artifacts */}
      <ArtifactsCard buildId={buildId} />

      {/* Events Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <span
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    title={new Date(event.created_at * 1000).toLocaleString()}
                  >
                    {relativeTime(event.created_at)}
                  </span>
                  <div>
                    <span>
                      {event.from_status && (
                        <span className="text-muted-foreground">
                          {event.from_status} &rarr;{' '}
                        </span>
                      )}
                      <span className="font-medium">{event.to_status}</span>
                    </span>
                    {event.reason && (
                      <p className="text-xs text-muted-foreground">
                        {event.reason}
                      </p>
                    )}
                    {event.actor && (
                      <p className="text-xs text-muted-foreground">
                        by {event.actor}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}

// ── Build Logs Card ─────────────────────────────────────────

function BuildLogsCard({
  buildId,
  isTerminal,
}: {
  buildId: string
  isTerminal: boolean
}) {
  const streamEnabled = !isTerminal
  const { logs: streamLogs, isStreaming } = useLogStream(buildId, streamEnabled)
  const { data: fullLogsData, isLoading: logsLoading } = useBuildLogs(buildId)

  const [autoScroll, setAutoScroll] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Use stream logs when live, full logs when terminal
  const logs: Array<BuildLogChunk> = useMemo(() => {
    if (streamEnabled && streamLogs.length > 0) return streamLogs
    if (isTerminal && fullLogsData?.logs) return fullLogsData.logs
    if (streamLogs.length > 0) return streamLogs
    return fullLogsData?.logs ?? []
  }, [streamEnabled, streamLogs, isTerminal, fullLogsData?.logs])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Build Logs
            {isStreaming && (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                Streaming...
              </span>
            )}
          </CardTitle>
          {!autoScroll && logs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAutoScroll(true)
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
                }
              }}
            >
              <HugeiconsIcon icon={ArrowDown01Icon} size={14} />
              Scroll to bottom
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {logsLoading && !streamEnabled ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No logs yet.</p>
        ) : (
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="max-h-[600px] overflow-y-auto bg-muted/30 p-4"
          >
            <pre className="font-mono text-xs leading-relaxed">
              {logs.map((chunk) => (
                <LogLine key={chunk.sequence} chunk={chunk} />
              ))}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function LogLine({ chunk }: { chunk: BuildLogChunk }) {
  const isStderr = chunk.stream === 'stderr'
  return (
    <div className={`flex gap-3 ${isStderr ? 'text-destructive' : 'text-foreground'}`}>
      <span className="select-none text-muted-foreground w-8 shrink-0 text-right">
        {chunk.sequence}
      </span>
      <span className="whitespace-pre-wrap break-all">{chunk.content}</span>
    </div>
  )
}

// ── Artifacts Card ──────────────────────────────────────────

function ArtifactsCard({ buildId }: { buildId: string }) {
  const { data, isLoading } = useArtifacts(buildId)
  const downloadMutation = useArtifactDownloadLink()

  function handleDownload(artifactId: string, name: string) {
    downloadMutation.mutate(artifactId, {
      onSuccess: (res) => {
        window.open(res.download_url, '_blank', 'noopener,noreferrer')
      },
      onError: (err) => {
        toast.error(`Failed to get download link for ${name}: ${err.message}`)
      },
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={File01Icon} size={16} />
          Artifacts
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !data?.artifacts.length ? (
          <p className="text-sm text-muted-foreground">No artifacts.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Checksum</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.artifacts.map((artifact) => (
                <TableRow key={artifact.id}>
                  <TableCell className="font-medium">{artifact.name}</TableCell>
                  <TableCell>
                    <Badge variant={artifactTypeBadgeVariant(artifact.artifact_type)}>
                      {artifact.artifact_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {artifact.file_size != null ? formatFileSize(artifact.file_size) : '--'}
                  </TableCell>
                  <TableCell>
                    {artifact.checksum ? (
                      <span className="font-mono text-xs" title={artifact.checksum}>
                        {artifact.checksum.slice(0, 12)}...
                      </span>
                    ) : (
                      '--'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(artifact.id, artifact.name)}
                      disabled={downloadMutation.isPending}
                    >
                      <HugeiconsIcon icon={Download04Icon} size={14} />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
