import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Phone, Mic, Square, MicOff, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';

const RATE_PER_MINUTE = 4.0; // KES per minute

interface Prompt {
  _id: string;
  name: string;
}

interface TranscriptLine {
  role: 'user' | 'ai' | 'system';
  text: string;
}

export const TestCallPage: React.FC = () => {
  const { request } = useApi();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [, setCreditsUsed] = useState(0);
  const [, setLastChargedMinute] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const lastChargedRef = useRef(0);
  const callRecordIdRef = useRef<string | null>(null);
  const requestRef = useRef(request);
  requestRef.current = request;

  const loadPrompts = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/prompts' });
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load prompts');
    }
  }, [request]);

  const loadBalance = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/credits' });
      setCreditBalance(data.availableCredits);
    } catch (error) {
      console.error('Failed to load balance');
    }
  }, [request]);

  useEffect(() => {
    loadPrompts();
    loadBalance();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const addTranscript = (role: 'user' | 'ai' | 'system', text: string) => {
    setTranscript((prev) => [...prev, { role, text }]);
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (dcRef.current) dcRef.current.close();
    if (pcRef.current) pcRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    pcRef.current = null;
    dcRef.current = null;
    streamRef.current = null;
  };

  const chargeForMinute = async () => {
    try {
      const result = await requestRef.current({
        method: 'POST',
        url: '/credits/charge',
        data: {
          amount: RATE_PER_MINUTE,
          channel: 'voice_call',
          duration: 60,
          description: `Test voice call - minute ${lastChargedRef.current + 1}`,
        },
      });
      setCreditBalance(result.availableCredits);
      setCreditsUsed((prev) => prev + RATE_PER_MINUTE);
      lastChargedRef.current += 1;
      setLastChargedMinute(lastChargedRef.current);

      // Check if balance is too low for next minute
      if (result.availableCredits < RATE_PER_MINUTE) {
        addTranscript('system', `Low balance! KES ${result.availableCredits.toFixed(2)} remaining. Call will end soon.`);
      }
    } catch (error: any) {
      if (error?.response?.data?.error === 'Insufficient credits') {
        addTranscript('system', 'Insufficient credits. Call ending.');
        toast.error('Insufficient credits — call ended');
        handleEndCall();
      }
    }
  };

  const chargeFinalSeconds = async (totalSeconds: number) => {
    const chargedSeconds = lastChargedRef.current * 60;
    const remainingSeconds = totalSeconds - chargedSeconds;
    if (remainingSeconds <= 0) return;

    const amount = parseFloat(((remainingSeconds / 60) * RATE_PER_MINUTE).toFixed(2));
    if (amount <= 0) return;

    try {
      const result = await requestRef.current({
        method: 'POST',
        url: '/credits/charge',
        data: {
          amount,
          channel: 'voice_call',
          duration: remainingSeconds,
          description: `Test voice call - final ${remainingSeconds}s`,
        },
      });
      setCreditBalance(result.availableCredits);
      setCreditsUsed((prev) => prev + amount);
    } catch {
      // Best effort
    }
  };

  const handleStartCall = async () => {
    // Check balance first
    if (creditBalance !== null && creditBalance < RATE_PER_MINUTE) {
      toast.error(`Insufficient credits. You need at least KES ${RATE_PER_MINUTE} to start a call.`);
      return;
    }

    setIsConnecting(true);
    setTranscript([]);
    setCallDuration(0);
    setCreditsUsed(0);
    setLastChargedMinute(0);
    lastChargedRef.current = 0;
    durationRef.current = 0;
    addTranscript('system', 'Requesting microphone access...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      addTranscript('system', 'Microphone access granted. Connecting to AI...');

      const session = await request({
        method: 'POST',
        url: '/test-call/session',
        data: { promptId: selectedPrompt || undefined },
      });

      if (!session.clientSecret) {
        throw new Error('No client secret returned from server');
      }

      addTranscript('system', 'Session created. Establishing WebRTC connection...');

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioRef.current = audioEl;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          handleRealtimeEvent(event);
        } catch {
          // ignore
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.clientSecret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`WebRTC connection failed (${sdpResponse.status})`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      addTranscript('system', `Connected! Rate: KES ${RATE_PER_MINUTE}/min. Start speaking...`);
      setIsCalling(true);
      setIsConnecting(false);

      // Create call record in DB
      try {
        const callRecord = await request({
          method: 'POST',
          url: '/call-history',
          data: {
            phoneNumber: 'browser',
            promptId: selectedPrompt || undefined,
          },
        });
        callRecordIdRef.current = callRecord._id;
      } catch {
        // Non-blocking — call continues even if record fails
      }

      // Timer: tick every second, charge every 60 seconds
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setCallDuration(durationRef.current);

        // Charge at each full minute
        const currentMinute = Math.floor(durationRef.current / 60);
        if (currentMinute > lastChargedRef.current) {
          chargeForMinute();
        }
      }, 1000);

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          handleEndCall();
        }
      };
    } catch (error: any) {
      console.error('Call failed:', error);
      const msg = error?.response?.data?.error || error?.message || 'Failed to start call';
      addTranscript('system', `Error: ${msg}`);
      toast.error(msg);

      // Mark call record as failed
      if (callRecordIdRef.current) {
        try {
          await requestRef.current({
            method: 'PUT',
            url: `/call-history/${callRecordIdRef.current}`,
            data: { status: 'failed', duration: durationRef.current, cost: 0 },
          });
        } catch { /* non-blocking */ }
        callRecordIdRef.current = null;
      }

      cleanup();
      setIsCalling(false);
      setIsConnecting(false);
    }
  };

  const handleRealtimeEvent = (event: any) => {
    switch (event.type) {
      case 'response.audio_transcript.delta':
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'ai' && !last.text.endsWith('\n')) {
            return [...prev.slice(0, -1), { role: 'ai', text: last.text + (event.delta || '') }];
          }
          return [...prev, { role: 'ai', text: event.delta || '' }];
        });
        break;

      case 'response.audio_transcript.done':
        setTranscript((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'ai') {
            return [...prev.slice(0, -1), { role: 'ai', text: last.text + '\n' }];
          }
          return prev;
        });
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) {
          addTranscript('user', event.transcript.trim());
        }
        break;

      case 'error':
        addTranscript('system', `Error: ${event.error?.message || 'Unknown error'}`);
        break;
    }
  };

  const handleEndCall = async () => {
    const finalDuration = durationRef.current;
    const callId = callRecordIdRef.current;
    cleanup();
    setIsCalling(false);
    setIsConnecting(false);

    // Charge for remaining seconds
    await chargeFinalSeconds(finalDuration);

    const totalCost = parseFloat(((finalDuration / 60) * RATE_PER_MINUTE).toFixed(2));
    addTranscript('system', `Call ended. Duration: ${formatDuration(finalDuration)} | Total cost: KES ${totalCost.toFixed(2)}`);

    // Finalize call record in DB
    if (callId) {
      try {
        const transcriptText = transcript
          .filter((t) => t.role !== 'system')
          .map((t) => `${t.role === 'user' ? 'User' : 'AI'}: ${t.text}`)
          .join('\n');

        await requestRef.current({
          method: 'PUT',
          url: `/call-history/${callId}`,
          data: {
            duration: finalDuration,
            cost: totalCost,
            status: 'completed',
            transcript: transcriptText,
          },
        });
      } catch {
        // Non-blocking
      }
      callRecordIdRef.current = null;
    }

    // Refresh balance
    loadBalance();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentCost = parseFloat(((callDuration / 60) * RATE_PER_MINUTE).toFixed(2));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Test Voice Call</h1>
        <p className="text-gray-600 mt-2">Test your Voice AI prompt directly from your browser using WebRTC</p>
      </div>

      {/* Balance Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-xs font-medium">Available Balance</p>
              <p className="text-2xl font-bold text-green-600">
                KES {creditBalance !== null ? creditBalance.toFixed(2) : '...'}
              </p>
            </div>
            <Wallet className="w-8 h-8 text-green-200" />
          </div>
        </Card>
        <Card>
          <div>
            <p className="text-gray-600 text-xs font-medium">Rate</p>
            <p className="text-2xl font-bold text-blue-600">KES {RATE_PER_MINUTE.toFixed(2)}<span className="text-sm font-normal text-gray-500">/min</span></p>
          </div>
        </Card>
        {isCalling && (
          <Card className="border-2 border-red-200 bg-red-50">
            <div>
              <p className="text-gray-600 text-xs font-medium">This Call</p>
              <p className="text-2xl font-bold text-red-600">KES {currentCost.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{formatDuration(callDuration)} elapsed</p>
            </div>
          </Card>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4">Browser Test Call</h2>
        <p className="text-gray-600 mb-4">
          No phone number required — uses your OpenAI API key via a secure ephemeral token. Your API key never reaches the browser.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Prompt</label>
            <select
              value={selectedPrompt}
              onChange={(e) => setSelectedPrompt(e.target.value)}
              disabled={isCalling || isConnecting}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="">Default assistant</option>
              {prompts.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {!isCalling ? (
              <Button onClick={handleStartCall} disabled={isConnecting} className="w-full">
                {isConnecting ? (
                  <>Connecting...</>
                ) : (
                  <><Phone className="w-4 h-4 mr-2 inline" /> Start Call</>
                )}
              </Button>
            ) : (
              <Button onClick={handleEndCall} variant="danger" className="w-full">
                <Square className="w-4 h-4 mr-2 inline" />
                End Call
              </Button>
            )}
          </div>
        </div>

        {/* Call Status Bar */}
        <div className={`rounded-lg p-3 ${isCalling ? 'bg-red-50 border border-red-200' : isConnecting ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              {isCalling ? (
                <>
                  <Mic className="w-4 h-4 text-red-600 animate-pulse" />
                  <span className="text-red-800 font-medium">Call in progress</span>
                </>
              ) : isConnecting ? (
                <>
                  <Phone className="w-4 h-4 text-yellow-600 animate-bounce" />
                  <span className="text-yellow-800 font-medium">Connecting...</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4 text-blue-600" />
                  <span className="text-blue-800">Ready to call</span>
                </>
              )}
            </div>
            {isCalling && (
              <div className="flex items-center gap-4 text-sm">
                <span className="font-mono text-red-700">{formatDuration(callDuration)}</span>
                <span className="text-red-600 font-semibold">-KES {currentCost.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Live Transcript */}
      <Card>
        <h2 className="text-xl font-semibold mb-4">Live Transcript</h2>
        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm space-y-1 h-96 overflow-y-auto">
          {transcript.length > 0 ? (
            <>
              {transcript.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.role === 'user'
                      ? 'text-blue-400'
                      : line.role === 'ai'
                      ? 'text-green-400'
                      : 'text-yellow-400'
                  }
                >
                  <span className="font-bold">
                    {line.role === 'user' ? 'You: ' : line.role === 'ai' ? 'AI: ' : 'System: '}
                  </span>
                  {line.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </>
          ) : (
            <div className="text-gray-600">Transcript will appear here during the call...</div>
          )}
        </div>
      </Card>

      {/* How It Works */}
      <Card className="bg-gray-50 border-l-4 border-blue-600">
        <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
        <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
          <li>Select a prompt from your saved prompts (or use default)</li>
          <li>Click "Start Call" — your browser will request microphone permission</li>
          <li>A secure session is created using your OpenAI API key (key stays on the server)</li>
          <li>WebRTC connects your microphone directly to OpenAI Realtime</li>
          <li>Speak naturally — the AI responds in real-time with voice</li>
          <li>Credits deducted at KES {RATE_PER_MINUTE}/min — live cost shown during call</li>
          <li>Click "End Call" when finished — final charges applied for partial minutes</li>
        </ol>
      </Card>
    </div>
  );
};
