import { cn } from '@/lib/utils'
import { Wifi, WifiOff, QrCode, Loader2 } from 'lucide-react'
import type { SessionStatus } from '@/types'

interface StatusIndicatorProps {
  status: SessionStatus['status']
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const statusConfig = {
  connected: {
    color: 'text-green-500',
    bgColor: 'bg-green-100',
    label: 'Connected',
    Icon: Wifi,
  },
  disconnected: {
    color: 'text-red-500',
    bgColor: 'bg-red-100',
    label: 'Disconnected',
    Icon: WifiOff,
  },
  qr_required: {
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-100',
    label: 'QR Required',
    Icon: QrCode,
  },
  loading: {
    color: 'text-blue-500',
    bgColor: 'bg-blue-100',
    label: 'Loading',
    Icon: Loader2,
  },
}

const sizeClasses = {
  sm: 'text-xs gap-1',
  md: 'text-sm gap-1.5',
  lg: 'text-base gap-2',
}

const iconSizes = {
  sm: 12,
  md: 14,
  lg: 16,
}

export function StatusIndicator({
  status,
  showLabel = true,
  size = 'md',
  className,
}: StatusIndicatorProps) {
  const config = statusConfig[status]
  const Icon = config.Icon

  return (
    <div
      className={cn(
        'inline-flex items-center',
        sizeClasses[size],
        className
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full p-1',
          config.bgColor
        )}
      >
        <Icon
          size={iconSizes[size]}
          className={cn(
            config.color,
            status === 'loading' && 'animate-spin'
          )}
        />
      </span>
      {showLabel && (
        <span className={cn('font-medium', config.color)}>
          {config.label}
        </span>
      )}
    </div>
  )
}

// Simplified dot indicator
interface StatusDotProps {
  status: 'online' | 'offline' | 'away' | 'busy'
  className?: string
}

const dotColors = {
  online: 'bg-green-500',
  offline: 'bg-muted-foreground',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'w-2 h-2 rounded-full',
        dotColors[status],
        className
      )}
    />
  )
}
