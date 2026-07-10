import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Send, Users, MessageSquare, User, MapPin, Target, Phone, PlayCircle } from 'lucide-react';
import { whatsappService, WaChat, WaChatMessage, WaLead } from '../services/whatsapp.service';

const formatChatLabel = (chatId: string): string => {
  if (chatId.endsWith('@s.whatsapp.net')) return `+${chatId.replace('@s.whatsapp.net', '')}`;
  if (chatId.endsWith('@g.us')) return `Group ${chatId.replace('@g.us', '').slice(0, 12)}…`;
  return chatId;
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function WhatsAppChats() {
  const { sessionId = 'novago-main' } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();

  const [chats, setChats] = useState<WaChat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(searchParams.get('chatId'));
  const [messages, setMessages] = useState<WaChatMessage[]>([]);
  const [lead, setLead] = useState<WaLead | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const loadChats = useCallback(async () => {
    try {
      const data = await whatsappService.getChats(sessionId);
      setChats(data);
      setActiveChatId((prev) => prev || (data.length > 0 ? data[0].chatId : null));
    } catch (err) {
      console.error('Failed to load chats', err);
    }
  }, [sessionId]);

  const loadMessages = useCallback(async () => {
    if (!activeChatId) return;
    try {
      setMessages(await whatsappService.getMessages(sessionId, activeChatId));
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  }, [sessionId, activeChatId]);

  const loadLead = useCallback(async () => {
    if (!activeChatId) { setLead(null); return; }
    try {
      setLead(await whatsappService.getLead(sessionId, activeChatId));
    } catch (err) {
      console.error('Failed to load lead', err);
    }
  }, [sessionId, activeChatId]);

  useEffect(() => { loadChats(); }, [loadChats]);
  useEffect(() => { loadMessages(); loadLead(); }, [loadMessages, loadLead]);

  useEffect(() => {
    const id = window.setInterval(() => {
      loadChats();
      loadMessages();
      loadLead();
    }, 3000);
    return () => window.clearInterval(id);
  }, [loadChats, loadMessages, loadLead]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeChat = chats.find((c) => c.chatId === activeChatId) || null;

  const handleSend = async () => {
    if (!activeChatId || !reply.trim()) return;
    setSending(true);
    try {
      await whatsappService.sendMessage(sessionId, activeChatId, reply.trim());
      setReply('');
      await loadMessages();
      await loadChats();
    } catch (err) {
      console.error('Failed to send', err);
    } finally {
      setSending(false);
    }
  };

  const handleResumeAi = async () => {
    if (!activeChatId) return;
    await whatsappService.resumeAi(sessionId, activeChatId);
    await loadChats();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/whatsapp" className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> WhatsApp
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        </div>
        <button
          onClick={() => { loadChats(); loadMessages(); }}
          className="btn-secondary text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
        {/* Left: chat list */}
        <div className="col-span-4 card p-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border flex items-center justify-between">
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
                  activeChatId === c.chatId ? 'bg-gold-50 hover:bg-gold-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {c.isGroup && <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    <span className="font-medium text-gray-900 truncate">{formatChatLabel(c.chatId)}</span>
                    {c.aiPaused && (
                      <span className="badge bg-amber-50 text-amber-700 border border-amber-200 shrink-0">Paused</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(c.lastMessage.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm text-gray-500 truncate flex-1">
                    {c.lastMessage.direction === 'out' && <span className="text-gold-600">You: </span>}
                    {c.lastMessage.hasMedia && !c.lastMessage.body ? '[media]' : c.lastMessage.body || '—'}
                  </p>
                  <span className="text-xs text-gray-400 ml-2">{c.messageCount}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: transcript */}
        <div className="col-span-8 card p-0 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
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

          {activeChat?.aiPaused && (
            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-700">AI replies paused for this chat — an admin took over.</p>
              <button
                onClick={handleResumeAi}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 hover:text-amber-900 shrink-0"
              >
                <PlayCircle className="w-3.5 h-3.5" /> Resume AI
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 space-y-2">
            {!activeChatId && (
              <div className="text-center text-gray-400 py-12">Select a chat from the left to view messages.</div>
            )}
            {activeChatId && messages.length === 0 && (
              <div className="text-center text-gray-400 py-12">No messages yet.</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                    m.direction === 'out'
                      ? 'bg-gold-600 text-white rounded-br-sm'
                      : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100'
                  }`}
                >
                  {m.body || (m.hasMedia ? <em className="opacity-70">[media]</em> : '—')}
                  <div
                    className={`text-[10px] mt-1 flex items-center gap-1 justify-end ${
                      m.direction === 'out' ? 'text-gold-100' : 'text-gray-400'
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
              className="border-t border-surface-border px-4 py-3 flex gap-2"
            >
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a manual reply…"
                className="flex-1 input-field"
                disabled={sending}
              />
              <button type="submit" disabled={sending || !reply.trim()} className="btn-primary">
                <Send className="w-4 h-4" /> Send
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
