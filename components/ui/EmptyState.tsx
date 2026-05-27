import { cn } from '@/lib/utils'
import { LucideIcon, InboxIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = InboxIcon,
  title = 'No data found',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <Icon className="h-10 w-10 text-gray-600 mb-3" />
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-600 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
