import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Copy, BookOpen, ArrowRight, ChevronDown, ChevronUp, CheckCircle, AlertTriangle, RefreshCw, Link2, Search, ShoppingCart } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface PhoneNumber {
  _id: string;
  phoneNumber: string;
  label: string;
  status: 'assigned' | 'pending' | 'unassigned';
  sipUri?: string;
  webhookUrl?: string;
  promptId?: { _id: string; name: string } | string;
  noiseFilter: boolean;
}

interface PromptOption {
  _id: string;
  name: string;
}

interface PhoneStatus {
  ready: boolean;
  checks: {
    hasPrompt: boolean;
    hasWebhookUrl: boolean;
    hasSipUri: boolean;
    publicBaseUrlConfigured: boolean;
  };
  webhookUrl: string;
  sipUri: string;
  twimlUrl: string;
  promptName: string | null;
}

interface AvailableTwilioNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string | null;
  region: string | null;
  isoCountry: string;
  capabilities: { voice: boolean; SMS: boolean; MMS: boolean };
}

const COUNTRY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: 'US', label: 'United States (+1)' },
  { code: 'GB', label: 'United Kingdom (+44)' },
  { code: 'CA', label: 'Canada (+1)' },
  { code: 'KE', label: 'Kenya (+254)' },
  { code: 'NG', label: 'Nigeria (+234)' },
  { code: 'ZA', label: 'South Africa (+27)' },
  { code: 'UG', label: 'Uganda (+256)' },
  { code: 'TZ', label: 'Tanzania (+255)' },
  { code: 'IN', label: 'India (+91)' },
  { code: 'AU', label: 'Australia (+61)' },
];

