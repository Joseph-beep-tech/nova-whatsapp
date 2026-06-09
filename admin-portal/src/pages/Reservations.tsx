/**
 * Reservations.tsx
 * Manage restaurant table reservations — from WhatsApp, voice calls or walk-ins.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { reservationService } from '../services/restaurantAI.service';
import { restaurantService } from '../services/restaurant.service';
import {
  ArrowLeft, Plus, CalendarDays, Users, Phone, Clock,
  MessageSquare, Mic, User, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle, AlertCircle, Coffee, X, Edit,
  RefreshCw,
} from 'lucide-react';

type ResStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';
type ResSource = 'whatsapp' | 'voice_call' | 'walk_in' | 'online' | 'phone';

interface Reservation {
  _id: string;
  customerName: string;
  customerPhone: string;
  partySize: number;
  date: string;
  timeSlot: string;
  tableNumber?: string;
  specialRequests?: string;
  status: ResStatus;
  source: ResSource;
  staffNote?: string;
}

const STATUS_CONFIG: Record<ResStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:    { label: 'Pending',    color: 'bg-yellow-100 text-yellow-700',  icon: Clock },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  seated:     { label: 'Seated',     color: 'bg-green-100 text-green-700',   icon: Coffee },
  completed:  { label: 'Completed',  color: 'bg-gray-100 text-gray-600',     icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-600',       icon: XCircle },
  no_show:    { label: 'No Show',    color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

const SOURCE_CONFIG: Record<ResSource, { label: string; icon: React.ElementType; color: string }> = {
  whatsapp:   { label: 'WhatsApp',   icon: MessageSquare, color: 'text-green-600' },
  voice_call: { label: 'Voice Call', icon: Mic,           color: 'text-purple-600' },
  walk_in:    { label: 'Walk-in',    icon: User,          color: 'text-blue-600' },
  online:     { label: 'Online',     icon: CalendarDays,  color: 'text-gray-600' },
  phone:      { label: 'Phone',      icon: Phone,         color: 'text-orange-600' },
};

const TIME_SLOTS = ['11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];

const emptyForm = {
  customerName: '', customerPhone: '', partySize: 2,
  date: new Date().toISOString().split('T')[0], timeSlot: '19:00',
  tableNumber: '', specialRequests: '', source: 'online' as ResSource,
  staffNote: '',
};

export default function Reservations() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<ResStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: restaurant } = useQuery(['restaurant', restaurantId], () => restaurantService.getById(restaurantId!), { enabled: !!restaurantId });

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>(
    ['reservations', restaurantId, selectedDate],
    () => reservationService.getAll(restaurantId!, { date: selectedDate }),
    { enabled: !!restaurantId, refetchInterval: 30000 }
  );

  const createMutation = useMutation(
    (data: Record<string, any>) => reservationService.create({ ...data, restaurantId }),
    { onSuccess: () => { qc.invalidateQueries(['reservations', restaurantId]); setShowModal(false); setForm(emptyForm); } }
  );

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: Record<string, any> }) => reservationService.update(id, data),
    { onSuccess: () => { qc.invalidateQueries(['reservations', restaurantId]); setShowModal(false); setEditingRes(null); } }
  );

  const cancelMutation = useMutation(
    (id: string) => reservationService.cancel(id),
    { onSuccess: () => qc.invalidateQueries(['reservations', restaurantId]) }
  );

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const displayed = reservations.filter((r) => !statusFilter || r.status === statusFilter);

  const openEdit = (r: Reservation) => {
    setEditingRes(r);
    setForm({
      customerName: r.customerName, customerPhone: r.customerPhone,
      partySize: r.partySize, date: r.date.split('T')[0], timeSlot: r.timeSlot,
      tableNumber: r.tableNumber || '', specialRequests: r.specialRequests || '',
      source: r.source, staffNote: r.staffNote || '',
    });
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (editingRes) {
      updateMutation.mutate({ id: editingRes._id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const totalGuests = displayed.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(`/restaurants/${restaurantId}/details`)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{restaurant?.name} — Reservations</h1>
          <p className="text-sm text-gray-500">Table bookings from WhatsApp, voice calls and walk-ins</p>
        </div>
        <button onClick={() => { setEditingRes(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Booking
        </button>
      </div>

      {/* Date Nav + Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm px-4 py-2 border">
          <button onClick={() => shiftDate(-1)} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
          <input
            type="date" value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm font-semibold text-gray-900 border-none outline-none cursor-pointer"
          />
          <button onClick={() => shiftDate(1)} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
        </div>
        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Total Bookings', value: displayed.filter((r) => r.status !== 'cancelled').length },
            { label: 'Expected Guests', value: totalGuests },
            { label: 'Pending', value: displayed.filter((r) => r.status === 'pending').length },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border px-4 py-2 text-center shadow-sm">
              <p className="text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('')} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${!statusFilter ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>All</button>
        {(Object.keys(STATUS_CONFIG) as ResStatus[]).map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-primary-500 text-white' : `${STATUS_CONFIG[s].color} hover:opacity-80`}`}>
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>

      {/* Reservations list */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading reservations...</div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16">
          <CalendarDays size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No bookings for this date</p>
          <p className="text-gray-400 text-sm mt-1">Reservations made via WhatsApp or voice calls appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map((res) => {
            const StatusCfg = STATUS_CONFIG[res.status];
            const SourceCfg = SOURCE_CONFIG[res.source];
            const StatusIcon = StatusCfg.icon;
            const SourceIcon = SourceCfg.icon;
            return (
              <div key={res._id} className="card hover:shadow-lg transition-shadow">
                <div className="flex items-center gap-4">
                  <div className="text-center w-16 shrink-0">
                    <p className="text-lg font-bold text-gray-900">{res.timeSlot}</p>
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                      <Users size={12} />
                      {res.partySize}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900">{res.customerName}</p>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${StatusCfg.color}`}>
                        <StatusIcon size={11} />{StatusCfg.label}
                      </span>
                      <span className={`flex items-center gap-1 text-xs ${SourceCfg.color}`}>
                        <SourceIcon size={11} />{SourceCfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Phone size={12} />{res.customerPhone}</span>
                      {res.tableNumber && <span>Table {res.tableNumber}</span>}
                      {res.specialRequests && <span className="truncate italic">"{res.specialRequests}"</span>}
                    </div>
                    {res.staffNote && <p className="text-xs text-blue-600 mt-1">📝 {res.staffNote}</p>}
                  </div>
                  <div className="flex gap-2">
                    {res.status === 'pending' && (
                      <button onClick={() => updateMutation.mutate({ id: res._id, data: { status: 'confirmed', confirmedAt: new Date() } })}
                        className="text-xs px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        Confirm
                      </button>
                    )}
                    {res.status === 'confirmed' && (
                      <button onClick={() => updateMutation.mutate({ id: res._id, data: { status: 'seated' } })}
                        className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                        Seated
                      </button>
                    )}
                    <button onClick={() => openEdit(res)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Edit size={16} /></button>
                    {res.status !== 'cancelled' && (
                      <button onClick={() => { if (confirm('Cancel booking?')) cancelMutation.mutate(res._id); }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><XCircle size={16} /></button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingRes ? 'Edit Booking' : 'New Booking'}</h2>
              <button onClick={() => { setShowModal(false); setEditingRes(null); }} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                  <input className="input-field" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input className="input-field" value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} placeholder="+254..." />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" className="input-field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                  <select className="input-field" value={form.timeSlot} onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}>
                    {TIME_SLOTS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Party Size</label>
                  <input type="number" min={1} max={50} className="input-field" value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Table No.</label>
                  <input className="input-field" value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} placeholder="e.g. 7, VIP-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                  <select className="input-field" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as ResSource })}>
                    {(Object.keys(SOURCE_CONFIG) as ResSource[]).map((s) => <option key={s} value={s}>{SOURCE_CONFIG[s].label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                <input className="input-field" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} placeholder="Allergens, high chair, birthday cake..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Staff Note</label>
                <input className="input-field" value={form.staffNote} onChange={(e) => setForm({ ...form, staffNote: e.target.value })} placeholder="Internal note..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSubmit} disabled={createMutation.isLoading || updateMutation.isLoading}
                  className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {(createMutation.isLoading || updateMutation.isLoading) && <RefreshCw size={16} className="animate-spin" />}
                  {editingRes ? 'Update Booking' : 'Save Booking'}
                </button>
                <button onClick={() => { setShowModal(false); setEditingRes(null); }} className="flex-1 btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
