import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Phone, User as UserIcon, MapPin, Target, MessageSquare, Search } from 'lucide-react';
import { whatsappService, WaLead, WaSession } from '../services/whatsapp.service';

const formatChatLabel = (chatId: string): string => {
  if (chatId.endsWith('@s.whatsapp.net')) return `+${chatId.replace('@s.whatsapp.net', '')}`;
  if (chatId.endsWith('@g.us')) return `Group ${chatId.replace('@g.us', '').slice(0, 12)}…`;
  return chatId;
};

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function WhatsAppLeads() {
  const [leads, setLeads] = useState<WaLead[]>([]);
  const [sessions, setSessions] = useState<WaSession[]>([]);
  const [sessionFilter, setSessionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsData, sessionsData] = await Promise.all([
        whatsappService.getLeads(sessionFilter || undefined),
        whatsappService.getSessions(),
      ]);
      setLeads(leadsData);
      setSessions(sessionsData);
    } finally {
      setLoading(false);
    }
  }, [sessionFilter]);

  useEffect(() => { load(); }, [load]);

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

  const completionPct = (l: WaLead): number => {
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
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Leads</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Auto-captured from every WhatsApp conversation: phone, name, location, and what each customer is looking for.
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, location, requirement or phone…"
              className="w-full input-field pl-9"
            />
          </div>
          <select
            value={sessionFilter}
            onChange={(e) => setSessionFilter(e.target.value)}
            className="input-field md:w-64"
          >
            <option value="">All sessions</option>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>{s.name || s.pushname || s.sessionId}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-0">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No leads yet. They appear automatically as customers chat with your WhatsApp AI.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Location</th>
                  <th>Requirement</th>
                  <th>Profile</th>
                  <th className="text-right">Last activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const pct = completionPct(l);
                  return (
                    <tr key={l.id}>
                      <td>
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
                      <td>
                        {l.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" /> +{l.phone}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td>
                        {l.location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> {l.location}
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="max-w-xs">
                        {l.requirement ? (
                          <span className="inline-flex items-start gap-1">
                            <Target className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <span className="line-clamp-2">{l.requirement}</span>
                          </span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-gold-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{pct}%</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{l.turns} turn{l.turns === 1 ? '' : 's'}</p>
                      </td>
                      <td className="text-right text-xs">{formatDate(l.lastInteractionAt || l.createdAt)}</td>
                      <td>
                        <Link
                          to={`/whatsapp/chats/${l.sessionId}?chatId=${encodeURIComponent(l.chatId)}`}
                          className="text-xs font-semibold text-gold-700 hover:text-gold-900 inline-flex items-center gap-1"
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
      </div>
    </div>
  );
}
