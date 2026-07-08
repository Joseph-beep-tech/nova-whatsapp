/**
 * AIConfig.tsx
 * Configure the AI persona, voice settings, WhatsApp bot, ordering rules,
 * RAG settings and M-Pesa integration for a restaurant.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { aiConfigService } from '../services/restaurantAI.service';
import { restaurantService } from '../services/restaurant.service';
import {
  ArrowLeft, Save, Mic, MessageSquare, CreditCard,
  Settings, CheckCircle2, RefreshCw,
  Info, Zap, ChevronDown, ChevronUp, Plus, Trash2, TrendingUp,
} from 'lucide-react';

interface UpsellRule { triggerItem: string; suggestItem: string; message?: string }

interface AIConfigForm {
  voiceEnabled?: boolean;
  voicePersona?: string;
  voiceLanguages?: string[];
  voiceGreeting?: string;
  voiceFallbackMessage?: string;
  waEnabled?: boolean;
  waPersona?: string;
  waGreeting?: string;
  waOrderConfirmationMsg?: string;
  waDeliveryUpdateMsg?: string;
  autoConfirmOrders?: boolean;
  maxOrdersPerHour?: number;
  orderClosingTime?: string;
  upsellRules?: UpsellRule[];
  ragEnabled?: boolean;
  ragTopK?: number;
  ragScoreThreshold?: number;
  mpesaEnabled?: boolean;
  mpesaPaybill?: string;
  mpesaTillNumber?: string;
}

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'French' },
  { code: 'ar', label: 'Arabic' },
];

interface Section { id: string; label: string; icon: React.ElementType; }
const SECTIONS: Section[] = [
  { id: 'voice',    label: 'Voice AI',        icon: Mic },
  { id: 'wa',       label: 'WhatsApp Bot',    icon: MessageSquare },
  { id: 'ordering', label: 'Ordering Rules',  icon: Settings },
  { id: 'upsell',   label: 'Upsell Engine',   icon: TrendingUp },
  { id: 'rag',      label: 'RAG Settings',    icon: Zap },
  { id: 'mpesa',    label: 'M-Pesa',          icon: CreditCard },
];

export default function AIConfig() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [openSection, setOpenSection] = useState<string>('voice');

  const { data: restaurant } = useQuery(['restaurant', restaurantId], () => restaurantService.getById(restaurantId!), { enabled: !!restaurantId });

  const { data: config, isLoading } = useQuery(
    ['aiConfig', restaurantId],
    () => aiConfigService.get(restaurantId!),
    { enabled: !!restaurantId }
  );

  const [form, setForm] = useState<AIConfigForm>({});
  useEffect(() => { if (config) setForm(config as AIConfigForm); }, [config]);

  const updateMutation = useMutation(
    (data: AIConfigForm) => aiConfigService.update(restaurantId!, data),
    {
      onSuccess: () => {
        qc.invalidateQueries(['aiConfig', restaurantId]);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      },
    }
  );

  const set = (key: string, value: unknown) => setForm((f) => ({ ...f, [key]: value }));

  const toggleLang = (code: string) => {
    const langs: string[] = form.voiceLanguages || [];
    set('voiceLanguages', langs.includes(code) ? langs.filter((l) => l !== code) : [...langs, code]);
  };

  if (isLoading) return <div className="p-6 text-center text-gray-400">Loading AI configuration...</div>;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/restaurants/${restaurantId}/details`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{restaurant?.name} — AI Configuration</h1>
          <p className="text-sm text-gray-500">Configure how the AI behaves on WhatsApp and voice calls</p>
        </div>
        <button
          onClick={() => updateMutation.mutate(form)}
          disabled={updateMutation.isLoading}
          className="btn-primary flex items-center gap-2"
        >
          {updateMutation.isLoading ? <RefreshCw size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      {/* Sections */}
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isOpen = openSection === section.id;
        return (
          <div key={section.id} className="card overflow-hidden p-0">
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              onClick={() => setOpenSection(isOpen ? '' : section.id)}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-50 rounded-lg text-primary-600"><Icon size={18} /></div>
                <span className="font-semibold text-gray-900">{section.label}</span>
                {section.id === 'voice' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.voiceEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {form.voiceEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                )}
                {section.id === 'wa' && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.waEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {form.waEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                )}
              </div>
              {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {isOpen && (
              <div className="px-5 pb-5 border-t space-y-4 pt-4">
                {/* ── VOICE ── */}
                {section.id === 'voice' && (
                  <>
                    <Toggle label="Enable Voice AI" value={form.voiceEnabled} onChange={(v) => set('voiceEnabled', v)} />
                    {form.voiceEnabled && (
                      <>
                        <Field label="AI Persona (Voice)" hint="How the AI introduces itself on calls">
                          <input className="input-field" value={form.voicePersona || ''} onChange={(e) => set('voicePersona', e.target.value)}
                            placeholder="e.g. Amina, friendly receptionist at Java House Nairobi" />
                        </Field>
                        <Field label="Languages">
                          <div className="flex gap-2 flex-wrap">
                            {LANGUAGES.map((l) => (
                              <button
                                key={l.code}
                                onClick={() => toggleLang(l.code)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-colors ${
                                  (form.voiceLanguages || []).includes(l.code)
                                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                {l.label}
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label="Greeting Message" hint="First thing the AI says when a call is answered">
                          <textarea rows={2} className="input-field" value={form.voiceGreeting || ''} onChange={(e) => set('voiceGreeting', e.target.value)} />
                        </Field>
                        <Field label="Fallback / Escalation Message" hint="Said when the AI can't help and needs to transfer">
                          <textarea rows={2} className="input-field" value={form.voiceFallbackMessage || ''} onChange={(e) => set('voiceFallbackMessage', e.target.value)} />
                        </Field>
                      </>
                    )}
                  </>
                )}

                {/* ── WHATSAPP ── */}
                {section.id === 'wa' && (
                  <>
                    <Toggle label="Enable WhatsApp Bot" value={form.waEnabled} onChange={(v) => set('waEnabled', v)} />
                    {form.waEnabled && (
                      <>
                        <Field label="AI Persona (WhatsApp)">
                          <input className="input-field" value={form.waPersona || ''} onChange={(e) => set('waPersona', e.target.value)}
                            placeholder="e.g. Nova, your helpful dining assistant at Chicken Inn" />
                        </Field>
                        <Field label="Greeting Message" hint="Sent when a new customer messages">
                          <textarea rows={2} className="input-field" value={form.waGreeting || ''} onChange={(e) => set('waGreeting', e.target.value)} />
                        </Field>
                        <Field label="Order Confirmation Message" hint="Use {orderId} and {eta} as placeholders">
                          <textarea rows={2} className="input-field" value={form.waOrderConfirmationMsg || ''} onChange={(e) => set('waOrderConfirmationMsg', e.target.value)} />
                        </Field>
                        <Field label="Delivery Update Message" hint="Use {orderId}, {status}, {message}">
                          <textarea rows={2} className="input-field" value={form.waDeliveryUpdateMsg || ''} onChange={(e) => set('waDeliveryUpdateMsg', e.target.value)} />
                        </Field>
                      </>
                    )}
                  </>
                )}

                {/* ── ORDERING ── */}
                {section.id === 'ordering' && (
                  <>
                    <Toggle label="Auto-confirm Orders" value={form.autoConfirmOrders}
                      onChange={(v) => set('autoConfirmOrders', v)}
                      hint="Orders placed via WhatsApp or voice will be auto-confirmed without manual review" />
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Max Orders / Hour" hint="0 = unlimited">
                        <input type="number" min={0} className="input-field" value={form.maxOrdersPerHour || 0}
                          onChange={(e) => set('maxOrdersPerHour', Number(e.target.value))} />
                      </Field>
                      <Field label="Order Cut-off Time" hint="Orders rejected after this time (24h format)">
                        <input type="time" className="input-field" value={form.orderClosingTime || ''}
                          onChange={(e) => set('orderClosingTime', e.target.value)} />
                      </Field>
                    </div>
                  </>
                )}

                {/* ── UPSELL ── */}
                {section.id === 'upsell' && (
                  <>
                    <p className="text-xs text-gray-500">
                      When a customer adds a trigger item to their cart, the AI will naturally suggest the paired item. Keep it to 3–5 rules max for best results.
                    </p>
                    <div className="space-y-2">
                      {((form.upsellRules || []) as Array<{ triggerItem: string; suggestItem: string; message?: string }>).map((rule, i) => (
                        <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                              className="input-field text-sm"
                              placeholder="Trigger item (e.g. Burger)"
                              value={rule.triggerItem}
                              onChange={(e) => {
                                const rules = [...(form.upsellRules || [])];
                                rules[i] = { ...rules[i], triggerItem: e.target.value };
                                set('upsellRules', rules);
                              }}
                            />
                            <input
                              className="input-field text-sm"
                              placeholder="Suggest (e.g. Hand-cut Fries)"
                              value={rule.suggestItem}
                              onChange={(e) => {
                                const rules = [...(form.upsellRules || [])];
                                rules[i] = { ...rules[i], suggestItem: e.target.value };
                                set('upsellRules', rules);
                              }}
                            />
                          </div>
                          <button
                            onClick={() => {
                              const rules = [...(form.upsellRules || [])];
                              rules.splice(i, 1);
                              set('upsellRules', rules);
                            }}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => set('upsellRules', [...(form.upsellRules || []), { triggerItem: '', suggestItem: '', message: '' }])}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      <Plus size={15} /> Add Upsell Rule
                    </button>
                    <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700 flex gap-2">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      The AI applies these rules naturally in conversation — it will never aggressively push items. Rules are suggestions, not scripts.
                    </div>
                  </>
                )}

                {/* ── RAG ── */}
                {section.id === 'rag' && (
                  <>
                    <Toggle label="Enable RAG (Knowledge Retrieval)" value={form.ragEnabled} onChange={(v) => set('ragEnabled', v)}
                      hint="The AI searches your knowledge base to answer customer questions accurately" />
                    {form.ragEnabled && (
                      <>
                        <Field label="Top-K Chunks" hint="How many knowledge snippets to retrieve per query (3–10 recommended)">
                          <input type="range" min={1} max={15} className="w-full accent-primary-500" value={form.ragTopK || 5}
                            onChange={(e) => set('ragTopK', Number(e.target.value))} />
                          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1 (fast)</span><span className="font-bold text-primary-600">{form.ragTopK || 5}</span><span>15 (thorough)</span></div>
                        </Field>
                        <Field label="Score Threshold" hint="Minimum similarity score to use a chunk (0.65–0.85 recommended)">
                          <input type="range" min={0.5} max={0.95} step={0.01} className="w-full accent-primary-500" value={form.ragScoreThreshold || 0.72}
                            onChange={(e) => set('ragScoreThreshold', parseFloat(e.target.value))} />
                          <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0.5 (loose)</span><span className="font-bold text-primary-600">{(form.ragScoreThreshold || 0.72).toFixed(2)}</span><span>0.95 (strict)</span></div>
                        </Field>
                        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex gap-2">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          Lower threshold = AI answers more questions but may hallucinate. Higher = more accurate but may say "I don't know" more often.
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ── MPESA ── */}
                {section.id === 'mpesa' && (
                  <>
                    <Toggle label="Enable M-Pesa Payments" value={form.mpesaEnabled} onChange={(v) => set('mpesaEnabled', v)}
                      hint="Customers can pay for orders via M-Pesa STK Push through WhatsApp or voice" />
                    {form.mpesaEnabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Paybill Number">
                          <input className="input-field" value={form.mpesaPaybill || ''} onChange={(e) => set('mpesaPaybill', e.target.value)}
                            placeholder="e.g. 247247" />
                        </Field>
                        <Field label="Till Number">
                          <input className="input-field" value={form.mpesaTillNumber || ''} onChange={(e) => set('mpesaTillNumber', e.target.value)}
                            placeholder="e.g. 123456" />
                        </Field>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function Toggle({ label, value = false, onChange, hint }: { label: string; value?: boolean; onChange: (v: boolean) => void; hint?: string; }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium text-gray-800 text-sm">{label}</p>
        {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${value ? 'bg-primary-500' : 'bg-gray-300'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}
