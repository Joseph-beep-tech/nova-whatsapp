import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import {
  LayoutDashboard, Store, ShoppingCart, CreditCard, Navigation,
  BarChart2, LogOut, Menu as MenuIcon, Shield,
  MessageSquare, ChevronDown, Bell, Bike, Users,
} from 'lucide-react';
import { useState } from 'react';

const NAV_GROUPS = [
  {
    label: 'Operations',
    items: [
      { path: '/',            label: 'Dashboard',     icon: LayoutDashboard },
      { path: '/orders',      label: 'Orders',        icon: ShoppingCart },
      { path: '/tracking',    label: 'Live Tracking', icon: Navigation },
      { path: '/riders',      label: 'Riders',        icon: Bike },
    ],
  },
  {
    label: 'Restaurant',
    items: [
      { path: '/restaurants', label: 'Restaurants',   icon: Store },
      { path: '/payments',    label: 'Payments',      icon: CreditCard },
      { path: '/analytics',   label: 'Analytics',     icon: BarChart2 },
      { path: '/whatsapp',    label: 'WhatsApp',      icon: MessageSquare, dot: true },
      { path: '/whatsapp/chats/novago-main', label: 'WA Chats', icon: MessageSquare },
      { path: '/whatsapp/leads', label: 'WA Leads', icon: Users },
    ],
  },
  {
    label: 'Admin',
    items: [
      { path: '/users',       label: 'Users & Roles', icon: Shield },
    ],
  },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const user = authService.getCurrentUser();

  const handleLogout = () => { authService.logout(); navigate('/login'); };

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const currentPage = NAV_GROUPS.flatMap((g) => g.items).find((i) => isActive(i.path))?.label || 'NovaGo';

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-slate-950 shadow-sidebar
          flex flex-col transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-8 h-8 bg-gold-500 rounded-lg flex items-center justify-center shrink-0">
            <Store size={16} className="text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight tracking-wide">NovaGo</p>
            <p className="text-slate-400 text-xs">Restaurant Platform</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`sidebar-nav-item ${active ? 'active' : ''}`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {'dot' in item && item.dot && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="sidebar-nav-item w-full text-slate-400 hover:text-red-400 hover:bg-red-900/20"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div className="lg:ml-64 flex flex-col flex-1 min-h-screen min-w-0">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white border-b border-surface-border px-6 py-3 flex items-center gap-4 shadow-sm">
          {/* Mobile menu */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 hover:text-gray-900">
            <MenuIcon size={22} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-gray-400 hidden sm:block">NovaGo</span>
            <span className="text-xs text-gray-300 hidden sm:block">/</span>
            <span className="text-sm font-semibold text-gray-800 truncate">{currentPage}</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button className="relative p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" />
            </button>

            {/* User chip */}
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="relative flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gold-500 flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block max-w-[100px] truncate">
                {user?.name || 'Admin'}
              </span>
              <ChevronDown size={14} className="text-gray-400" />

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-surface-border rounded-xl shadow-card-hover z-50 py-1">
                  <div className="px-3 py-2 border-b border-surface-border">
                    <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              )}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 fade-in overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
