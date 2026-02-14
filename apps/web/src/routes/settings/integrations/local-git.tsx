import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { HugeiconsIcon } from '@hugeicons/react'
import { Delete02Icon, InformationCircleIcon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import {
  getActiveInstanceOrRedirect,
  requireAuthOrRedirect,
} from '@/lib/instance-context'
import {
  useCreateLocalGitIntegration,
  useDeleteLocalGitIntegration,
  useLocalGitIntegrations,
} from '@/hooks/use-integrations'
import { useInstancePreferences } from '@/hooks/use-artifact-storage'
import { PageMeta } from '@/lib/seo'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import PageHeader from '@/components/page-header'
import PageLayout from '@/components/page-layout'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const localGitSchema = z.object({
  repository_path: z
    .string()
    .trim()
    .min(1, 'Absolute repository path is required'),
  display_name: z.string().optional(),
})

type LocalGitForm = z.infer<typeof localGitSchema>

export const Route = createFileRoute('/settings/integrations/local-git')({
  staticData: { breadcrumbLabel: 'Local Git' },
  beforeLoad: () => {
    const instance = getActiveInstanceOrRedirect()
    requireAuthOrRedirect(instance.id)
  },
  component: LocalGitPage,
})

function LocalGitPage() {
  const { data: preferences } = useInstancePreferences()
  const runtimeMode = preferences?.preferences.runtime_mode ?? 'local'
  const isLocalMode = runtimeMode === 'local'
  const { data, isLoading, error } = useLocalGitIntegrations(isLocalMode)
  const createMutation = useCreateLocalGitIntegration()
  const deleteMutation = useDeleteLocalGitIntegration()

  const form = useForm<LocalGitForm>({
    resolver: zodResolver(localGitSchema),
    defaultValues: {
      repository_path: '',
      display_name: '',
    },
  })

  function onSubmit(values: LocalGitForm) {
    createMutation.mutate(
      {
        repository_path: values.repository_path.trim(),
        display_name: values.display_name?.trim() || undefined,
      },
      {
        onSuccess: (response) => {
          toast.success(
            `Connected ${response.integration.display_name ?? 'local repository'}`,
          )
          form.reset()
        },
        onError: (err) => {
          toast.error(`Failed to connect local repository: ${err.message}`)
        },
      },
    )
  }

  function handleDelete(integrationId: string) {
    deleteMutation.mutate(integrationId, {
      onSuccess: () => toast.success('Local repository disconnected'),
      onError: (err) => toast.error(`Failed to disconnect: ${err.message}`),
    })
  }

  const integrations = data?.integrations ?? []

  return (
    <PageLayout width="wide">
      <PageMeta title="Connect Local Git" noindex />
      <PageHeader
        title="Connect Local Git"
        description="Register local filesystem git repositories for local-first builds."
        back={{ to: '/settings/integrations', label: 'Integrations' }}
      />

      {!isLocalMode ? (
        <Alert>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Runtime mode is <code>remote</code>. Local Git management is
            available only in <code>local</code> mode.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add local repository</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4 md:grid-cols-[2fr_1fr_auto]"
            >
              <FormField
                control={form.control}
                name="repository_path"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repository path</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="/absolute/path/to/repository"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="My Local Repo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={createMutation.isPending || !isLocalMode}
                >
                  {createMutation.isPending ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={InformationCircleIcon} size={16} />
          <AlertDescription>
            Failed to load local integrations: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Connected Local Repositories
            </CardTitle>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No local repositories connected yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Auth mode</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integrations.map((integration) => (
                    <TableRow key={integration.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {integration.display_name ?? 'local_git'}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {integration.id.slice(0, 8)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {integration.status}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {integration.auth_mode}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            render={
                              <Link
                                to="/settings/integrations/$integrationId"
                                params={{ integrationId: integration.id }}
                              />
                            }
                          >
                            Open
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button variant="ghost" size="sm">
                                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                                  Disconnect
                                </Button>
                              }
                            />
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Disconnect local repository?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This removes the repository mapping and related
                                  integration records.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(integration.id)}
                                >
                                  Disconnect
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </PageLayout>
  )
}
