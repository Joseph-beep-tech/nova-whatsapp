import React, { useState, useEffect, useCallback } from 'react';
import { Card, Input, Select } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { ChevronDown, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Prompt {
  _id: string;
  name: string;
}

interface AutopilotSettings {
  configured: boolean;
  enabled: boolean;
  promptId: any;
  autoReply: boolean;
  replyToGroups: boolean;
  replyDelaySeconds: number;
  keywordTriggers: string[];
  excludedKeywords: string[];
  businessHoursOnly: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

const DEFAULTS: AutopilotSettings = {
  configured: false,
  enabled: false,
  promptId: null,
  autoReply: true,
  replyToGroups: false,
  replyDelaySeconds: 5,
  keywordTriggers: [],
  excludedKeywords: [],
  businessHoursOnly: false,
  startTime: '09:00',
  endTime: '18:00',
  timezone: 'Africa/Nairobi',
};

export const AutopilotPage: React.FC = () => {
  const { request, loading } = useApi();
  const [settings, setSettings] = useState<AutopilotSettings>(DEFAULTS);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [expandedSection, setExpandedSection] = useState<string>('general');
  const [newKeyword, setNewKeyword] = useState('');
  const [newExcluded, setNewExcluded] = useState('');
  const [toggling, setToggling] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/autopilot' });
      setSettings({
        configured: data.configured || false,
        enabled: data.enabled || false,
        promptId: data.promptId,
        autoReply: data.autoReply ?? true,
        replyToGroups: data.replyToGroups || false,
        replyDelaySeconds: data.replyDelaySeconds ?? 5,
        keywordTriggers: data.keywordTriggers || [],
        excludedKeywords: data.excludedKeywords || [],
        businessHoursOnly: data.businessHoursOnly || false,
        startTime: data.startTime || '09:00',
        endTime: data.endTime || '18:00',
        timezone: data.timezone || 'Africa/Nairobi',
      });
    } catch (error) {
      console.error('Failed to load settings');
    }
  }, [request]);

  const loadPrompts = useCallback(async () => {
    try {
      const data = await request({ method: 'GET', url: '/prompts' });
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load prompts');
    }
  }, [request]);

  useEffect(() => {
    loadSettings();
    loadPrompts();
  }, [loadSettings, loadPrompts]);

  const getSelectedPromptId = () => {
    if (!settings.promptId) return '';
    if (typeof settings.promptId === 'object' && settings.promptId._id) return settings.promptId._id;
    return settings.promptId;
  };

  const getSelectedPromptName = () => {
    if (!settings.promptId) return 'None selected';
    if (typeof settings.promptId === 'object' && settings.promptId.name) return settings.promptId.name;
    const found = prompts.find(p => p._id === settings.promptId);
    return found?.name || 'Unknown';
  };

  const handleSave = async () => {
    try {
      const data = {
        promptId: getSelectedPromptId() || undefined,
        enabled: settings.enabled,
        autoReply: settings.autoReply,
        replyToGroups: settings.replyToGroups,
        replyDelaySeconds: settings.replyDelaySeconds,
        keywordTriggers: settings.keywordTriggers,
        excludedKeywords: settings.excludedKeywords,
        businessHoursOnly: settings.businessHoursOnly,
        startTime: settings.startTime,
        endTime: settings.endTime,
        timezone: settings.timezone,
      };

      const result = await request({ method: 'POST', url: '/autopilot', data });
      setSettings({
        configured: true,
        enabled: result.enabled,
        promptId: result.promptId,
        autoReply: result.autoReply,
        replyToGroups: result.replyToGroups,
        replyDelaySeconds: result.replyDelaySeconds,
        keywordTriggers: result.keywordTriggers || [],
        excludedKeywords: result.excludedKeywords || [],
        businessHoursOnly: result.businessHoursOnly,
        startTime: result.startTime,
        endTime: result.endTime,
        timezone: result.timezone,
      });
      toast.success('Autopilot settings saved');
    } catch (error) {
      console.error('Failed to save settings');
    }
  };

  const handleToggle = async () => {
    if (!settings.configured) {
      toast.error('Save your settings first before toggling');
      return;
    }
    setToggling(true);
    try {
      const result = await request({ method: 'POST', url: '/autopilot/toggle' });
      setSettings({ ...settings, enabled: result.enabled });
      toast.success(result.message);
    } catch (error) {
      console.error('Failed to toggle');
    } finally {
      setToggling(false);
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !settings.keywordTriggers.includes(kw)) {
      setSettings({ ...settings, keywordTriggers: [...settings.keywordTriggers, kw] });
      setNewKeyword('');
    }
  };

  const removeKeyword = (kw: string) => {
    setSettings({ ...settings, keywordTriggers: settings.keywordTriggers.filter(k => k !== kw) });
  };

  const addExcluded = () => {
    const kw = newExcluded.trim().toLowerCase();
    if (kw && !settings.excludedKeywords.includes(kw)) {
      setSettings({ ...settings, excludedKeywords: [...settings.excludedKeywords, kw] });
      setNewExcluded('');
    }
  };

  const removeExcluded = (kw: string) => {
    setSettings({ ...settings, excludedKeywords: settings.excludedKeywords.filter(k => k !== kw) });
  };

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`}
    >
      <span
        className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(3px)' }}
      />
    </button>
  );

  const Section: React.FC<{ title: string; id: string; children: React.ReactNode }> = ({ title, id, children }) => (
    <Card>
      <button
        onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
        className="w-full flex items-center justify-between mb-0"
      >
        <h3 className="text-lg font-semibold text-gray-900 text-left">{title}</h3>
        <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${expandedSection === id ? 'rotate-180' : ''}`} />
      </button>
      {expandedSection === id && <div className="space-y-4 mt-4 pt-4 border-t border-gray-200">{children}</div>}
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">WhatsApp Autopilot</h1>
        <p className="text-gray-600 mt-2">Configure AI-powered auto-replies for WhatsApp messages</p>
      </div>

      {/* Status + Toggle */}
      <Card className={settings.enabled ? 'border-2 border-green-400 bg-green-50' : ''}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Autopilot Status</h3>
            <p className="text-sm text-gray-600 mt-1">
              {settings.enabled ? 'Active — AI is replying to WhatsApp messages' : 'Inactive — auto-replies are off'}
            </p>
            {settings.configured && settings.promptId && (
              <p className="text-xs text-gray-500 mt-1">Using prompt: <span className="font-medium">{getSelectedPromptName()}</span></p>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
              settings.enabled
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            } ${toggling ? 'opacity-50' : ''}`}
          >
            {toggling ? '...' : settings.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </Card>

      {/* Prompt Selection */}
      <Section title="AI Prompt" id="prompt">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Prompt for Auto-Replies</label>
          <select
            value={getSelectedPromptId()}
            onChange={(e) => setSettings({ ...settings, promptId: e.target.value || null })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
          >
            <option value="">No prompt selected</option>
            {prompts.map((p) => (
              <option key={p._id} value={p._id}>{p.name}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">The AI will use this prompt's instructions when replying to WhatsApp messages</p>
          {prompts.length === 0 && (
            <p className="text-xs text-yellow-600 mt-2">No prompts found. Create one in the Prompts section first.</p>
          )}
        </div>
      </Section>

      {/* General Settings */}
      <Section title="General Settings" id="general">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Auto-Reply</p>
            <p className="text-sm text-gray-600">Automatically reply to incoming messages</p>
          </div>
          <Toggle checked={settings.autoReply} onChange={(v) => setSettings({ ...settings, autoReply: v })} />
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Reply to Groups</p>
            <p className="text-sm text-gray-600">Include group messages in auto-replies</p>
          </div>
          <Toggle checked={settings.replyToGroups} onChange={(v) => setSettings({ ...settings, replyToGroups: v })} />
        </div>

        <Input
          label="Reply Delay (seconds)"
          type="number"
          value={settings.replyDelaySeconds}
          onChange={(e) => setSettings({ ...settings, replyDelaySeconds: parseInt(e.target.value) || 0 })}
          min="0"
          max="300"
        />
        <p className="text-xs text-gray-500 -mt-2">Wait this many seconds before sending a reply (makes it feel more natural)</p>
      </Section>

      {/* Keyword Triggers */}
      <Section title="Keyword Triggers" id="keywords">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Keywords</label>
          <p className="text-xs text-gray-500 mb-3">Only reply to messages containing these keywords. Leave empty to reply to all.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.keywordTriggers.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {kw}
                <button onClick={() => removeKeyword(kw)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {settings.keywordTriggers.length === 0 && (
              <span className="text-sm text-gray-400">No triggers — will reply to all messages</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
              placeholder="Type keyword and press Enter"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <button onClick={addKeyword} className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Excluded Keywords</label>
          <p className="text-xs text-gray-500 mb-3">Messages containing these keywords will NOT get a reply.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {settings.excludedKeywords.map((kw) => (
              <span key={kw} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                {kw}
                <button onClick={() => removeExcluded(kw)} className="hover:text-red-900"><X className="w-3 h-3" /></button>
              </span>
            ))}
            {settings.excludedKeywords.length === 0 && (
              <span className="text-sm text-gray-400">No exclusions</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newExcluded}
              onChange={(e) => setNewExcluded(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addExcluded()}
              placeholder="Type keyword and press Enter"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <button onClick={addExcluded} className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Section>

      {/* Business Hours */}
      <Section title="Business Hours" id="hours">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="font-medium text-gray-900">Only During Business Hours</p>
            <p className="text-sm text-gray-600">Disable auto-replies outside business hours</p>
          </div>
          <Toggle checked={settings.businessHoursOnly} onChange={(v) => setSettings({ ...settings, businessHoursOnly: v })} />
        </div>

        {settings.businessHoursOnly && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Start Time"
              type="time"
              value={settings.startTime}
              onChange={(e) => setSettings({ ...settings, startTime: e.target.value })}
            />
            <Input
              label="End Time"
              type="time"
              value={settings.endTime}
              onChange={(e) => setSettings({ ...settings, endTime: e.target.value })}
            />
            <Select
              label="Timezone"
              options={[
                { value: 'Africa/Nairobi', label: 'East Africa (EAT)' },
                { value: 'Africa/Lagos', label: 'West Africa (WAT)' },
                { value: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
                { value: 'Africa/Cairo', label: 'Egypt (EET)' },
                { value: 'UTC', label: 'UTC' },
              ]}
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
            />
          </div>
        )}
      </Section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl shadow-lg hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 transform hover:scale-[1.02] active:scale-95 disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save Autopilot Settings'}
      </button>

      {/* Tips */}
      <Card className="bg-blue-50 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">How It Works</h3>
        <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
          <li>Select a prompt that defines how the AI should respond</li>
          <li>Configure triggers and exclusions to control which messages get replies</li>
          <li>Set business hours if you want replies only during work time</li>
          <li>Click Save, then Enable the autopilot</li>
          <li>The AI will automatically reply to WhatsApp messages using your prompt</li>
          <li>Each reply costs KES 0.50 from your credits balance</li>
        </ol>
      </Card>
    </div>
  );
};
