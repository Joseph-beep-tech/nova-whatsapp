import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { ChatsPage, SettingsPage, LoginPage, SessionsPage, MemoryInsightsPage } from '@/pages'
import { ProtectedRoute } from '@/auth'

// Placeholder pages for routes not yet implemented
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-full bg-surface-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-surface-900 mb-2">{title}</h1>
        <p className="text-surface-500">Coming soon</p>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public route - Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes - require authentication */}
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {/* Main chat interface */}
        <Route path="/chats" element={<ChatsPage />} />

        {/* Sessions management */}
        <Route path="/sessions" element={<SessionsPage />} />

        {/* Memory insights */}
        <Route path="/memory" element={<MemoryInsightsPage />} />

        {/* Placeholder routes */}
        <Route path="/contacts" element={<PlaceholderPage title="Contacts" />} />
        <Route path="/tags" element={<PlaceholderPage title="Tags" />} />
        <Route path="/analytics" element={<PlaceholderPage title="Analytics" />} />
        <Route path="/help" element={<PlaceholderPage title="Help" />} />

        {/* Settings */}
        <Route path="/settings" element={<SettingsPage />} />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/chats" replace />} />
        <Route path="*" element={<Navigate to="/chats" replace />} />
      </Route>
    </Routes>
  )
}
