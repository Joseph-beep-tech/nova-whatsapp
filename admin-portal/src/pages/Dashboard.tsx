import { useQuery } from 'react-query';
import { restaurantService } from '../services/restaurant.service';
import { orderService } from '../services/order.service';
import { riderService } from '../services/rider.service';
import { paymentService } from '../services/payment.service';
import {
  ShoppingCart, DollarSign, TrendingUp, AlertCircle,
  Bell, Store, Bike, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Zap, Utensils,
} from 'lucide-react';
import { OrderStatus } from '../types';
import { useMemo, useState, useEffect } from 'react';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing',
  ready: 'Ready', assigned: 'Assigned', picked_up: 'Picked Up',
  on_the_way: 'On the Way', delivered: 'Delivered', cancelled: 'Cancelled',
};

const STATUS_BAR_COLOR: Partial<Record<OrderStatus, string>> = {
  delivered: 'bg-emerald-500', cancelled: 'bg-red-400',
  on_the_way: 'bg-violet-500', preparing: 'bg-orange-400',
  pending: 'bg-amber-400', confirmed: 'bg-blue-500',
};

function KPICard({
  label, value, sub, icon: Icon, iconBg, trend, trendUp,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; iconBg: string; trend?: string; trendUp?: boolean;
}) {
  return (
    <div className="card p-5 flex gap-4 items-start hover:shadow-card-hover transition-shadow">
      <div className={`stat-icon ${iconBg}`}>
        <Icon size={20} className="text-current" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5 leading-tight">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
          {trendUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { data: restaurants = [] } = useQuery('restaurants', restaurantService.getAll);
  const { data: orders = [] } = useQuery('orders', orderService.getAll);
  const { data: riders = [] } = useQuery('riders', riderService.getAll);
  const { data: payments = [] } = useQuery('payments', paymentService.getAll);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((k) => k + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);
    const yesterday = new Date(today.getTime() - 86400000);

    const delivered = orders.filter((o) => o.status === 'delivered');
    const pending = orders.filter((o) => ['pending','confirmed','preparing'].includes(o.status));
    const active = orders.filter((o) => ['assigned','picked_up','on_the_way'].includes(o.status));

    const rev = (list: typeof orders) => list.reduce((s, o) => s + o.total, 0);
    const revenueToday     = rev(delivered.filter((o) => new Date(o.createdAt) >= today));
    const revenueYesterday = rev(delivered.filter((o) => { const d = new Date(o.createdAt); return d >= yesterday && d < today; }));
    const revenueWeek      = rev(delivered.filter((o) => new Date(o.createdAt) >= weekAgo));
    const revenueMonth     = rev(delivered.filter((o) => new Date(o.createdAt) >= monthAgo));
    const totalRevenue     = rev(delivered);

    const ordersToday     = orders.filter((o) => new Date(o.createdAt) >= today).length;
    const ordersYesterday = orders.filter((o) => { const d = new Date(o.createdAt); return d >= yesterday && d < today; }).length;

    const delayed = orders.filter((o) => {
      if (['delivered','cancelled'].includes(o.status)) return false;
      return (now.getTime() - new Date(o.createdAt).getTime()) / 60000 > 60;
    });
    const availableRiders = riders.filter((r) => r.status === 'available').length;
    const paymentFails = payments.filter((p) => p.status === 'failed').length;

    const revenueByRestaurant = delivered.reduce((acc, o) => {
      acc[o.restaurantId] = (acc[o.restaurantId] || 0) + o.total;
      return acc;
    }, {} as Record<string, number>);
    const topRestaurants = Object.entries(revenueByRestaurant)
      .sort(([, a], [, b]) => b - a).slice(0, 6)
      .map(([id, revenue]) => ({ id, revenue, name: restaurants.find((r) => r.id === id)?.name || id }));

    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1; return acc;
    }, {} as Record<OrderStatus, number>);

    const avgOrder = delivered.length ? totalRevenue / delivered.length : 0;
    const todayChange = ordersYesterday > 0
      ? ((ordersToday - ordersYesterday) / ordersYesterday * 100).toFixed(1) + '%'
      : undefined;
    const revChange = revenueYesterday > 0
      ? ((revenueToday - revenueYesterday) / revenueYesterday * 100).toFixed(1) + '%'
      : undefined;

    return {
      ordersToday, ordersWeek: orders.filter((o) => new Date(o.createdAt) >= weekAgo).length,
      ordersMonth: orders.filter((o) => new Date(o.createdAt) >= monthAgo).length,
      totalOrders: orders.length, revenueToday, revenueWeek, revenueMonth,
      totalRevenue, pendingOrders: pending.length, activeDeliveries: active.length,
      deliveredOrders: delivered.length, cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
      avgOrder, topRestaurants, byStatus, availableRiders, totalRiders: riders.length,
      onlineRestaurants: restaurants.filter((r) => r.isOpen).length,
      totalRestaurants: restaurants.length, platformCommission: totalRevenue * 0.2,
      alerts: { delayed: delayed.length, riderShortage: availableRiders < 3 && active.length > availableRiders, paymentFails },
      todayChange, revChange, revTrendUp: revenueToday >= revenueYesterday, orderTrendUp: ordersToday >= ordersYesterday,
    };
  }, [orders, restaurants, riders, payments]);

  const recentOrders = useMemo(() =>
    [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
    [orders]);

  const hasAlerts = stats.alerts.delayed > 0 || stats.alerts.riderShortage || stats.alerts.paymentFails > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">
            {new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="p-1.5 bg-amber-100 rounded-lg shrink-0 mt-0.5">
            <Bell size={16} className="text-amber-600" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold text-amber-900">Attention Required</p>
            {stats.alerts.delayed > 0 && (
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <AlertCircle size={12} /> {stats.alerts.delayed} order{stats.alerts.delayed > 1 ? 's' : ''} delayed over 60 minutes
              </p>
            )}
            {stats.alerts.riderShortage && (
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <AlertCircle size={12} /> Rider shortage — {stats.activeDeliveries} active deliveries, {stats.availableRiders} available
              </p>
            )}
            {stats.alerts.paymentFails > 0 && (
              <p className="text-xs text-amber-800 flex items-center gap-1.5">
                <AlertCircle size={12} /> {stats.alerts.paymentFails} failed payment{stats.alerts.paymentFails > 1 ? 's' : ''} need review
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Orders Today" value={stats.ordersToday} sub={`${stats.ordersWeek} this week`}
          icon={ShoppingCart} iconBg="bg-blue-50 text-blue-600"
          trend={stats.todayChange} trendUp={stats.orderTrendUp} />
        <KPICard label="Revenue Today" value={`KSh ${stats.revenueToday.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`}
          sub={`KSh ${stats.revenueWeek.toLocaleString()} this week`}
          icon={DollarSign} iconBg="bg-emerald-50 text-emerald-600"
          trend={stats.revChange} trendUp={stats.revTrendUp} />
        <KPICard label="Active Deliveries" value={stats.activeDeliveries}
          sub={`${stats.pendingOrders} pending confirmation`}
          icon={Bike} iconBg="bg-violet-50 text-violet-600" />
        <KPICard label="Online Restaurants" value={`${stats.onlineRestaurants}/${stats.totalRestaurants}`}
          sub={`${stats.availableRiders} riders available`}
          icon={Store} iconBg="bg-gold-50 text-gold-600" />
      </div>

      {/* KPI row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Revenue" value={`KSh ${stats.totalRevenue.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`}
          sub="All time, delivered orders" icon={TrendingUp} iconBg="bg-teal-50 text-teal-600" />
        <KPICard label="Platform Commission" value={`KSh ${stats.platformCommission.toLocaleString('en-KE', { minimumFractionDigits: 0 })}`}
          sub="20% of delivered revenue" icon={Zap} iconBg="bg-gold-50 text-gold-600" />
        <KPICard label="Avg Order Value" value={`KSh ${stats.avgOrder.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`}
          sub="Per completed order" icon={Utensils} iconBg="bg-orange-50 text-orange-600" />
        <KPICard label="Completed Orders" value={stats.deliveredOrders}
          sub={`${stats.cancelledOrders} cancelled`}
          icon={CheckCircle2} iconBg="bg-emerald-50 text-emerald-600" />
      </div>

      {/* Mid section: Order pipeline + Top restaurants */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order pipeline */}
        <div className="card col-span-1">
          <p className="section-label">Order Pipeline</p>
          <div className="space-y-3 mt-1">
            {(Object.entries(stats.byStatus) as [OrderStatus, number][])
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-24 shrink-0">{STATUS_LABEL[status]}</span>
                <div className="flex-1 bg-surface rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${STATUS_BAR_COLOR[status] || 'bg-gray-400'}`}
                    style={{ width: `${stats.totalOrders ? (count / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top restaurants */}
        <div className="card col-span-1 lg:col-span-2">
          <p className="section-label">Top Restaurants by Revenue</p>
          {stats.topRestaurants.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2 mt-1">
              {stats.topRestaurants.map((r, i) => {
                const maxRev = stats.topRestaurants[0].revenue || 1;
                return (
                  <div key={r.id} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400 w-4 shrink-0">{i + 1}</span>
                    <span className="text-sm text-gray-800 font-medium flex-1 truncate">{r.name}</span>
                    <div className="w-24 bg-surface rounded-full h-1.5 hidden sm:block overflow-hidden">
                      <div className="h-full rounded-full bg-gold-500" style={{ width: `${(r.revenue / maxRev) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 w-28 text-right shrink-0">
                      KSh {r.revenue.toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <p className="section-label mb-0">Recent Orders</p>
          <a href="/orders" className="text-xs text-gold-600 hover:text-gold-700 font-medium flex items-center gap-1">
            View all <ArrowUpRight size={12} />
          </a>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Restaurant</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td><span className="font-mono text-xs text-gray-500">#{order.id.slice(-6).toUpperCase()}</span></td>
                  <td className="font-medium text-gray-900 max-w-[140px] truncate">
                    {restaurants.find((r) => r.id === order.restaurantId)?.name || order.restaurantId}
                  </td>
                  <td>{order.customerName}</td>
                  <td className="font-semibold">KSh {order.total.toLocaleString()}</td>
                  <td>
                    <span className={`status-${order.status}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="text-gray-400 text-xs">
                    {new Date(order.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
