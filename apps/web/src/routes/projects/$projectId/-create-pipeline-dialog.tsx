import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCreatePipeline, useValidatePipeline } from '@/hooks/use-pipelines'
import type { TriggerConfig, ConcurrencyPolicy } from '@/lib/types'

const createPipelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  config_path: z.string().min(1, 'Config path is required'),
  branches: z.string().optional(),
  max_concurrent: z.string().optional().refine(
    (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100),
    'Must be a number between 1 and 100',
  ),
})

type CreatePipelineForm = z.infer<typeof createPipelineSchema>

const TRIGGER_EVENTS = ['push', 'pull_request', 'tag_push'] as const

interface CreatePipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

export default function CreatePipelineDialog({
  open,
  onOpenChange,
  projectId,
}: CreatePipelineDialogProps) {
  const createMutation = useCreatePipeline()
  const validateMutation = useValidatePipeline()

  const form = useForm<CreatePipelineForm>({
    resolver: zodResolver(createPipelineSchema),
    defaultValues: {
      name: '',
      config_path: '.oore.yml',
      branches: '',
      max_concurrent: undefined,
    },
    mode: 'onBlur',
  })

  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [cancelPrevious, setCancelPrevious] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  function buildPayload(data: CreatePipelineForm) {
    const trigger_config: TriggerConfig = {
      events: selectedEvents,
      branches: data.branches
        ? data.branches.split(',').map((b) => b.trim()).filter(Boolean)
        : [],
    }
    const concurrency: ConcurrencyPolicy = {
      cancel_previous: cancelPrevious,
      max_concurrent: data.max_concurrent ? Number(data.max_concurrent) : undefined,
    }
    return {
      name: data.name.trim(),
      config_path: data.config_path.trim(),
      trigger_config,
      concurrency,
    }
  }

  async function onSubmit(data: CreatePipelineForm) {
    const payload = buildPayload(data)

    try {
      const result = await validateMutation.mutateAsync(payload)
      if (!result.valid && result.errors?.length) {
        setValidationErrors(result.errors)
        return
      }
    } catch {
      // Validation endpoint may not exist yet; proceed with creation
    }

    setValidationErrors([])

    createMutation.mutate(
      { projectId, data: payload },
      {
        onSuccess: () => {
          toast.success('Pipeline created')
          handleClose()
        },
        onError: (err) => {
          toast.error(`Failed to create pipeline: ${err.message}`)
        },
      },
    )
  }

  function handleClose() {
    form.reset()
    setSelectedEvents([])
    setCancelPrevious(false)
    setValidationErrors([])
    onOpenChange(false)
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    )
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) handleClose()
      else onOpenChange(true)
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Pipeline</DialogTitle>
          <DialogDescription>
            Configure a new build pipeline for this project.
          </DialogDescription>
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
                    <Input placeholder="Build & Test" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Config Path</FormLabel>
                  <FormControl>
                    <Input placeholder=".oore.yml" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Trigger Events</FormLabel>
              <div className="flex flex-col gap-2">
                {TRIGGER_EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>

            <FormField
              control={form.control}
              name="branches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Branch Patterns{' '}
                    <span className="text-muted-foreground font-normal">
                      (comma-separated, optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="main, develop, release/*" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={cancelPrevious}
                  onCheckedChange={(checked) => setCancelPrevious(!!checked)}
                />
                Cancel previous builds on same branch
              </label>
            </div>

            <FormField
              control={form.control}
              name="max_concurrent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Max Concurrent{' '}
                    <span className="text-muted-foreground font-normal">
                      (optional, 1-100)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      placeholder=""
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || validateMutation.isPending}
              >
                {createMutation.isPending ? (
                  <>
                    <Spinner className="size-4" />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
