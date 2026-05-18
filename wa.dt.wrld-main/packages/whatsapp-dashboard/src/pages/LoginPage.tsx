import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { MessageCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/auth'
import { Button } from '@/components/common'

export function LoginPage() {
  const { authenticated, isLoading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Get the page they tried to visit before being redirected
  const from = (location.state as { from?: Location })?.from?.pathname || '/chats'

  // If already authenticated, redirect to the page they came from
  useEffect(() => {
    if (authenticated && !isLoading) {
      navigate(from, { replace: true })
    }
  }, [authenticated, isLoading, navigate, from])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="mt-3 text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
      <div className="bg-card dark:bg-card rounded-2xl shadow-xl p-8 w-full max-w-md mx-4">
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Dashboard</h1>
          <p className="text-muted-foreground mt-2">Sign in to access your conversations</p>
        </div>

        <Button
          onClick={login}
          className="w-full py-3"
          size="lg"
        >
          Sign In with SSO
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          You'll be redirected to your organization's login page
        </p>
      </div>
    </div>
  )
}
