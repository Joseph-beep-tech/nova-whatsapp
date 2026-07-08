import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { restaurantService } from '../services/restaurant.service';
import { whatsappService, WaSession } from '../services/whatsapp.service';
import {
  ArrowLeft, Edit, Save, X, Upload, Star, Clock,
  Brain, CalendarDays, MessageSquare, Settings,
  UtensilsCrossed, Wifi, WifiOff, Phone, RefreshCw,
  ClipboardList, DollarSign, Link2, Unlink, CheckCircle2,
} from 'lucide-react';
import { useState } from 'react';
import { Restaurant } from '../types';

const AI_MODULES = [
  { label: 'Knowledge Base',    sub: 'Menus, FAQs, pricing',  icon: Brain,        path: 'knowledge',        color: 'text-purple-600 bg-purple-50' },
  { label: 'AI Config',         sub: 'Voice & WA settings',   icon: Settings,     path: 'ai-config',        color: 'text-blue-600 bg-blue-50' },
  { label: 'Reservations',      sub: 'Table bookings',        icon: CalendarDays, path: 'reservations',     color: 'text-emerald-600 bg-emerald-50' },
  { label: 'AI Conversations',  sub: 'Interaction logs',      icon: MessageSquare,path: 'ai-interactions',  color: 'text-orange-600 bg-orange-50' },
  { label: 'Menu Management',   sub: 'Items & categories',    icon: UtensilsCrossed, path: 'menu',          color: 'text-gold-600 bg-gold-50' },
  { label: 'Orders',            sub: 'Restaurant orders',     icon: ClipboardList, path: '',               color: 'text-slate-600 bg-slate-50' },
];

function FieldRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<Partial<Restaurant>>({});
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [, setLinkingSession] = useState<string | null>(null);

  const { data: restaurant, isLoading } = useQuery(
    ['restaurant', id],
    () => restaurantService.getById(id!),
    { enabled: !!id, onSuccess: (d) => setForm(d) }
  );

  const updateMutation = useMutation(
    (data: FormData) => restaurantService.update(id!, data),
    { onSuccess: () => { qc.invalidateQueries(['restaurant', id]); setIsEditing(false); } }
  );

  const { data: waSessions = [] } = useQuery<WaSession[]>(
    'wa-sessions',
    () => whatsappService.getSessions(),
  );

  const linkMutation = useMutation(
    ({ sessionId, restaurantId }: { sessionId: string; restaurantId: string | null }) =>
      whatsappService.linkRestaurant(sessionId, restaurantId),
    {
      onSuccess: () => {
        qc.invalidateQueries('wa-sessions');
        setLinkingSession(null);
      },
    }
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (v !== undefined && v !== null && k !== 'id' && k !== 'imageUrl') {
        fd.append(k, k === 'features' && Array.isArray(v) ? JSON.stringify(v) : String(v));
      }
    });
    if (image) fd.append('image', image);
    updateMutation.mutate(fd);
  };

  if (isLoading) return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="skeleton h-8 w-48 rounded-xl" />
      <div className="skeleton h-48 rounded-2xl" />
      <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
    </div>
  );

  if (!restaurant) return <div className="text-center py-20 text-gray-400">Restaurant not found</div>;

  const imgSrc = imagePreview || `http://localhost:4000${restaurant.imageUrl}`;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/restaurants')} className="p-2 hover:bg-surface-muted rounded-xl transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="page-title truncate">{restaurant.name}</h1>
          <p className="page-subtitle">{restaurant.cuisine} · {restaurant.address}</p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={handleSubmit} disabled={updateMutation.isLoading} className="btn-primary">
                {updateMutation.isLoading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                Save
              </button>
              <button onClick={() => { setIsEditing(false); setForm(restaurant); setImagePreview(null); }} className="btn-secondary">
                <X size={14} /> Cancel
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn-secondary">
              <Edit size={14} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Hero image + quick stats */}
      <div className="card p-0 overflow-hidden">
        <div className="relative h-52">
          <img src={imgSrc} alt={restaurant.name} className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(restaurant.name)}&size=800&background=C9A84C&color=fff&bold=true`; }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm ${restaurant.isOpen ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-white/70'}`}>
            {restaurant.isOpen ? <Wifi size={11} /> : <WifiOff size={11} />}
            {restaurant.isOpen ? 'Open Now' : 'Closed'}
          </div>
          {isEditing && (
            <label className="absolute bottom-4 right-4 btn-primary text-xs cursor-pointer">
              <Upload size={13} /> Change Image
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          )}
          {/* bottom stats */}
          <div className="absolute bottom-4 left-4 flex gap-4">
            {[
              { icon: Star, value: restaurant.rating.toFixed(1), cls: 'text-gold-400 fill-gold-400' },
              { icon: Clock, value: `${restaurant.deliveryTimeMinutesMin}–${restaurant.deliveryTimeMinutesMax} min`, cls: '' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-white text-sm font-medium">
                <s.icon size={14} className={s.cls || 'text-white/80'} />
                {s.value}
              </div>
            ))}
          </div>
        </div>

        {/* Quick info row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-surface-border border-t border-surface-border">
          {[
            { label: 'Delivery Fee', value: `KSh ${restaurant.deliveryFee}`, icon: DollarSign },
            { label: 'Min Order', value: `KSh ${restaurant.minOrder || 0}`, icon: UtensilsCrossed },
            { label: 'Phone', value: restaurant.phone || 'N/A', icon: Phone },
            { label: 'Hours', value: restaurant.hours || 'Set hours', icon: Clock },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-4">
              <item.icon size={16} className="text-gray-400 shrink-0" />
              <div>
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Modules */}
      <div>
        <p className="section-label">AI & Management</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {AI_MODULES.map((m) => (
            <button key={m.path} onClick={() => navigate(m.path ? `/restaurants/${id}/${m.path}` : `/restaurants/${id}`)}
              className="card-sm flex items-center gap-3 text-left hover:shadow-card-hover hover:border-gray-300 transition-all group">
              <div className={`p-2.5 rounded-xl ${m.color} transition-transform group-hover:scale-105 shrink-0`}>
                <m.icon size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 leading-tight">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp AI Agent — session linking */}
      <div>
        <p className="section-label">WhatsApp AI Agent</p>
        <div className="card space-y-3">
          <p className="text-sm text-gray-500">
            Link a connected WhatsApp session to this restaurant. All incoming messages on that session will be handled by the restaurant's AI — menu questions, ordering, tracking.
          </p>

          {waSessions.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">
              No WhatsApp sessions found. Go to the{' '}
              <button onClick={() => navigate('/whatsapp')} className="text-primary-600 underline">WhatsApp page</button>{' '}
              to connect one first.
            </div>
          ) : (
            <div className="space-y-2">
              {waSessions.map((s) => {
                const isLinkedHere = s.restaurantId === id;
                const isLinkedElsewhere = s.restaurantId && s.restaurantId !== id;
                const isConnected = s.status === 'connected';
                return (
                  <div key={s.sessionId} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${isLinkedHere ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name || s.sessionId}</p>
                      <p className="text-xs text-gray-500">
                        {s.phone ? `+${s.phone}` : 'No phone yet'} · {s.status}
                        {isLinkedElsewhere && <span className="ml-1 text-amber-600">(linked to another restaurant)</span>}
                      </p>
                    </div>
                    {isLinkedHere ? (
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                          <CheckCircle2 size={11} /> Active AI Agent
                        </span>
                        <button
                          onClick={() => linkMutation.mutate({ sessionId: s.sessionId, restaurantId: null })}
                          disabled={linkMutation.isLoading}
                          className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                        >
                          <Unlink size={12} /> Unlink
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => linkMutation.mutate({ sessionId: s.sessionId, restaurantId: id! })}
                        disabled={linkMutation.isLoading || !isConnected}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                        title={!isConnected ? 'Session must be connected first' : ''}
                      >
                        <Link2 size={12} /> Link
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Only one session can be the active AI agent per restaurant. Linking a new session automatically replaces the previous one.
          </p>
        </div>
      </div>

      {/* Edit form or info display */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main fields */}
        <div className="lg:col-span-3 card">
          <p className="section-label">Restaurant Information</p>
          {isEditing ? (
            <div className="space-y-4">
              {[
                { label: 'Name', key: 'name', type: 'text' },
                { label: 'Cuisine', key: 'cuisine', type: 'text' },
                { label: 'Address', key: 'address', type: 'text' },
                { label: 'Phone', key: 'phone', type: 'tel' },
                { label: 'Opening Hours', key: 'hours', type: 'text', placeholder: 'Mon-Sun 10am–10pm' },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                  <input type={f.type} className="input-field"
                    value={(form as any)[f.key] || ''} placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Description</label>
                <textarea className="input-field" rows={3}
                  value={form.description || ''}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Delivery Fee (KSh)', key: 'deliveryFee', type: 'number' },
                  { label: 'Min Order (KSh)', key: 'minOrder', type: 'number' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label}</label>
                    <input type="number" className="input-field"
                      value={(form as any)[f.key] || 0}
                      onChange={(e) => setForm({ ...form, [f.key]: parseFloat(e.target.value) })} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <FieldRow label="Name" value={restaurant.name} />
              <FieldRow label="Cuisine" value={restaurant.cuisine} />
              <FieldRow label="Address" value={restaurant.address} />
              <FieldRow label="Phone" value={restaurant.phone || '—'} />
              <FieldRow label="Hours" value={restaurant.hours || '—'} />
              <FieldRow label="Delivery Fee" value={`KSh ${restaurant.deliveryFee}`} />
              <FieldRow label="Min Order" value={`KSh ${restaurant.minOrder || 0}`} />
              <FieldRow label="Currency" value={`${restaurant.currencyCode || 'KES'} (${restaurant.currencySymbol || 'KSh'})`} />
            </div>
          )}
        </div>

        {/* Right: toggles + meta */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <p className="section-label">Status & Features</p>
            {[
              { label: 'Restaurant Open', value: restaurant.isOpen, color: 'bg-emerald-500' },
              { label: 'Promoted', value: restaurant.isPromoted, color: 'bg-gold-500' },
            ].map((t) => (
              <div key={t.label} className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
                <span className="text-sm text-gray-700">{t.label}</span>
                <div className={`w-10 h-5 rounded-full transition-colors ${t.value ? t.color : 'bg-gray-200'} flex items-center px-0.5`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${t.value ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <p className="section-label">Delivery</p>
            <FieldRow label="Min time" value={`${restaurant.deliveryTimeMinutesMin} min`} />
            <FieldRow label="Max time" value={`${restaurant.deliveryTimeMinutesMax} min`} />
            <FieldRow label="Rating" value={`⭐ ${restaurant.rating?.toFixed(1) || '—'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
