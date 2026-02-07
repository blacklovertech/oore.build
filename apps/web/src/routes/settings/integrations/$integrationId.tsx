import { useEffect } from 'react'
import { createFileRoute, Link, useNavigate, useSearch } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft02Icon,
  Delete02Icon,
  InformationCircleIcon,
  Refresh01Icon,
  Setting07Icon,
} from '@hugeicons/core-free-icons'
import { toast } from 'sonner'

import { getActiveInstanceOrRedirect, requireAuthOrRedirect } from '@/lib/instance-context'
import {
  useIntegration,
  useInstallations,
  useIntegrationRepos,
  useSyncInstallations,
  useDeleteIntegration,
} from '@/hooks/use-integrations'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const Route = createFileRoute('/settings/integrations/$integrationId')({
  validateSearch: (search: Record<string, unknown>): { installed?: string } => ({
    installed: (search.installed as string) || undefined,
  }),
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: IntegrationDetailPage,
})

function IntegrationDetailPage() {
  const { integrationId } = Route.useParams()
  const search = useSearch({ from: '/settings/integrations/$integrationId' })
  const navigate = useNavigate()

  const { data: detail, isLoading, error } = useIntegration(integrationId)
  const { data: installationsData } = useInstallations(integrationId)
  const { data: reposData } = useIntegrationRepos(integrationId)
  const syncMutation = useSyncInstallations()
  const deleteMutation = useDeleteIntegration()

  useEffect(() => {
    if (search.installed === 'true') {
      toast.success('GitHub App installed successfully')
      window.history.replaceState({}, '', `/settings/integrations/${integrationId}`)
    }
  }, [search.installed, integrationId])

  function handleSync() {
    syncMutation.mutate(integrationId, {
      onSuccess: () => {
        toast.success('Installations synced')
      },
      onError: (err) => {
        toast.error(`Sync failed: ${err.message}`)
      },
    })
  }

  function handleDisconnect() {
    const name = detail?.integration.display_name ?? detail?.integration.provider ?? 'integration'
    deleteMutation.mutate(integrationId, {
      onSuccess: () => {
        toast.success(`Disconnected ${name}`)
        void navigate({ to: '/settings/integrations' })
      },
      onError: (err) => {
        toast.error(`Failed to disconnect: ${err.message}`)
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
            Failed to load integration: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!detail) return null

  const { integration } = detail
  const installations = installationsData?.installations ?? []
  const repositories = reposData?.repositories ?? []

  return (
    <div className="max-w-4xl mx-auto w-full px-6 py-8 space-y-6">
      <div>
        <Link
          to="/settings/integrations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={14} />
          Back to Integrations
        </Link>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {integration.display_name ?? integration.provider}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant={integration.status === 'active' ? 'default' : 'secondary'}>
                {integration.status}
              </Badge>
              <Badge variant="outline">{integration.provider}</Badge>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App Info</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Provider</dt>
            <dd>{integration.provider}</dd>
            <dt className="text-muted-foreground">Host URL</dt>
            <dd>{integration.host_url}</dd>
            <dt className="text-muted-foreground">Auth Mode</dt>
            <dd>{integration.auth_mode}</dd>
            {integration.app_id && (
              <>
                <dt className="text-muted-foreground">App ID</dt>
                <dd className="font-mono">{integration.app_id}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(integration.created_at * 1000).toLocaleString()}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {integration.provider === 'github' && integration.app_slug && (
            <Button
              variant="outline"
              render={
                <a
                  href={
                    installations.length > 0
                      ? `https://github.com/apps/${integration.app_slug}/installations/select_target`
                      : `https://github.com/apps/${integration.app_slug}/installations/new`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <HugeiconsIcon icon={Setting07Icon} size={16} />
              {installations.length > 0 ? 'Manage on GitHub' : 'Install on GitHub'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleSync}
            disabled={syncMutation.isPending}
          >
            <HugeiconsIcon icon={Refresh01Icon} size={16} />
            {syncMutation.isPending ? 'Syncing...' : 'Sync Installations'}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger render={
              <Button variant="destructive">
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                Disconnect
              </Button>
            } />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect integration?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the integration, all credentials, installations,
                  and repository links. Webhooks will stop working.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDisconnect}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Installations ({installations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {installations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No installations yet
              {integration.provider === 'github' && integration.app_slug
                ? ' — install your GitHub App to get started.'
                : '.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Account</th>
                    <th className="pb-2 font-medium text-muted-foreground">Type</th>
                    <th className="pb-2 font-medium text-muted-foreground">External ID</th>
                  </tr>
                </thead>
                <tbody>
                  {installations.map((inst) => (
                    <tr key={inst.id} className="border-b last:border-0">
                      <td className="py-2">{inst.account_name}</td>
                      <td className="py-2">{inst.account_type ?? '—'}</td>
                      <td className="py-2 font-mono text-muted-foreground">{inst.external_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Repositories ({repositories.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {repositories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No repositories synced yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Repository</th>
                    <th className="pb-2 font-medium text-muted-foreground">Default Branch</th>
                    <th className="pb-2 font-medium text-muted-foreground">Visibility</th>
                  </tr>
                </thead>
                <tbody>
                  {repositories.map((repo) => (
                    <tr key={repo.id} className="border-b last:border-0">
                      <td className="py-2">{repo.full_name}</td>
                      <td className="py-2 font-mono text-muted-foreground">
                        {repo.default_branch ?? '—'}
                      </td>
                      <td className="py-2">
                        <Badge variant={repo.is_private ? 'secondary' : 'outline'}>
                          {repo.is_private ? 'private' : 'public'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
