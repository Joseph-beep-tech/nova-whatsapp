import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from './Button'

interface SessionExpiredModalProps {
  isOpen: boolean
  onLogin: () => void
}

export function SessionExpiredModal({ isOpen, onLogin }: SessionExpiredModalProps) {
  const [countdown, setCountdown] = useState(10)

  // Auto-redirect countdown
  useEffect(() => {
    if (!isOpen) {
      setCountdown(10)
      return
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          onLogin()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isOpen, onLogin])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>

          <h2 className="text-xl font-semibold text-surface-900 mb-2">
            Session Expired
          </h2>

          <p className="text-surface-500 mb-6">
            Your session has expired. Please log in again to continue.
          </p>

          <Button onClick={onLogin} className="w-full">
            Log In Again
          </Button>

          <p className="mt-4 text-sm text-surface-400">
            Redirecting automatically in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  )
}
