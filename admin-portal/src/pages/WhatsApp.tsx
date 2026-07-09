import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, CheckCircle2, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import api from '../services/api';

type Phase = 'idle' | 'loading' | 'qr' | 'connected' | 'error';

const SESSION = 'novago-main';

export default function WhatsApp() {
  const [phase, setPhase]       = useState<Phase>('idle');
  const [qrUrl, setQrUrl]       = useState<string | null>(null);
  const [phone, setPhone]       = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef    = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const stopPoll = () => {
    if (pollRef.current)    { clearInterval(pollRef.current);  pollRef.current    = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  };

  const poll = async () => {
    try {
      const { data } = await api.get<{ status: string; phone?: string }>(
        `/whatsapp/sessions/${SESSION}/status`
      );
      const s = (data.status || '').toLowerCase();

      if (s === 'connected') {
        setPhone(data.phone || '');
        setQrUrl(null);
        setPhase('connected');
        stopPoll();
        return;
      }

      if (s === 'scan_qr_code') {
        setPhase('qr');
        const qr = await api.get<{ qrDataUrl: string | null }>(
          `/whatsapp/sessions/${SESSION}/qr`
        );
        if (qr.data.qrDataUrl) setQrUrl(qr.data.qrDataUrl);
      }
      // else still 'initializing' — keep phase 'loading', keep polling
    } catch { /* retry next tick */ }
  };

  const startPoll = () => {
    stopPoll();
    pollRef.current    = window.setInterval(poll, 3000);
    // Give up after 40 s and show an actionable error
    timeoutRef.current = window.setTimeout(() => {
      stopPoll();
      setPhase('error');
    }, 40_000);
  };

  // Check for an existing live session on mount
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ status: string; phone?: string }>(
          `/whatsapp/sessions/${SESSION}/status`
        );
        const s = (data.status || '').toLowerCase();
        if (s === 'connected') {
          setPhone(data.phone || '');
          setPhase('connected');
        } else if (s === 'scan_qr_code' || s === 'initializing') {
          setPhase(s === 'scan_qr_code' ? 'qr' : 'loading');
          startPoll();
        }
      } catch { /* no session yet */ }
    })();
    return stopPoll;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setStarting(true);
    setQrUrl(null);
    setPhase('loading');
    try {
      // Kill any stale session so Baileys starts fresh and generates a new QR
      await api.post(`/whatsapp/sessions/${SESSION}/disconnect`).catch(() => {});
      await new Promise<void>((r) => setTimeout(r, 600));
      await api.post('/whatsapp/sessions', { name: SESSION });
      startPoll();
    } catch {
      setPhase('idle');
    } finally {
      setStarting(false);
    }
  };

  const handleDisconnect = async () => {
    stopPoll();
    await api.post(`/whatsapp/sessions/${SESSION}/disconnect`).catch(() => {});
    setPhase('idle');
    setQrUrl(null);
    setPhone('');
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-full max-w-sm text-center">

        {/* ── IDLE ── */}
        {phase === 'idle' && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Connect WhatsApp</h1>
            <p className="text-gray-500 text-sm mb-8">
              Link your WhatsApp Business number. The AI will handle customer orders automatically.
            </p>
            <button
              onClick={handleConnect}
              disabled={starting}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {starting ? 'Starting…' : 'Connect WhatsApp'}
            </button>
          </>
        )}

        {/* ── LOADING (session starting, QR not yet ready) ── */}
        {phase === 'loading' && (
          <>
            <Loader2 className="w-14 h-14 animate-spin text-green-500 mx-auto mb-5" />
            <h2 className="text-xl font-semibold text-gray-800 mb-1">Generating QR code…</h2>
            <p className="text-gray-400 text-sm">This usually takes 5 – 10 seconds</p>
            <div className="mt-4 flex gap-1 justify-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </>
        )}

        {/* ── QR READY ── */}
        {phase === 'qr' && (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Scan with WhatsApp</h2>
            <p className="text-gray-500 text-sm mb-5">
              WhatsApp → Settings → Linked Devices → Link a Device
            </p>

            <div className="bg-white border-2 border-gray-200 rounded-2xl p-4 shadow-sm inline-block mx-auto">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt="WhatsApp QR code"
                  className="w-60 h-60 rounded-lg"
                />
              ) : (
                <div className="w-60 h-60 bg-gray-50 rounded-lg flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-green-400" />
                  <p className="text-xs text-gray-400">Loading QR…</p>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-center gap-4">
              <button
                onClick={() =>
                  api
                    .get<{ qrDataUrl: string | null }>(`/whatsapp/sessions/${SESSION}/qr`)
                    .then(({ data }) => { if (data.qrDataUrl) setQrUrl(data.qrDataUrl); })
                    .catch(() => {})
                }
                className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh QR
              </button>
              <button
                onClick={handleConnect}
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600"
              >
                Restart
              </button>
            </div>
          </>
        )}

        {/* ── ERROR (QR timed out) ── */}
        {phase === 'error' && (
          <>
            <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">QR code not generated</h2>
            <p className="text-gray-500 text-sm mb-2">
              The WhatsApp engine is taking too long to respond.
            </p>
            <p className="text-gray-400 text-xs mb-8">
              Check the <strong>dependable-surprise</strong> service logs on Railway for connection errors,
              then try again.
            </p>
            <button
              onClick={handleConnect}
              disabled={starting}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {starting ? 'Starting…' : 'Try Again'}
            </button>
          </>
        )}

        {/* ── CONNECTED ── */}
        {phase === 'connected' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-1">WhatsApp Connected!</h2>
            {phone && <p className="text-gray-500 mb-1">+{phone}</p>}
            <p className="text-sm text-gray-400 mb-8">AI is now active and handling customer orders</p>

            <div className="grid grid-cols-3 gap-3 mb-8 text-left">
              {[
                { emoji: '🤖', title: 'AI Ordering',  desc: 'Reads live menus & prices' },
                { emoji: '💬', title: 'Live Inbox',   desc: 'Admin chat takeover' },
                { emoji: '📦', title: 'Real Orders',  desc: 'Synced to dashboard' },
              ].map((f) => (
                <div key={f.title} className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg mb-1">{f.emoji}</p>
                  <p className="text-xs font-semibold text-green-800">{f.title}</p>
                  <p className="text-[11px] text-green-600 mt-0.5 leading-tight">{f.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleDisconnect}
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <WifiOff className="w-4 h-4" /> Disconnect
            </button>
          </>
        )}

      </div>
    </div>
  );
}
