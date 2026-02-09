import { useState, useEffect } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { Add01Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'

import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import { useProjects } from '@/hooks/use-projects'
import { useHasPermission } from '@/hooks/use-permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import PageLayout from '@/components/page-layout'
import PageHeader from '@/components/page-header'
import { webPageTitle } from '@/lib/seo'
import CreateProjectDialog from './-create-project-dialog'

export const Route = createFileRoute('/projects/')({
  staticData: { breadcrumbLabel: 'Projects' },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: ProjectsListPage,
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

function ProjectsListPage() {
  const { data, isLoading, error } = useProjects({ limit: 50 })
  const canWrite = useHasPermission('projects', 'write')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    document.title = webPageTitle('Projects')
  }, [])

  return (
    <PageLayout>
      <PageHeader
        title="Projects"
        description="Manage your CI projects."
        actions={
          canWrite ? (
            <Button onClick={() => setCreateOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} size={16} />
              New Project
            </Button>
          ) : undefined
        }
      />

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load projects: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {data && data.projects.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          {canWrite && (
            <Button onClick={() => setCreateOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} size={16} />
              Create your first project
            </Button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {data?.projects.map((project) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
          >
            <Card className="hover:bg-muted/50 transition-colors">
              <CardContent className="flex items-center justify-between py-4">
                <div className="space-y-1 min-w-0">
                  <p className="font-medium text-sm">{project.name}</p>
                  {project.description && (
                    <p className="text-xs text-muted-foreground truncate max-w-md">
                      {project.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {project.default_branch && (
                      <span>{project.default_branch}</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {relativeTime(project.updated_at)}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PageLayout>
  )
}
