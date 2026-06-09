import { useQuery, useMutation, useQueryClient } from 'react-query';
import { orderService } from '../services/order.service';
import { restaurantService } from '../services/restaurant.service';
import { riderService } from '../services/rider.service';
import { paymentService } from '../services/payment.service';
import { Search, Filter, Eye, X, Package, MapPin, User, Bike, CreditCard, Clock, ChevronDown, CheckCircle2, RefreshCw } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useEffect, useState } from 'react';

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready',
  assigned: 'Assigned', picked_up: 'Picked Up', on_the_way: 'On the Way',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready',
  ready: 'assigned', assigned: 'picked_up', picked_up: 'on_the_way',
  on_the_way: 'delivered',
};

export default function Orders() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const { data: orders = [], isLoading } = useQuery('orders', orderService.getAll, { refetchInterval: 15000 });
  const { data: restaurants = [] } = useQuery('restaurants', restaurantService.getAll);
  const { data: riders = [] } = useQuery('riders', riderService.getAll);

  const updateStatusMutation = useMutation(
    ({ id, status }: { id: string; status: OrderStatus }) => orderService.updateStatus(id, status),
    { onSuccess: () => qc.invalidateQueries('orders') }
  );

  const assignRiderMutation = useMutation(
    ({ orderId, riderId }: { orderId: string; riderId: string }) => orderService.assignRider(orderId, riderId),
    {
      onSuccess: () => {
        qc.invalidateQueries('orders');
        if (selectedOrder) qc.invalidateQueries(['order-tracking', selectedOrder.id]);
      },
    }
  );

  const { data: tracking, refetch: refetchTracking } = useQuery(
    ['order-tracking', selectedOrder?.id],
    () => orderService.getTracking(selectedOrder!.id),
    { enabled: !!selectedOrder }
  );

  const { data: payment, refetch: refetchPayment } = useQuery(
    ['payment', selectedOrder?.id],
    () => paymentService.getByOrder(selectedOrder!.id),
    { enabled: !!selectedOrder }
  );

  useEffect(() => {
    if (selectedOrder) setSelectedRiderId(selectedOrder.driverId ?? '');
    else setSelectedRiderId('');
  }, [selectedOrder]);

  const availableRiders = riders.filter((r) => r.status === 'available' || r.id === selectedOrder?.driverId);

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.id.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchRest = restaurantFilter === 'all' || o.restaurantId === restaurantFilter;
    return matchSearch && matchStatus && matchRest;
  });

  const totalRevenue = filtered.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.total, 0);
  const getRestName = (id: string) => restaurants.find((r) => r.id === id)?.name || id;

  const STATUS_TABS: { value: OrderStatus | 'all'; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: orders.length },
    { value: 'pending', label: 'Pending', count: orders.filter((o) => o.status === 'pending').length },
    { value: 'preparing', label: 'Preparing', count: orders.filter((o) => o.status === 'preparing').length },
    { value: 'on_the_way', label: 'On the Way', count: orders.filter((o) => o.status === 'on_the_way').length },
    { value: 'delivered', label: 'Delivered', count: orders.filter((o) => o.status === 'delivered').length },
    { value: 'cancelled', label: 'Cancelled', count: orders.filter((o) => o.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-subtitle">{orders.length} total · KSh {totalRevenue.toLocaleString('en-KE', { maximumFractionDigits: 0 })} revenue</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={restaurantFilter} onChange={(e) => setRestaurantFilter(e.target.value)} className="input-field w-auto text-sm">
            <option value="all">All Restaurants</option>
            {restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-surface-muted p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button key={tab.value} onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === tab.value ? 'bg-white shadow-card text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label}
            {tab.count > 0 && <span className="ml-1.5 text-gray-400">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input-field pl-9 max-w-sm" placeholder="Search by ID or customer…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading orders…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-2" />
            <p className="text-gray-500 text-sm font-medium">No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Restaurant</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const next = NEXT_STATUS[order.status];
                  return (
                    <tr key={order.id}>
                      <td><span className="font-mono text-xs text-gray-500">#{order.id.slice(-6).toUpperCase()}</span></td>
                      <td className="font-medium text-gray-900 max-w-[140px]"><span className="truncate block">{getRestName(order.restaurantId)}</span></td>
                      <td className="text-gray-700">{order.customerName}</td>
                      <td className="text-gray-500">{order.items.length} item{order.items.length !== 1 ? 's' : ''}</td>
                      <td className="font-semibold text-gray-900">KSh {order.total.toLocaleString()}</td>
                      <td><span className={`status-${order.status}`}>{STATUS_LABEL[order.status]}</span></td>
                      <td className="text-gray-400 text-xs">{new Date(order.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {next && (
                            <button onClick={() => updateStatusMutation.mutate({ id: order.id, status: next })}
                              className="text-xs px-2.5 py-1 bg-slate-900 text-white rounded-lg hover:bg-gold-500 transition-colors font-medium">
                              → {STATUS_LABEL[next]}
                            </button>
                          )}
                          <button onClick={() => setSelectedOrder(order)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-surface rounded-lg">
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl fade-in" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="sticky top-0 bg-white z-10 border-b border-surface-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-gray-900">Order #{selectedOrder.id.slice(-6).toUpperCase()}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{new Date(selectedOrder.createdAt).toLocaleString('en-KE')}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-${selectedOrder.status}`}>{STATUS_LABEL[selectedOrder.status]}</span>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-surface rounded-lg ml-2"><X size={18} /></button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Grid info */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Restaurant', value: getRestName(selectedOrder.restaurantId), icon: Package },
                  { label: 'Customer', value: selectedOrder.customerName, icon: User },
                  { label: 'Delivery Address', value: selectedOrder.deliveryAddress, icon: MapPin },
                  { label: 'Rider', value: selectedOrder.driverId || 'Unassigned', icon: Bike },
                ].map((f) => (
                  <div key={f.label} className="bg-surface-muted rounded-xl p-3 flex items-start gap-2.5">
                    <f.icon size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{f.label}</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{f.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Assign rider */}
              <div className="bg-surface-muted rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assign Rider</p>
                <div className="flex gap-2">
                  <select value={selectedRiderId} onChange={(e) => setSelectedRiderId(e.target.value)} className="input-field flex-1 text-sm">
                    <option value="">Select a rider…</option>
                    {availableRiders.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.status})</option>)}
                  </select>
                  <button onClick={() => selectedRiderId && assignRiderMutation.mutate({ orderId: selectedOrder.id, riderId: selectedRiderId })}
                    disabled={!selectedRiderId || assignRiderMutation.isLoading} className="btn-primary">
                    {assignRiderMutation.isLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Assign'}
                  </button>
                </div>
              </div>

              {/* Order items */}
              <div>
                <p className="section-label">Order Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.quantity} × KSh {item.price.toLocaleString()}</p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900">KSh {(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 mt-4 pt-4 border-t border-surface-border">
                  {[['Subtotal', selectedOrder.subtotal], ['Delivery Fee', selectedOrder.deliveryFee], ['Tax', selectedOrder.tax]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between text-sm">
                      <span className="text-gray-500">{l}</span>
                      <span>KSh {(v as number).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-surface-border mt-2">
                    <span>Total</span>
                    <span className="text-gold-600">KSh {selectedOrder.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Payment */}
              {payment && (
                <div className="bg-surface-muted rounded-xl p-4">
                  <p className="section-label">Payment</p>
                  <div className="flex items-center gap-4">
                    <CreditCard size={18} className="text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{payment.method} · KSh {payment.amount.toLocaleString()}</p>
                    </div>
                    <span className={`badge ${payment.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : payment.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                      {payment.status}
                    </span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="section-label mb-0">Timeline</p>
                  <button onClick={() => { refetchTracking(); refetchPayment(); }} className="text-xs text-gold-600 hover:text-gold-700 font-medium">Refresh</button>
                </div>
                <div className="space-y-3">
                  {(tracking?.steps || selectedOrder.statusHistory || []).map((step: any, i: number) => (
                    <div key={step.id || i} className="flex items-start gap-3">
                      <div className="mt-1 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-gold-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">{step.status.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-400">{new Date(step.timestamp).toLocaleString('en-KE')}</p>
                        {step.message && <p className="text-xs text-gray-600 mt-0.5">{step.message}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status change */}
              <div className="flex gap-2 pt-2 border-t border-surface-border">
                <select value={selectedOrder.status}
                  onChange={(e) => updateStatusMutation.mutate({ id: selectedOrder.id, status: e.target.value as OrderStatus })}
                  className="input-field flex-1 text-sm">
                  {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <button onClick={() => setSelectedOrder(null)} className="btn-secondary">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
