import { cn } from '@/lib/utils'
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  iconColor?: string
  className?: string
  valueColor?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  iconColor = 'text-blue-400',
  className,
  valueColor,
}: StatCardProps) {
  const isPositive = change !== undefined && change > 0
  const isNegative = change !== undefined && change < 0

  return (
    <div className={cn(
      'rounded-lg border border-[#1F2937] bg-[#111827] p-4',
      className
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-gray-400">{title}</p>
        {Icon && (
          <Icon className={cn('h-4 w-4', iconColor)} />
        )}
      </div>

      <p className={cn(
        'text-xl font-semibold tabular-nums',
        valueColor ?? 'text-gray-100'
      )}>
        {value}
      </p>

      {(subtitle || change !== undefined) && (
        <div className="mt-2 flex items-center gap-2">
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-0.5 text-xs',
              isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-gray-400'
            )}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : isNegative ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{change > 0 ? '+' : ''}{change.toFixed(2)}%</span>
            </div>
          )}
          {subtitle && (
            <span className="text-xs text-gray-500">{subtitle}</span>
          )}
          {changeLabel && (
            <span className="text-xs text-gray-500">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}
