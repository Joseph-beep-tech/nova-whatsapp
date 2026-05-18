import React from 'react';
import {
  Settings,
  Zap,
  Phone,
  MessageSquare,
  CreditCard,
  Radio,
  Cloud,
  LayoutDashboard,
  Puzzle,
  Users,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard', color: 'indigo' },
  { icon: Settings, label: 'AI Credentials', href: '/credentials', color: 'blue' },
  { icon: Cloud, label: 'Google Cloud', href: '/gcp-config', color: 'cyan' },
  { icon: MessageSquare, label: 'Prompts', href: '/prompts', color: 'purple' },
  { icon: Phone, label: 'Phone Numbers', href: '/phone-numbers', color: 'green' },
  { icon: CreditCard, label: 'Voice Credits', href: '/credits', color: 'yellow' },
  { icon: Puzzle, label: 'MCP Tools', href: '/mcp-tools', color: 'teal' },
  { icon: MessageSquare, label: 'WhatsApp', href: '/whatsapp', color: 'emerald' },
  { icon: Users, label: 'WhatsApp Leads', href: '/whatsapp/leads', color: 'emerald' },
  { icon: Phone, label: 'Call History', href: '/call-history', color: 'slate' },
  { icon: Radio, label: 'Test Call', href: '/test-call', color: 'red' },
  { icon: Zap, label: 'Autopilot', href: '/autopilot', color: 'orange' },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="hidden md:flex flex-col w-64 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-2xl font-bold">Nova</h1>
        <p className="text-gray-400 text-sm">Voice AI Portal</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-700 bg-gray-800 rounded-lg m-4">
        <p className="text-xs text-gray-400">Version 1.0.0</p>
        <p className="text-xs text-gray-400">© {new Date().getFullYear()} Nova AI</p>
      </div>
    </div>
  );
};
