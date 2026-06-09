/**
 * WhatsApp.tsx — NovaGo Admin Portal WhatsApp Page
 *
 * Uses the same axios `api` instance as every other admin page —
 * baseURL already set to VITE_API_URL (default http://localhost:4000).
 *
 * Backend proxy at /api/whatsapp/* forwards to wwebjs-api and whatsapp-service.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, QrCode, CheckCircle2, XCircle, Loader2,
  RefreshCw, Search, Bot, User, Send, StickyNote, UserCheck,
  Zap, Paperclip, X, ShoppingBag, Clock, Info,
  Wifi, WifiOff, AlertTriangle, Plus, RotateCcw,
} from 'lucide-react';
import api from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type SessionState = 'CONNECTED' | 'DISCONNECTED' | 'SCAN_QR_CODE' | 'INITIALIZING' | 'FAILED';

interface WaSession {
  sessionId: string;
  state: SessionState;
  phone?: string;
  pushName?: string;
  qrObjectUrl?: string;
}
interface Chat {
  id: string; identifier: string; platform: string;
  contactName: string; contactPhone: string;
  lastMessage: string; lastMessageTime: string;
  unreadCount: number; status: string;
  isGroup: boolean; tags: string[]; assignedTo?: string;
}
interface Message {
  id: string; content: string; contentType: string; timestamp: string;
  sender: { type: 'customer' | 'bot' | 'agent'; name: string };
  isFromMe: boolean;
}
interface Order { id: string; status: string; total: number; }

// ── Colour helpers ────────────────────────────────────────────────────────────
const COLORS = [
  { bg: '#E1F5EE', fg: '#0F6E56' }, { bg: '#ede9fe', fg: '#5b21b6' },
  { bg: '#dbeafe', fg: '#1e40af' }, { bg: '#fef3c7', fg: '#d97706' },
  { bg: '#fce7f3', fg: '#be185d' },
];
function ini(name: string) {
  return (name || '?').split(' ').map((w: string) => w[0] || '').join('').slice(0, 2).toUpperCase() || '??';
}
function clr(name: string) { return COLORS[(name || '?').charCodeAt(0) % COLORS.length]; }
function ago(ts: string) {
  const d = (Date.now() - new Date(ts).getTime()) / 1000;
  if (d < 60) return 'now'; if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`; return `${Math.floor(d / 86400)}d`;
}
function fmt(ts: string) {
  try { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function normaliseState(raw: string): SessionState {
  const s = (raw || '').toUpperCase();
  if (s === 'CONNECTED' || s === 'READY') return 'CONNECTED';
  if (s === 'SCAN_QR_CODE' || s === 'QR' || s === 'QR_REQUIRED') return 'SCAN_QR_CODE';
  if (s === 'INITIALIZING' || s === 'STARTING' || s === 'LOADING') return 'INITIALIZING';
  if (s === 'FAILED' || s === 'ERROR') return 'FAILED';
  return 'DISCONNECTED';
}

// ── API helpers using the shared axios instance ───────────────────────────────
async function waGet(path: string): Promise<any> {
  try {
    const res = await api.get(`/api/whatsapp${path}`);
    return res.data;
  } catch (e: any) {
    console.warn(`[WA GET] ${path}`, e?.response?.status, e?.message);
    return null;
  }
}
async function waPost(path: string, body: object): Promise<any> {
  try {
    const res = await api.post(`/api/whatsapp${path}`, body);
    return res.data;
  } catch (e: any) {
    console.warn(`[WA POST] ${path}`, e?.response?.status, e?.message);
    return null;
  }
}

// QR image needs a raw fetch because we need a Blob, not JSON.
// We build the URL the same way axios does (baseURL + path).
async function fetchQrBlob(sessionId: string): Promise<string | null> {
  try {
    const baseURL: string = (api.defaults.baseURL as string || 'http://localhost:4000').replace(/\/$/, '');
    const token = localStorage.getItem('auth_token') || '';
    const url = `${baseURL}/api/whatsapp/session/qr/${sessionId}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size < 50) return null;
    return URL.createObjectURL(blob);
  } catch { return null; }
}

const QUICK_REPLIES = [
  { emoji: '🏍️', label: 'Order on its way', text: 'Your order is on the way and will arrive in about 25 minutes!' },
  { emoji: '🙏', label: 'Apologise', text: 'We sincerely apologise for the inconvenience. Let me fix this right away.' },
  { emoji: '💸', label: 'Refund processed', text: 'Your refund has been processed and will reflect within 24 hours.' },
  { emoji: '👍', label: 'Thank customer', text: 'Thank you for ordering with NovaGo! Is there anything else I can help you with?' },
  { emoji: '📞', label: 'Escalate', text: "I'm escalating this to our team. You'll hear from us within 15 minutes." },
];

// ─── QR Connect Panel ─────────────────────────────────────────────────────────
function QRConnectPanel({ onConnected }: { onConnected: (phone?: string) => void }) {
  const [session, setSession]   = useState<WaSession | null>(null);
  const [sessionId, setSessionId] = useState('novago-main');
  const [starting, setStarting] = useState(false);
  const [error, setError]       = useState('');
  const pollRef   = useRef<ReturnType<typeof setInterval>>();
  const prevQrUrl = useRef('');
  const pollTick  = useRef(0);

  const revokeOldQr = () => {
    if (prevQrUrl.current) { URL.revokeObjectURL(prevQrUrl.current); prevQrUrl.current = ''; }
  };

  const pollStatus = useCallback(async (sid: string) => {
    pollTick.current++;
    const data = await waGet(`/session/status/${sid}`);
    if (!data) return;

    // shape: { success, data: { sessionId, state, phone, pushName } }
    const inner = data?.data ?? data;
    const state = normaliseState(inner?.state || inner?.status || '');

    let qrObjectUrl: string | undefined;
    if (state === 'SCAN_QR_CODE' && pollTick.current % 2 === 1) {
      const url = await fetchQrBlob(sid);
      if (url) { revokeOldQr(); prevQrUrl.current = url; qrObjectUrl = url; }
    }

    setSession(prev => ({
      ...(prev ?? { sessionId: sid }),
      sessionId: sid, state,
      phone:      inner?.phone    ?? prev?.phone,
      pushName:   inner?.pushName ?? prev?.pushName,
      qrObjectUrl: qrObjectUrl ?? (state === 'SCAN_QR_CODE' ? prev?.qrObjectUrl : undefined),
    }));

    if (state === 'CONNECTED') {
      clearInterval(pollRef.current);
      revokeOldQr();
      onConnected(inner?.phone);
    }
  }, [onConnected]);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      const res = await waGet('/sessions');
      if (!res) return;
      const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
      if (list.length > 0) {
        const s   = list[0];
        const sid = s.sessionId || s.id || 'novago-main';
        setSessionId(sid);
        setSession({ sessionId: sid, state: normaliseState(s.state || s.status || '') });
        pollRef.current = setInterval(() => pollStatus(sid), 4000);
      }
    })();
    return () => { clearInterval(pollRef.current); revokeOldQr(); };
  }, [pollStatus]);

  const handleConnect = async () => {
    if (!sessionId.trim()) return;
    setError(''); setStarting(true);
    clearInterval(pollRef.current);
    pollTick.current = 0;

    const res = await waGet(`/session/start/${sessionId.trim()}`);
    setStarting(false);

    if (res === null) {
      setError(
        'The backend could not reach the WhatsApp API (wwebjs-api). ' +
        'Make sure wwebjs-api is running and WA_API_URL is set in the backend .env file.'
      );
      return;
    }

    setSession({ sessionId: sessionId.trim(), state: 'INITIALIZING' });
    pollRef.current = setInterval(() => pollStatus(sessionId.trim()), 3000);
  };

  const handleRegenerate = async () => {
    clearInterval(pollRef.current);
    revokeOldQr();
    setSession(prev => prev ? { ...prev, state: 'INITIALIZING', qrObjectUrl: undefined } : null);
    await waGet(`/session/terminate/${sessionId}`);
    await new Promise(r => setTimeout(r, 1500));
    await handleConnect();
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Connect WhatsApp</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Link a WhatsApp Business number. The AI reads your restaurant menus and handles orders automatically.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

          {/* Session name input — only when not active */}
          {(!session || session.state === 'DISCONNECTED' || session.state === 'FAILED') && (
            <div className="p-6 border-b border-gray-100">
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Session Name</label>
              <div className="flex gap-2">
                <input
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value.replace(/\s/g, '-').toLowerCase())}
                  onKeyDown={e => e.key === 'Enter' && !starting && handleConnect()}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                  placeholder="novago-main"
                />
                <button
                  onClick={handleConnect} disabled={starting || !sessionId.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Connect
                </button>
              </div>
              {error && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-xs leading-relaxed">{error}</p>
                </div>
              )}
            </div>
          )}

          {/* Status body */}
          <div className="p-6">
            {!session ? (
              <div className="text-center py-10 text-gray-300">
                <QrCode className="w-14 h-14 mx-auto mb-3" />
                <p className="text-sm">Enter a session name and click Connect</p>
              </div>

            ) : (session.state === 'INITIALIZING') ? (
              <div className="text-center py-10">
                <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto mb-4" />
                <p className="font-semibold text-gray-800 text-base">Starting session…</p>
                <p className="text-sm text-gray-400 mt-1">Generating QR code, please wait</p>
                <div className="mt-4 flex gap-1 justify-center">
                  {[0,1,2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>

            ) : session.state === 'SCAN_QR_CODE' ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center justify-center gap-2">
                  <QrCode className="w-4 h-4 text-amber-500" />
                  Scan with WhatsApp to link your number
                </p>
                {session.qrObjectUrl ? (
                  <img src={session.qrObjectUrl} alt="WhatsApp QR code"
                    className="w-56 h-56 mx-auto rounded-xl border-4 border-white shadow-lg" />
                ) : (
                  <div className="w-56 h-56 mx-auto rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                    <p className="text-xs text-gray-400">Loading QR code…</p>
                  </div>
                )}
                <div className="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-3 text-left text-xs text-amber-800 space-y-1">
                  <p className="font-semibold">How to scan:</p>
                  <p>1. Open WhatsApp on your phone</p>
                  <p>2. Tap ⋮ Menu → Linked Devices</p>
                  <p>3. Tap "Link a device" and scan this QR code</p>
                </div>
                <button onClick={handleRegenerate}
                  className="mt-4 text-xs text-gray-400 hover:text-green-600 flex items-center gap-1.5 mx-auto transition-colors">
                  <RotateCcw className="w-3 h-3" /> QR expired? Regenerate
                </button>
              </div>

            ) : session.state === 'CONNECTED' ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-3" />
                <p className="font-bold text-gray-800 text-lg">WhatsApp Connected!</p>
                {session.phone && (
                  <p className="text-gray-500 text-sm mt-1">
                    {session.phone}{session.pushName ? ` · ${session.pushName}` : ''}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">AI agent is now active and handling customer orders</p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-left">
                  <div className="bg-green-50 rounded-lg p-3 text-xs">
                    <p className="font-semibold text-green-700 mb-1">✅ AI is reading</p>
                    <p className="text-green-600">Live menus &amp; prices from all restaurants</p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 text-xs">
                    <p className="font-semibold text-blue-700 mb-1">📦 Orders go to</p>
                    <p className="text-blue-600">Your NovaGo dashboard automatically</p>
                  </div>
                </div>
                <button onClick={handleRegenerate}
                  className="mt-4 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1.5 mx-auto">
                  <RefreshCw className="w-3 h-3" /> Reconnect / Switch number
                </button>
              </div>

            ) : (
              <div className="text-center py-6">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                <p className="font-semibold text-gray-800">Session Disconnected</p>
                {error && (
                  <div className="mt-3 mx-auto max-w-xs flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-left">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs">{error}</p>
                  </div>
                )}
                <button onClick={handleConnect} disabled={starting}
                  className="mt-4 flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 mx-auto disabled:opacity-50 transition-colors">
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Reconnect
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {session && (
            <div className="px-6 pb-4 flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3">
              <span>Session: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{session.sessionId}</code></span>
              <div className="flex items-center gap-1.5">
                {session.state === 'CONNECTED'
                  ? <><Wifi className="w-3 h-3 text-green-500"/><span className="text-green-600 font-medium">Live</span></>
                  : <><WifiOff className="w-3 h-3 text-red-400"/><span className="text-red-500">{session.state}</span></>}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Bot,           label: 'AI Ordering',  desc: 'Reads live menus & prices' },
            { icon: MessageSquare, label: 'Live Inbox',   desc: 'Admin chat takeover' },
            { icon: ShoppingBag,   label: 'Real Orders',  desc: 'Synced to dashboard' },
          ].map(f => (
            <div key={f.label} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <f.icon className="w-5 h-5 text-green-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-gray-700">{f.label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WhatsApp() {
  const [tab, setTab]                       = useState<'connect' | 'inbox'>('connect');
  const [connected, setConnected]           = useState(false);
  const [connectedPhone, setConnectedPhone] = useState('');
  const [chats, setChats]                   = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat]     = useState<Chat | null>(null);
  const [messages, setMessages]             = useState<Message[]>([]);
  const [orders, setOrders]                 = useState<Order[]>([]);
  const [filter, setFilter]                 = useState('all');
  const [search, setSearch]                 = useState('');
  const [inputText, setInputText]           = useState('');
  const [inputMode, setInputMode]           = useState<'reply' | 'note'>('reply');
  const [isClaimed, setIsClaimed]           = useState(false);
  const [claimLoading, setClaimLoading]     = useState(false);
  const [quickOpen, setQuickOpen]           = useState(false);
  const [loadingMsgs, setLoadingMsgs]       = useState(false);
  const [loadingChats, setLoadingChats]     = useState(false);
  const msgEndRef   = useRef<HTMLDivElement>(null);
  const taRef       = useRef<HTMLTextAreaElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval>>();
  const msgPollRef  = useRef<ReturnType<typeof setInterval>>();

  // Check for already-connected session on mount
  useEffect(() => {
    (async () => {
      const res = await waGet('/sessions');
      if (!res) return;
      const list: any[] = Array.isArray(res) ? res : (res?.data ?? []);
      const live = list.find((s: any) => normaliseState(s.state || s.status || '') === 'CONNECTED');
      if (live) { setConnected(true); setConnectedPhone(live.phone || ''); setTab('inbox'); }
    })();
  }, []);

  const fetchChats = useCallback(async () => {
    setLoadingChats(true);
    const data = await waGet(`/chats?filter=${filter}&limit=60`);
    if (data) {
      const raw: any[] = Array.isArray(data) ? data : (data.chats || data.data || []);
      setChats(raw.map((c: any) => ({
        id: c.id || c._id || c.identifier || String(Math.random()),
        identifier: c.identifier || c.id || '',
        platform: c.platform || 'c.us',
        contactName: c.contactName || c.name || c.identifier || 'Unknown',
        contactPhone: c.contactPhone || c.phone || c.identifier || '',
        lastMessage: c.lastMessage || '',
        lastMessageTime: c.lastMessageTime || c.updatedAt || new Date().toISOString(),
        unreadCount: c.unreadCount || 0,
        status: c.status || 'open',
        isGroup: !!c.isGroup,
        tags: c.tags || [],
        assignedTo: c.assignedTo,
      })));
    }
    setLoadingChats(false);
  }, [filter]);

  useEffect(() => {
    if (tab !== 'inbox') return;
    fetchChats();
    chatPollRef.current = setInterval(fetchChats, 8000);
    return () => clearInterval(chatPollRef.current);
  }, [tab, fetchChats]);

  const fetchMessages = useCallback(async (chat: Chat) => {
    setLoadingMsgs(true);
    const data = await waGet(`/messages?identifier=${encodeURIComponent(chat.identifier)}&platform=${chat.platform}&limit=50`);
    if (data) {
      const raw: any[] = Array.isArray(data) ? data : (data.messages || data.data || []);
      setMessages(raw.map((m: any) => ({
        id: m.id || m._id || String(Math.random()),
        content: m.content || m.body || m.text || '',
        contentType: m.contentType || 'text',
        timestamp: m.timestamp || m.createdAt || new Date().toISOString(),
        sender: m.sender || { type: m.fromMe ? 'bot' : 'customer', name: m.fromMe ? 'AI' : chat.contactName },
        isFromMe: !!m.isFromMe || !!m.fromMe,
      })));
    }
    setLoadingMsgs(false);
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const selectChat = async (chat: Chat) => {
    clearInterval(msgPollRef.current);
    setSelectedChat(chat); setIsClaimed(!!chat.assignedTo);
    setMessages([]); setOrders([]); setInputText('');
    await fetchMessages(chat);
    try {
      const ords = await api.get(`/api/orders?customerPhone=${encodeURIComponent(chat.contactPhone)}`);
      const list = Array.isArray(ords.data) ? ords.data : (ords.data?.data || []);
      setOrders(list.slice(0, 3));
    } catch { /* no orders is fine */ }
    msgPollRef.current = setInterval(() => fetchMessages(chat), 5000);
  };

  useEffect(() => () => clearInterval(msgPollRef.current), []);

  const handleTakeover = async () => {
    if (!selectedChat) return;
    setClaimLoading(true);
    const adminId = localStorage.getItem('novago_admin_id') || 'admin';
    if (isClaimed) {
      await waPost('/chats/release', { identifier: selectedChat.identifier, platform: selectedChat.platform });
      setIsClaimed(false);
      pushSys('Released back to AI — NovaGo AI has resumed');
    } else {
      const res = await waPost('/chats/claim', { identifier: selectedChat.identifier, platform: selectedChat.platform, agentId: adminId });
      if (res) { setIsClaimed(true); pushSys('You claimed this conversation — AI is paused'); }
    }
    setClaimLoading(false);
    fetchChats();
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !selectedChat) return;
    if (inputMode === 'note') {
      pushMsg({ id: `note-${Date.now()}`, content: text, contentType: 'note',
        timestamp: new Date().toISOString(), sender: { type: 'agent', name: 'Admin' }, isFromMe: true });
    } else {
      if (!isClaimed) await handleTakeover();
      await waPost('/messages/send', { identifier: selectedChat.identifier, platform: selectedChat.platform, content: text, contentType: 'text' });
      pushMsg({ id: `sent-${Date.now()}`, content: text, contentType: 'text',
        timestamp: new Date().toISOString(), sender: { type: 'agent', name: 'Admin' }, isFromMe: true });
    }
    setInputText('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setTimeout(() => msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const pushMsg = (m: Message) => setMessages(p => [...p, m]);
  const pushSys = (text: string) => pushMsg({
    id: `sys-${Date.now()}`, content: text, contentType: 'system',
    timestamp: new Date().toISOString(), sender: { type: 'bot', name: 'System' }, isFromMe: false,
  });

  const onConnected = (phone?: string) => {
    setConnected(true); setConnectedPhone(phone || ''); setTab('inbox');
  };

  const totalUnread = chats.reduce((s, c) => s + c.unreadCount, 0);
  const filteredChats = chats.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.contactName.toLowerCase().includes(q) && !c.contactPhone.includes(q)) return false;
    }
    const adminId = localStorage.getItem('novago_admin_id') || 'admin';
    if (filter === 'pending') return c.status === 'pending';
    if (filter === 'mine')    return c.assignedTo === adminId;
    if (filter === 'ai')      return !c.assignedTo;
    if (filter === 'groups')  return c.isGroup;
    return true;
  });

  return (
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <MessageSquare className="w-5 h-5 text-green-600" />
        <h1 className="text-lg font-bold text-gray-900">WhatsApp</h1>
        <div className="flex gap-1 ml-2">
          <button onClick={() => setTab('connect')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'connect' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            {connected ? <><CheckCircle2 className="w-3.5 h-3.5" />Connected</> : 'Connect WhatsApp'}
          </button>
          <button onClick={() => setTab('inbox')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === 'inbox' ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
            Inbox
            {totalUnread > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{totalUnread}</span>}
          </button>
        </div>
        {connected && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 font-semibold">AI Active</span>
            {connectedPhone && <span className="text-gray-400">{connectedPhone}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === 'connect' ? <QRConnectPanel onConnected={onConnected} /> : (
          <div className="flex h-full">

            {/* Chat list */}
            <div className="w-72 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search conversations…" className="flex-1 bg-transparent text-sm outline-none" />
                  {search && <button onClick={() => setSearch('')}><X className="w-3.5 h-3.5 text-gray-400" /></button>}
                </div>
              </div>
              <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 overflow-x-auto">
                {['all','pending','mine','ai','groups'].map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${filter === f ? 'bg-green-100 text-green-700 border border-green-200' : 'border border-gray-200 text-gray-500 hover:text-gray-700'}`}>
                    {f === 'ai' ? 'AI Active' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button onClick={fetchChats} className="ml-auto p-1 text-gray-400 hover:text-green-600 transition-colors">
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChats ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingChats && chats.length === 0 ? (
                  <div className="flex items-center justify-center h-20"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                ) : filteredChats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-gray-300 gap-2 px-4 text-center">
                    <MessageSquare className="w-8 h-8 opacity-40" />
                    <p className="text-xs">{connected ? 'No conversations yet' : 'Connect WhatsApp first'}</p>
                  </div>
                ) : filteredChats.map(chat => {
                  const c = clr(chat.contactName);
                  const isSelected = selectedChat?.identifier === chat.identifier;
                  const isAI = !chat.assignedTo;
                  return (
                    <button key={chat.id} onClick={() => selectChat(chat)}
                      className={`w-full flex items-start gap-2.5 p-3 text-left border-b border-gray-50 transition-colors ${isSelected ? 'bg-green-50 border-l-2 border-l-green-600' : 'hover:bg-gray-50'}`}>
                      <div className="relative flex-shrink-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: c.bg, color: c.fg }}>{ini(chat.contactName)}</div>
                        <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${isAI ? 'bg-purple-500' : 'bg-blue-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold text-gray-900 truncate">{chat.contactName}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{ago(chat.lastMessageTime)}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{chat.lastMessage}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${isAI ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {isAI ? <><Bot className="w-2.5 h-2.5"/>AI</> : <><User className="w-2.5 h-2.5"/>Agent</>}
                          </span>
                          {chat.unreadCount > 0 && (
                            <span className="ml-auto bg-green-600 text-white text-[10px] font-bold min-w-[17px] h-[17px] rounded-full flex items-center justify-center px-1">{chat.unreadCount}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thread */}
            <div className="flex-1 flex flex-col min-w-0">
              {!selectedChat ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-3">
                  <MessageSquare className="w-14 h-14 opacity-30" />
                  <p className="text-sm">Select a conversation</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: clr(selectedChat.contactName).bg, color: clr(selectedChat.contactName).fg }}>
                      {ini(selectedChat.contactName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{selectedChat.contactName}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        {isClaimed ? <><User className="w-3 h-3"/>Agent active</> : <><Bot className="w-3 h-3"/>AI handling</>}
                        <span className="mx-1">·</span>{selectedChat.contactPhone}
                      </p>
                    </div>
                    <button onClick={handleTakeover} disabled={claimLoading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${claimLoading ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400' : isClaimed ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                      {claimLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : isClaimed ? <><Bot className="w-3.5 h-3.5"/>Release to AI</> : <><UserCheck className="w-3.5 h-3.5"/>Claim</>}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50 flex flex-col gap-2">
                    {loadingMsgs ? (
                      <div className="flex justify-center items-center h-20"><Loader2 className="w-5 h-5 animate-spin text-gray-300"/></div>
                    ) : messages.length === 0 ? (
                      <div className="flex justify-center items-center h-20 text-gray-400 text-xs">No messages yet</div>
                    ) : messages.map(msg => {
                      if (msg.contentType === 'system') return (
                        <div key={msg.id} className="flex justify-center">
                          <span className="text-[11px] text-gray-500 bg-white border border-gray-200 rounded-full px-3 py-1">{msg.content}</span>
                        </div>
                      );
                      if (msg.contentType === 'note') return (
                        <div key={msg.id} className="flex justify-center">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800 flex items-center gap-2 max-w-xs">
                            <StickyNote className="w-3 h-3 flex-shrink-0"/>
                            <span><strong>Note:</strong> {msg.content}</span>
                          </div>
                        </div>
                      );
                      const isOut = msg.isFromMe;
                      const isAgent = msg.sender.type === 'agent';
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isOut ? 'flex-row-reverse' : ''} max-w-[78%] ${isOut ? 'self-end' : 'self-start'}`}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-1"
                            style={isOut ? { background: isAgent ? '#2563eb' : '#16a34a', color: '#fff' } : { background: clr(selectedChat.contactName).bg, color: clr(selectedChat.contactName).fg }}>
                            {isOut ? (isAgent ? 'A' : 'AI') : ini(selectedChat.contactName)}
                          </div>
                          <div>
                            {isOut && <p className={`text-[10px] font-semibold mb-1 text-right ${isAgent ? 'text-blue-600' : 'text-green-600'}`}>{isAgent ? msg.sender.name : 'NovaGo AI'}</p>}
                            <div className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${isOut ? (isAgent ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-green-700 text-white rounded-tr-sm') : 'bg-white text-gray-900 rounded-tl-sm border border-gray-200'}`}
                              style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            <p className={`text-[10px] text-gray-400 mt-1 ${isOut ? 'text-right' : ''}`}>{fmt(msg.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={msgEndRef}/>
                  </div>

                  {quickOpen && (
                    <div className="border-t border-gray-200 bg-white px-3 py-2 flex flex-col gap-1 max-h-36 overflow-y-auto">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500">Quick Replies</span>
                        <button onClick={() => setQuickOpen(false)}><X className="w-3.5 h-3.5 text-gray-400"/></button>
                      </div>
                      {QUICK_REPLIES.map(qr => (
                        <button key={qr.label}
                          onClick={() => { setInputText(qr.text); setInputMode('reply'); setQuickOpen(false); taRef.current?.focus(); }}
                          className="flex items-center gap-2 px-2.5 py-2 text-xs text-left rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 hover:text-green-700 transition-colors">
                          <span>{qr.emoji}</span><span className="font-semibold">{qr.label}</span>
                          <span className="text-gray-400 truncate">— {qr.text.slice(0,40)}…</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-gray-200 bg-white flex-shrink-0">
                    <div className="flex border-b border-gray-100">
                      {(['reply','note'] as const).map(m => (
                        <button key={m} onClick={() => setInputMode(m)}
                          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${inputMode === m ? (m === 'reply' ? 'text-green-700 border-green-600' : 'text-amber-600 border-amber-500') : 'text-gray-400 border-transparent hover:text-gray-600'}`}>
                          {m === 'reply' ? <><Send className="w-3.5 h-3.5"/>Reply</> : <><StickyNote className="w-3.5 h-3.5"/>Note</>}
                        </button>
                      ))}
                      <div className="ml-auto flex items-center gap-1.5 px-3 text-xs text-gray-400">
                        <span className={`w-1.5 h-1.5 rounded-full ${isClaimed ? 'bg-blue-500' : 'bg-green-500 animate-pulse'}`}/>
                        {isClaimed ? 'Agent active' : 'AI active'}
                      </div>
                    </div>
                    {inputMode === 'note' && <p className="text-xs text-amber-600 px-3 pt-2">Internal note — not sent to customer</p>}
                    <div className="flex items-end gap-2 p-3">
                      <button onClick={() => setQuickOpen(!quickOpen)} title="Quick replies" className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"><Zap className="w-4 h-4"/></button>
                      <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Attach"><Paperclip className="w-4 h-4"/></button>
                      <textarea ref={taRef} rows={1} value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 120) + 'px'; }}
                        placeholder={inputMode === 'note' ? 'Write an internal note…' : isClaimed ? 'Type your reply…' : 'Claim to reply manually, or AI handles automatically…'}
                        className={`flex-1 text-sm px-3 py-2 rounded-lg resize-none outline-none border transition-colors max-h-28 ${inputMode === 'note' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' : 'bg-gray-50 border-gray-200 focus:border-green-500 focus:bg-white'}`}/>
                      <button onClick={handleSend} disabled={!inputText.trim()}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${inputMode === 'note' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                        <Send className="w-4 h-4"/>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right panel */}
            {selectedChat && (
              <div className="w-56 border-l border-gray-200 bg-white flex flex-col overflow-y-auto flex-shrink-0">
                <div className="p-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Customer</p>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold mx-auto mb-2"
                    style={{ background: clr(selectedChat.contactName).bg, color: clr(selectedChat.contactName).fg }}>
                    {ini(selectedChat.contactName)}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 text-center">{selectedChat.contactName}</p>
                  <p className="text-xs text-gray-400 text-center">{selectedChat.contactPhone}</p>
                </div>
                <div className="p-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Session</p>
                  {[
                    { icon: Bot,   label: 'Mode',     val: isClaimed ? 'Agent Active' : 'AI Active', cls: isClaimed ? 'text-blue-600' : 'text-green-600' },
                    { icon: Clock, label: 'Last seen', val: ago(selectedChat.lastMessageTime) + ' ago', cls: '' },
                    { icon: Info,  label: 'Status',   val: selectedChat.status, cls: '' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50 last:border-0">
                      <span className="text-gray-400 flex items-center gap-1.5"><r.icon className="w-3 h-3"/>{r.label}</span>
                      <span className={`font-medium truncate max-w-24 ${r.cls || 'text-gray-700'}`}>{r.val}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Recent Orders</p>
                  {orders.length === 0
                    ? <p className="text-xs text-gray-400">No orders found</p>
                    : orders.map(o => (
                      <div key={o.id} className="bg-gray-50 rounded-lg p-2 mb-1.5 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-gray-700">{o.id}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o.status === 'delivered' ? 'bg-blue-100 text-blue-700' : o.status === 'preparing' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{o.status}</span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">KSh {(o.total || 0).toFixed(0)}</p>
                      </div>
                    ))}
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Replies</p>
                  {QUICK_REPLIES.map(qr => (
                    <button key={qr.label}
                      onClick={() => { setInputText(qr.text); setInputMode('reply'); taRef.current?.focus(); }}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-xs rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50 hover:text-green-700 transition-colors mb-1">
                      <span>{qr.emoji}</span><span className="font-medium">{qr.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
