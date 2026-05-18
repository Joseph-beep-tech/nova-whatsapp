import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { useAuthStore } from '../store/authStore';
import {
  MessageSquare,
  Phone,
  Mic,
  Settings,
  Puzzle,
  PlusCircle,
  Clock,
  Store,
  Code,
  Users,
  ShoppingBag,
  UserCheck,
  HelpCircle,
  BarChart3,
  Zap,
} from 'lucide-react';

interface DashboardStats {
  credits: number;
  callsThisMonth: number;
  whatsappReplies: number;
}

interface WhatsAppStats {
  sessions: number;
  totalChats: number;
  totals: {
    all: number;
    inbound: number;
    outbound: number;
    ai: number;
    keyword: number;
    manual: number;
  };
  last24h: { all: number; inbound: number; outbound: number };
  thisMonth: { all: number; replies: number };
  recentChats: Array<{
    chatId: string;
    lastBody: string;
    lastDirection: 'in' | 'out';
    timestamp: string;
  }>;
}

const formatChatLabel = (chatId: string): string => {
  if (chatId.endsWith('@c.us')) return `+${chatId.replace('@c.us', '')}`;
  if (chatId.endsWith('@g.us')) return `Group ${chatId.replace('@g.us', '').slice(0, 10)}…`;
  return chatId;
};

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { request } = useApi();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({ credits: 0, callsThisMonth: 0, whatsappReplies: 0 });
  const [waStats, setWaStats] = useState<WhatsAppStats | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const creditsData = await request({ method: 'GET', url: '/credits' });
      const txs = creditsData.transactions || [];

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      let calls = 0;
      for (const tx of txs) {
        if (new Date(tx.date) >= monthStart && tx.type === 'charge') {
          if (tx.channel === 'voice_call') calls++;
        }
      }

      let waMonthlyReplies = 0;
      let wa: WhatsAppStats | null = null;
      try {
        wa = await request({ method: 'GET', url: '/whatsapp/stats' });
        waMonthlyReplies = wa?.thisMonth.replies || 0;
        setWaStats(wa);
      } catch {
        // WhatsApp engine not initialized yet — leave wa stats null
      }

      setStats({
        credits: creditsData.availableCredits || 0,
        callsThisMonth: calls,
        whatsappReplies: waMonthlyReplies,
      });
    } catch {
      // silent
    }
  }, [request]);

  useEffect(() => {
    loadStats();
    const id = window.setInterval(loadStats, 15000);
    return () => window.clearInterval(id);
  }, [loadStats]);

  const firstName = user?.firstName || 'User';

  const aiTools = [
    {
      icon: MessageSquare,
      label: 'Prompt Studio',
      desc: 'Create and manage AI prompts. Assign to voice numbers or WhatsApp.',
      href: '/prompts',
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Phone,
      label: 'Voice AI Agents',
      desc: 'Manage phone numbers and connect them to AI prompts.',
      href: '/phone-numbers',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: MessageSquare,
      label: 'WhatsApp',
      desc: 'Connect WhatsApp accounts, bulk messaging, and AI auto-replies.',
      href: '/whatsapp',
      color: 'bg-emerald-100 text-emerald-600',
    },
    {
      icon: Mic,
      label: 'Live Test',
      desc: 'Test your AI agents from the browser via WebRTC.',
      href: '/test-call',
      color: 'bg-red-100 text-red-600',
    },
    {
      icon: Puzzle,
      label: 'MCP Tools',
      desc: 'Google Sheets, WhatsApp, RAG \u2014 extend your AI capabilities.',
      href: '/gcp-config',
      color: 'bg-teal-100 text-teal-600',
    },
    {
      icon: Settings,
      label: 'AI Credentials',
      desc: 'Manage OpenAI, Twilio, and Google Cloud API keys.',
      href: '/credentials',
      color: 'bg-pink-100 text-pink-600',
    },
  ];

  const quickActions = [
    { icon: Clock, label: 'Call History', href: '/call-history' },
    { icon: Store, label: 'Marketplace', href: '#' },
    { icon: Code, label: 'Developer API', href: '#' },
    { icon: Users, label: 'Referrals', href: '#' },
    { icon: ShoppingBag, label: 'Seller Dashboard', href: '#' },
    { icon: UserCheck, label: 'Profile & KYC', href: '#' },
  ];

  // Simple bar chart data — uses real WhatsApp totals when available
  const usageCategories = ['Voice Calls', 'WhatsApp In', 'WhatsApp Out', 'AI Replies'];
  const usageValues = [
    stats.callsThisMonth,
    waStats?.totals.inbound || 0,
    waStats?.totals.outbound || 0,
    waStats?.totals.ai || 0,
  ];
  const maxVal = Math.max(...usageValues, 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {firstName}</h1>
        <p className="text-gray-500 mt-1">Your AI platform at a glance</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate('/credits')}>
          <p className="text-3xl font-bold text-green-600">{Math.round(stats.credits).toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">Voice Credits (KES)</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-bold text-gray-900">{stats.callsThisMonth}</p>
          <p className="text-sm text-gray-500 mt-1">Calls This Month</p>
        </Card>
        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/whatsapp')}
        >
          <p className="text-3xl font-bold text-gray-900">{waStats?.totals.outbound ?? stats.whatsappReplies}</p>
          <p className="text-sm text-gray-500 mt-1">WhatsApp Replies</p>
          {waStats && (
            <p className="text-xs text-gray-400 mt-1">
              {waStats.totals.ai} AI · {waStats.totals.keyword} Cmd · {waStats.totals.manual} Manual
            </p>
          )}
        </Card>
        <Card
          className="text-center cursor-pointer hover:shadow-lg transition-shadow flex flex-col items-center justify-center"
          onClick={() => navigate('/credits')}
        >
          <PlusCircle className="w-10 h-10 text-green-500 mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Top Up Credits</p>
        </Card>
      </div>

      {/* AI Tools */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-bold text-gray-900">AI Tools</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {aiTools.map((tool) => (
            <Card
              key={tool.label}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(tool.href)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tool.color}`}>
                  <tool.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{tool.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{tool.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* WhatsApp Activity */}
      {waStats && waStats.sessions > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">WhatsApp Activity</h2>
            <button
              onClick={() => navigate('/whatsapp')}
              className="ml-auto text-sm text-teal-600 hover:text-teal-700"
            >
              Manage sessions →
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Lifetime</p>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{waStats.sessions}</p>
                  <p className="text-xs text-gray-500">Sessions</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{waStats.totalChats}</p>
                  <p className="text-xs text-gray-500">Conversations</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{waStats.totals.inbound}</p>
                  <p className="text-xs text-gray-500">Messages In</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-teal-600">{waStats.totals.outbound}</p>
                  <p className="text-xs text-gray-500">Replies Out</p>
                </div>
              </div>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Reply Breakdown</p>
              <div className="space-y-2">
                {[
                  { label: 'AI replies', value: waStats.totals.ai, color: 'bg-teal-500' },
                  { label: 'Keyword replies', value: waStats.totals.keyword, color: 'bg-blue-500' },
                  { label: 'Manual replies', value: waStats.totals.manual, color: 'bg-purple-500' },
                ].map((row) => {
                  const total = Math.max(waStats.totals.outbound, 1);
                  const pct = Math.round((row.value / total) * 100);
                  return (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">{row.label}</span>
                        <span className="text-gray-500 font-medium">{row.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${row.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div className="pt-2 mt-2 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                  <span>Last 24h</span>
                  <span>{waStats.last24h.inbound} in · {waStats.last24h.outbound} out</span>
                </div>
              </div>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Recent Conversations</p>
              {waStats.recentChats.length === 0 ? (
                <p className="text-sm text-gray-400">No conversations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {waStats.recentChats.map((c) => (
                    <li key={c.chatId} className="text-sm">
                      <p className="font-medium text-gray-900 truncate">{formatChatLabel(c.chatId)}</p>
                      <p className="text-gray-500 truncate text-xs">
                        {c.lastDirection === 'out' && <span className="text-teal-600">You: </span>}
                        {c.lastBody || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Usage Overview + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Overview */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center gap-2 mb-6">
              <BarChart3 className="w-5 h-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Usage Overview</h2>
            </div>
            <div className="flex items-end gap-6 h-48 px-4">
              {usageCategories.map((cat, i) => (
                <div key={cat} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div className="w-full flex flex-col items-center justify-end flex-1">
                    <div
                      className="w-full max-w-[60px] bg-teal-400 rounded-t-md transition-all"
                      style={{ height: `${Math.max((usageValues[i] / maxVal) * 100, 4)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">{cat}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center mt-4 border-t pt-3">
              <span className="text-xs text-gray-400 -rotate-90 mr-2">Credits</span>
              <div className="flex-1 flex justify-between text-xs text-gray-400 px-4">
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
                  <span key={v}>{(v * maxVal).toFixed(1)}</span>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => action.href !== '#' && navigate(action.href)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
              >
                <action.icon className="w-5 h-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Floating Help Button */}
      <button
        className="fixed bottom-6 right-6 w-12 h-12 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 transition-colors flex items-center justify-center z-40"
        onClick={() => window.open('mailto:support@nova.ai', '_blank')}
      >
        <HelpCircle className="w-6 h-6" />
      </button>
    </div>
  );
};
