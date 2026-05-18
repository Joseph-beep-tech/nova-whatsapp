import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui';
import { useApi } from '../hooks/useApi';
import { Grid3x3, MessageCircle, Search, Phone as PhoneIcon, Lightbulb } from 'lucide-react';
import toast from 'react-hot-toast';

interface PhoneNumber {
  _id: string;
  phoneNumber: string;
  promptId?: { _id: string; name: string } | string;
}

const MCP_TOOLS = [
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    desc: 'Read and write Google Sheets during calls',
    icon: Grid3x3,
    color: 'bg-teal-100 text-teal-600',
    credentials: ['Google Service Account', 'Drive Folder ID'],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Messaging',
    desc: 'Send WhatsApp messages during calls',
    icon: MessageCircle,
    color: 'bg-green-100 text-green-600',
    credentials: ['WhatsApp API Key'],
  },
  {
    id: 'rag',
    name: 'Knowledge Base (RAG)',
    desc: 'Search your document knowledge base during calls',
    icon: Search,
    color: 'bg-blue-100 text-blue-600',
    credentials: ['RAG Collection'],
  },
  {
    id: 'call-management',
    name: 'Call Management',
    desc: 'Transfer and hang up calls',
    icon: PhoneIcon,
    color: 'bg-gray-100 text-gray-600',
    credentials: [],
  },
];

export const MCPToolsPage: React.FC = () => {
  const { request } = useApi();
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);

  useEffect(() => {
    loadPhoneNumbers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const loadPhoneNumbers = async () => {
    try {
      const data = await request({ method: 'GET', url: '/phone-numbers' });
      setPhoneNumbers(Array.isArray(data) ? data : []);
    } catch {
      // silent
    }
  };

  const getPromptName = (phone: PhoneNumber) => {
    if (!phone.promptId) return '-';
    if (typeof phone.promptId === 'object' && phone.promptId.name) return phone.promptId.name;
    return phone.promptId as string;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">MCP Tools</h1>
        <p className="text-gray-600 mt-2">Extend your AI with powerful integrations. Each capability can be activated per phone number.</p>
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {MCP_TOOLS.map((tool) => (
          <Card key={tool.id}>
            <div className="flex items-start gap-4 mb-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tool.color}`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{tool.name}</h3>
                <p className="text-sm text-gray-500">{tool.desc}</p>
              </div>
            </div>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-teal-500 text-white">
              Available
            </span>
            <div className="border-t border-gray-200 mt-4 pt-3">
              <p className="text-xs text-gray-500 mb-1">Required credentials:</p>
              {tool.credentials.length === 0 ? (
                <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">No extra credentials needed</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tool.credentials.map((c) => (
                    <span key={c} className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">{c}</span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* How MCP Tools Work */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-bold text-gray-900">How MCP Tools Work</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">1</span>
              <h3 className="font-semibold text-gray-900">Configure Credentials</h3>
            </div>
            <p className="text-sm text-gray-500">
              Add your API keys and service accounts in <a href="/credentials" className="text-teal-600 hover:underline">AI Studio</a> → AI Credentials tab.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">2</span>
              <h3 className="font-semibold text-gray-900">Activate Per Number</h3>
            </div>
            <p className="text-sm text-gray-500">
              Choose which capabilities to enable for each phone number. Some require admin approval.
            </p>
          </div>
          <div className="border border-gray-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">3</span>
              <h3 className="font-semibold text-gray-900">AI Uses Tools During Calls</h3>
            </div>
            <p className="text-sm text-gray-500">
              When a call comes in, your AI agent automatically has access to the enabled tools — Google Sheets, WhatsApp, knowledge base, etc.
            </p>
          </div>
        </div>
      </Card>

      {/* Your Numbers & Capabilities */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <PhoneIcon className="w-5 h-5 text-gray-600" />
          <h2 className="text-xl font-bold text-gray-900">Your Numbers & Capabilities</h2>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-teal-400">
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Phone Number</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Prompt</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Active Capabilities</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-teal-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {phoneNumbers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-gray-400">
                      No phone numbers yet. Add numbers from the Phone Numbers page.
                    </td>
                  </tr>
                ) : (
                  phoneNumbers.map((phone) => (
                    <tr key={phone._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 font-mono text-sm font-medium text-gray-900">
                        +{phone.phoneNumber.replace(/^\+/, '')}
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-teal-600">{getPromptName(phone)}</span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-teal-500 text-white">
                          Call Management
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toast.success('MCP configuration coming soon')}
                          className="px-4 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50 font-medium"
                        >
                          Configure MCP
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};
