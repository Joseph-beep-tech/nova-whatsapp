import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { AlertCircle, AlertTriangle, Info, X, WifiOff, MessageSquareX, Clock, Users } from 'lucide-react'
import type { Alert, AlertSeverity, AlertType } from '@/types'

interface AlertBannerProps {
  alert: Alert
  onDismiss?: (alertId: string) => void
  className?: string
}

function AlertIcon({ type, severity }: { type: AlertType; severity: AlertSeverity }) {
  const iconClass = 'w-5 h-5'

  // Choose icon based on alert type
  switch (type) {
    case 'session_disconnect':
      return <WifiOff className={iconClass} />
    case 'failed_message':
      return <MessageSquareX className={iconClass} />
    case 'queue_backup':
      return <Clock className={iconClass} />
    case 'escalation_needed':
      return <Users className={iconClass} />
    default:
      // Fallback to severity-based icon
      if (severity === 'critical') {
        return <AlertCircle className={iconClass} />
      } else if (severity === 'warning') {
        return <AlertTriangle className={iconClass} />
      } else {
        return <Info className={iconClass} />
      }
  }
}

function severityStyles(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-50 border-red-200 text-red-800'
    case 'warning':
      return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    case 'info':
      return 'bg-blue-50 border-blue-200 text-blue-800'
  }
}

function severityIconColor(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'text-red-600'
    case 'warning':
      return 'text-yellow-600'
    case 'info':
      return 'text-blue-600'
  }
}

function severityButtonStyles(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'hover:bg-red-100 text-red-600'
    case 'warning':
      return 'hover:bg-yellow-100 text-yellow-600'
    case 'info':
      return 'hover:bg-blue-100 text-blue-600'
  }
}

export function AlertBanner({ alert, onDismiss, className }: AlertBannerProps) {
  const formattedTime = format(new Date(alert.createdAt), 'HH:mm')
  const formattedDate = format(new Date(alert.createdAt), 'MMM d, yyyy')

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-3 border rounded-lg',
        severityStyles(alert.severity),
        className
      )}
    >
      {/* Icon */}
      <div className={cn('flex-shrink-0 mt-0.5', severityIconColor(alert.severity))}>
        <AlertIcon type={alert.type} severity={alert.severity} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="text-sm font-medium">{alert.message}</p>

            {/* Metadata details */}
            {Object.keys(alert.metadata).length > 0 && (
              <div className="mt-1 text-xs opacity-80">
                {alert.metadata.sessionId && (
                  <span className="mr-3">Session: {alert.metadata.sessionId}</span>
                )}
                {alert.metadata.identifier && (
                  <span className="mr-3">
                    Chat: {alert.metadata.identifier}
                    {alert.metadata.platform && ` (${alert.metadata.platform})`}
                  </span>
                )}
                {alert.metadata.queueName && alert.metadata.queueDepth !== undefined && (
                  <span className="mr-3">
                    Queue: {alert.metadata.queueName} ({alert.metadata.queueDepth}/{alert.metadata.threshold})
                  </span>
                )}
                {alert.metadata.errorMessage && (
                  <span className="mr-3">Error: {alert.metadata.errorMessage}</span>
                )}
              </div>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs opacity-70">
              {formattedTime} • {formattedDate}
            </span>

            {/* Dismiss button */}
            {onDismiss && !alert.acknowledged && (
              <button
                onClick={() => onDismiss(alert._id!)}
                className={cn(
                  'p-1 rounded transition-colors',
                  severityButtonStyles(alert.severity)
                )}
                aria-label="Dismiss alert"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
