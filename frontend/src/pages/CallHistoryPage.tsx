import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Phone, Clock, DollarSign, PhoneIncoming } from 'lucide-react';

interface Call {
  _id: string;
  phoneNumber: string;
  promptId?: { _id: string; name: string };
  duration: number;
  cost: number;
  status: 'completed' | 'failed' | 'ongoing';
  recording?: string;
  transcript?: string;
  callSid: string;
  createdAt: string;
}

interface CallStats {
  totalCalls: number;
  callsThisMonth: number;
  totalDuration: number;
  monthDuration: number;
}

export const CallHistoryPage: React.FC = () => {
  const { request } = useApi();
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<CallStats>({ totalCalls: 0, callsThisMonth: 0, totalDuration: 0, monthDuration: 0 });
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const loadCalls = useCallback(async () => {
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const data = await request({ method: 'GET', url: `/call-history${params}` });
      setCalls(data.calls || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    }
  }, [request, statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/call-history/stats' });
      setStats(data);
    } catch {
      // silent
    }
  }, [request]);

  useEffect(() => {
    loadCalls();
    loadStats();
  }, [loadCalls, loadStats]);

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Call History</h1>
        <p className="text-gray-600 mt-2">View all voice AI calls, durations, costs, and recordings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <PhoneIncoming className="w-8 h-8 text-teal-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.totalCalls}</p>
          <p className="text-xs text-gray-500 mt-1">Total Calls</p>
        </Card>
        <Card className="text-center">
          <Phone className="w-8 h-8 text-blue-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.callsThisMonth}</p>
          <p className="text-xs text-gray-500 mt-1">This Month</p>
        </Card>
        <Card className="text-center">
          <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.totalDuration)}</p>
          <p className="text-xs text-gray-500 mt-1">Total Duration</p>
        </Card>
        <Card className="text-center">
          <DollarSign className="w-8 h-8 text-green-400 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatDuration(stats.monthDuration)}</p>
          <p className="text-xs text-gray-500 mt-1">Duration This Month</p>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-600">Filter:</span>
        {['', 'completed', 'failed', 'ongoing'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="text-xs text-gray-400 ml-auto">{total} call{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Call Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-teal-400">
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Phone Number</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Prompt</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Duration</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Cost (KES)</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Call SID</th>
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400">
                    <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p>No calls recorded yet.</p>
                    <p className="text-sm mt-1">Calls will appear here once your AI agents start receiving them.</p>
                  </td>
                </tr>
              ) : (
                calls.map((call) => (
                  <tr key={call._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDate(call.createdAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatTime(call.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-900">
                      +{call.phoneNumber.replace(/^\+/, '')}
                    </td>
                    <td className="px-4 py-3 text-sm text-teal-600">
                      {call.promptId?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDuration(call.duration)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {call.cost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        call.status === 'completed' ? 'bg-green-100 text-green-700' :
                        call.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {call.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-400">{call.callSid}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
