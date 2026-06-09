/**
 * AIInteractions.tsx
 * Shows every customer interaction handled by the AI — WhatsApp and voice calls.
 * Displays intent, retrieved chunks, tokens used, escalations.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { aiLogService } from '../services/restaurantAI.service';
import { restaurantService } from '../services/restaurant.service';
import {
  ArrowLeft, MessageSquare, Mic, Bot, AlertTriangle,
  ChevronDown, ChevronUp, Search, Filter, BarChart2,
  TrendingUp, Zap, Users,
} from 'lucide-react';

const INTENT_COLORS: Record<string, string> = {
  order:        'bg-orange-100 text-orange-700',
  reservation:  'bg-blue-100 text-blue-700',
  faq:          'bg-purple-100 text-purple-700',
  menu_query:   'bg-green-100 text-green-700',
  hours:        'bg-yellow-100 text-yellow-700',
  location:     'bg-teal-100 text-teal-700',
  complaint:    'bg-red-100 text-red-700',
  general:      'bg-gray-100 text-gray-700',
};

interface LogEntry {
  _id: string;
  channel: 'whatsapp' | 'voice';
  customerPhone?: string;
  customerName?: string;
  userQuery: string;
  aiResponse: string;
  intent?: string;
  retrievedChunks?: { docId: string; score: number; snippet: string }[];
  tokensUsed?: number;
  latencyMs?: number;
  wasEscalated: boolean;
  createdAt: string;
}

export default function AIInteractions() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [channel, setChannel] = useState('');
  const [intent, setIntent] = useState('');
  const [page, setPage] = useState(1);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data: restaurant } = useQuery(['restaurant', restaurantId], () => restaurantService.getById(restaurantId!), { enabled: !!restaurantId });

  const { data: logsData, isLoading } = useQuery(
    ['aiLogs', restaurantId, channel, intent, page],
    () => aiLogService.getLogs(restaurantId!, { channel: channel || undefined, intent: intent || undefined, page, limit: 30 }),
    { enabled: !!restaurantId, keepPreviousData: true }
  );

  const { data: stats } = useQuery(
    ['aiStats', restaurantId],
    () => aiLogService.getStats(restaurantId!),
    { enabled: !!restaurantId }
  );

  const logs: LogEntry[] = logsData?.logs || [];

  function fmtTime(ts: string) {
    return new Date(ts).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/restaurants/${restaurantId}/details`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{restaurant?.name} — AI Conversations</h1>
          <p className="text-sm text-gray-500">Every customer interaction handled by the AI engine (last 30 days)</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Interactions', value: stats.total, icon: Bot, color: 'text-primary-600 bg-primary-50' },
            { label: 'Escalated to Human', value: stats.escalated, icon: AlertTriangle, color: 'text-orange-600 bg-orange-50' },
            { label: 'AI Resolution Rate', value: stats.total ? `${(((stats.total - stats.escalated) / stats.total) * 100).toFixed(1)}%` : '—', icon: TrendingUp, color: 'text-green-600 bg-green-50' },
            { label: 'Channels', value: stats.byChannel?.length || 0, icon: Zap, color: 'text-purple-600 bg-purple-50' },
          ].map((s) => (
            <div key={s.label} className="card flex items-center gap-3 p-4">
              <div className={`p-2 rounded-xl ${s.color}`}><s.icon size={20} /></div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
          <option value="">All Channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="voice">Voice Call</option>
        </select>
        <select value={intent} onChange={(e) => { setIntent(e.target.value); setPage(1); }} className="input-field w-auto text-sm">
          <option value="">All Intents</option>
          {['order','reservation','faq','menu_query','hours','location','complaint','general'].map((i) => (
            <option key={i} value={i}>{i.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      {/* Log list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading interactions...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16">
          <Bot size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No AI interactions yet</p>
          <p className="text-gray-400 text-sm mt-1">Interactions appear here once customers message via WhatsApp or call</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const isExpanded = expandedLog === log._id;
            return (
              <div key={log._id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg mt-0.5 ${log.channel === 'whatsapp' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'}`}>
                    {log.channel === 'whatsapp' ? <MessageSquare size={16} /> : <Mic size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-sm text-gray-900">{log.customerName || log.customerPhone || 'Unknown'}</span>
                      {log.intent && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INTENT_COLORS[log.intent] || 'bg-gray-100 text-gray-600'}`}>
                          {log.intent.replace('_', ' ')}
                        </span>
                      )}
                      {log.wasEscalated && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium flex items-center gap-1">
                          <AlertTriangle size={10} /> Escalated
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">{fmtTime(log.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 font-medium">Q: {log.userQuery}</p>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">A: {log.aiResponse}</p>
                    {(log.tokensUsed || log.latencyMs) && (
                      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                        {log.tokensUsed && <span>{log.tokensUsed} tokens</span>}
                        {log.latencyMs && <span>{log.latencyMs}ms</span>}
                        {log.retrievedChunks && <span>{log.retrievedChunks.length} RAG chunks used</span>}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setExpandedLog(isExpanded ? null : log._id)} className="p-1 text-gray-400 hover:text-gray-600">
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Full AI Response</p>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">{log.aiResponse}</div>
                    </div>
                    {log.retrievedChunks && log.retrievedChunks.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Knowledge Chunks Retrieved</p>
                        <div className="space-y-2">
                          {log.retrievedChunks.map((c, i) => (
                            <div key={i} className="bg-blue-50 rounded-lg p-2.5 text-xs">
                              <div className="flex justify-between mb-1">
                                <span className="font-medium text-blue-700">Chunk {c.chunkIndex}</span>
                                <span className="text-blue-600">{(c.score * 100).toFixed(1)}% match</span>
                              </div>
                              <p className="text-gray-700">{c.snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {logsData && logsData.pages > 1 && (
        <div className="flex justify-center gap-3">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="btn-secondary disabled:opacity-40">Previous</button>
          <span className="py-2 px-3 text-sm text-gray-600">Page {page} of {logsData.pages}</span>
          <button disabled={page === logsData.pages} onClick={() => setPage(page + 1)} className="btn-secondary disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
