import { create } from 'zustand'
import type { Alert, AlertStats, AlertSeverity, AlertType } from '@/types'
import { alertApi } from '@/lib/api'
import { USE_MOCK_API } from '@/lib/config'

// Mock data for development/testing
const MOCK_ALERTS: Alert[] = [
  {
    _id: '1',
    type: 'session_disconnect',
    severity: 'critical',
    message: 'WhatsApp session disconnected',
    metadata: {
      sessionId: 'mysession',
    },
    acknowledged: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    _id: '2',
    type: 'queue_backup',
    severity: 'warning',
    message: 'Event queue depth exceeds threshold',
    metadata: {
      queueName: 'whatsapp-events',
      queueDepth: 150,
      threshold: 100,
    },
    acknowledged: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    _id: '3',
    type: 'failed_message',
    severity: 'warning',
    message: 'Failed to send message',
    metadata: {
      identifier: '254712345678',
      platform: 'c.us',
      errorMessage: 'Network timeout',
    },
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    acknowledgedBy: 'agent@example.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    _id: '4',
    type: 'escalation_needed',
    severity: 'info',
    message: 'Conversation requires human intervention',
    metadata: {
      identifier: '254798765432',
      platform: 'c.us',
      tags: ['SOMO'],
    },
    acknowledged: true,
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    acknowledgedBy: 'agent@example.com',
    createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  },
]

const MOCK_STATS: AlertStats = {
  total: 4,
  unacknowledged: 2,
  acknowledged: 2,
  bySeverity: {
    info: 1,
    warning: 2,
    critical: 1,
  },
  byType: {
    session_disconnect: 1,
    failed_message: 1,
    queue_backup: 1,
    escalation_needed: 1,
  },
}

// Use mock data when mock API is enabled
const USE_MOCK_DATA = USE_MOCK_API

interface AlertState {
  // State
  alerts: Alert[]
  stats: AlertStats | null
  selectedAlertId: string | null
  severityFilter: AlertSeverity | null
  typeFilter: AlertType | null
  acknowledgedFilter: boolean | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchAlerts: (
    severity?: AlertSeverity,
    type?: AlertType,
    acknowledged?: boolean
  ) => Promise<void>
  fetchStats: () => Promise<void>
  selectAlert: (alertId: string | null) => void
  setSeverityFilter: (severity: AlertSeverity | null) => void
  setTypeFilter: (type: AlertType | null) => void
  setAcknowledgedFilter: (acknowledged: boolean | null) => void
  acknowledgeAlert: (alertId: string, acknowledgedBy?: string) => Promise<void>
  deleteAlert: (alertId: string) => Promise<void>
  createAlert: (
    alert: Omit<Alert, '_id' | 'acknowledged' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>

  // Real-time updates
  addAlert: (alert: Alert) => void
  updateAlert: (alert: Partial<Alert> & { _id: string }) => void
  removeAlert: (alertId: string) => void
}

export const useAlertStore = create<AlertState>((set, get) => ({
  // Initial state
  alerts: USE_MOCK_DATA ? MOCK_ALERTS : [],
  stats: USE_MOCK_DATA ? MOCK_STATS : null,
  selectedAlertId: null,
  severityFilter: null,
  typeFilter: null,
  acknowledgedFilter: null,
  isLoading: false,
  error: null,

  // Fetch alerts with optional filters
  fetchAlerts: async (severity, type, acknowledged) => {
    const activeFilters = {
      severity: severity ?? get().severityFilter ?? undefined,
      type: type ?? get().typeFilter ?? undefined,
      acknowledged: acknowledged ?? get().acknowledgedFilter ?? undefined,
    }

    set({ isLoading: true, error: null })

    if (USE_MOCK_DATA) {
      // Use mock data in development
      setTimeout(() => {
        let filtered = [...MOCK_ALERTS]

        if (activeFilters.severity) {
          filtered = filtered.filter((a) => a.severity === activeFilters.severity)
        }
        if (activeFilters.type) {
          filtered = filtered.filter((a) => a.type === activeFilters.type)
        }
        if (activeFilters.acknowledged !== undefined) {
          filtered = filtered.filter((a) => a.acknowledged === activeFilters.acknowledged)
        }

        set({ alerts: filtered, isLoading: false })
      }, 300)
      return
    }

    const response = await alertApi.list(
      activeFilters.severity,
      activeFilters.type,
      activeFilters.acknowledged
    )
    if (response.success && response.data) {
      set({ alerts: response.data, isLoading: false })
    } else {
      set({ error: response.error || 'Failed to fetch alerts', isLoading: false })
    }
  },

  // Fetch alert statistics
  fetchStats: async () => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        set({ stats: MOCK_STATS })
      }, 200)
      return
    }

    const response = await alertApi.stats()
    if (response.success && response.data) {
      set({ stats: response.data })
    }
  },

  // Select an alert
  selectAlert: (alertId) => {
    set({ selectedAlertId: alertId })
  },

  // Set severity filter
  setSeverityFilter: (severity) => {
    set({ severityFilter: severity })
  },

  // Set type filter
  setTypeFilter: (type) => {
    set({ typeFilter: type })
  },

  // Set acknowledged filter
  setAcknowledgedFilter: (acknowledged) => {
    set({ acknowledgedFilter: acknowledged })
  },

  // Acknowledge an alert
  acknowledgeAlert: async (alertId, acknowledgedBy) => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a._id === alertId
              ? {
                  ...a,
                  acknowledged: true,
                  acknowledgedAt: new Date().toISOString(),
                  acknowledgedBy,
                }
              : a
          ),
        }))
      }, 200)
      return
    }

    const response = await alertApi.acknowledge(alertId, acknowledgedBy)
    if (response.success && response.data) {
      set((state) => ({
        alerts: state.alerts.map((a) => (a._id === alertId ? response.data! : a)),
      }))
    }
  },

  // Delete an alert
  deleteAlert: async (alertId) => {
    if (USE_MOCK_DATA) {
      setTimeout(() => {
        set((state) => ({
          alerts: state.alerts.filter((a) => a._id !== alertId),
        }))
      }, 200)
      return
    }

    const response = await alertApi.delete(alertId)
    if (response.success) {
      set((state) => ({
        alerts: state.alerts.filter((a) => a._id !== alertId),
      }))
    }
  },

  // Create a new alert
  createAlert: async (alert) => {
    if (USE_MOCK_DATA) {
      const newAlert: Alert = {
        ...alert,
        _id: String(Date.now()),
        acknowledged: false,
        createdAt: new Date().toISOString(),
      }
      setTimeout(() => {
        set((state) => ({
          alerts: [newAlert, ...state.alerts],
        }))
      }, 200)
      return
    }

    const response = await alertApi.create(alert)
    if (response.success && response.data) {
      set((state) => ({
        alerts: [response.data!, ...state.alerts],
      }))
    }
  },

  // Real-time: add a new alert
  addAlert: (alert) => {
    set((state) => ({
      alerts: [alert, ...state.alerts],
    }))
  },

  // Real-time: update an existing alert
  updateAlert: (alert) => {
    set((state) => ({
      alerts: state.alerts.map((a) => (a._id === alert._id ? { ...a, ...alert } : a)),
    }))
  },

  // Real-time: remove an alert
  removeAlert: (alertId) => {
    set((state) => ({
      alerts: state.alerts.filter((a) => a._id !== alertId),
    }))
  },
}))
