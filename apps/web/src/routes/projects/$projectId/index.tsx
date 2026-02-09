import { useState, useEffect } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HugeiconsIcon } from '@hugeicons/react'
import { Edit02Icon, Delete02Icon, Add01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/use-projects'
import { usePipelines } from '@/hooks/use-pipelines'
import { useBuilds } from '@/hooks/use-builds'
import { useHasPermission } from '@/hooks/use-permissions'
import { getStatusVariant } from '@/lib/status-variants'
import { getPipelineStatusVariant } from '@/lib/status-variants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import PageLayout from '@/components/page-layout'
import PageHeader from '@/components/page-header'
import { webPageTitle } from '@/lib/seo'
import CreatePipelineDialog from './-create-pipeline-dialog'

export const Route = createFileRoute('/projects/$projectId/')({
  staticData: { breadcrumbLabel: 'Details' },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: ProjectDetailPage,
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

// ── Edit project dialog ─────────────────────────────────────

const editProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  default_branch: z.string().optional(),
})

type EditProjectForm = z.infer<typeof editProjectSchema>

function EditProjectDialog({
  open,
  onOpenChange,
  projectId,
  currentValues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  currentValues: { name: string; description?: string; default_branch?: string }
}) {
  const updateMutation = useUpdateProject()

  const form = useForm<EditProjectForm>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: currentValues.name,
      description: currentValues.description ?? '',
      default_branch: currentValues.default_branch ?? '',
    },
    mode: 'onBlur',
  })

  useEffect(() => {
    if (open) {
      form.reset({
        name: currentValues.name,
        description: currentValues.description ?? '',
        default_branch: currentValues.default_branch ?? '',
      })
    }
  }, [open, currentValues, form])

  function onSubmit(data: EditProjectForm) {
    updateMutation.mutate(
      {
        projectId,
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || undefined,
          default_branch: data.default_branch?.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Project updated')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`Failed to update project: ${err.message}`)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
          <DialogDescription>Update project settings.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="default_branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Branch</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Spinner className="size-4" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ──────────────────────────────────────────

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { data, isLoading, error } = useProject(projectId)
  const { data: pipelinesData } = usePipelines(projectId)
  const { data: buildsData } = useBuilds({ project_id: projectId, limit: 5 })
  const deleteMutation = useDeleteProject()
  const canWriteProjects = useHasPermission('projects', 'write')
  const canDeleteProjects = useHasPermission('projects', 'delete')
  const canWritePipelines = useHasPermission('pipelines', 'write')

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pipelineCreateOpen, setPipelineCreateOpen] = useState(false)

  useEffect(() => {
    const label = data?.project.name ?? 'Project Details'
    document.title = webPageTitle(label)
  }, [data?.project.name])

  if (isLoading) {
    return (
      <PageLayout>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
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
            Failed to load project: {error.message}
          </AlertDescription>
        </Alert>
      </PageLayout>
    )
  }

  if (!data) return null

  const { project } = data

  function handleDelete() {
    deleteMutation.mutate(projectId, {
      onSuccess: () => {
        toast.success('Project deleted')
        void navigate({ to: '/projects' })
      },
      onError: (err) => {
        toast.error(`Failed to delete project: ${err.message}`)
      },
    })
  }

  return (
    <PageLayout>
      <PageHeader
        title={project.name}
        back={{ to: '/projects', label: 'Projects' }}
        description={project.description}
        actions={
          (canWriteProjects || canDeleteProjects) ? (
            <div className="flex items-center gap-2">
              {canWriteProjects && (
                <Button variant="outline" onClick={() => setEditOpen(true)}>
                  <HugeiconsIcon icon={Edit02Icon} size={16} />
                  Edit
                </Button>
              )}
              {canDeleteProjects && (
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                  Delete
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Project Info */}
      <Card>
        <CardHeader>
          <CardTitle>Project Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{project.name}</dd>
            {project.description && (
              <>
                <dt className="text-muted-foreground">Description</dt>
                <dd>{project.description}</dd>
              </>
            )}
            {project.default_branch && (
              <>
                <dt className="text-muted-foreground">Default Branch</dt>
                <dd>{project.default_branch}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Created By</dt>
            <dd>{project.created_by}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(project.created_at * 1000).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Updated</dt>
            <dd>{new Date(project.updated_at * 1000).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Pipelines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Pipelines</CardTitle>
            {canWritePipelines && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPipelineCreateOpen(true)}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                Add Pipeline
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!pipelinesData?.pipelines.length ? (
            <p className="text-sm text-muted-foreground">
              No pipelines yet. Add one to start building.
            </p>
          ) : (
            <div className="space-y-2">
              {pipelinesData.pipelines.map((pipeline) => (
                <Link
                  key={pipeline.id}
                  to="/projects/$projectId/pipelines/$pipelineId"
                  params={{ projectId, pipelineId: pipeline.id }}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors border rounded-md"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {pipeline.name}
                      </span>
                      <Badge variant={getPipelineStatusVariant(pipeline.enabled)}>
                        {pipeline.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {pipeline.config_path}
                    </p>
                    {pipeline.trigger_config.events.length > 0 && (
                      <div className="flex items-center gap-1">
                        {pipeline.trigger_config.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {relativeTime(pipeline.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          )}
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
                    <Badge variant="outline">{build.trigger_type}</Badge>
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
      <EditProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        projectId={projectId}
        currentValues={{
          name: project.name,
          description: project.description,
          default_branch: project.default_branch,
        }}
      />

      {/* Create Pipeline Dialog */}
      <CreatePipelineDialog
        open={pipelineCreateOpen}
        onOpenChange={setPipelineCreateOpen}
        projectId={projectId}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.name}" and all its
              pipelines. This action cannot be undone.
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
