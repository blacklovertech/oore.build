import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useInstanceStore } from '@/stores/instance-store'

const addInstanceSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  url: z
    .string()
    .transform((v) => v.replace(/\/+$/, ''))
    .pipe(
      z.string().refine(
        (v) => v === '' || /^https?:\/\/.+/.test(v),
        'URL must be a valid HTTP/HTTPS URL, or empty for local dev',
      ),
    ),
})

type AddInstanceForm = z.infer<typeof addInstanceSchema>

interface AddInstanceDialogProps {
  onClose: () => void
}

export default function AddInstanceDialog({ onClose }: AddInstanceDialogProps) {
  const addInstance = useInstanceStore((s) => s.addInstance)
  const setActiveInstance = useInstanceStore((s) => s.setActiveInstance)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AddInstanceForm>({
    resolver: zodResolver(addInstanceSchema),
    defaultValues: { label: '', url: '' },
    mode: 'onBlur',
  })

  function onSubmit(data: AddInstanceForm) {
    const id = addInstance(data.label.trim(), data.url)
    setActiveInstance(id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-md mx-4">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">Add Instance</h2>
            <p className="text-sm text-muted-foreground">
              Connect to an oore.build backend. Leave URL empty to use the local
              dev proxy.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-label">Label</Label>
              <Input
                id="instance-label"
                type="text"
                placeholder="My CI Server"
                {...register('label')}
                autoFocus
              />
              {errors.label ? (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instance-url">
                Backend URL{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="instance-url"
                type="text"
                placeholder="https://ci.example.com"
                {...register('url')}
              />
              {errors.url ? (
                <p className="text-sm text-destructive">{errors.url.message}</p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid} className="flex-1">
                Add
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
