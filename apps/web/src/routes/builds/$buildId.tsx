import { createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { InformationCircleIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import { useBuild, useCancelBuild } from '@/hooks/use-builds'
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

export const Route = createFileRoute('/builds/$buildId')({
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: BuildDetailPage,
})

const TERMINAL_STATUSES = new Set([
  'succeeded',
  'failed',
  'canceled',
  'timed_out',
  'expired',
])

function BuildDetailPage() {
  const { buildId } = Route.useParams()
  const { data, isLoading, error } = useBuild(buildId)
  const cancelMutation = useCancelBuild()

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
      <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto w-full px-6 py-8">
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load build: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  const { build, events } = data
  const canCancel = !TERMINAL_STATUSES.has(build.status)

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Build #{build.build_number}
          </h1>
          <div className="flex items-center gap-2">
            <Badge>{build.status}</Badge>
            <Badge variant="outline">{build.trigger_type}</Badge>
          </div>
        </div>
        {canCancel && (
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Canceling...' : 'Cancel Build'}
          </Button>
        )}
      </div>

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
          </dl>
        </CardContent>
      </Card>

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
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(event.created_at * 1000).toLocaleTimeString()}
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
    </div>
  )
}
