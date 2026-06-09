import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { orderService } from '../services/order.service';
import { restaurantService } from '../services/restaurant.service';
import { paymentService } from '../services/payment.service';
import { riderService } from '../services/rider.service';
import {
  TrendingUp, TrendingDown, Timer, Users, Flame,
  DollarSign, ShoppingCart, XCircle, Bike,
} from 'lucide-react';

function getDayKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function MetricCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color: string; trend?: { value: string; up: boolean };
}) {
  return (
    <div className="card p-5 flex items-start gap-4 hover:shadow-card-hover transition-shadow">
      <div className={`stat-icon ${color}`}><Icon size={20} /></div>
      <div className="flex-1">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend.up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {trend.value}
        </div>
      )}
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{label}</span>
      <div className="flex-1 bg-surface rounded-full h-2 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-14 text-right shrink-0">
        {typeof value === 'number' && value > 100 ? `KSh ${value.toLocaleString('en-KE', { maximumFractionDigits: 0 })}` : value}
      </span>
    </div>
  );
}

export default function Analytics() {
  const { data: orders = [], isLoading: ol } = useQuery('orders', orderService.getAll);
  const { data: restaurants = [] } = useQuery('restaurants', restaurantService.getAll);
  const { data: payments = [] } = useQuery('payments', paymentService.getAll);
  const { data: riders = [] } = useQuery('riders', riderService.getAll);

  const data = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    const cancellationRate = orders.length ? (cancelled.length / orders.length) * 100 : 0;

    const avgDelivery = delivered.reduce((sum, o) => {
      const step = o.statusHistory?.find((s: any) => s.status === 'delivered');
      return step ? sum + (new Date(step.timestamp).getTime() - new Date(o.createdAt).getTime()) / 60000 : sum;
    }, 0) / (delivered.length || 1);

    const revByDay = delivered.reduce((acc, o) => {
      const k = getDayKey(o.createdAt);
      acc[k] = (acc[k] || 0) + o.total;
      return acc;
    }, {} as Record<string, number>);

    const last7 = Object.entries(revByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7);

    const maxDayRev = Math.max(...last7.map(([, v]) => v), 1);

    const revenueByRest = delivered.reduce((acc, o) => {
      acc[o.restaurantId] = (acc[o.restaurantId] || 0) + o.total;
      return acc;
    }, {} as Record<string, number>);

    const topRestaurants = Object.entries(revenueByRest)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([id, rev]) => ({ name: restaurants.find((r) => r.id === id)?.name || id, rev }));

    const cuisineCounts = restaurants.reduce((acc, r) => {
      acc[r.cuisine] = (acc[r.cuisine] || 0) + 1; return acc;
    }, {} as Record<string, number>);

    const topCuisines = Object.entries(cuisineCounts).sort(([,a],[,b]) => b-a).slice(0,5);

    const paymentMix = payments.reduce((acc, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount; return acc;
    }, {} as Record<string, number>);

    const maxPay = Math.max(...Object.values(paymentMix), 1);

    const riderStatus = riders.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1; return acc;
    }, { available: 0, busy: 0, offline: 0 } as Record<string, number>);

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

    return { delivered: delivered.length, cancelled: cancelled.length, cancellationRate, avgDelivery, last7, maxDayRev, topRestaurants, topCuisines, paymentMix, maxPay, riderStatus, totalRevenue };
  }, [orders, restaurants, payments, riders]);

  if (ol) return <div className="text-center py-20 text-gray-400">Loading analytics…</div>;

  const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Platform performance overview</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Revenue" value={`KSh ${data.totalRevenue.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`}
          sub="All-time payments" icon={DollarSign} color="bg-emerald-50 text-emerald-600" />
        <MetricCard label="Completed Orders" value={data.delivered.toLocaleString()}
          sub={`${data.cancelled} cancelled`} icon={ShoppingCart} color="bg-blue-50 text-blue-600" />
        <MetricCard label="Cancellation Rate" value={`${data.cancellationRate.toFixed(1)}%`}
          sub="Of all orders" icon={XCircle} color={data.cancellationRate > 10 ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'}
          trend={{ value: data.cancellationRate > 10 ? 'High' : 'Good', up: data.cancellationRate <= 10 }} />
        <MetricCard label="Avg Delivery Time" value={`${Math.round(data.avgDelivery)} min`}
          sub="Door-to-door" icon={Timer} color="bg-orange-50 text-orange-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue sparkline */}
        <div className="card">
          <p className="section-label">Revenue — Last 7 Days</p>
          {data.last7.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-gray-300 text-sm">No data</div>
          ) : (
            <div className="mt-3">
              <div className="flex items-end gap-1.5 h-28">
                {data.last7.map(([day, rev]) => {
                  const pct = data.maxDayRev ? (rev / data.maxDayRev) * 100 : 0;
                  const d = new Date(day);
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none z-10">
                        KSh {rev.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="w-full bg-gold-500 rounded-t-md transition-all duration-500 hover:bg-gold-600 cursor-default"
                        style={{ height: `${Math.max(pct, 4)}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 mt-1">
                {data.last7.map(([day]) => (
                  <div key={day} className="flex-1 text-center text-xs text-gray-400">
                    {DAY_LABELS[new Date(day).getDay()]}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top restaurants */}
        <div className="card">
          <p className="section-label">Top Restaurants</p>
          <div className="space-y-3 mt-2">
            {data.topRestaurants.length === 0
              ? <p className="text-sm text-gray-400">No data</p>
              : data.topRestaurants.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-400 w-4">{i+1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{r.name}</span>
                  <div className="w-20 bg-surface rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${(r.rev / (data.topRestaurants[0].rev || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 w-24 text-right">
                    KSh {r.rev.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment mix */}
        <div className="card">
          <p className="section-label">Payment Methods</p>
          <div className="space-y-3 mt-2">
            {Object.entries(data.paymentMix).map(([method, amount]) => (
              <MiniBar key={method} label={method.toUpperCase()} value={amount} max={data.maxPay} color="bg-blue-500" />
            ))}
            {Object.keys(data.paymentMix).length === 0 && <p className="text-sm text-gray-400">No payment data</p>}
          </div>
        </div>

        {/* Cuisines */}
        <div className="card">
          <p className="section-label">Cuisine Distribution</p>
          <div className="space-y-3 mt-2">
            {data.topCuisines.map(([cuisine, count]) => (
              <MiniBar key={cuisine} label={cuisine} value={count} max={data.topCuisines[0]?.[1] || 1} color="bg-gold-500" />
            ))}
          </div>
        </div>

        {/* Rider status */}
        <div className="card">
          <p className="section-label">Rider Availability</p>
          <div className="space-y-4 mt-3">
            {[
              { label: 'Available', key: 'available', color: 'bg-emerald-500' },
              { label: 'Busy', key: 'busy', color: 'bg-amber-500' },
              { label: 'Offline', key: 'offline', color: 'bg-gray-400' },
            ].map((s) => {
              const count = data.riderStatus[s.key] || 0;
              const total = riders.length || 1;
              return (
                <div key={s.key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600">{s.label}</span>
                    <span className="font-semibold text-gray-900">{count} <span className="text-gray-400 font-normal">/ {total}</span></span>
                  </div>
                  <div className="bg-surface rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full ${s.color}`} style={{ width: `${(count/total)*100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
