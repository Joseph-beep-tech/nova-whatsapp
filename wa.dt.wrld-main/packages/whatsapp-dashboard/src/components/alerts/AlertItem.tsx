import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { Check, AlertCircle, AlertTriangle, Info, WifiOff, MessageSquareX, Clock, Users } from 'lucide-react'
import { Badge } from '@/components/common'
import type { Alert, AlertSeverity, AlertType } from '@/types'

interface AlertItemProps {
  alert: Alert
  isSelected: boolean
  onClick: () => void
  onAcknowledge?: () => void
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
      return 'border-l-red-500 bg-red-50/50'
    case 'warning':
      return 'border-l-yellow-500 bg-yellow-50/50'
    case 'info':
      return 'border-l-blue-500 bg-blue-50/50'
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

function severityBadge(severity: AlertSeverity) {
  switch (severity) {
    case 'critical':
      return 'danger'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
  }
}

export function AlertItem({ alert, isSelected, onClick, onAcknowledge }: AlertItemProps) {
  const formattedTime = formatDistanceToNow(new Date(alert.createdAt), {
    addSuffix: true,
  })

  return (
    <div
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left transition-colors border-l-2',
        'hover:bg-secondary cursor-pointer',
        alert.acknowledged ? 'opacity-60' : '',
        isSelected && 'bg-secondary',
        severityStyles(alert.severity)
      )}
    >
      {/* Icon */}
      <div className={cn('relative flex-shrink-0 mt-1', severityIconColor(alert.severity))}>
        <AlertIcon type={alert.type} severity={alert.severity} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className="font-medium text-foreground text-sm">{alert.message}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{formattedTime}</span>
        </div>

        {/* Metadata details */}
        {Object.keys(alert.metadata).length > 0 && (
          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
            {alert.metadata.sessionId && (
              <div>
                <span className="font-medium">Session:</span> {alert.metadata.sessionId}
              </div>
            )}
            {alert.metadata.identifier && (
              <div>
                <span className="font-medium">Chat:</span> {alert.metadata.identifier}
                {alert.metadata.platform && ` (${alert.metadata.platform})`}
              </div>
            )}
            {alert.metadata.queueName && alert.metadata.queueDepth !== undefined && (
              <div>
                <span className="font-medium">Queue:</span> {alert.metadata.queueName} (
                {alert.metadata.queueDepth}/{alert.metadata.threshold})
              </div>
            )}
            {alert.metadata.errorMessage && (
              <div>
                <span className="font-medium">Error:</span> {alert.metadata.errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Status badges and actions */}
        <div className="flex items-center gap-2 mt-2">
          {/* Severity badge */}
          <Badge variant={severityBadge(alert.severity)} size="sm">
            {alert.severity}
          </Badge>

          {/* Acknowledged badge */}
          {alert.acknowledged ? (
            <Badge variant="success" size="sm">
              <Check className="w-3 h-3 mr-1" />
              Acknowledged
            </Badge>
          ) : (
            onAcknowledge && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onAcknowledge()
                }}
                className="px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
              >
                Acknowledge
              </button>
            )
          )}
        </div>

        {/* Acknowledged by info */}
        {alert.acknowledged && alert.acknowledgedBy && (
          <div className="mt-1 text-xs text-muted-foreground">
            By {alert.acknowledgedBy}
          </div>
        )}
      </div>
    </div>
  )
}
