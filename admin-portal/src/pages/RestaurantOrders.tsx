import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { orderService } from '../services/order.service';
import { paymentService } from '../services/payment.service';
import { riderService } from '../services/rider.service';
import { Restaurant, Order, OrderStatus } from '../types';
import { restaurantService } from '../services/restaurant.service';
import { useMemo, useState, useEffect } from 'react';
import { Bike, X, DollarSign, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-orange-100 text-orange-800',
  ready: 'bg-indigo-100 text-indigo-800',
  assigned: 'bg-cyan-100 text-cyan-800',
  picked_up: 'bg-purple-100 text-purple-800',
  on_the_way: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabel: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  on_the_way: 'On the Way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function RestaurantOrders() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const { data: restaurant, isLoading: restaurantLoading } = useQuery<Restaurant>(
    ['restaurant', id],
    () => restaurantService.getById(id!),
    { enabled: !!id }
  );

  const { data: orders = [], isLoading: ordersLoading } = useQuery<Order[]>(
    ['orders', id],
    () => orderService.getByRestaurant(id!),
    { enabled: !!id }
  );

  const { data: riders = [] } = useQuery('riders', riderService.getAll);

  const updateStatusMutation = useMutation(
    ({ orderId, status }: { orderId: string; status: OrderStatus }) =>
      orderService.updateStatus(orderId, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['orders', id]);
        if (selectedOrder) {
          queryClient.invalidateQueries(['payment', selectedOrder.id]);
        }
      },
    }
  );

  const assignRiderMutation = useMutation(
    ({ orderId, riderId }: { orderId: string; riderId: string }) => orderService.assignRider(orderId, riderId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['orders', id]);
      },
    }
  );

  const { data: payment } = useQuery(
    ['payment', selectedOrder?.id],
    () => paymentService.getByOrder(selectedOrder!.id),
    { enabled: !!selectedOrder }
  );

  useEffect(() => {
    if (selectedOrder) {
      setSelectedRiderId(selectedOrder.driverId ?? '');
    } else {
      setSelectedRiderId('');
    }
  }, [selectedOrder]);

  useEffect(() => {
    if (!selectedOrder && orders.length > 0) {
      setSelectedOrder(orders[0]);
    }
  }, [orders, selectedOrder]);

  const currencySymbol =
    restaurant?.currencySymbol && restaurant.currencySymbol.trim().length > 0
      ? restaurant.currencySymbol
      : 'KSh';

  const totals = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered');
    const revenue = delivered.reduce((sum, o) => sum + o.total, 0);
    return {
      deliveredCount: delivered.length,
      revenue,
    };
  }, [orders]);

  const actionsForStatus = (status: OrderStatus): Array<{ value: OrderStatus; label: string }> => {
    switch (status) {
      case 'pending':
        return [
          { value: 'confirmed', label: 'Accept' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'confirmed':
        return [
          { value: 'preparing', label: 'Start Preparing' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'preparing':
        return [
          { value: 'ready', label: 'Mark Ready' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'ready':
        return [
          { value: 'assigned', label: 'Assign Rider' },
          { value: 'picked_up', label: 'Pickup (self)' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'assigned':
        return [
          { value: 'picked_up', label: 'Picked Up' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'picked_up':
        return [
          { value: 'on_the_way', label: 'On the Way' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      case 'on_the_way':
        return [
          { value: 'delivered', label: 'Delivered' },
          { value: 'cancelled', label: 'Cancel' },
        ];
      default:
        return [];
    }
  };

  const handleStatus = (orderId: string, next: OrderStatus) => {
    updateStatusMutation.mutate({ orderId, status: next });
  };

  const handleAssign = (orderId: string, riderId: string) => {
    assignRiderMutation.mutate({ orderId, riderId });
  };

  if (restaurantLoading || ordersLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  const StatusBadge = ({ status }: { status: OrderStatus }) => (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[status]}`}>
      {statusLabel[status]}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{restaurant?.name} Orders</h1>
          <p className="text-gray-600 mt-1">Manage and track orders for this restaurant</p>
        </div>
        <div className="card flex items-center gap-6">
          <Link
            to={`/restaurants/${id}/details`}
            className="btn-secondary flex items-center gap-2"
          >
            <Store size={16} />
            Restaurant Info
          </Link>
          <div>
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-2xl font-bold text-green-600">{totals.deliveredCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Revenue</p>
            <p className="text-2xl font-bold text-green-600">
              {currencySymbol}{totals.revenue.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-x-auto">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No orders yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Order ID</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Customer</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`border-b hover:bg-gray-50 cursor-pointer ${
                      selectedOrder?.id === order.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="py-3 px-4 text-sm font-mono text-gray-800">{order.id}</td>
                    <td className="py-3 px-4 text-sm text-gray-800">
                      <div className="font-semibold">{order.customerName}</div>
                      {order.customerPhone && <div className="text-gray-500 text-xs">{order.customerPhone}</div>}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-gray-900">
                      {currencySymbol}{order.total.toFixed(2)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Order detail drawer-like card */}
        <div className="card">
          {!selectedOrder ? (
            <div className="text-center text-gray-500 py-12">Select an order to view details</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-gray-700">{selectedOrder.id}</p>
                  <p className="text-sm text-gray-600">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                </div>
                <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-semibold">{selectedOrder.customerName}</p>
                {selectedOrder.customerPhone && <p className="text-gray-600">{selectedOrder.customerPhone}</p>}
                <p className="text-gray-600">{selectedOrder.deliveryAddress}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Items</p>
                <div className="divide-y">
                  {selectedOrder.items.map((item) => (
                    <div key={item.menuItemId} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <p className="font-semibold">{item.name}</p>
                        <p className="text-gray-500">Qty {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{currencySymbol}{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">{currencySymbol}{selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Delivery</span>
                  <span className="font-semibold">{currencySymbol}{selectedOrder.deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-semibold">{currencySymbol}{selectedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Total</span>
                  <span className="font-bold text-green-700">{currencySymbol}{selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Status actions</p>
                <div className="flex flex-wrap gap-2">
                  {actionsForStatus(selectedOrder.status).map((action) => (
                    <button
                      key={action.value}
                      onClick={() => handleStatus(selectedOrder.id, action.value)}
                      className="btn-secondary text-sm"
                      disabled={updateStatusMutation.isLoading}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Bike size={16} className="text-gray-600" />
                  <span className="text-sm font-semibold">Assign rider</span>
                </div>
                <select
                  value={selectedRiderId}
                  onChange={(e) => {
                    setSelectedRiderId(e.target.value);
                    if (e.target.value) {
                      handleAssign(selectedOrder.id, e.target.value);
                    }
                  }}
                  className="input-field"
                >
                  <option value="">Select rider</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 text-sm">
                <p className="text-sm font-semibold">Payment</p>
                {payment ? (
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    <span className="font-semibold capitalize">{payment.status}</span>
                    <span className="text-gray-600">{currencySymbol}{payment.amount.toFixed(2)}</span>
                  </div>
                ) : (
                  <p className="text-gray-500">No payment record</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

