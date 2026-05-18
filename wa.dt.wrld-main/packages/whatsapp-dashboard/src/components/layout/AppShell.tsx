import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { useSessionStore } from '@/stores/sessionStore'
import { useChatStore } from '@/stores/chatStore'
import { useAlertStore } from '@/stores/alertStore'
import { socketClient } from '@/lib/socket'
import { AlertBanner } from '@/components/alerts'

export function AppShell() {
  const { fetchStatus, connectSocket } = useSessionStore()
  const { addMessage, updateMessage, updateChat, setTyping } = useChatStore()
  const { alerts, fetchAlerts, acknowledgeAlert } = useAlertStore()

  // Get unacknowledged alerts for banner display
  const unacknowledgedAlerts = alerts.filter((alert) => !alert.acknowledged)

  // Initialize on mount
  useEffect(() => {
    // Fetch initial session status
    fetchStatus()

    // Fetch initial alerts
    fetchAlerts()

    // Connect WebSocket
    connectSocket()

    // Set up socket event listeners
    const unsubMessage = socketClient.on('message:new', addMessage)
    const unsubMessageUpdate = socketClient.on('message:update', updateMessage)
    const unsubChatUpdate = socketClient.on('chat:update', updateChat)
    const unsubTypingStart = socketClient.on('typing:start', (data) => {
      // Backend may send identifier+platform or legacy chatId
      const key = data.identifier && data.platform
        ? `${data.identifier}:${data.platform}`
        : data.chatId
      setTyping(key, true)
    })
    const unsubTypingStop = socketClient.on('typing:stop', (data) => {
      const key = data.identifier && data.platform
        ? `${data.identifier}:${data.platform}`
        : data.chatId
      setTyping(key, false)
    })

    return () => {
      unsubMessage()
      unsubMessageUpdate()
      unsubChatUpdate()
      unsubTypingStart()
      unsubTypingStop()
    }
  }, [fetchStatus, fetchAlerts, connectSocket, addMessage, updateMessage, updateChat, setTyping])

  const handleDismissAlert = async (alertId: string) => {
    await acknowledgeAlert(alertId)
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Alert Banner Area */}
        {unacknowledgedAlerts.length > 0 && (
          <div className="flex-shrink-0 p-2 space-y-2 bg-card">
            {unacknowledgedAlerts.slice(0, 3).map((alert) => (
              <AlertBanner
                key={alert._id}
                alert={alert}
                onDismiss={handleDismissAlert}
              />
            ))}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
