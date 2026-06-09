import { useQuery, useMutation, useQueryClient } from 'react-query';
import { orderService } from '../services/order.service';
import { restaurantService } from '../services/restaurant.service';
import { riderService } from '../services/rider.service';
import { paymentService } from '../services/payment.service';
import { Search, Filter, Eye, X } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { useEffect, useState } from 'react';

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

function formatStatus(status: OrderStatus): string {
  const statusMap: Record<OrderStatus, string> = {
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
  return statusMap[status] || status;
}

export default function Orders() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRiderId, setSelectedRiderId] = useState('');

  const { data: orders = [], isLoading } = useQuery('orders', orderService.getAll);
  const { data: restaurants = [] } = useQuery('restaurants', restaurantService.getAll);
  const { data: riders = [] } = useQuery('riders', riderService.getAll);

  const updateStatusMutation = useMutation(
    ({ id, status }: { id: string; status: OrderStatus }) =>
      orderService.updateStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
      },
    }
  );

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.restaurantId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesRestaurant = restaurantFilter === 'all' || order.restaurantId === restaurantFilter;
    return matchesSearch && matchesStatus && matchesRestaurant;
  });

  const getRestaurantName = (restaurantId: string) => {
    const restaurant = restaurants.find((r) => r.id === restaurantId);
    return restaurant?.name || restaurantId;
  };

  const assignRiderMutation = useMutation(
    ({ orderId, riderId }: { orderId: string; riderId: string }) => orderService.assignRider(orderId, riderId),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        if (selectedOrder) {
          queryClient.invalidateQueries(['order-tracking', selectedOrder.id]);
        }
      },
    }
  );

  const {
    data: tracking,
    isFetching: trackingLoading,
    refetch: refetchTracking,
  } = useQuery(
    ['order-tracking', selectedOrder?.id],
    () => orderService.getTracking(selectedOrder!.id),
    { enabled: !!selectedOrder }
  );

  const {
    data: payment,
    isFetching: paymentLoading,
    refetch: refetchPayment,
  } = useQuery(
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

  const availableRiders = riders.filter(
    (r) => r.status === 'available' || r.id === selectedOrder?.driverId
  );

  if (isLoading) {
    return <div className="text-center py-12">Loading orders...</div>;
  }

  const totalRevenue = filteredOrders
    .filter((o) => o.status === 'delivered')
    .reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Manage and track all orders</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">KSh {totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search orders by ID, customer name, or restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
              className="input-field w-auto min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="picked_up">Picked Up</option>
              <option value="on_the_way">On the Way</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={restaurantFilter}
              onChange={(e) => setRestaurantFilter(e.target.value)}
              className="input-field w-auto min-w-[200px]"
            >
              <option value="all">All Restaurants</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-600">Total Orders</p>
          <p className="text-2xl font-bold">{filteredOrders.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-600">
            {filteredOrders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Delivered</p>
          <p className="text-2xl font-bold text-green-600">
            {filteredOrders.filter((o) => o.status === 'delivered').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Cancelled</p>
          <p className="text-2xl font-bold text-red-600">
            {filteredOrders.filter((o) => o.status === 'cancelled').length}
          </p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Order ID</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Restaurant</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Items</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Total</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-sm font-mono">{order.id}</td>
                <td className="py-3 px-4 text-sm">{getRestaurantName(order.restaurantId)}</td>
                <td className="py-3 px-4 text-sm">
                  {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                </td>
                <td className="py-3 px-4 text-sm font-medium">KSh {order.total.toFixed(2)}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[order.status]
                    }`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                      className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="assigned">Assigned</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="on_the_way">On the Way</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="p-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="View Details"
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && orders.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No orders match your filter criteria.
        </div>
      )}

      {orders.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No orders found.
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Payment</p>
                  {payment ? (
                    <>
                      <p className="text-sm font-semibold mt-1">KSh {payment.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 uppercase">{payment.method}</p>
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full mt-2 ${
                          payment.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {payment.status}
                      </span>
                    </>
                  ) : (
                    <p className="text-xs text-gray-500">
                      {paymentLoading ? 'Loading payment...' : 'No payment record'}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Rider</p>
                  <p className="text-sm font-semibold mt-1">
                    {selectedOrder.driverId ? selectedOrder.driverId : 'Unassigned'}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <select
                      value={selectedRiderId}
                      onChange={(e) => setSelectedRiderId(e.target.value)}
                      className="flex-1 input-field text-sm"
                    >
                      <option value="">Select rider</option>
                      {availableRiders.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.name} {rider.status === 'available' ? '' : `( ${rider.status} )`}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        selectedRiderId &&
                        assignRiderMutation.mutate({ orderId: selectedOrder.id, riderId: selectedRiderId })
                      }
                      disabled={!selectedRiderId || assignRiderMutation.isLoading}
                      className="btn-primary text-xs"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <p className="font-mono font-medium">{selectedOrder.id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[selectedOrder.status]
                    }`}
                  >
                    {formatStatus(selectedOrder.status)}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Restaurant</p>
                  <p className="font-medium">{getRestaurantName(selectedOrder.restaurantId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Date</p>
                  <p className="font-medium">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Delivery Address</p>
                  <p className="font-medium">{selectedOrder.deliveryAddress}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Order Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Quantity: {item.quantity} × KSh {item.price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold">KSh {(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">KSh {selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery Fee</span>
                  <span className="font-medium">KSh {selectedOrder.deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span className="font-medium">KSh {selectedOrder.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary-500">KSh {selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Tracking Timeline</h3>
                  <button
                    onClick={() => {
                      refetchTracking();
                      refetchPayment();
                    }}
                    className="text-xs text-primary-600 hover:underline"
                    disabled={trackingLoading}
                  >
                    Refresh
                  </button>
                </div>
                <div className="space-y-3">
                  {(tracking?.steps || selectedOrder.statusHistory || []).map((step) => (
                    <div key={step.id} className="flex items-start gap-3">
                      <div className="mt-1">
                        <span className="w-2 h-2 rounded-full bg-primary-500 inline-block" />
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">{step.status.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(step.timestamp).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">{step.message}</p>
                      </div>
                    </div>
                  ))}
                  {!tracking && !selectedOrder.statusHistory && (
                    <p className="text-sm text-gray-500">No tracking data available.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

