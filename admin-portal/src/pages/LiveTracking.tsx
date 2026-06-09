import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { orderService } from '../services/order.service';
import { Order } from '../types';
import { Navigation, Clock3 } from 'lucide-react';

const statusColors: Record<Order['status'], string> = {
  pending: 'bg-gray-100 text-gray-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-orange-100 text-orange-700',
  ready: 'bg-indigo-100 text-indigo-700',
  assigned: 'bg-cyan-100 text-cyan-600',
  picked_up: 'bg-purple-100 text-purple-700',
  on_the_way: 'bg-green-100 text-green-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function LiveTracking() {
  const { data: orders = [], isLoading } = useQuery('orders', orderService.getAll);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrderId && orders.length > 0) {
      setSelectedOrderId(orders[0].id);
    }
    if (selectedOrderId && orders.length > 0 && !orders.find((o) => o.id === selectedOrderId)) {
      setSelectedOrderId(orders[0].id);
    }
  }, [orders, selectedOrderId]);

  const {
    data: tracking,
    isLoading: trackingLoading,
    refetch,
  } = useQuery(
    ['order-tracking', selectedOrderId],
    () => orderService.getTracking(selectedOrderId!),
    { enabled: !!selectedOrderId }
  );

  const activeOrders = useMemo(() => {
    return orders.filter((order) => order.status !== 'delivered' && order.status !== 'cancelled');
  }, [orders]);

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);

  if (isLoading) {
    return <div className="text-center py-12">Loading tracking...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live Tracking</h1>
          <p className="text-gray-600 mt-1">Monitor riders, customer locations, and delivery ETAs</p>
        </div>
        {selectedOrderId && (
          <button
            onClick={() => refetch()}
            className="btn-secondary"
            disabled={trackingLoading}
          >
            Refresh Snapshot
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card max-h-[70vh] overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Active Orders</h2>
          <div className="space-y-3">
            {activeOrders.map((order) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  selectedOrderId === order.id ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{order.id}</p>
                    <p className="text-base font-semibold text-gray-900">{order.customerName}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">{order.deliveryAddress}</p>
                {order.etaMinutes && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Clock3 size={14} /> ETA {order.etaMinutes} min
                  </p>
                )}
              </button>
            ))}
            {activeOrders.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">No active deliveries.</p>
            )}
          </div>
        </div>

        <div className="card lg:col-span-2 space-y-4">
          {selectedOrder && tracking ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Order</p>
                  <p className="text-xl font-semibold">{selectedOrder.id}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.customerName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Current Status</p>
                  <p className="text-lg font-semibold capitalize">{tracking.status.replace('_', ' ')}</p>
                  {tracking.etaMinutes && (
                    <p className="text-sm text-gray-500">ETA {tracking.etaMinutes} min</p>
                  )}
                </div>
              </div>

              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 border border-dashed border-gray-300">
                <div className="text-center space-y-2">
                  <Navigation className="mx-auto text-primary-500" size={40} />
                  <p className="font-medium">Map placeholder</p>
                  <p className="text-xs">
                    Rider: {tracking.driverLocation ? `${tracking.driverLocation.lat.toFixed(4)}, ${tracking.driverLocation.lng.toFixed(4)}` : 'N/A'}
                  </p>
                  <p className="text-xs">
                    Customer: {tracking.customerLocation ? `${tracking.customerLocation.lat?.toFixed(4)}, ${tracking.customerLocation.lng?.toFixed(4)}` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Restaurant</p>
                  <p className="font-medium">{selectedOrder.restaurantId}</p>
                  <p className="text-xs">{selectedOrder.restaurantLocation?.address ?? '—'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Driver</p>
                  <p className="font-medium">{tracking.driverId ?? 'Unassigned'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Delivery</p>
                  <p className="font-medium">{selectedOrder.deliveryAddress}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Timeline</h3>
                <div className="space-y-3">
                  {tracking.steps
                    .slice()
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .map((step) => (
                      <div key={step.id} className="flex items-start gap-3">
                        <div className="mt-1">
                          <span className="w-2 h-2 rounded-full bg-primary-500 inline-block" />
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">{step.status.replace('_', ' ')}</p>
                          <p className="text-xs text-gray-500">{new Date(step.timestamp).toLocaleString()}</p>
                          <p className="text-xs text-gray-600 mt-1">{step.message}</p>
                        </div>
                      </div>
                    ))}
                  {tracking.steps.length === 0 && (
                    <p className="text-sm text-gray-500">No tracking updates yet.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-gray-500">
              Select an order to view the live tracking snapshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

