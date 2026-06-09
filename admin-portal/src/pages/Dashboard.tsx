import { useQuery } from 'react-query';
import { restaurantService } from '../services/restaurant.service';
import { orderService } from '../services/order.service';
import { riderService } from '../services/rider.service';
import { paymentService } from '../services/payment.service';
import { Store, ShoppingCart, DollarSign, TrendingUp, AlertCircle, Users, Clock, Bell } from 'lucide-react';
import { OrderStatus } from '../types';
import { useMemo, useState, useEffect } from 'react';

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

export default function Dashboard() {
  const { data: restaurants = [] } = useQuery('restaurants', restaurantService.getAll);
  const { data: orders = [] } = useQuery('orders', orderService.getAll);
  const { data: riders = [] } = useQuery('riders', riderService.getAll);
  const { data: payments = [] } = useQuery('payments', paymentService.getAll);
  
  // Auto-refresh every 30 seconds for real-time updates
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const pendingOrders = orders.filter(
      (o) => o.status === 'pending' || o.status === 'confirmed' || o.status === 'preparing'
    );
    const activeDeliveries = orders.filter(
      (o) => o.status === 'assigned' || o.status === 'picked_up' || o.status === 'on_the_way'
    );
    
    // Time-based filtering
    const ordersToday = orders.filter((o) => new Date(o.createdAt) >= today);
    const ordersThisWeek = orders.filter((o) => new Date(o.createdAt) >= weekAgo);
    const ordersThisMonth = orders.filter((o) => new Date(o.createdAt) >= monthAgo);
    
    const revenueToday = deliveredOrders
      .filter((o) => new Date(o.createdAt) >= today)
      .reduce((sum, order) => sum + order.total, 0);
    const revenueThisWeek = deliveredOrders
      .filter((o) => new Date(o.createdAt) >= weekAgo)
      .reduce((sum, order) => sum + order.total, 0);
    const revenueThisMonth = deliveredOrders
      .filter((o) => new Date(o.createdAt) >= monthAgo)
      .reduce((sum, order) => sum + order.total, 0);
    
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
    const avgOrderValue = deliveredOrders.length > 0 ? totalRevenue / deliveredOrders.length : 0;
    
    // Online restaurants
    const onlineRestaurants = restaurants.filter((r) => r.isOpen).length;
    
    // Available riders
    const availableRiders = riders.filter((r) => r.status === 'available').length;
    
    // Alerts
    const delayedOrders = orders.filter((o) => {
      if (o.status === 'delivered' || o.status === 'cancelled') return false;
      const orderAge = (now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60); // minutes
      return orderAge > 60; // More than 60 minutes old
    });
    
    const riderShortage = availableRiders < 3 && activeDeliveries.length > availableRiders;
    
    const paymentFailures = payments.filter((p) => p.status === 'failed').length;
    
    // Revenue by restaurant
    const revenueByRestaurant = deliveredOrders.reduce((acc, order) => {
      acc[order.restaurantId] = (acc[order.restaurantId] || 0) + order.total;
      return acc;
    }, {} as Record<string, number>);
    
    const topRestaurants = Object.entries(revenueByRestaurant)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, revenue]) => ({
        id,
        name: restaurants.find((r) => r.id === id)?.name || id,
        revenue,
      }));

    // Orders by status
    const ordersByStatus = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);

    // Platform commissions (assuming 20% commission)
    const platformCommissions = totalRevenue * 0.2;

    return {
      totalRestaurants: restaurants.length,
      onlineRestaurants,
      totalOrders: orders.length,
      ordersToday: ordersToday.length,
      ordersThisWeek: ordersThisWeek.length,
      ordersThisMonth: ordersThisMonth.length,
      totalRevenue,
      revenueToday,
      revenueThisWeek,
      revenueThisMonth,
      platformCommissions,
      pendingOrders: pendingOrders.length,
      activeDeliveries: activeDeliveries.length,
      deliveredOrders: deliveredOrders.length,
      cancelledOrders: orders.filter((o) => o.status === 'cancelled').length,
      avgOrderValue,
      topRestaurants,
      ordersByStatus,
      availableRiders,
      totalRiders: riders.length,
      alerts: {
        delayedOrders: delayedOrders.length,
        riderShortage,
        paymentFailures,
      },
    };
  }, [orders, restaurants, riders, payments, refreshKey]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [orders]);


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Alerts */}
      {(stats.alerts.delayedOrders > 0 || stats.alerts.riderShortage || stats.alerts.paymentFailures > 0) && (
        <div className="card bg-yellow-50 border-yellow-200 border-2">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="text-yellow-600" size={20} />
            <h2 className="text-lg font-semibold text-yellow-900">System Alerts</h2>
          </div>
          <div className="space-y-2">
            {stats.alerts.delayedOrders > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-orange-600" size={16} />
                <span className="text-gray-700">
                  <strong>{stats.alerts.delayedOrders}</strong> orders delayed (over 60 minutes)
                </span>
              </div>
            )}
            {stats.alerts.riderShortage && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-red-600" size={16} />
                <span className="text-gray-700">
                  <strong>Rider shortage:</strong> {stats.activeDeliveries} active deliveries but only {stats.availableRiders} available riders
                </span>
              </div>
            )}
            {stats.alerts.paymentFailures > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="text-red-600" size={16} />
                <span className="text-gray-700">
                  <strong>{stats.alerts.paymentFailures}</strong> payment failures require attention
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* System-wide Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders (Today)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.ordersToday}</p>
              <p className="text-xs text-gray-500 mt-1">
                This week: {stats.ordersThisWeek} • This month: {stats.ordersThisMonth}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Deliveries</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.activeDeliveries}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.pendingOrders} pending • {stats.deliveredOrders} delivered
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online Restaurants</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.onlineRestaurants}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalRestaurants} total restaurants
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <Store className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Available Riders</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats.availableRiders}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.totalRiders} total riders
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="text-green-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Revenue & Commissions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                KSh {stats.totalRevenue.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Today: KSh {stats.revenueToday.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Platform Commissions</p>
              <p className="text-3xl font-bold text-primary-600 mt-1">
                KSh {stats.platformCommissions.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                20% commission rate
              </p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <TrendingUp className="text-primary-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Revenue (This Week)</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                KSh {stats.revenueThisWeek.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.ordersThisWeek} orders
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                KSh {stats.avgOrderValue.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Per completed order
              </p>
            </div>
            <div className="p-3 bg-indigo-100 rounded-lg">
              <DollarSign className="text-indigo-600" size={24} />
            </div>
          </div>
        </div>
      </div>


      {/* Top Restaurants */}
      {stats.topRestaurants.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Restaurants</h2>
            <div className="space-y-3">
              {stats.topRestaurants.map((restaurant, index) => (
                <div
                  key={restaurant.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{restaurant.name}</p>
                      <p className="text-xs text-gray-500">Revenue</p>
                    </div>
                  </div>
                  <p className="font-bold text-green-600">KSh {restaurant.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Orders by Status</h2>
            <div className="space-y-3">
              {Object.entries(stats.ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{formatStatus(status as OrderStatus)}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full"
                        style={{
                          width: `${(count / stats.totalOrders) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Order ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Restaurant</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Total</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 text-sm font-mono">{order.id}</td>
                  <td className="py-3 px-4 text-sm">{order.restaurantId}</td>
                  <td className="py-3 px-4 text-sm font-medium">KSh {order.total.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        order.status === 'delivered'
                          ? 'bg-green-100 text-green-800'
                          : order.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
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

