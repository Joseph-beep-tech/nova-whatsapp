import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Send, Users, MessageSquare, User, MapPin, Target, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../utils/api';

type Direction = 'in' | 'out';
type ReplyKind = 'ai' | 'keyword' | 'manual' | null;

interface ChatSummary {
  chatId: string;
  isGroup: boolean;
  lastMessage: {
    body: string;
    direction: Direction;
    timestamp: string;
    replyKind: ReplyKind;
    hasMedia: boolean;
  };
  messageCount: number;
  inboundCount: number;
}

interface ChatMessage {
  id: string;
  chatId: string;
  direction: Direction;
  fromMe: boolean;
  author: string | null;
  body: string;
  hasMedia: boolean;
  replyKind: ReplyKind;
  timestamp: string;
}

interface SessionStatus {
  status: string;
  phone: string | null;
  pushname: string | null;
  lastActiveAt: string | null;
  lastError: string | null;
}

interface Lead {
  phone: string | null;
  name: string | null;
  location: string | null;
  requirement: string | null;
  turns: number;
  lastInteractionAt: string | null;
}

const formatChatLabel = (chatId: string): string => {
  if (chatId.endsWith('@c.us')) return `+${chatId.replace('@c.us', '')}`;
  if (chatId.endsWith('@g.us')) return `Group ${chatId.replace('@g.us', '').slice(0, 12)}…`;
  return chatId;
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const WhatsAppChatsPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionStatus | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const loadStatus = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await api.get<SessionStatus>(`/whatsapp/sessions/${sessionId}/status`);
      setSession(data);
    } catch (_) { /* ignore */ }
  }, [sessionId]);

  const loadChats = useCallback(async () => {
    if (!sessionId) return;
    try {
      const { data } = await api.get<ChatSummary[]>(`/whatsapp/sessions/${sessionId}/chats`);
      setChats(data);
      if (!activeChatId && data.length > 0) {
        setActiveChatId(data[0].chatId);
      }
    } catch (err) {
      console.error('Failed to load chats', err);
    }
  }, [sessionId, activeChatId]);

  const loadMessages = useCallback(async () => {
    if (!sessionId || !activeChatId) return;
    try {
      const { data } = await api.get<ChatMessage[]>(
        `/whatsapp/sessions/${sessionId}/chats/${encodeURIComponent(activeChatId)}/messages`
      );
      setMessages(data);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }, [sessionId, activeChatId]);

  const loadLead = useCallback(async () => {
    if (!sessionId || !activeChatId) {
      setLead(null);
      return;
    }
    try {
      const { data } = await api.get<Lead>(
        `/whatsapp/sessions/${sessionId}/chats/${encodeURIComponent(activeChatId)}/lead`
      );
      setLead(data);
    } catch (err: any) {
      if (err?.response?.status === 404) setLead(null);
    }
  }, [sessionId, activeChatId]);

  useEffect(() => {
    loadStatus();
    loadChats();
  }, [loadStatus, loadChats]);

  useEffect(() => {
    loadMessages();
    loadLead();
  }, [loadMessages, loadLead]);

  // Live polling — every 3s refresh chats, transcript, and lead state
  useEffect(() => {
    const id = window.setInterval(() => {
      loadChats();
      loadMessages();
      loadStatus();
      loadLead();
    }, 3000);
    return () => window.clearInterval(id);
  }, [loadChats, loadMessages, loadStatus, loadLead]);

  // Auto-scroll transcript on new messages
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!sessionId || !activeChatId || !reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/whatsapp/sessions/${sessionId}/messages`, {
        to: activeChatId,
        text: reply.trim(),
      });
      setReply('');
      await loadMessages();
      await loadChats();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/whatsapp"
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Sessions
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
            <p className="text-sm text-gray-500">
              {session?.pushname && <span className="font-medium">{session.pushname}</span>}
              {session?.phone && <span> · +{session.phone}</span>}
              {session && (
                <span className={`ml-2 inline-block px-2 py-0.5 rounded-full text-xs font-bold uppercase ${
                  session.status === 'connected' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                }`}>{session.status}</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => { loadChats(); loadMessages(); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Left: chat list */}
        <div className="col-span-4 bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Chats</h2>
            <span className="text-xs text-gray-400">{chats.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversations yet. Send a message to your linked number from another phone.
              </div>
            )}
            {chats.map((c) => (
              <button
                key={c.chatId}
                onClick={() => setActiveChatId(c.chatId)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  activeChatId === c.chatId ? 'bg-teal-50 hover:bg-teal-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.isGroup && <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span className="font-medium text-gray-900 truncate">{formatChatLabel(c.chatId)}</span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(c.lastMessage.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-500 truncate flex-1">
                    {c.lastMessage.direction === 'out' && <span className="text-teal-600">You: </span>}
                    {c.lastMessage.hasMedia && !c.lastMessage.body ? '[media]' : c.lastMessage.body || '—'}
                  </p>
                  <span className="text-xs text-gray-400 ml-2">{c.messageCount}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: transcript */}
        <div className="col-span-8 bg-white rounded-lg shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">
              {lead?.name || (activeChatId ? formatChatLabel(activeChatId) : 'Select a chat')}
            </h2>
            {activeChatId && lead && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {lead.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="w-3 h-3 text-gray-400" /> +{lead.phone}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <User className="w-3 h-3 text-gray-400" />
                  {lead.name || <em className="text-gray-400">name unknown</em>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  {lead.location || <em className="text-gray-400">location unknown</em>}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Target className="w-3 h-3 text-gray-400" />
                  {lead.requirement ? (
                    <span className="truncate max-w-[16rem]" title={lead.requirement}>{lead.requirement}</span>
                  ) : (
                    <em className="text-gray-400">requirement unknown</em>
                  )}
                </span>
                <span className="text-gray-400 ml-auto">{lead.turns} turn{lead.turns === 1 ? '' : 's'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-2">
            {!activeChatId && (
              <div className="text-center text-gray-400 py-12">Select a chat from the left to view messages.</div>
            )}
            {activeChatId && messages.length === 0 && (
              <div className="text-center text-gray-400 py-12">No messages yet.</div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                    m.direction === 'out'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                  }`}
                >
                  {m.body || (m.hasMedia ? <em className="opacity-70">[media]</em> : '—')}
                  <div
                    className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${
                      m.direction === 'out' ? 'text-teal-100' : 'text-gray-400'
                    }`}
                  >
                    {m.direction === 'out' && m.replyKind && (
                      <span className="uppercase tracking-wider">{m.replyKind}</span>
                    )}
                    <span>{formatTime(m.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
          {activeChatId && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="border-t border-gray-100 px-4 py-3 flex gap-2"
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a manual reply…"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500"
                disabled={sending || session?.status !== 'connected'}
              />
              <button
                type="submit"
                disabled={sending || !reply.trim() || session?.status !== 'connected'}
                className="inline-flex items-center gap-1 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:bg-gray-300"
              >
                <Send className="w-4 h-4" /> Send
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
