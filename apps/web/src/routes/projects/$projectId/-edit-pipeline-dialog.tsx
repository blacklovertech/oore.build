import { useState, useEffect } from 'react'
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
import { useUpdatePipeline } from '@/hooks/use-pipelines'
import type { Pipeline } from '@/lib/types'

const editPipelineSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  config_path: z.string().min(1, 'Config path is required'),
  branches: z.string().optional(),
  max_concurrent: z.string().optional().refine(
    (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100),
    'Must be a number between 1 and 100',
  ),
})

type EditPipelineForm = z.infer<typeof editPipelineSchema>

const TRIGGER_EVENTS = ['push', 'pull_request', 'tag_push'] as const

interface EditPipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: Pipeline
}

export default function EditPipelineDialog({
  open,
  onOpenChange,
  pipeline,
}: EditPipelineDialogProps) {
  const updateMutation = useUpdatePipeline()

  const form = useForm<EditPipelineForm>({
    resolver: zodResolver(editPipelineSchema),
    defaultValues: {
      name: pipeline.name,
      config_path: pipeline.config_path,
      branches: pipeline.trigger_config.branches.join(', '),
      max_concurrent: pipeline.concurrency.max_concurrent
        ? String(pipeline.concurrency.max_concurrent)
        : undefined,
    },
    mode: 'onBlur',
  })

  const [selectedEvents, setSelectedEvents] = useState<string[]>(
    pipeline.trigger_config.events,
  )
  const [cancelPrevious, setCancelPrevious] = useState(
    pipeline.concurrency.cancel_previous,
  )

  useEffect(() => {
    if (open) {
      form.reset({
        name: pipeline.name,
        config_path: pipeline.config_path,
        branches: pipeline.trigger_config.branches.join(', '),
        max_concurrent: pipeline.concurrency.max_concurrent
          ? String(pipeline.concurrency.max_concurrent)
          : undefined,
      })
      setSelectedEvents(pipeline.trigger_config.events)
      setCancelPrevious(pipeline.concurrency.cancel_previous)
    }
  }, [open, pipeline, form])

  function onSubmit(data: EditPipelineForm) {
    updateMutation.mutate(
      {
        pipelineId: pipeline.id,
        data: {
          name: data.name.trim(),
          config_path: data.config_path.trim(),
          trigger_config: {
            events: selectedEvents,
            branches: data.branches
              ? data.branches.split(',').map((b) => b.trim()).filter(Boolean)
              : [],
          },
          concurrency: {
            cancel_previous: cancelPrevious,
            max_concurrent: data.max_concurrent ? Number(data.max_concurrent) : undefined,
          },
        },
      },
      {
        onSuccess: () => {
          toast.success('Pipeline updated')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(`Failed to update pipeline: ${err.message}`)
        },
      },
    )
  }

  function toggleEvent(event: string) {
    setSelectedEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event],
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pipeline</DialogTitle>
          <DialogDescription>Update pipeline configuration.</DialogDescription>
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
              name="config_path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Config Path</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <FormLabel>Branch Patterns</FormLabel>
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
                      (optional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={100} {...field} />
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
