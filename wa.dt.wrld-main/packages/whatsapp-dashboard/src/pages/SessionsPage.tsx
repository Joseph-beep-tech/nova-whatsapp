import { useEffect, useState, useCallback } from 'react'
import {
  Smartphone,
  QrCode,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/common'
import { sessionApi } from '@/lib/api'
import type { SessionStatus } from '@/types'
import { cn } from '@/lib/utils'

// Mock session data for development
const USE_MOCK_SESSION = true

const MOCK_SESSION: SessionStatus = {
  sessionId: 'mysession',
  status: 'connected',
  phone: '+254748085137',
  pushName: 'SOMO Bot',
  lastSeen: new Date(),
}

export function SessionsPage() {
  const [session, setSession] = useState<SessionStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true)
    setError(null)

    if (USE_MOCK_SESSION) {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setSession(MOCK_SESSION)
      setIsLoading(false)
      setIsRefreshing(false)
      return
    }

    const response = await sessionApi.status('mysession')
    if (response.success && response.data) {
      setSession(response.data)
    } else {
      setError(response.error || 'Failed to fetch session status')
    }
    setIsLoading(false)
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const getStatusIcon = (status: SessionStatus['status']) => {
    switch (status) {
      case 'connected':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'qr_required':
        return <QrCode className="w-5 h-5 text-amber-500" />
      case 'loading':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <AlertTriangle className="w-5 h-5 text-muted-foreground" />
    }
  }

  const getStatusLabel = (status: SessionStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'disconnected':
        return 'Disconnected'
      case 'qr_required':
        return 'QR Code Required'
      case 'loading':
        return 'Loading...'
      default:
        return 'Unknown'
    }
  }

  const getStatusColor = (status: SessionStatus['status']) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-700'
      case 'disconnected':
        return 'bg-red-100 text-red-700'
      case 'qr_required':
        return 'bg-amber-100 text-amber-700'
      case 'loading':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-secondary text-muted-foreground'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">WhatsApp Sessions</h1>
            <p className="text-muted-foreground mt-1">Manage your WhatsApp Web connections</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => fetchSession(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Session Card */}
        {session && (
          <div className="bg-card dark:bg-card rounded-xl shadow-sm border border-border overflow-hidden">
            {/* Session Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-foreground">
                      {session.pushName || session.sessionId}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {session.phone || 'No phone number'}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
                    getStatusColor(session.status)
                  )}
                >
                  {getStatusIcon(session.status)}
                  {getStatusLabel(session.status)}
                </span>
              </div>
            </div>

            {/* Session Details */}
            <div className="p-6">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Session ID</dt>
                  <dd className="mt-1 font-mono text-sm text-foreground">
                    {session.sessionId}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last Seen</dt>
                  <dd className="mt-1 text-sm text-foreground">
                    {session.lastSeen
                      ? new Date(session.lastSeen).toLocaleString()
                      : 'Never'}
                  </dd>
                </div>
              </dl>

              {/* QR Code Section */}
              {session.status === 'qr_required' && (
                <div className="mt-6 p-6 bg-background rounded-lg text-center">
                  <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">
                    Scan the QR code with your WhatsApp mobile app
                  </p>
                  {session.qrCode ? (
                    <img
                      src={session.qrCode}
                      alt="WhatsApp QR Code"
                      className="mx-auto max-w-[256px] rounded-lg border border-border"
                    />
                  ) : (
                    <Button
                      onClick={() => window.open(sessionApi.qrCode(session.sessionId), '_blank')}
                    >
                      View QR Code
                    </Button>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                {session.status === 'disconnected' && (
                  <Button onClick={() => fetchSession(true)}>
                    Reconnect
                  </Button>
                )}
                {session.status === 'connected' && (
                  <Button variant="secondary">
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-1">About WhatsApp Sessions</h3>
          <p className="text-sm text-blue-700">
            WhatsApp Web sessions allow the dashboard to send and receive messages.
            You can have multiple sessions connected to different WhatsApp accounts.
            Each session requires scanning a QR code with the WhatsApp mobile app.
          </p>
        </div>
      </div>
    </div>
  )
}