export const PhoneNumbersPage: React.FC = () => {
  const { request, loading } = useApi();
  const { user } = useAuthStore();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [statuses, setStatuses] = useState<Record<string, PhoneStatus>>({});
  const [showAssignFor, setShowAssignFor] = useState<string | null>(null);
  const [voiceHealthOk, setVoiceHealthOk] = useState<boolean | null>(null);
  const [twilioConfigured, setTwilioConfigured] = useState<boolean | null>(null);
  const [twilioSearch, setTwilioSearch] = useState({ country: 'US', areaCode: '', contains: '', type: 'local' });
  const [twilioResults, setTwilioResults] = useState<AvailableTwilioNumber[]>([]);
  const [twilioSearching, setTwilioSearching] = useState(false);
  const [twilioPurchasing, setTwilioPurchasing] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('twilio');
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);
  const [phoneRequests, setPhoneRequests] = useState<Array<{
    qty: number;
    areaCode: string;
    status: string;
    notes: string;
    assigned: string;
    date: string;
  }>>([]);
  const [requestData, setRequestData] = useState({
    quantity: '1',
    country: 'Kenya (+254)',
    areaCode: '',
    notes: '',
  });

  const loadPhoneNumbers = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/phone-numbers' });
      const list = Array.isArray(data) ? data : [];
      setPhoneNumbers(list);
      // Fetch live status for each number in parallel
      const entries = await Promise.all(
        list.map(async (p: PhoneNumber) => {
          try {
            const s = await request({ method: 'GET', url: `/phone-numbers/${p._id}/status` });
            return [p._id, s] as const;
          } catch {
            return [p._id, null] as const;
          }
        })
      );
      const map: Record<string, PhoneStatus> = {};
      for (const [id, s] of entries) if (s) map[id] = s;
      setStatuses(map);
    } catch (error) {
      console.error('Failed to load phone numbers');
    }
  }, [request]);

  const loadPrompts = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/prompts' });
      setPrompts(Array.isArray(data) ? data : []);
    } catch { /* prompts optional */ }
  }, [request]);

  const checkVoiceHealth = useCallback(async () => {
    try {
      // Use absolute URL because /api/v1/voice is unauthenticated and outside the api util's namespace
      const base = (process.env.REACT_APP_API_BASE || 'http://localhost:5001');
      const res = await fetch(`${base}/api/v1/voice/health`);
      setVoiceHealthOk(res.ok);
    } catch {
      setVoiceHealthOk(false);
    }
  }, []);

  const checkTwilioConfigured = useCallback(async () => {
    try {
      const r = await request({ method: 'GET', url: '/phone-numbers/twilio/status' });
      setTwilioConfigured(!!r?.configured);
    } catch {
      setTwilioConfigured(false);
    }
  }, [request]);

  useEffect(() => {
    loadPhoneNumbers();
    loadPrompts();
    checkVoiceHealth();
    checkTwilioConfigured();
  }, [loadPhoneNumbers, loadPrompts, checkVoiceHealth, checkTwilioConfigured]);

  const handleTwilioSearch = async () => {
    setTwilioSearching(true);
    setTwilioResults([]);
    try {
      const data = await request({
        method: 'POST',
        url: '/phone-numbers/twilio/search',
        data: twilioSearch,
      });
      setTwilioResults(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length === 0) toast('No matches — try a different country / area code.');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 412) {
        toast.error('Save your Twilio credentials in AI Credentials first.');
        setTwilioConfigured(false);
      } else {
        toast.error(err?.response?.data?.message || 'Twilio search failed');
      }
    } finally {
      setTwilioSearching(false);
    }
  };

  const handleTwilioPurchase = async (phoneNumber: string) => {
    if (!window.confirm(`Purchase ${phoneNumber} on Twilio? Your account will be billed.`)) return;
    setTwilioPurchasing(phoneNumber);
    try {
      await request({
        method: 'POST',
        url: '/phone-numbers/twilio/purchase',
        data: { phoneNumber, label: `Twilio ${phoneNumber}` },
      });
      toast.success('Number purchased and Voice URL configured automatically');
      setTwilioResults((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
      loadPhoneNumbers();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Purchase failed');
    } finally {
      setTwilioPurchasing(null);
    }
  };

  const handleTwilioSync = async (id: string) => {
    try {
      await request({ method: 'POST', url: `/phone-numbers/${id}/twilio-sync` });
      toast.success('Pushed Voice URL + Status Callback to Twilio');
      loadPhoneNumbers();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 412) toast.error('Save Twilio credentials first');
      else if (status === 404) toast.error('This number is not owned on the saved Twilio account');
      else toast.error(err?.response?.data?.message || 'Twilio sync failed');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleRequestPhoneNumber = async () => {
    try {
      const qty = parseInt(requestData.quantity) || 1;
      for (let i = 0; i < qty; i++) {
        await request({
          method: 'POST',
          url: '/phone-numbers',
          data: {
            phoneNumber: `+254${requestData.areaCode}`,
            label: requestData.notes || `Phone Number - ${new Date().toLocaleDateString()}`,
          },
        });
      }
      toast.success(`Phone number request${qty > 1 ? 's' : ''} submitted`);
      setPhoneRequests((prev) => [
        ...prev,
        {
          qty,
          areaCode: requestData.areaCode || '-',
          status: 'pending',
          notes: requestData.notes || '-',
          assigned: '-',
          date: new Date().toLocaleDateString('en-GB'),
        },
      ]);
      setRequestData({ quantity: '1', country: 'Kenya (+254)', areaCode: '', notes: '' });
      loadPhoneNumbers();
    } catch (error) {
      console.error('Failed to request phone number');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await request({
        method: 'POST',
        url: `/phone-numbers/assign/${id}`,
        data: { promptId: null },
      });
      toast.success('Phone number released');
      loadPhoneNumbers();
    } catch (error) {
      console.error('Failed to release phone number');
    }
  };

  const handleAssignPrompt = async (phoneId: string, promptId: string) => {
    try {
      await request({
        method: 'POST',
        url: `/phone-numbers/assign/${phoneId}`,
        data: { promptId },
      });
      toast.success('Prompt assigned — number is now live for incoming calls');
      setShowAssignFor(null);
      loadPhoneNumbers();
    } catch {
      toast.error('Failed to assign prompt');
    }
  };

  const handleRefreshConfig = async (id: string) => {
    try {
      await request({ method: 'POST', url: `/phone-numbers/${id}/refresh-config` });
      toast.success('Webhook + SIP regenerated from current settings');
      loadPhoneNumbers();
    } catch {
      toast.error('Failed to regenerate config');
    }
  };

  const handleToggleNoiseFilter = async (id: string, current: boolean) => {
    try {
      await request({
        method: 'POST',
        url: `/phone-numbers/assign/${id}`,
        data: { noiseFilter: !current },
      });
      loadPhoneNumbers();
    } catch (error) {
      console.error('Failed to toggle noise filter');
    }
  };

  const getPromptName = (phone: PhoneNumber) => {
    if (!phone.promptId) return 'None';
    if (typeof phone.promptId === 'object' && phone.promptId.name) return phone.promptId.name;
    return 'None';
  };

  const userId = user?.id || '1';
  const apiBase = (process.env.REACT_APP_API_BASE || 'http://localhost:5001');
  // Live values from the actual backend so the user copies the right URL
  const webhookSample =
    Object.values(statuses).find((s) => s.webhookUrl)?.webhookUrl ||
    `${apiBase}/api/v1/voice/webhook/user/${userId}`;
  const sipSample =
    Object.values(statuses).find((s) => s.sipUri)?.sipUri ||
    'sip:proj_<your-openai-project-id>@sip.api.openai.com;transport=tls';
  const usingLocalhost = webhookSample.includes('localhost');
  const noPublicBase = Object.values(statuses).some((s) => !s.checks.publicBaseUrlConfigured);

  const providers = [
    { id: 'twilio', name: 'Twilio', sub: 'SIP & Voice', color: 'text-red-500', label: 'twilio' },
    { id: 'infobip', name: 'Infobip', sub: 'Voice & SMS', color: 'text-gray-800', label: 'infobip' },
    { id: 'africastalking', name: "Africa's Talking", sub: 'Voice & USSD', color: 'text-orange-500', label: 'AT' },
    { id: '3cx', name: '3CX PBX', sub: 'SIP Trunk', color: 'text-green-600', label: '3CX' },
  ];

  const flowSteps = ['Caller', 'Twilio Number', 'Twilio SIP Trunk', 'OpenAI Realtime', 'Our Webhook', 'AI Responds with Your Prompt'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Phone Numbers</h1>
        <p className="text-gray-600 mt-2">Manage your dedicated voice AI phone lines</p>
      </div>

      {/* Pipeline health banner */}
      <Card className={`border-l-4 ${voiceHealthOk === false ? 'border-red-500' : (usingLocalhost || noPublicBase) ? 'border-yellow-500' : 'border-green-500'}`}>
        <div className="flex items-start gap-3">
          {voiceHealthOk === false ? (
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          ) : (usingLocalhost || noPublicBase) ? (
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="font-bold text-gray-900">
              {voiceHealthOk === false
                ? 'Voice webhook is NOT reachable'
                : (usingLocalhost || noPublicBase)
                ? 'Voice webhook is internal-only'
                : 'Voice pipeline ready for incoming calls'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {voiceHealthOk === false ? (
                <>The backend voice webhook (<code className="bg-gray-100 px-1 rounded">/api/v1/voice/health</code>) is not responding. Calls cannot be routed.</>
              ) : (usingLocalhost || noPublicBase) ? (
                <>Webhook URL points to <code className="bg-gray-100 px-1 rounded">localhost</code>, which OpenAI / Twilio cannot reach. Set the <code className="bg-gray-100 px-1 rounded">PUBLIC_BASE_URL</code> env var (e.g. an ngrok / cloudflared tunnel for dev, or your real domain in prod), then click <strong>Refresh config</strong> on each number.</>
              ) : (
                <>OpenAI / Twilio can reach this backend. Assign a prompt to a number and incoming calls will be answered by your AI agent.</>
              )}
            </p>
          </div>
          <button
            onClick={checkVoiceHealth}
            className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded text-xs text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Re-check
          </button>
        </div>
      </Card>

      {/* How It Works */}
      <Card>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">How It Works</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">Follow these 4 steps to connect your phone numbers to AI. Each step has copyable values.</p>

        {/* Flow Diagram */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-8 py-4 bg-gray-50 rounded-lg">
          {flowSteps.map((step, i) => (
            <React.Fragment key={step}>
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                i === 0 ? 'bg-teal-600 text-white' :
                i === flowSteps.length - 1 ? 'bg-gray-800 text-white' :
                i === 4 ? 'bg-yellow-500 text-white' :
                'bg-teal-500 text-white'
              }`}>
                {step}
              </span>
              {i < flowSteps.length - 1 && <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* 4 Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1 */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</span>
              <h3 className="font-bold text-gray-900">Save Your OpenAI Credentials</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">Go to the <strong>AI Credentials</strong> tab above and enter:</p>
            <ul className="space-y-1 text-sm text-gray-600">
              <li><strong>API Key</strong> — from <span className="text-teal-600">platform.openai.com/api-keys</span></li>
              <li><strong>Project ID</strong> — from <span className="text-teal-600">Settings {'>'} Projects</span> (looks like <code className="text-xs bg-gray-100 px-1 rounded">proj_abc123...</code>)</li>
              <li><strong>Signing Secret</strong> — from <span className="text-teal-600">Settings {'>'} Phone Numbers</span></li>
            </ul>
          </div>

          {/* Step 2 */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</span>
              <h3 className="font-bold text-gray-900">Configure Twilio SIP Trunk</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">In <span className="text-teal-600">Twilio Console {'>'} SIP Trunking</span>:</p>
            <ol className="space-y-1 text-sm text-gray-600 list-decimal list-inside mb-3">
              <li>Create or edit a <strong>Trunk</strong></li>
              <li>Under <strong>Origination</strong>, add this SIP URI:</li>
            </ol>
            <div className="bg-yellow-100 rounded-lg px-4 py-2 mb-2">
              <code className="text-xs text-gray-800 break-all">{sipSample}</code>
            </div>
            <button onClick={() => handleCopy(sipSample)} className="inline-flex items-center gap-1 px-3 py-1 border border-gray-300 rounded text-xs text-gray-600 hover:bg-gray-50">
              <Copy className="w-3 h-3" /> Copy SIP URI
            </button>
            <p className="text-xs text-gray-500 mt-2">Set Priority: <strong>10</strong>, Weight: <strong>10</strong></p>
          </div>

          {/* Step 3 */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</span>
              <h3 className="font-bold text-gray-900">Set OpenAI Incoming Call Webhook</h3>
            </div>
            <p className="text-sm text-gray-600 mb-2">In <span className="text-teal-600">OpenAI {'>'} Settings {'>'} Phone Numbers</span>:</p>
            <ol className="space-y-1 text-sm text-gray-600 list-decimal list-inside mb-3">
              <li>Add your phone numbers</li>
              <li>Set the <strong>Incoming Call Webhook URL</strong> to:</li>
            </ol>
            <div className="bg-yellow-100 rounded-lg px-4 py-2 mb-2">
              <code className="text-xs text-gray-800 break-all">{webhookSample}</code>
            </div>
            <button onClick={() => handleCopy(webhookSample)} className="inline-flex items-center gap-1 px-3 py-1 border border-teal-500 text-teal-600 rounded text-xs hover:bg-teal-50">
              <Copy className="w-3 h-3" /> Copy Webhook URL
            </button>
            <p className="text-xs text-gray-500 mt-2">This single URL handles all your numbers. Our platform routes each call to the correct prompt.</p>
          </div>

          {/* Step 4 */}
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</span>
              <h3 className="font-bold text-gray-900">Create a Prompt & Assign</h3>
            </div>
            <ol className="space-y-1 text-sm text-gray-600 list-decimal list-inside mb-3">
              <li>Go to the <strong>Prompt Studio</strong> tab</li>
              <li>Click <strong>+ New Prompt</strong> and write your AI agent instructions</li>
              <li>Click <strong>Assign to Phone</strong> and select your number</li>
              <li>Call your number — the AI agent responds using your prompt!</li>
            </ol>
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 mt-3">
              <p className="text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                Each number can have a different prompt for different use cases
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Available Phone Numbers */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available Phone Numbers</h2>
        <p className="text-center py-8 text-gray-400">No phone numbers currently available.</p>
      </Card>

      {/* Your Phone Numbers Table */}
      {phoneNumbers.length > 0 && (
        <Card>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Your Phone Numbers</h2>
          <p className="text-sm text-gray-500 mb-6">
            Phone numbers assigned to you for Voice AI. Each number has a SIP URI and webhook URL for OpenAI Realtime + Twilio integration.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-teal-400">
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Label</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Configuration</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Prompt</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Noise Filter</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {phoneNumbers.map((phone) => (
                  <tr key={phone._id} className="border-b border-dashed border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-4 font-mono text-sm font-medium text-gray-900">
                      +{phone.phoneNumber.replace(/^\+/, '')}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {phone.label}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                        phone.status === 'assigned' ? 'bg-green-100 text-green-700' :
                        phone.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {phone.status}
                      </span>
                      {statuses[phone._id]?.ready && (
                        <span className="block mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-green-700">
                          <CheckCircle className="w-3 h-3" /> READY FOR CALLS
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-5">
                      {phone.sipUri ? (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">SIP URI (Twilio Origination):</p>
                            <div className="flex items-center gap-1">
                              <code className="text-xs text-teal-700 break-all">{phone.sipUri}</code>
                              <button onClick={() => handleCopy(phone.sipUri!)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {phone.webhookUrl && (
                            <div>
                              <p className="text-xs text-gray-500 mb-0.5">Webhook URL (OpenAI Incoming Call):</p>
                              <div className="flex items-center gap-1">
                                <code className="text-xs text-teal-700 break-all">{phone.webhookUrl}</code>
                                <button onClick={() => handleCopy(phone.webhookUrl!)} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Pending assignment</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">
                      {getPromptName(phone)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleNoiseFilter(phone._id, phone.noiseFilter)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              phone.noiseFilter ? 'bg-green-500' : 'bg-gray-300'
                            }`}
                          >
                            <span
                              className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform"
                              style={{ transform: phone.noiseFilter ? 'translateX(18px)' : 'translateX(2px)' }}
                            />
                          </button>
                          <span className="text-xs text-gray-500">{phone.noiseFilter ? 'On' : 'Off'}</span>
                        </div>
                        <span className="text-[10px] text-gray-400">Extra charge/min</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1.5">
                        {phone.promptId ? (
                          <button
                            onClick={() => handleRelease(phone._id)}
                            className="px-3 py-1 border border-red-400 text-red-500 rounded text-xs hover:bg-red-50 font-medium"
                          >
                            Release
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowAssignFor(phone._id)}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1 border border-teal-500 text-teal-600 rounded text-xs hover:bg-teal-50 font-medium"
                          >
                            <Link2 className="w-3 h-3" /> Assign Prompt
                          </button>
                        )}
                        <button
                          onClick={() => handleRefreshConfig(phone._id)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs hover:bg-gray-50 font-medium"
                          title="Regenerate SIP URI + webhook URL from current PUBLIC_BASE_URL and OpenAI project ID"
                        >
                          <RefreshCw className="w-3 h-3" /> Refresh config
                        </button>
                        {twilioConfigured && (
                          <button
                            onClick={() => handleTwilioSync(phone._id)}
                            className="inline-flex items-center justify-center gap-1 px-3 py-1 border border-teal-300 text-teal-700 rounded text-xs hover:bg-teal-50 font-medium"
                            title="Push the current Voice URL + Status Callback to Twilio for this number"
                          >
                            <RefreshCw className="w-3 h-3" /> Sync to Twilio
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Twilio: Search & Purchase */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-teal-600" /> Search & Purchase via Twilio
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Find available numbers in Twilio's inventory and purchase them. The Voice URL and Status Callback are
              configured automatically to point at this backend.
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            twilioConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {twilioConfigured === null ? '…' : twilioConfigured ? 'Twilio Connected' : 'Twilio Not Configured'}
          </span>
        </div>

        {!twilioConfigured ? (
          <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4 text-sm text-yellow-800">
            Save your Twilio Account SID + Auth Token in <strong>AI Credentials</strong> first. Then refresh this page.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Country</label>
                <select
                  value={twilioSearch.country}
                  onChange={(e) => setTwilioSearch({ ...twilioSearch, country: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
                <select
                  value={twilioSearch.type}
                  onChange={(e) => setTwilioSearch({ ...twilioSearch, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="local">Local</option>
                  <option value="mobile">Mobile</option>
                  <option value="tollFree">Toll-Free</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Area Code (optional)</label>
                <input
                  type="text"
                  value={twilioSearch.areaCode}
                  onChange={(e) => setTwilioSearch({ ...twilioSearch, areaCode: e.target.value })}
                  placeholder="e.g. 415"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Contains digits (optional)</label>
                <input
                  type="text"
                  value={twilioSearch.contains}
                  onChange={(e) => setTwilioSearch({ ...twilioSearch, contains: e.target.value })}
                  placeholder="e.g. 1234"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <button
              onClick={handleTwilioSearch}
              disabled={twilioSearching}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-60 mb-4"
            >
              <Search className="w-4 h-4" /> {twilioSearching ? 'Searching…' : 'Search Twilio inventory'}
            </button>

            {twilioResults.length > 0 && (
              <div className="overflow-x-auto border border-gray-100 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50">
                    <tr>
                      <th className="py-2 px-3">Number</th>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Capabilities</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {twilioResults.map((n) => (
                      <tr key={n.phoneNumber} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-gray-900">{n.phoneNumber}</td>
                        <td className="py-2 px-3 text-gray-600">
                          {n.locality || '—'}{n.region ? `, ${n.region}` : ''} · {n.isoCountry}
                        </td>
                        <td className="py-2 px-3 text-xs text-gray-500">
                          {n.capabilities.voice && <span className="mr-1 px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded">Voice</span>}
                          {n.capabilities.SMS && <span className="mr-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">SMS</span>}
                          {n.capabilities.MMS && <span className="mr-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">MMS</span>}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleTwilioPurchase(n.phoneNumber)}
                            disabled={twilioPurchasing === n.phoneNumber}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-teal-600 text-white rounded text-xs font-semibold hover:bg-teal-700 disabled:opacity-60"
                          >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            {twilioPurchasing === n.phoneNumber ? 'Purchasing…' : 'Purchase'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Request or Add Phone Number */}
      <Card>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Request or Add Phone Number</h2>

        {/* Provider Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {providers.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProvider(p.id)}
              className={`p-4 rounded-xl border-2 text-center transition-all ${
                selectedProvider === p.id ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className={`text-lg font-bold ${p.color}`}>{p.label}</p>
              <p className="font-semibold text-gray-900 text-sm mt-1">{p.name}</p>
              <p className="text-xs text-gray-500">{p.sub}</p>
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500 mb-6">
          Request one or more phone numbers. An admin will review and approve. Each number costs $25 USD (deducted from your USD wallet).
        </p>

        {/* Request Form */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
            <select
              value={requestData.quantity}
              onChange={(e) => setRequestData({ ...requestData, quantity: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
            >
              <option value="1">1 number</option>
              <option value="2">2 numbers</option>
              <option value="3">3 numbers</option>
              <option value="5">5 numbers</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Country</label>
            <select
              value={requestData.country}
              onChange={(e) => setRequestData({ ...requestData, country: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
            >
              <option>Kenya (+254)</option>
              <option>Uganda (+256)</option>
              <option>Tanzania (+255)</option>
              <option>Nigeria (+234)</option>
              <option>South Africa (+27)</option>
              <option>United States (+1)</option>
              <option>United Kingdom (+44)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Area Code (optional)</label>
            <input
              type="text"
              value={requestData.areaCode}
              onChange={(e) => setRequestData({ ...requestData, areaCode: e.target.value })}
              placeholder="e.g. 0205"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex items-end gap-4 mb-6">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <input
              type="text"
              value={requestData.notes}
              onChange={(e) => setRequestData({ ...requestData, notes: e.target.value })}
              placeholder="e.g. For customer support"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleRequestPhoneNumber}
            disabled={loading}
            className="px-10 py-2.5 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50"
          >
            {loading ? 'Requesting...' : 'Request'}
          </button>
        </div>

        {/* Your Requests */}
        <div>
          <h3 className="font-bold text-gray-900 mb-3">Your Requests</h3>
          {phoneRequests.length === 0 ? (
            <p className="text-sm text-gray-400">No requests yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-teal-400">
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Qty</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Area Code</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Notes</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Assigned</th>
                    <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {phoneRequests.map((req, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{req.qty}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{req.areaCode}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          req.status === 'pending' ? 'bg-teal-500 text-white' :
                          req.status === 'approved' ? 'bg-green-100 text-green-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{req.notes}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{req.assigned}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{req.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Assign Prompt Modal */}
      {showAssignFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Assign a Prompt</h2>
              <button
                onClick={() => setShowAssignFor(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            {prompts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-2">No prompts available.</p>
                <p className="text-sm text-gray-400">Create one in <strong>Prompts</strong> first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {prompts.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => handleAssignPrompt(showAssignFor, p._id)}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-teal-50 hover:border-teal-300 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{p.name}</p>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowAssignFor(null)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Webhook Setup Instructions - Collapsible */}
      <Card>
        <button
          onClick={() => setShowWebhookHelp(!showWebhookHelp)}
          className="w-full flex items-center justify-between"
        >
          <h2 className="text-lg font-semibold text-teal-700">Webhook Setup Instructions</h2>
          {showWebhookHelp ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
        </button>
        {showWebhookHelp && (
          <ol className="mt-4 space-y-2 text-sm text-gray-600 list-decimal list-inside">
            <li>Copy the webhook URL shown for your phone number</li>
            <li>Go to <strong>platform.openai.com</strong> {'>'} Settings {'>'} Realtime {'>'} Webhooks</li>
            <li>Paste the webhook URL</li>
            <li>Your incoming calls will now be handled by your AI assistant</li>
          </ol>
        )}
      </Card>
    </div>
  );
};
