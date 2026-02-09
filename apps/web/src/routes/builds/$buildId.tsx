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
      <PageLayout width="wide">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout width="wide">
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
    <PageLayout width="wide">
      <PageHeader
        title={`Build #${build.build_number}`}
        back={{ to: '/builds', label: 'Builds' }}
        description="Execution status, logs, artifacts, and event timeline."
        meta={
          <>
            <Badge variant={getStatusVariant(build.status)}>{build.status}</Badge>
            <Badge variant="outline">{build.trigger_type}</Badge>
            {build.branch ? (
              <Badge variant="outline" className="font-mono text-[11px]">
                {build.branch}
              </Badge>
            ) : null}
            {duration != null ? (
              <span className="inline-flex items-center gap-1">
                <HugeiconsIcon icon={TimeQuarterPassIcon} size={12} />
                {formatDuration(duration)}
              </span>
            ) : null}
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

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Queued</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{relativeTime(build.queued_at)}</p>
            <p className="text-xs text-muted-foreground">{new Date(build.queued_at * 1000).toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Runner</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs">{build.runner_id ?? 'unassigned'}</p>
            <p className="text-xs text-muted-foreground">Claimed runner for this build</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Commit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-xs">{build.commit_sha ?? 'not provided'}</p>
            <p className="text-xs text-muted-foreground">Trigger actor: {build.trigger_actor ?? 'n/a'}</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Build metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="w-56 text-muted-foreground">Build ID</TableCell>
                <TableCell className="font-mono text-xs">{build.id}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Branch</TableCell>
                <TableCell className="font-mono text-xs">{build.branch ?? 'n/a'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Commit SHA</TableCell>
                <TableCell className="font-mono text-xs">{build.commit_sha ?? 'n/a'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Started</TableCell>
                <TableCell>{build.started_at ? new Date(build.started_at * 1000).toLocaleString() : 'not started'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted-foreground">Finished</TableCell>
                <TableCell>{build.finished_at ? new Date(build.finished_at * 1000).toLocaleString() : 'not finished'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BuildLogsCard buildId={buildId} isTerminal={isTerminal} />

      <ArtifactsCard buildId={buildId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Transition</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell
                      className="text-xs text-muted-foreground"
                      title={new Date(event.created_at * 1000).toLocaleString()}
                    >
                      {relativeTime(event.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {event.from_status ? (
                          <span className="text-muted-foreground">{event.from_status} → </span>
                        ) : null}
                        <span className="font-medium">{event.to_status}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{event.reason ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{event.actor ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  )
}

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

  const logs: Array<BuildLogChunk> = useMemo(() => {
    if (streamEnabled && streamLogs.length > 0) return streamLogs
    if (isTerminal && fullLogsData?.logs) return fullLogsData.logs
    if (streamLogs.length > 0) return streamLogs
    return fullLogsData?.logs ?? []
  }, [streamEnabled, streamLogs, isTerminal, fullLogsData?.logs])

  useEffect(() => {
    if (autoScroll && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    setAutoScroll(isAtBottom)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Build logs
            {isStreaming ? (
              <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <HugeiconsIcon icon={Loading03Icon} size={12} className="animate-spin" />
                Streaming
              </span>
            ) : null}
          </CardTitle>
          {!autoScroll && logs.length > 0 ? (
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
          ) : null}
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
            className="max-h-[600px] overflow-y-auto border bg-muted/30 p-4"
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
      <span className="w-8 shrink-0 select-none text-right text-muted-foreground">
        {chunk.sequence}
      </span>
      <span className="whitespace-pre-wrap break-all">{chunk.content}</span>
    </div>
  )
}

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
        <CardTitle className="flex items-center gap-2 text-base">
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
                <TableHead className="text-right">Action</TableHead>
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
