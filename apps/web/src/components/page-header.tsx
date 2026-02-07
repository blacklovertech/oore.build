import { Link } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  back?: { to: string; label: string }
  meta?: React.ReactNode
}

export default function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: PageHeaderProps) {
  return (
    <div className="space-y-3">
      {back && (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={14} />
          {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
          {meta && <div className="flex items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
