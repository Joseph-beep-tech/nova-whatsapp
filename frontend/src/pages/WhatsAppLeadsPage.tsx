import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui';
import { RefreshCw, Phone, User as UserIcon, MapPin, Target, MessageSquare, Search } from 'lucide-react';
import api from '../utils/api';

interface Lead {
  id: string;
  sessionId: string;
  chatId: string;
  phone: string | null;
  name: string | null;
  location: string | null;
  requirement: string | null;
  turns: number;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionSummary {
  sessionId: string;
  name: string;
  pushname: string | null;
}

const formatChatLabel = (chatId: string): string => {
  if (chatId.endsWith('@c.us')) return `+${chatId.replace('@c.us', '')}`;
  if (chatId.endsWith('@g.us')) return `Group ${chatId.replace('@g.us', '').slice(0, 12)}…`;
  if (chatId.endsWith('@lid')) return `LID ${chatId.replace('@lid', '').slice(0, 8)}…`;
  return chatId;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const WhatsAppLeadsPage: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionFilter, setSessionFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, sessionsRes] = await Promise.all([
        api.get<Lead[]>('/whatsapp/leads', { params: sessionFilter ? { sessionId: sessionFilter } : {} }),
        api.get<SessionSummary[]>('/whatsapp/sessions'),
      ]);
      setLeads(leadsRes.data);
      setSessions(sessionsRes.data);
    } finally {
      setLoading(false);
    }
  }, [sessionFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = leads.filter((l) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return (
      (l.name || '').toLowerCase().includes(needle) ||
      (l.location || '').toLowerCase().includes(needle) ||
      (l.requirement || '').toLowerCase().includes(needle) ||
      (l.phone || '').toLowerCase().includes(needle)
    );
  });

  const completionPct = (l: Lead): number => {
    let known = 0;
    if (l.name) known++;
    if (l.location) known++;
    if (l.requirement) known++;
    if (l.phone) known++;
    return Math.round((known / 4) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Leads</h1>
          <p className="text-gray-600 mt-2">
            Auto-captured from every WhatsApp conversation: phone, name, location, and what each user is looking for.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <Card>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, location, requirement or phone…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 min-w-[16rem]"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>{s.name || s.pushname || s.sessionId}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No leads yet. They appear automatically as users chat with your WhatsApp AI.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-3 pr-4">Contact</th>
                  <th className="py-3 pr-4">Phone</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Requirement</th>
                  <th className="py-3 pr-4">Profile</th>
                  <th className="py-3 pr-4 text-right">Last activity</th>
                  <th className="py-3 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const pct = completionPct(l);
                  return (
                    <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">
                              {l.name || <span className="text-gray-400">— unknown —</span>}
                            </p>
                            <p className="text-xs text-gray-400">{formatChatLabel(l.chatId)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {l.phone ? (
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <Phone className="w-3.5 h-3.5 text-gray-400" /> +{l.phone}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {l.location ? (
                          <span className="inline-flex items-center gap-1 text-gray-700">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> {l.location}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        {l.requirement ? (
                          <span className="inline-flex items-start gap-1 text-gray-700">
                            <Target className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{l.requirement}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct === 100 ? 'bg-green-500' : 'bg-teal-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{l.turns} turn{l.turns === 1 ? '' : 's'}</p>
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-500 text-xs">
                        {formatDate(l.lastInteractionAt || l.updatedAt)}
                      </td>
                      <td className="py-3 pl-2">
                        <Link
                          to={`/whatsapp/${l.sessionId}/chats`}
                          className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
