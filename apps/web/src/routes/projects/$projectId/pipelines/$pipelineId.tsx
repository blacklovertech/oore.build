import { useState, useEffect } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, Delete02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import { usePipeline, useUpdatePipeline, useDeletePipeline } from '@/hooks/use-pipelines'
import { useBuilds } from '@/hooks/use-builds'
import { useHasPermission } from '@/hooks/use-permissions'
import { getStatusVariant, getPipelineStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import PageLayout from '@/components/page-layout'
import PageHeader from '@/components/page-header'
import { webPageTitle } from '@/lib/seo'
import EditPipelineDialog from '../-edit-pipeline-dialog'

export const Route = createFileRoute(
  '/projects/$projectId/pipelines/$pipelineId',
)({
  staticData: { breadcrumbLabel: 'Pipeline' },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: PipelineDetailPage,
})

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

function PipelineDetailPage() {
  const { projectId, pipelineId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = usePipeline(pipelineId)
  const { data: buildsData } = useBuilds({
    pipeline_id: pipelineId,
    limit: 10,
  })
  const updateMutation = useUpdatePipeline()
  const deleteMutation = useDeletePipeline()
  const canWrite = useHasPermission('pipelines', 'write')
  const canDelete = useHasPermission('pipelines', 'delete')

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  useEffect(() => {
    const label = data?.pipeline.name ?? 'Pipeline Details'
    document.title = webPageTitle(label)
  }, [data?.pipeline.name])

  if (isLoading) {
    return (
      <PageLayout>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </PageLayout>
    )
  }

  if (error) {
    return (
      <PageLayout>
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load pipeline: {error.message}
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (!data) return null

  const { pipeline } = data

  function handleToggleEnabled() {
    updateMutation.mutate(
      {
        pipelineId: pipeline.id,
        data: { enabled: !pipeline.enabled },
      },
      {
        onSuccess: () => {
          toast.success(
            pipeline.enabled ? 'Pipeline disabled' : 'Pipeline enabled',
          )
        },
        onError: (err) => {
          toast.error(`Failed to update pipeline: ${err.message}`)
        },
      },
    )
  }

  function handleDelete() {
    deleteMutation.mutate(pipelineId, {
      onSuccess: () => {
        toast.success('Pipeline deleted')
        void navigate({
          to: '/projects/$projectId',
          params: { projectId },
        })
      },
      onError: (err) => {
        toast.error(`Failed to delete pipeline: ${err.message}`)
      },
    })
  }

  return (
    <PageLayout>
      <PageHeader
        title={pipeline.name}
        back={{
          to: `/projects/${projectId}`,
          label: 'Project',
        }}
        meta={
          <Badge variant={getPipelineStatusVariant(pipeline.enabled)}>
            {pipeline.enabled ? 'enabled' : 'disabled'}
          </Badge>
        }
        actions={
          (canWrite || canDelete) ? (
            <div className="flex items-center gap-2">
              {canWrite && (
                <Button
                  variant="outline"
                  onClick={handleToggleEnabled}
                  disabled={updateMutation.isPending}
                >
                  {pipeline.enabled ? 'Disable' : 'Enable'}
                </Button>
              )}
              {canWrite && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <HugeiconsIcon icon={Edit02Icon} size={16} />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                  Delete
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Pipeline Info */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{pipeline.name}</dd>
            <dt className="text-muted-foreground">Config Path</dt>
            <dd className="font-mono">{pipeline.config_path}</dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={getPipelineStatusVariant(pipeline.enabled)}>
                {pipeline.enabled ? 'enabled' : 'disabled'}
              </Badge>
            </dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(pipeline.created_at * 1000).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(pipeline.updated_at * 1000).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Trigger Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Trigger Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Events</p>
            {pipeline.trigger_config.events.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {pipeline.trigger_config.events.map((event) => (
                  <Badge key={event} variant="outline">
                    {event}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm">All events</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              Branch Patterns
            </p>
            {pipeline.trigger_config.branches.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {pipeline.trigger_config.branches.map((branch) => (
                  <code
                    key={branch}
                    className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono"
                  >
                    {branch}
                  </code>
                ))}
              </div>
            ) : (
              <p className="text-sm">All branches</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Concurrency Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Concurrency Policy</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Cancel Previous</dt>
            <dd>{pipeline.concurrency.cancel_previous ? 'Yes' : 'No'}</dd>
            <dt className="text-muted-foreground">Max Concurrent</dt>
            <dd>
              {pipeline.concurrency.max_concurrent ?? 'Unlimited'}
            </dd>
          </dl>
        </CardContent>
      </Card>

      {/* Recent Builds */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Builds</CardTitle>
        </CardHeader>
        <CardContent>
          {!buildsData?.builds.length ? (
            <p className="text-sm text-muted-foreground">No builds yet.</p>
          ) : (
            <div className="space-y-2">
              {buildsData.builds.map((build) => (
                <Link
                  key={build.id}
                  to="/builds/$buildId"
                  params={{ buildId: build.id }}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">
                      #{build.build_number}
                    </span>
                    <Badge variant={getStatusVariant(build.status)}>
                      {build.status}
                    </Badge>
                    {build.branch && (
                      <span className="text-xs text-muted-foreground">
                        {build.branch}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(build.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editOpen && (
        <EditPipelineDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          pipeline={pipeline}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete pipeline?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{pipeline.name}". This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  )
}
