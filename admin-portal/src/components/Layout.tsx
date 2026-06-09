import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import {
  LayoutDashboard, Store, ShoppingCart, CreditCard,
  Navigation, UsersRound, AreaChart, LogOut, Menu as MenuIcon,
  Shield, MessageSquare,
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = authService.getCurrentUser();

  const handleLogout = () => { authService.logout(); navigate('/login'); };

  const navItems = [
    { path: '/',            label: 'Dashboard',    icon: LayoutDashboard },
    { path: '/restaurants', label: 'Restaurants',  icon: Store },
    { path: '/orders',      label: 'Orders',       icon: ShoppingCart },
    { path: '/tracking',    label: 'Live Tracking', icon: Navigation },
    { path: '/payments',    label: 'Payments',     icon: CreditCard },
    { path: '/riders',      label: 'Riders',       icon: UsersRound },
    { path: '/analytics',   label: 'Analytics',    icon: AreaChart },
    { path: '/users',       label: 'Users & Roles', icon: Shield },
    { path: '/whatsapp',    label: 'WhatsApp',     icon: MessageSquare },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-primary-500">NovaGo Admin</h1>
            {user && <p className="text-sm text-gray-600 mt-1">{user.name}</p>}
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
                const isWhatsApp = item.path === '/whatsapp';
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? isWhatsApp
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'bg-primary-50 text-primary-600 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isWhatsApp && isActive ? 'text-green-600' : ''}`} />
                      {item.label}
                      {isWhatsApp && (
                        <span className="ml-auto flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:ml-64 flex flex-col min-h-screen">
        <header className="bg-white shadow-sm lg:hidden">
          <div className="flex items-center gap-4 p-4">
            <button onClick={() => setSidebarOpen(true)} className="text-gray-600">
              <MenuIcon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-primary-500">NovaGo Admin</h1>
          </div>
        </header>
        <main className="flex-1 flex flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
