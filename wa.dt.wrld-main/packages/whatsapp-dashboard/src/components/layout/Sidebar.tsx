import { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import {
  MessageSquare,
  BarChart3,
  Settings,
  Users,
  Tag,
  HelpCircle,
  Smartphone,
  LogOut,
} from 'lucide-react'
import { Avatar, StatusIndicator, ThemeToggle } from '@/components/common'
import { useSessionStore } from '@/stores/sessionStore'
import { useAuth } from '@/auth'
import { cn } from '@/lib/utils'
import type { Role } from '@/types'

interface NavItem {
  to: string
  label: string
  icon: typeof MessageSquare
  /** Required roles to see this nav item (any of these) */
  roles?: Role[]
}

// Navigation items with role requirements
const allNavItems: NavItem[] = [
  { to: '/chats', label: 'Chats', icon: MessageSquare },
  { to: '/sessions', label: 'Sessions', icon: Smartphone, roles: ['automation_engineer', 'tenant_admin', 'creator_admin'] },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/tags', label: 'Tags', icon: Tag, roles: ['tenant_admin', 'creator_admin'] },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, roles: ['automation_engineer', 'tenant_admin', 'creator_admin'] },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const { status } = useSessionStore()
  const { user, canAccess, logout } = useAuth()

  // Filter nav items based on user roles
  const navItems = useMemo(() => {
    return allNavItems.filter((item) => {
      if (!item.roles) return true // No role requirement
      return canAccess(item.roles)
    })
  }, [canAccess])

  return (
    <aside className="flex flex-col w-16 bg-[hsl(var(--teal-12))] dark:bg-[hsl(var(--slate-2))] h-screen">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 bg-primary">
        <MessageSquare className="w-8 h-8 text-primary-foreground" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-center w-full h-12 text-white/70 dark:text-muted-foreground transition-colors',
                    'hover:bg-white/10 dark:hover:bg-accent hover:text-white dark:hover:text-accent-foreground',
                    isActive && 'bg-white/10 dark:bg-accent text-white dark:text-accent-foreground border-l-2 border-white dark:border-primary'
                  )
                }
                title={item.label}
              >
                <item.icon className="w-6 h-6" />
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="py-4 space-y-2">
        {/* Session status indicator */}
        <div className="flex items-center justify-center py-2">
          <StatusIndicator
            status={status?.status || 'disconnected'}
            showLabel={false}
            size="sm"
          />
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Help link */}
        <NavLink
          to="/help"
          className="flex items-center justify-center w-full h-12 text-white/70 dark:text-muted-foreground hover:bg-white/10 dark:hover:bg-accent hover:text-white dark:hover:text-accent-foreground transition-colors"
          title="Help"
        >
          <HelpCircle className="w-6 h-6" />
        </NavLink>

        {/* User avatar */}
        {user && (
          <div className="flex items-center justify-center py-2" title={user.name}>
            <Avatar name={user.name} size="sm" />
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={logout}
          className="flex items-center justify-center w-full h-12 text-white/70 dark:text-muted-foreground hover:bg-white/10 dark:hover:bg-accent hover:text-white dark:hover:text-accent-foreground transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </aside>
  )
}
