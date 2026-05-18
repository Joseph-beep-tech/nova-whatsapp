import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Plus, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Prompt {
  _id: string;
  name: string;
  description: string;
  content: string;
  status: 'active' | 'inactive' | 'draft';
  phoneNumber?: string;
  whatsappStatus?: 'connected' | 'disconnected';
  fileUrl?: string;
}

interface PhoneNumber {
  _id: string;
  phoneNumber: string;
  label: string;
  status: 'assigned' | 'pending' | 'unassigned';
}

export const PromptsPage: React.FC = () => {
  const { request, loading } = useApi();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTab, setFormTab] = useState<'builder' | 'raw'>('builder');
  const [formData, setFormData] = useState({
    name: '',
    businessContext: '',
    roleIdentity: '',
    tone: 'Friendly',
    language: 'English',
    responseLength: 'Medium',
    greeting: '',
    coreInstructions: '',
    dataCollection: '',
    mcpToolInstructions: '',
    escalationRules: '',
    closing: '',
    keywords: '',
    guardrails: '',
    content: '',
    phoneNumber: '',
  });

  useEffect(() => {
    loadPrompts();
    loadPhoneNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const loadPrompts = async () => {
    try {
      const data = await request({ method: 'GET', url: '/prompts' });
      setPrompts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load prompts');
    }
  };

  const loadPhoneNumbers = async () => {
    try {
      const data = await request({ method: 'GET', url: '/phone-numbers' });
      setPhoneNumbers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load phone numbers');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.roleIdentity) {
      toast.error('Please fill in Prompt Name and Role & Identity');
      return;
    }

    try {
      const content = formTab === 'builder'
        ? `Business Context: ${formData.businessContext}\n\nRole & Identity: ${formData.roleIdentity}\n\nVoice & Language: ${formData.tone}, ${formData.language}, ${formData.responseLength}\n\nGreeting: ${formData.greeting}\n\nCore Instructions: ${formData.coreInstructions}\n\nData Collection: ${formData.dataCollection}\n\nMCP Tool Instructions: ${formData.mcpToolInstructions}\n\nEscalation Rules: ${formData.escalationRules}\n\nClosing: ${formData.closing}\n\nKeywords: ${formData.keywords}\n\nGuardrails: ${formData.guardrails}`
        : formData.content;

      const payload = {
        name: formData.name,
        description: formData.businessContext,
        content: content,
        phoneNumber: formData.phoneNumber,
      };

      if (editingId) {
        await request({
          method: 'PUT',
          url: `/prompts/${editingId}`,
          data: payload,
        });
        toast.success('Prompt updated successfully');
      } else {
        await request({
          method: 'POST',
          url: '/prompts',
          data: payload,
        });
        toast.success('Prompt created successfully');
      }
      
      const resetForm = {
        name: '',
        businessContext: '',
        roleIdentity: '',
        tone: 'Friendly',
        language: 'English',
        responseLength: 'Medium',
        greeting: '',
        coreInstructions: '',
        dataCollection: '',
        mcpToolInstructions: '',
        escalationRules: '',
        closing: '',
        keywords: '',
        guardrails: '',
        content: '',
        phoneNumber: '',
      };
      setFormData(resetForm);
      setEditingId(null);
      setShowForm(false);
      loadPrompts();
    } catch (error) {
      console.error('Failed to save prompt');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure?')) {
      try {
        await request({ method: 'DELETE', url: `/prompts/${id}` });
        toast.success('Prompt deleted');
        loadPrompts();
      } catch (error) {
        console.error('Failed to delete prompt');
      }
    }
  };

  const handleAssignPhone = async (promptId: string, phoneNumber: string) => {
    try {
      await request({
        method: 'PUT',
        url: `/prompts/${promptId}`,
        data: { phoneNumber, status: 'active' },
      });
      toast.success('Phone number assigned');
      setShowPhoneModal(null);
      loadPrompts();
    } catch (error) {
      console.error('Failed to assign phone');
    }
  };

  const handleRemoveWhatsApp = async (promptId: string) => {
    try {
      await request({
        method: 'PUT',
        url: `/prompts/${promptId}`,
        data: { whatsappStatus: 'disconnected' },
      });
      toast.success('WhatsApp connection removed');
      loadPrompts();
    } catch (error) {
      console.error('Failed to remove WhatsApp');
    }
  };

  const handleAssignWhatsApp = async (promptId: string) => {
    try {
      await request({
        method: 'PUT',
        url: `/prompts/${promptId}`,
        data: { whatsappStatus: 'connected' },
      });
      toast.success('WhatsApp assigned');
      loadPrompts();
    } catch (error) {
      console.error('Failed to assign WhatsApp');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Your Prompts</h1>
          <p className="text-gray-600 mt-2">Create prompts for different projects. Assign a prompt to a phone number to activate it for incoming calls.</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData({ name: '', businessContext: '', roleIdentity: '', tone: 'Friendly', language: 'English', responseLength: 'Medium', greeting: '', coreInstructions: '', dataCollection: '', mcpToolInstructions: '', escalationRules: '', closing: '', keywords: '', guardrails: '', content: '', phoneNumber: '' }); }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          New Prompt
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold">{editingId ? 'Edit Prompt' : 'New Prompt'}</h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    businessContext: '',
                    roleIdentity: '',
                    tone: 'Friendly',
                    language: 'English',
                    responseLength: 'Medium',
                    greeting: '',
                    coreInstructions: '',
                    dataCollection: '',
                    mcpToolInstructions: '',
                    escalationRules: '',
                    closing: '',
                    keywords: '',
                    guardrails: '',
                    content: '',
                    phoneNumber: '',
                  });
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-4 mb-6 border-b">
              <button
                onClick={() => setFormTab('builder')}
                className={`px-4 py-2 font-medium ${
                  formTab === 'builder'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Structured Builder
              </button>
              <button
                onClick={() => setFormTab('raw')}
                className={`px-4 py-2 font-medium ${
                  formTab === 'raw'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Raw Text
              </button>
            </div>

            {formTab === 'builder' ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prompt Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Customer Support Agent"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    1. Business Context
                  </label>
                  <textarea
                    value={formData.businessContext}
                    onChange={(e) => setFormData({ ...formData, businessContext: e.target.value })}
                    placeholder="Describe your business and what the AI assistant does."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    2. Role & Identity <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.roleIdentity}
                    onChange={(e) => setFormData({ ...formData, roleIdentity: e.target.value })}
                    placeholder="Who is the AI? What is its personality and purpose?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    3. Voice & Language
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Tone</label>
                      <select
                        value={formData.tone}
                        onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option>Friendly</option>
                        <option>Professional</option>
                        <option>Casual</option>
                        <option>Formal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Language</label>
                      <select
                        value={formData.language}
                        onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option>English</option>
                        <option>Spanish</option>
                        <option>French</option>
                        <option>German</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Response length</label>
                      <select
                        value={formData.responseLength}
                        onChange={(e) => setFormData({ ...formData, responseLength: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option>Short</option>
                        <option>Medium</option>
                        <option>Long</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    4. Greeting <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.greeting}
                    onChange={(e) => setFormData({ ...formData, greeting: e.target.value })}
                    placeholder="How should the AI greet callers?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    5. Core Instructions
                  </label>
                  <textarea
                    value={formData.coreInstructions}
                    onChange={(e) => setFormData({ ...formData, coreInstructions: e.target.value })}
                    placeholder="Step-by-step instructions for the AI to follow during the call."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    6. Data Collection
                  </label>
                  <textarea
                    value={formData.dataCollection}
                    onChange={(e) => setFormData({ ...formData, dataCollection: e.target.value })}
                    placeholder="What information should the AI collect from callers?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    7. MCP Tool Instructions
                  </label>
                  <textarea
                    value={formData.mcpToolInstructions}
                    onChange={(e) => setFormData({ ...formData, mcpToolInstructions: e.target.value })}
                    placeholder="e.g. After collecting caller data, use the write_to_sheet tool with spreadsheet_id: 'YOUR_SHEET_ID' and range: 'Sheet1!A:F' to save it."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500 mt-1">If you have MCP tools (Google Sheets, Drive), describe when and how to use them.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    8. Escalation Rules
                  </label>
                  <textarea
                    value={formData.escalationRules}
                    onChange={(e) => setFormData({ ...formData, escalationRules: e.target.value })}
                    placeholder="What should the AI do when it cannot help?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    9. Closing
                  </label>
                  <textarea
                    value={formData.closing}
                    onChange={(e) => setFormData({ ...formData, closing: e.target.value })}
                    placeholder="How should the AI end the call?"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={2}
                  />

                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Keywords</label>
                      <input
                        type="text"
                        value={formData.keywords}
                        onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                        placeholder="booking, payment, support (comma-separated)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="text-xs text-gray-500 mt-1">Used for context detection when routing conversations.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Guardrails</label>
                      <textarea
                        value={formData.guardrails}
                        onChange={(e) => setFormData({ ...formData, guardrails: e.target.value })}
                        placeholder="One rule per line..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        rows={3}
                      />
                      <p className="text-xs text-gray-500 mt-1">Rules the AI must follow (e.g. "Never share personal data", "Always verify identity first")</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prompt Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Customer Support Agent"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Prompt Instructions <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Enter your full AI prompt/instructions here..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={12}
                  />
                  <p className="text-xs text-gray-500 mt-2">Full system prompt sent to OpenAI Realtime for incoming calls.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Keywords</label>
                  <input
                    type="text"
                    value={formData.keywords}
                    onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                    placeholder="booking, payment, support (comma-separated)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Used for context detection when routing conversations.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">Guardrails</label>
                  <textarea
                    value={formData.guardrails}
                    onChange={(e) => setFormData({ ...formData, guardrails: e.target.value })}
                    placeholder="One rule per line..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Rules the AI must follow (e.g. "Never share personal data", "Always verify identity first")</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-8 pt-6 border-t">
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({
                    name: '',
                    businessContext: '',
                    roleIdentity: '',
                    tone: 'Friendly',
                    language: 'English',
                    responseLength: 'Medium',
                    greeting: '',
                    coreInstructions: '',
                    dataCollection: '',
                    mcpToolInstructions: '',
                    escalationRules: '',
                    closing: '',
                    keywords: '',
                    guardrails: '',
                    content: '',
                    phoneNumber: '',
                  });
                }}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-400 font-semibold transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-2xl hover:from-green-600 hover:to-emerald-700 transition-all duration-300 ease-in-out transform hover:scale-105 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100"
              >
                {loading ? 'Saving...' : 'Save Prompt'}
              </button>
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-teal-400">
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">Phone</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">WhatsApp</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">File</th>
                <th className="text-left px-4 py-3 font-semibold text-teal-700 text-sm uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prompts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    No prompts created yet. Create one to get started!
                  </td>
                </tr>
              ) : (
                prompts.map((prompt) => (
                  <tr key={prompt._id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{prompt.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        prompt.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : prompt.status === 'draft'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {prompt.status === 'active' ? 'Active' : prompt.status === 'draft' ? 'Unassigned' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-900 font-mono text-sm">
                      {prompt.phoneNumber ? `+${prompt.phoneNumber.replace(/^\+/, '')}` : '-'}
                    </td>
                    <td className="px-4 py-4">
                      {prompt.whatsappStatus === 'connected' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-600 text-white">
                          <MessageCircle className="w-3 h-3" />
                          {prompt.phoneNumber || 'Connected'}
                        </span>
                      ) : (
                        <span className="inline-block w-6 h-6 rounded-full bg-gray-300 text-white text-center leading-6 text-xs font-bold">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-500 text-sm font-mono">
                      {prompt.fileUrl
                        ? prompt.fileUrl.split('/').pop()
                        : prompt.phoneNumber
                        ? `${prompt.phoneNumber.replace(/^\+/, '')}_1_${prompt._id.slice(-8)}.txt`
                        : '-'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => {
                            setFormData({
                              name: prompt.name,
                              businessContext: prompt.description || '',
                              roleIdentity: '',
                              tone: 'Friendly',
                              language: 'English',
                              responseLength: 'Medium',
                              greeting: '',
                              coreInstructions: '',
                              dataCollection: '',
                              mcpToolInstructions: '',
                              escalationRules: '',
                              closing: '',
                              keywords: '',
                              guardrails: '',
                              content: prompt.content || '',
                              phoneNumber: prompt.phoneNumber || '',
                            });
                            setEditingId(prompt._id);
                            setShowForm(true);
                          }}
                          className="px-3 py-1 border border-green-500 text-green-600 rounded text-sm hover:bg-green-50 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setShowPhoneModal(prompt._id)}
                          className="px-3 py-1 border border-green-500 text-green-600 rounded text-sm hover:bg-green-50 font-medium"
                        >
                          Assign Phone
                        </button>
                        {prompt.whatsappStatus === 'connected' ? (
                          <button
                            onClick={() => handleRemoveWhatsApp(prompt._id)}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-yellow-500 text-yellow-600 rounded text-sm hover:bg-yellow-50 font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAssignWhatsApp(prompt._id)}
                            className="inline-flex items-center gap-1 px-3 py-1 border border-teal-500 text-teal-600 rounded text-sm hover:bg-teal-50 font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> Assign
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(prompt._id)}
                          className="px-3 py-1 border border-red-400 text-red-500 rounded text-sm hover:bg-red-50 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Phone Number Selection Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Assign Phone Number</h2>
              <button
                onClick={() => setShowPhoneModal(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>
            {phoneNumbers.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-2">No phone numbers available.</p>
                <p className="text-sm text-gray-400">Request phone numbers from the Phone Numbers page first.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {phoneNumbers.map((phone) => (
                  <button
                    key={phone._id}
                    onClick={() => handleAssignPhone(showPhoneModal, phone.phoneNumber)}
                    className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-mono text-sm font-medium text-gray-900">{phone.phoneNumber}</p>
                      <p className="text-xs text-gray-500">{phone.label}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      phone.status === 'assigned'
                        ? 'bg-green-100 text-green-700'
                        : phone.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {phone.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowPhoneModal(null)}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
