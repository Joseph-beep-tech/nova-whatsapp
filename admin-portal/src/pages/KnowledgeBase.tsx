/**
 * KnowledgeBase.tsx
 * Upload menus, FAQs, prices, locations and anything the AI should know.
 * Documents are chunked + embedded into vectors for RAG retrieval.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { kbService } from '../services/restaurantAI.service';
import { restaurantService } from '../services/restaurant.service';
import {
  ArrowLeft, Plus, Trash2, RefreshCw, Search, FileText,
  CheckCircle2, AlertCircle, Clock, Upload, X, ChevronDown,
  ChevronUp, Bot, Zap, MapPin, HelpCircle, Tag, Star,
  BookOpen, DollarSign,
} from 'lucide-react';

const DOC_TYPES = [
  { value: 'menu',      label: 'Menu',        icon: BookOpen,    color: 'bg-orange-100 text-orange-700' },
  { value: 'faq',       label: 'FAQs',        icon: HelpCircle,  color: 'bg-purple-100 text-purple-700' },
  { value: 'location',  label: 'Location',    icon: MapPin,      color: 'bg-blue-100 text-blue-700' },
  { value: 'hours',     label: 'Hours',       icon: Clock,       color: 'bg-yellow-100 text-yellow-700' },
  { value: 'pricing',   label: 'Pricing',     icon: DollarSign,  color: 'bg-green-100 text-green-700' },
  { value: 'policy',    label: 'Policy',      icon: FileText,    color: 'bg-gray-100 text-gray-700' },
  { value: 'promotion', label: 'Promotions',  icon: Star,        color: 'bg-pink-100 text-pink-700' },
  { value: 'general',   label: 'General',     icon: Tag,         color: 'bg-teal-100 text-teal-700' },
];

const STATUS_CONFIG = {
  active:     { label: 'Active',      icon: CheckCircle2, cls: 'text-green-600 bg-green-50' },
  processing: { label: 'Processing',  icon: Clock,        cls: 'text-yellow-600 bg-yellow-50' },
  error:      { label: 'Error',       icon: AlertCircle,  cls: 'text-red-600 bg-red-50' },
  archived:   { label: 'Archived',    icon: X,            cls: 'text-gray-400 bg-gray-50' },
};

interface KBDoc {
  _id: string;
  title: string;
  docType: string;
  status: 'active' | 'processing' | 'error' | 'archived';
  wordCount: number;
  chunks?: { chunkIndex: number }[];
  vectorisedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export default function KnowledgeBase() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', docType: 'general', content: '', file: null as File | null,
  });

  const { data: restaurant } = useQuery(
    ['restaurant', restaurantId],
    () => restaurantService.getById(restaurantId!),
    { enabled: !!restaurantId }
  );

  const { data: docs = [], isLoading } = useQuery<KBDoc[]>(
    ['kb', restaurantId],
    () => kbService.getAll(restaurantId!),
    { enabled: !!restaurantId, refetchInterval: 8000 }
  );

  const createMutation = useMutation(
    (fd: FormData) => kbService.create(fd),
    { onSuccess: () => { qc.invalidateQueries(['kb', restaurantId]); setShowModal(false); resetForm(); } }
  );

  const deleteMutation = useMutation(
    (docId: string) => kbService.remove(docId),
    { onSuccess: () => qc.invalidateQueries(['kb', restaurantId]) }
  );

  const reprocessMutation = useMutation(
    (docId: string) => kbService.reprocess(docId),
    { onSuccess: () => qc.invalidateQueries(['kb', restaurantId]) }
  );

  const resetForm = () => setForm({ title: '', docType: 'general', content: '', file: null });

  const handleSubmit = () => {
    if (!form.title.trim()) return;
    if (!form.content.trim() && !form.file) return;
    const fd = new FormData();
    fd.append('restaurantId', restaurantId!);
    fd.append('title', form.title);
    fd.append('docType', form.docType);
    if (form.content) fd.append('content', form.content);
    if (form.file) fd.append('file', form.file);
    createMutation.mutate(fd);
  };

  const handleTest = async () => {
    if (!testQuery.trim()) return;
    setTestLoading(true);
    try {
      const res = await kbService.query(restaurantId!, testQuery);
      setTestResults(res.results || []);
    } catch {
      setTestResults([]);
    } finally {
      setTestLoading(false);
    }
  };

  const filtered = filterType ? docs.filter((d) => d.docType === filterType) : docs;
  const activeCount = docs.filter((d) => d.status === 'active').length;
  const totalChunks = docs.reduce((s, d) => s + (d.chunks?.length || 0), 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/restaurants/${restaurantId}/details`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="page-title">{restaurant?.name} — AI Knowledge Base</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload menus, FAQs, locations and pricing. The AI uses this to answer customers via WhatsApp and voice calls.
          </p>
        </div>
        <button
          onClick={() => setShowTestPanel(!showTestPanel)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showTestPanel ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}
        >
          <Bot size={16} />
          Test RAG
        </button>
        <button onClick={() => { setShowModal(true); resetForm(); }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add Document
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Documents', value: docs.length, sub: `${activeCount} active`, icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Vector Chunks', value: totalChunks, sub: 'embedded & searchable', icon: Zap, color: 'text-purple-600 bg-purple-50' },
          { label: 'AI-Ready', value: `${activeCount}/${docs.length}`, sub: 'docs vectorised', icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-4">
            <div className={`p-3 rounded-xl ${s.color}`}><s.icon size={22} /></div>
            <div>
              <p className="page-title">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Test RAG panel */}
      {showTestPanel && (
        <div className="card border border-purple-200 bg-purple-50/40 space-y-4">
          <div className="flex items-center gap-2 text-purple-700 font-semibold">
            <Bot size={18} />
            Test Knowledge Retrieval
          </div>
          <p className="text-xs text-gray-500">
            Type a customer question to see which knowledge chunks the AI would retrieve. This simulates how the AI answers WhatsApp messages and voice calls.
          </p>
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="e.g. What are your vegetarian options? Do you deliver to Westlands?"
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <button onClick={handleTest} disabled={testLoading} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {testLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
              Search
            </button>
          </div>
          {testResults.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {testResults.map((r, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border text-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-gray-700">{r.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.score > 0.85 ? 'bg-green-100 text-green-700' : r.score > 0.72 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {(r.score * 100).toFixed(1)}% match
                    </span>
                  </div>
                  <p className="text-gray-600 line-clamp-3">{r.text}</p>
                </div>
              ))}
            </div>
          )}
          {testResults.length === 0 && testQuery && !testLoading && (
            <p className="text-sm text-gray-500 text-center py-2">No results. Make sure documents are active (green status).</p>
          )}
        </div>
      )}

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterType ? 'bg-primary-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
        >
          All ({docs.length})
        </button>
        {DOC_TYPES.map((t) => {
          const count = docs.filter((d) => d.docType === t.value).length;
          if (count === 0) return null;
          return (
            <button
              key={t.value}
              onClick={() => setFilterType(filterType === t.value ? null : t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterType === t.value ? 'bg-primary-500 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading knowledge base...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No documents yet</p>
          <p className="text-gray-400 text-sm mt-1">Add your first document to power the AI</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mt-4 inline-flex items-center gap-2">
            <Plus size={16} /> Add Document
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((doc) => {
            const typeInfo = DOC_TYPES.find((t) => t.value === doc.docType);
            const statusInfo = STATUS_CONFIG[doc.status];
            const StatusIcon = statusInfo.icon;
            const TypeIcon = typeInfo?.icon || FileText;
            const isExpanded = expandedDoc === doc._id;

            return (
              <div key={doc._id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${typeInfo?.color || 'bg-gray-100 text-gray-600'}`}>
                    <TypeIcon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{doc.title}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.cls}`}>
                        <StatusIcon size={11} />
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full ${typeInfo?.color || ''}`}>{typeInfo?.label}</span>
                      <span>{doc.wordCount?.toLocaleString() || 0} words</span>
                      {doc.chunks && <span>{doc.chunks.length} chunks</span>}
                      {doc.vectorisedAt && <span>Vectorised {new Date(doc.vectorisedAt).toLocaleDateString()}</span>}
                    </div>
                    {doc.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">{doc.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.status === 'error' && (
                      <button
                        onClick={() => reprocessMutation.mutate(doc._id)}
                        className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                        title="Retry processing"
                      >
                        <RefreshCw size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : doc._id)}
                      className="p-2 text-gray-400 hover:bg-gray-50 rounded-lg"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${doc.title}"?`)) deleteMutation.mutate(doc._id);
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Raw content preview</p>
                    <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans">
                        {/* rawContent not returned in list — show placeholder */}
                        Content stored securely. Re-upload to update.
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add Document Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Knowledge Document</h2>
                <p className="text-sm text-gray-500 mt-0.5">This content will be used by the AI to answer customers</p>
              </div>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  className="input-field"
                  placeholder="e.g. Full Menu — June 2025, Westlands Branch FAQs"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Type *</label>
                <div className="grid grid-cols-4 gap-2">
                  {DOC_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setForm({ ...form, docType: t.value })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-xs font-medium ${
                        form.docType === t.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 hover:border-gray-300 text-gray-600'
                      }`}
                    >
                      <t.icon size={18} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Paste Content</label>
                <textarea
                  className="input-field"
                  rows={8}
                  placeholder={`Paste your menu, FAQ, pricing, location details etc. here.\n\nExample for menu:\nBurgers\n- Classic Beef Burger - KSh 750 (beef patty, lettuce, tomato, pickles)\n- Chicken Crunch Burger - KSh 800 (crispy chicken, coleslaw, mayo)\n\nDrinks\n- Freshly Squeezed Orange Juice - KSh 300\n- Mango Smoothie - KSh 350`}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Or Upload File (.txt, .pdf)</label>
                <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                  <Upload size={18} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{form.file ? form.file.name : 'Choose file...'}</span>
                  <input
                    type="file"
                    accept=".txt,.pdf,.md"
                    className="hidden"
                    onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  />
                </label>
              </div>

              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                <strong>Tip:</strong> The more specific your content, the better the AI responds. Include prices, allergens, delivery zones, opening times, and anything customers ask about.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={createMutation.isLoading || (!form.content.trim() && !form.file)}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {createMutation.isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
                  Save & Vectorise
                </button>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
