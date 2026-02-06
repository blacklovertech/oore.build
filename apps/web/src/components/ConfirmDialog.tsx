import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
  isPending: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  isPending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onCancel}
        aria-hidden="true"
      />
      <Card className="relative z-10 w-full max-w-md mx-4">
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-medium">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant={confirmVariant}
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1"
            >
              {isPending ? 'Please wait...' : confirmLabel}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
