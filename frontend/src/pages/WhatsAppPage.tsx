import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui';
import { PlusCircle, QrCode, CheckCircle, RefreshCw, Trash2, LogOut, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

type WAStatus =
  | 'initializing'
  | 'qr_pending'
  | 'authenticated'
  | 'connected'
  | 'disconnected'
  | 'auth_failed';

interface WASession {
  id: string;
  sessionId: string;
  name: string;
  phone: string | null;
  pushname: string | null;
  status: WAStatus;
  promptId: string | null;
  lastActiveAt: string | null;
  lastError: string | null;
  createdAt: string;
}

interface Prompt {
  _id: string;
  name: string;
  status: string;
}

const STATUS_LABEL: Record<WAStatus, string> = {
  initializing: 'Initializing',
  qr_pending: 'Scan QR',
  authenticated: 'Authenticated',
  connected: 'Connected',
  disconnected: 'Disconnected',
  auth_failed: 'Auth Failed',
};

const STATUS_COLOR: Record<WAStatus, string> = {
  initializing: 'bg-gray-400',
  qr_pending: 'bg-yellow-500',
  authenticated: 'bg-blue-500',
  connected: 'bg-green-500',
  disconnected: 'bg-red-500',
  auth_failed: 'bg-red-600',
};

export const WhatsAppPage: React.FC = () => {
  const [sessions, setSessions] = useState<WASession[]>([]);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [showQrFor, setShowQrFor] = useState<string | null>(null);
  const [qrMap, setQrMap] = useState<Record<string, string | null>>({});
  const [creating, setCreating] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPromptId, setNewPromptId] = useState<string>('');
  const pollRef = useRef<number | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get<WASession[]>('/whatsapp/sessions');
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions', err);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    try {
      const { data } = await api.get<Prompt[]>('/prompts');
      setPrompts(data);
    } catch (_) { /* prompts optional */ }
  }, []);

  useEffect(() => {
    loadSessions();
    loadPrompts();
  }, [loadSessions, loadPrompts]);

  // Poll while any session is in a transitional state OR has a visible QR
  useEffect(() => {
    const needsPolling =
      sessions.some((s) =>
        ['initializing', 'qr_pending', 'authenticated'].includes(s.status)
      ) || showQrFor !== null;

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
        const { data } = await api.get<WASession[]>('/whatsapp/sessions');
        setSessions(data);

        // Refresh QR for any sessions still pending
        const pending = data.filter((s) => s.status === 'qr_pending');
        const updates: Record<string, string | null> = {};
        await Promise.all(
          pending.map(async (s) => {
            try {
              const { data: qr } = await api.get<{ status: WAStatus; qrDataUrl: string | null }>(
                `/whatsapp/sessions/${s.sessionId}/qr`
              );
              updates[s.sessionId] = qr.qrDataUrl;
            } catch (_) { /* ignore */ }
          })
        );
        if (Object.keys(updates).length > 0) {
          setQrMap((prev) => ({ ...prev, ...updates }));
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
      const { data } = await api.get<{ status: WAStatus; qrDataUrl: string | null }>(
        `/whatsapp/sessions/${sessionId}/qr`
      );
      setQrMap((prev) => ({ ...prev, [sessionId]: data.qrDataUrl }));
    } catch (err) {
      console.error('Failed to fetch QR', err);
    }
  };

  const handleAddSession = async () => {
    setCreating(true);
    try {
      const { data } = await api.post('/whatsapp/sessions', {
        name: newName,
        promptId: newPromptId || null,
      });
      toast.success('Session created — generating QR code…');
      setShowNewForm(false);
      setNewName('');
      setNewPromptId('');
      await loadSessions();
      setShowQrFor(data.sessionId);
      // Try fetching the QR a few times so first scan is fast
      setTimeout(() => fetchQrOnce(data.sessionId), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    if (!window.confirm('Disconnect this WhatsApp session?')) return;
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/disconnect`);
      toast.success('Session disconnected');
      await loadSessions();
    } catch (err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm('Permanently delete this session and its WhatsApp link?')) return;
    try {
      await api.delete(`/whatsapp/sessions/${sessionId}`);
      toast.success('Session deleted');
      setShowQrFor((cur) => (cur === sessionId ? null : cur));
      await loadSessions();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Sessions</h1>
          <p className="text-gray-600 mt-2">
            Connect your WhatsApp accounts. Each session runs the AI engine independently — incoming messages are
            answered using your active prompt and OpenAI credentials.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition-all"
        >
          <PlusCircle className="w-5 h-5" />
          Add WhatsApp
        </button>
      </div>

      {showNewForm && (
        <Card>
          <h2 className="text-lg font-semibold mb-3">New WhatsApp session</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sales bot"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prompt (optional)</label>
              <select
                value={newPromptId}
                onChange={(e) => setNewPromptId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">— Use latest active prompt —</option>
                {prompts.map((p) => (
                  <option key={p._id} value={p._id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAddSession}
              disabled={creating}
              className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-300"
            >
              {creating ? 'Starting engine…' : 'Create & generate QR'}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessions.length === 0 && (
          <div className="col-span-full text-center py-16 text-gray-400">
            <p className="text-lg">No WhatsApp sessions yet.</p>
            <p className="text-sm mt-1">Click "Add WhatsApp" to connect your first account.</p>
          </div>
        )}

        {sessions.map((session) => (
          <Card key={session.sessionId} className="relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${STATUS_COLOR[session.status]}`} />
                <span className="font-semibold text-gray-900">
                  {session.name || session.pushname || session.sessionId}
                </span>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase text-white ${STATUS_COLOR[session.status]}`}
              >
                {STATUS_LABEL[session.status]}
              </span>
            </div>

            {session.phone && (
              <p className="text-sm text-gray-600 mb-1">Phone: +{session.phone}</p>
            )}
            <p className="text-xs text-gray-400 mb-3 truncate">Session: {session.sessionId}</p>

            {session.lastError && session.status !== 'connected' && (
              <p className="text-xs text-red-600 mb-3">⚠ {session.lastError}</p>
            )}

            {session.status === 'connected' && (
              <div className="flex items-center gap-1.5 text-sm text-gray-500 border-t border-gray-100 pt-3 mb-3">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span>
                  Connected{session.lastActiveAt ? ` — Last active: ${new Date(session.lastActiveAt).toLocaleString()}` : ''}
                </span>
              </div>
            )}

            {(session.status === 'qr_pending' || session.status === 'initializing') && (
              <>
                {showQrFor === session.sessionId ? (
                  <div className="border border-gray-200 rounded-lg p-4 text-center">
                    {qrMap[session.sessionId] ? (
                      <img
                        src={qrMap[session.sessionId]!}
                        alt="WhatsApp QR code"
                        className="w-56 h-56 mx-auto rounded-lg mb-3"
                      />
                    ) : (
                      <div className="w-56 h-56 mx-auto bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                        <RefreshCw className="w-10 h-10 text-gray-300 animate-spin" />
                      </div>
                    )}
                    <p className="text-xs text-gray-500">
                      Open WhatsApp on your phone → Settings → Linked Devices → Link a Device
                    </p>
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        onClick={() => fetchQrOnce(session.sessionId)}
                        className="text-sm text-teal-600 hover:text-teal-700 inline-flex items-center gap-1"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Refresh
                      </button>
                      <button
                        onClick={() => setShowQrFor(null)}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Hide QR
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowQrFor(session.sessionId);
                      fetchQrOnce(session.sessionId);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <QrCode className="w-4 h-4" />
                    Show QR Code
                  </button>
                )}
              </>
            )}

            <div className="flex gap-2 mt-3 border-t border-gray-100 pt-3 items-center">
              <Link
                to={`/whatsapp/${session.sessionId}/chats`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                <MessageSquare className="w-3.5 h-3.5" /> View chats
              </Link>
              {session.status === 'connected' && (
                <button
                  onClick={() => handleDisconnect(session.sessionId)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600"
                >
                  <LogOut className="w-3.5 h-3.5" /> Disconnect
                </button>
              )}
              <button
                onClick={() => handleDelete(session.sessionId)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
