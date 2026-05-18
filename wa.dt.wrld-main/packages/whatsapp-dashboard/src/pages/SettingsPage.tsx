import { useState, useEffect } from 'react'
import { Settings, Key, Wifi, RefreshCw } from 'lucide-react'
import { Button, Input, Badge } from '@/components/common'
import { StatusIndicator } from '@/components/common'
import { useSessionStore } from '@/stores/sessionStore'

export function SettingsPage() {
  const { status, fetchStatus } = useSessionStore()
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    // Load saved API key
    const savedKey = localStorage.getItem('api_key') || ''
    setApiKey(savedKey)
  }, [])

  const handleSaveApiKey = () => {
    localStorage.setItem('api_key', apiKey)
    // Refresh session status with new key
    fetchStatus()
  }

  const handleRefreshStatus = () => {
    fetchStatus()
  }

  return (
    <div className="h-full overflow-y-auto bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        </div>

        {/* Session Status */}
        <div className="bg-card dark:bg-card rounded-lg border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Wifi className="w-5 h-5 text-muted-foreground" />
              <h2 className="text-lg font-medium text-foreground">
                WhatsApp Session
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefreshStatus}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusIndicator
                status={status?.status || 'disconnected'}
                showLabel
              />
            </div>

            {status?.phone && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Phone Number</span>
                <span className="text-sm text-foreground">{status.phone}</span>
              </div>
            )}

            {status?.pushName && (
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm text-foreground">{status.pushName}</span>
              </div>
            )}

            {status?.status === 'qr_required' && status.qrCode && (
              <div className="mt-4 p-4 bg-background rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  Scan this QR code with WhatsApp to connect
                </p>
                <img
                  src={status.qrCode}
                  alt="WhatsApp QR Code"
                  className="mx-auto max-w-[200px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* API Key */}
        <div className="bg-card dark:bg-card rounded-lg border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-medium text-foreground">API Key</h2>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Enter your API key to authenticate with the WhatsApp service.
          </p>

          <div className="space-y-3">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              rightIcon={
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-muted-foreground hover:text-muted-foreground"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              }
            />
            <Button onClick={handleSaveApiKey}>Save API Key</Button>
          </div>
        </div>

        {/* About */}
        <div className="bg-card dark:bg-card rounded-lg border border-border p-6">
          <h2 className="text-lg font-medium text-foreground mb-4">About</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Version</dt>
              <dd className="text-foreground">0.1.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Environment</dt>
              <dd>
                <Badge variant="info">
                  {import.meta.env.MODE}
                </Badge>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}
