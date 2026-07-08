import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { orderService } from '../services/order.service';
import { restaurantService } from '../services/restaurant.service';
import { paymentService } from '../services/payment.service';
import { riderService } from '../services/rider.service';
import { restaurantAnalyticsService } from '../services/restaurantAI.service';
import {
  TrendingUp, TrendingDown, Timer,
  DollarSign, ShoppingCart, XCircle, BarChart2, UserCheck, RefreshCw,
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

  const [selectedRid, setSelectedRid] = useState<string>('');

  const { data: popularItems = [], isLoading: piLoading } = useQuery(
    ['popular-items', selectedRid],
    () => restaurantAnalyticsService.getPopularItems(selectedRid),
    { enabled: !!selectedRid }
  );
  const { data: demandData = [], isLoading: demandLoading } = useQuery(
    ['demand', selectedRid],
    () => restaurantAnalyticsService.getDemand(selectedRid),
    { enabled: !!selectedRid }
  );
  const { data: customersData, isLoading: custLoading } = useQuery(
    ['customers', selectedRid],
    () => restaurantAnalyticsService.getCustomers(selectedRid),
    { enabled: !!selectedRid }
  );

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

      {/* ── Restaurant Intelligence ─────────────────────────────────────────────── */}
      <div className="border-t border-border pt-6 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-gold-500" />
            <h2 className="text-base font-semibold text-gray-900">Restaurant Intelligence</h2>
          </div>
          <select
            value={selectedRid}
            onChange={(e) => setSelectedRid(e.target.value)}
            className="input text-sm py-1.5 pr-8 w-64"
          >
            <option value="">Select a restaurant…</option>
            {restaurants.map((r: any) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {!selectedRid && (
          <div className="card flex items-center justify-center h-32 text-sm text-gray-400">
            Choose a restaurant above to see its AI-powered intelligence
          </div>
        )}

        {selectedRid && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Popular Items */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Top Items (30 days)</p>
                {piLoading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
              </div>
              {popularItems.length === 0 && !piLoading && (
                <p className="text-sm text-gray-400">No order data yet</p>
              )}
              <div className="space-y-2.5">
                {popularItems.slice(0, 8).map((item) => (
                  <MiniBar
                    key={item.name}
                    label={item.name}
                    value={item.totalQty}
                    max={popularItems[0]?.totalQty || 1}
                    color="bg-gold-500"
                  />
                ))}
              </div>
            </div>

            {/* Demand Heatmap */}
            <div className="card overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label">Demand Heatmap (7 days)</p>
                {demandLoading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
              </div>
              {demandData.length === 0 && !demandLoading ? (
                <p className="text-sm text-gray-400">No demand data yet</p>
              ) : (
                <HeatmapGrid data={demandData} />
              )}
            </div>

            {/* Customer CLV */}
            <div className="card lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserCheck size={15} className="text-blue-500" />
                  <p className="section-label">Customer Intelligence (30 days)</p>
                </div>
                {custLoading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
              </div>

              {customersData && (
                <>
                  {/* Retention summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {[
                      { label: 'Unique Customers', value: customersData.last30Days.uniqueCustomers, color: 'text-blue-600' },
                      { label: 'New Customers', value: customersData.last30Days.newCustomers, color: 'text-emerald-600' },
                      { label: 'Returning', value: customersData.last30Days.returningCustomers, color: 'text-gold-600' },
                      { label: 'Retention Rate', value: `${customersData.last30Days.retentionRate.toFixed(1)}%`, color: 'text-purple-600' },
                    ].map((s) => (
                      <div key={s.label} className="bg-surface rounded-xl p-3 text-center">
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Top customers table */}
                  {customersData.topCustomers.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b border-border">
                            <th className="pb-2 pr-4 font-medium">#</th>
                            <th className="pb-2 pr-4 font-medium">Customer</th>
                            <th className="pb-2 pr-4 font-medium">Phone</th>
                            <th className="pb-2 pr-4 font-medium text-right">Orders</th>
                            <th className="pb-2 pr-4 font-medium text-right">Total Spend</th>
                            <th className="pb-2 font-medium text-right">Avg Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customersData.topCustomers.map((c, i) => (
                            <tr key={c.phone} className="border-b border-border/50 hover:bg-surface transition-colors">
                              <td className="py-2 pr-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                              <td className="py-2 pr-4 font-medium text-gray-900">{c.customerName || '—'}</td>
                              <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{c.phone}</td>
                              <td className="py-2 pr-4 text-right text-gray-700">{c.orderCount}</td>
                              <td className="py-2 pr-4 text-right font-semibold text-emerald-600">
                                KSh {c.totalSpend.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                              </td>
                              <td className="py-2 text-right text-gray-600">
                                KSh {c.avgOrderValue.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {!custLoading && !customersData && (
                <p className="text-sm text-gray-400">No customer data yet</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Heatmap helper ─────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function HeatmapGrid({ data }: { data: Array<{ hour: number; dayOfWeek: number; orders: number }> }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  const lookup = new Map(data.map((d) => [`${d.dayOfWeek}-${d.hour}`, d.orders]));

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[420px]">
        {/* Hour header */}
        <div className="flex">
          <div className="w-10 shrink-0" />
          {HOURS.filter((h) => h % 3 === 0).map((h) => (
            <div key={h} className="flex-1 text-center text-xs text-gray-400" style={{ minWidth: 0 }}>
              {h}h
            </div>
          ))}
        </div>
        {/* Rows per day */}
        {DAY_NAMES.map((day, dow) => (
          <div key={day} className="flex items-center mt-0.5">
            <span className="w-10 shrink-0 text-xs text-gray-500">{day}</span>
            {HOURS.map((h) => {
              const orders = lookup.get(`${dow}-${h}`) ?? 0;
              const intensity = maxOrders ? orders / maxOrders : 0;
              const bg = intensity === 0
                ? 'bg-gray-100'
                : intensity < 0.25 ? 'bg-gold-100'
                : intensity < 0.5 ? 'bg-gold-300'
                : intensity < 0.75 ? 'bg-gold-500'
                : 'bg-gold-700';
              return (
                <div
                  key={h}
                  title={`${day} ${h}:00 — ${orders} orders`}
                  className={`flex-1 h-5 ${bg} rounded-sm mx-px cursor-default transition-colors`}
                  style={{ minWidth: 0 }}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>Low</span>
          {['bg-gray-100','bg-gold-100','bg-gold-300','bg-gold-500','bg-gold-700'].map((c) => (
            <div key={c} className={`w-4 h-3 rounded-sm ${c}`} />
          ))}
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
