import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlusCircle, QrCode, CheckCircle, RefreshCw, Trash2, LogOut,
  MessageSquare, Loader2, AlertTriangle, RotateCcw,
} from 'lucide-react';
import api from '../services/api';

type WAStatus = 'initializing' | 'qr_pending' | 'connected' | 'disconnected' | 'auth_failed';

interface WASession {
  id: string;
  sessionId: string;
  name: string;
  phone: string | null;
  pushname: string | null;
  status: string;
  lastError: string | null;
  lastActiveAt: string | null;
  createdAt: string;
}

function normalizeStatus(raw: string): WAStatus {
  const s = (raw || '').toLowerCase();
  if (s === 'connected') return 'connected';
  if (s === 'scan_qr_code' || s === 'qr_pending' || s === 'qr' || s === 'pairing') return 'qr_pending';
  if (s === 'initializing' || s === 'starting' || s === 'opening' || s === 'unlaunched') return 'initializing';
  if (s === 'auth_failed' || s === 'error' || s === 'conflict') return 'auth_failed';
  return 'disconnected';
}

const STATUS_LABEL: Record<WAStatus, string> = {
  initializing: 'Initializing',
  qr_pending:   'Scan QR',
  connected:    'Connected',
  disconnected: 'Disconnected',
  auth_failed:  'Auth Failed',
};

const STATUS_BG: Record<WAStatus, string> = {
  initializing: 'bg-gray-400',
  qr_pending:   'bg-yellow-500',
  connected:    'bg-green-500',
  disconnected: 'bg-red-500',
  auth_failed:  'bg-red-700',
};

