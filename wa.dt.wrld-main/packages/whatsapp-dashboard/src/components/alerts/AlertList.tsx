import { useEffect, useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { AlertItem } from './AlertItem'
import { useAlertStore } from '@/stores/alertStore'
import type { AlertSeverity } from '@/types'
import { cn } from '@/lib/utils'

const severityFilters: { value: AlertSeverity | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

const acknowledgedFilters: { value: boolean | null; label: string }[] = [
  { value: null, label: 'All' },
  { value: false, label: 'Active' },
  { value: true, label: 'Acknowledged' },
]

export function AlertList() {
  const {
    alerts,
    severityFilter,
    acknowledgedFilter,
    selectedAlertId,
    isLoading,
    fetchAlerts,
    fetchStats,
    setSeverityFilter,
    setAcknowledgedFilter,
    selectAlert,
    acknowledgeAlert,
  } = useAlertStore()

  // Initial fetch
  useEffect(() => {
    fetchAlerts()
    fetchStats()
  }, [fetchAlerts, fetchStats])

  // Refetch when filters change
  useEffect(() => {
    fetchAlerts()
  }, [severityFilter, acknowledgedFilter, fetchAlerts])

  // Filter alerts (client-side filtering for mock data, server-side for real API)
  const filteredAlerts = useMemo(() => {
    let result = [...alerts]

    // Sort by creation time (newest first)
    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [alerts])

  const handleAcknowledge = async (alertId: string) => {
    await acknowledgeAlert(alertId)
    // Refresh stats after acknowledging
    fetchStats()
  }

  return (
    <div className="flex flex-col h-full bg-card dark:bg-card">
      {/* Header */}
      <div className="p-4">
        <h1 className="text-xl font-semibold text-foreground">Alerts</h1>

        {/* Severity Filters */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Severity</p>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {severityFilters.map((f) => (
              <button
                key={f.value}
                onClick={() =>
                  setSeverityFilter(f.value === 'all' ? null : f.value)
                }
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                  (f.value === 'all' && !severityFilter) ||
                    severityFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Acknowledged Filters */}
        <div className="mt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {acknowledgedFilters.map((f) => (
              <button
                key={f.label}
                onClick={() => setAcknowledgedFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                  acknowledgedFilter === f.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No alerts found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredAlerts.map((alert) => (
              <AlertItem
                key={alert._id}
                alert={alert}
                isSelected={alert._id === selectedAlertId}
                onClick={() => selectAlert(alert._id!)}
                onAcknowledge={() => handleAcknowledge(alert._id!)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
