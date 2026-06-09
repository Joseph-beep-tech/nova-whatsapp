import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link, useNavigate } from 'react-router-dom';
import { restaurantService } from '../services/restaurant.service';
import { Plus, Edit, Trash2, Eye, Search, Star, Clock, MapPin, Wifi, WifiOff, ChevronRight, MoreVertical, Brain, CalendarDays } from 'lucide-react';
import { useState } from 'react';

const CUISINE_COLORS: Record<string, string> = {
  'Fast Food': 'bg-orange-100 text-orange-700',
  'Italian':   'bg-red-100 text-red-700',
  'Indian':    'bg-yellow-100 text-yellow-700',
  'Chinese':   'bg-rose-100 text-rose-700',
  'Kenyan':    'bg-green-100 text-green-700',
  'Pizza':     'bg-orange-100 text-orange-700',
  'Burgers':   'bg-amber-100 text-amber-700',
  'Seafood':   'bg-blue-100 text-blue-700',
  'Healthy':   'bg-teal-100 text-teal-700',
};

export default function Restaurants() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const { data: restaurants = [], isLoading } = useQuery('restaurants', restaurantService.getAll);

  const toggleMutation = useMutation(
    ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      const r = restaurants.find((x) => x.id === id);
      if (!r) throw new Error();
      const fd = new FormData();
      Object.entries(r).forEach(([k, v]) => {
        if (v !== undefined && v !== null && k !== 'id' && k !== 'imageUrl') {
          fd.append(k, k === 'features' && Array.isArray(v) ? JSON.stringify(v) : String(v));
        }
      });
      fd.set('isOpen', String(isOpen));
      return restaurantService.update(id, fd);
    },
    { onSuccess: () => qc.invalidateQueries('restaurants') }
  );

  const deleteMutation = useMutation(restaurantService.delete, {
    onSuccess: () => qc.invalidateQueries('restaurants'),
  });

  const filtered = restaurants.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.cuisine.toLowerCase().includes(search.toLowerCase()) ||
    r.address.toLowerCase().includes(search.toLowerCase())
  );

  const online = restaurants.filter((r) => r.isOpen).length;

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card p-0 overflow-hidden">
          <div className="skeleton h-44 rounded-none rounded-t-2xl" />
          <div className="p-5 space-y-2">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Restaurants</h1>
          <p className="page-subtitle">{restaurants.length} registered · {online} online now</p>
        </div>
        <Link to="/restaurants/new" className="btn-primary">
          <Plus size={16} /> Add Restaurant
        </Link>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: 'All', count: restaurants.length, active: true },
          { label: 'Open', count: online },
          { label: 'Closed', count: restaurants.length - online },
        ].map((p) => (
          <div key={p.label} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors
            ${p.active ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-gray-600 border-surface-border hover:border-gray-300'}`}>
            {p.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${p.active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{p.count}</span>
          </div>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9 w-64" placeholder="Search restaurants…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="card text-center py-20">
          <p className="text-gray-400 font-medium">No restaurants found</p>
          <p className="text-gray-300 text-sm mt-1">Try adjusting your search or add a new restaurant</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r) => {
            const cuisineColor = CUISINE_COLORS[r.cuisine] || 'bg-gray-100 text-gray-600';
            return (
              <div key={r.id} className="card p-0 overflow-hidden group hover:shadow-card-hover transition-all duration-200">
                {/* Image */}
                <div className="relative h-44 overflow-hidden">
                  <img
                    src={`http://localhost:4000${r.imageUrl}`}
                    alt={r.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(r.name)}&size=400&background=C9A84C&color=fff&bold=true`; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                  {/* Status badge */}
                  <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold backdrop-blur-sm ${r.isOpen ? 'bg-emerald-500/90 text-white' : 'bg-black/50 text-white/80'}`}>
                    {r.isOpen ? <Wifi size={10} /> : <WifiOff size={10} />}
                    {r.isOpen ? 'Open' : 'Closed'}
                  </div>

                  {r.isPromoted && (
                    <div className="absolute top-3 right-10 bg-gold-500 text-white px-2 py-1 rounded-full text-xs font-bold">
                      Promoted
                    </div>
                  )}

                  {/* Context menu */}
                  <div className="absolute top-3 right-3">
                    <button onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                      className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-lg backdrop-blur-sm transition-colors">
                      <MoreVertical size={14} />
                    </button>
                    {menuOpenId === r.id && (
                      <div className="absolute top-full right-0 mt-1 w-44 bg-white border border-surface-border rounded-xl shadow-card-hover z-10 py-1 text-sm" onClick={() => setMenuOpenId(null)}>
                        <Link to={`/restaurants/${r.id}/details`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface text-gray-700"><Eye size={14} /> View Details</Link>
                        <Link to={`/restaurants/${r.id}/menu`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface text-gray-700"><Edit size={14} /> Edit Menu</Link>
                        <Link to={`/restaurants/${r.id}/knowledge`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface text-gray-700"><Brain size={14} /> Knowledge Base</Link>
                        <Link to={`/restaurants/${r.id}/reservations`} className="flex items-center gap-2 px-3 py-2 hover:bg-surface text-gray-700"><CalendarDays size={14} /> Reservations</Link>
                        <div className="border-t border-surface-border my-1" />
                        <button onClick={() => toggleMutation.mutate({ id: r.id, isOpen: !r.isOpen })}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface text-gray-700">
                          {r.isOpen ? <WifiOff size={14} /> : <Wifi size={14} />} {r.isOpen ? 'Mark Closed' : 'Mark Open'}
                        </button>
                        <button onClick={() => { if (confirm(`Delete ${r.name}?`)) deleteMutation.mutate(r.id); }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-gray-900 text-base leading-tight">{r.name}</h3>
                    <span className={`badge text-xs shrink-0 ${cuisineColor}`}>{r.cuisine}</span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1"><Star size={11} className="text-gold-500 fill-gold-500" /> {r.rating.toFixed(1)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {r.deliveryTimeMinutesMin}–{r.deliveryTimeMinutesMax} min</span>
                    <span>·</span>
                    <span className="flex items-center gap-1 truncate"><MapPin size={11} /> {r.address.split(',')[0]}</span>
                  </div>

                  <div className="flex gap-2">
                    <Link to={`/restaurants/${r.id}`} className="btn-secondary flex-1 py-2 text-xs">
                      <Eye size={13} /> Orders
                    </Link>
                    <Link to={`/restaurants/${r.id}/details`} className="btn-primary flex-1 py-2 text-xs">
                      Manage <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