export default function WhatsApp() {
  const [sessions, setSessions]       = useState<WASession[]>([]);
  const [showQrFor, setShowQrFor]     = useState<string | null>(null);
  const [qrMap, setQrMap]             = useState<Record<string, string | null>>({});
  const [creating, setCreating]       = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName]         = useState('');
  const [formError, setFormError]     = useState('');
  const pollRef = useRef<number | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get<WASession[]>('/whatsapp/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Poll live state for sessions that are still transitioning (initializing / qr_pending)
  useEffect(() => {
    const needsPolling =
      sessions.some((s) => ['initializing', 'qr_pending'].includes(normalizeStatus(s.status))) ||
      showQrFor !== null;

    if (!needsPolling) {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    if (pollRef.current) return;

    pollRef.current = window.setInterval(async () => {
      try {
        // 1. Fetch fresh session list from DB
        const { data: sessionList } = await api.get<WASession[]>('/whatsapp/sessions');

        // 2. For sessions still in a transitional state, pull live status from the
        //    Baileys engine — this also updates the DB so the next list fetch reflects it
        const transitional = sessionList.filter((s) =>
          ['initializing', 'qr_pending'].includes(normalizeStatus(s.status))
        );

        const liveStatuses: Record<string, { status: string; phone?: string; pushname?: string }> = {};
        await Promise.all(
          transitional.map(async (s) => {
            try {
              const { data } = await api.get<{ status: string; phone?: string; pushname?: string }>(
                `/whatsapp/sessions/${s.sessionId}/status`
              );
              liveStatuses[s.sessionId] = data;
            } catch { /* skip — will retry next tick */ }
          })
        );

        // Merge live status into the list so the UI updates immediately
        const merged = sessionList.map((s) =>
          liveStatuses[s.sessionId]
            ? {
                ...s,
                status:   liveStatuses[s.sessionId].status || s.status,
                phone:    liveStatuses[s.sessionId].phone    ?? s.phone,
                pushname: liveStatuses[s.sessionId].pushname ?? s.pushname,
              }
            : s
        );
        setSessions(merged);

        // 3. Fetch QR for every session that is now qr_pending
        const pending = merged.filter((s) => normalizeStatus(s.status) === 'qr_pending');
        const qrUpdates: Record<string, string | null> = {};
        await Promise.all(
          pending.map(async (s) => {
            try {
              const { data: qr } = await api.get<{ qrDataUrl: string | null }>(
                `/whatsapp/sessions/${s.sessionId}/qr`
              );
              qrUpdates[s.sessionId] = qr.qrDataUrl;
            } catch { /* skip */ }
          })
        );
        if (Object.keys(qrUpdates).length) {
          setQrMap((prev) => ({ ...prev, ...qrUpdates }));
        }
      } catch (err) {
        console.error('Polling failed', err);
      }
    }, 3000);

    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sessions, showQrFor]);

  const fetchQrOnce = async (sessionId: string) => {
    try {
      const { data } = await api.get<{ qrDataUrl: string | null }>(
        `/whatsapp/sessions/${sessionId}/qr`
      );
      setQrMap((prev) => ({ ...prev, [sessionId]: data.qrDataUrl }));
    } catch (err) {
      console.error('Failed to fetch QR', err);
    }
  };

  const handleAddSession = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setFormError('');
    try {
      const { data } = await api.post<{ sessionId: string }>('/whatsapp/sessions', {
        name: newName.trim(),
      });
      setShowNewForm(false);
      setNewName('');
      await loadSessions();
      setShowQrFor(data.sessionId);
      // Give Baileys a couple of seconds to generate the QR, then pre-fetch it
      setTimeout(() => fetchQrOnce(data.sessionId), 2000);
    } catch {
      setFormError('Failed to create session. Make sure the backend is reachable.');
    } finally {
      setCreating(false);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    if (!window.confirm('Disconnect this WhatsApp session?')) return;
    await api.post(`/whatsapp/sessions/${sessionId}/disconnect`).catch(console.error);
    await loadSessions();
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm('Permanently delete this session and its WhatsApp link?')) return;
    await api.delete(`/whatsapp/sessions/${sessionId}`).catch(console.error);
    setShowQrFor((cur) => (cur === sessionId ? null : cur));
    await loadSessions();
  };

  // Restart a disconnected session in-place (upserts the DB record and re-calls Baileys)
  const handleReconnect = async (session: WASession) => {
    try {
      // Use sessionId as name so normalizeSessionId on the backend matches the existing record
      await api.post('/whatsapp/sessions', { name: session.sessionId });
      await loadSessions();
      setShowQrFor(session.sessionId);
      setTimeout(() => fetchQrOnce(session.sessionId), 2000);
    } catch (err) {
      console.error('Failed to reconnect', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Sessions</h1>
          <p className="text-gray-600 mt-2">
            Connect your WhatsApp accounts. Each session runs the AI engine independently —
            incoming messages are answered automatically.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          Add WhatsApp
        </button>
      </div>

      {/* New session form */}
      {showNewForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">New WhatsApp session</h2>
          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !creating && handleAddSession()}
              placeholder="Session name (e.g. novago-main)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={handleAddSession}
              disabled={creating || !newName.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              {creating ? 'Starting…' : 'Create & Connect'}
            </button>
            <button
              onClick={() => { setShowNewForm(false); setFormError(''); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
          {formError && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{formError}</p>
            </div>
          )}
        </div>
      )}

      {/* Sessions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 ? (
          <div className="col-span-full text-center py-16 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg">No WhatsApp sessions yet.</p>
            <p className="text-sm mt-1">Click "Add WhatsApp" to connect your first account.</p>
          </div>
        ) : (
          sessions.map((session) => {
            const st = normalizeStatus(session.status);
            return (
              <div key={session.sessionId} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                {/* Card header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${STATUS_BG[st]}`} />
                    <span className="font-semibold text-gray-900 truncate">
                      {session.name || session.pushname || session.sessionId}
                    </span>
                  </div>
                  <span className={`ml-2 flex-shrink-0 px-3 py-1 rounded-full text-xs font-bold uppercase text-white ${STATUS_BG[st]}`}>
                    {STATUS_LABEL[st]}
                  </span>
                </div>

                {session.phone && (
                  <p className="text-sm text-gray-600 mb-1">+{session.phone}</p>
                )}
                <p className="text-xs text-gray-400 mb-3 truncate">Session: {session.sessionId}</p>

                {/* Connected */}
                {st === 'connected' && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500 border-t border-gray-100 pt-3 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>
                      Connected
                      {session.lastActiveAt
                        ? ` — Last active: ${new Date(session.lastActiveAt).toLocaleString()}`
                        : ''}
                    </span>
                  </div>
                )}

                {/* Disconnected / failed — show Reconnect button */}
                {(st === 'disconnected' || st === 'auth_failed') && (
                  <div className="mb-3">
                    <button
                      onClick={() => handleReconnect(session)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" /> Reconnect &amp; Get QR
                    </button>
                  </div>
                )}

                {/* Initializing / QR pending */}
                {(st === 'initializing' || st === 'qr_pending') && (
                  <div className="mb-3">
                    {showQrFor === session.sessionId ? (
                      <div className="border border-gray-200 rounded-lg p-4 text-center">
                        {qrMap[session.sessionId] ? (
                          <img
                            src={qrMap[session.sessionId]!}
                            alt="WhatsApp QR code"
                            className="w-56 h-56 mx-auto rounded-lg mb-3"
                          />
                        ) : (
                          <div className="w-56 h-56 mx-auto bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center mb-3 gap-2">
                            <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                            <p className="text-xs text-gray-400">
                              {st === 'initializing' ? 'Starting session…' : 'Loading QR code…'}
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mb-3">
                          Open WhatsApp → Settings → Linked Devices → Link a Device
                        </p>
                        <div className="flex justify-center gap-3">
                          <button
                            onClick={() => fetchQrOnce(session.sessionId)}
                            className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Refresh QR
                          </button>
                          <button
                            onClick={() => setShowQrFor(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Hide
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setShowQrFor(session.sessionId);
                          if (st === 'qr_pending') fetchQrOnce(session.sessionId);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {st === 'initializing' ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                        ) : (
                          <><QrCode className="w-4 h-4" /> Show QR Code</>
                        )}
                      </button>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 border-t border-gray-100 pt-3 items-center">
                  {st === 'connected' && (
                    <button
                      onClick={() => handleDisconnect(session.sessionId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(session.sessionId)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 transition-colors ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
