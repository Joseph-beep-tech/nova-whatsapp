import { useMemo } from 'react';
import { useQuery } from 'react-query';
import { orderService } from '../services/order.service';
import { restaurantService } from '../services/restaurant.service';
import { paymentService } from '../services/payment.service';
import { riderService } from '../services/rider.service';
import { TrendingUp, TrendingDown, Timer, Users, CalendarDays, Flame, Download } from 'lucide-react';

function getDayKey(date: string) {
  const d = new Date(date);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export default function Analytics() {
  const { data: orders = [], isLoading: ordersLoading } = useQuery('orders', orderService.getAll);
  const { data:
     restaurants = [], isLoading: restaurantsLoading } = useQuery('restaurants', restaurantService.getAll);
  const { data: payments = [], isLoading: paymentsLoading } = useQuery('payments', paymentService.getAll);
  const { data: riders = [], isLoading: ridersLoading } = useQuery('riders', riderService.getAll);

  const analytics = useMemo(() => {
    const deliveredOrders = orders.filter((o) => o.status === 'delivered');
    const cancellationRate = orders.length
      ? (orders.filter((o) => o.status === 'cancelled').length / orders.length) * 100
      : 0;

    const avgDeliveryMinutes = deliveredOrders.reduce((sum, order) => {
      const deliveredStep = order.statusHistory?.find((step) => step.status === 'delivered');
      if (deliveredStep) {
        sum += (new Date(deliveredStep.timestamp).getTime() - new Date(order.createdAt).getTime()) / 60000;
      }
      return sum;
    }, 0);
    const avgDelivery = deliveredOrders.length ? avgDeliveryMinutes / deliveredOrders.length : 0;

    const revenueByDay = deliveredOrders.reduce((acc, order) => {
      const key = getDayKey(order.createdAt);
      acc[key] = (acc[key] || 0) + order.total;
      return acc;
    }, {} as Record<string, number>);

    const revenueSeries = Object.entries(revenueByDay)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .slice(-7);

    const cuisineCounts = restaurants.reduce((acc, restaurant) => {
      acc[restaurant.cuisine] = (acc[restaurant.cuisine] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCuisines = Object.entries(cuisineCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    const paymentBreakdown = payments.reduce((acc, payment) => {
      acc[payment.method] = (acc[payment.method] || 0) + payment.amount;
      return acc;
    }, {} as Record<string, number>);

    const riderAvailability = riders.reduce(
      (acc, rider) => {
        acc[rider.status] = (acc[rider.status] || 0) + 1;
        return acc;
      },
      { available: 0, busy: 0, offline: 0 } as Record<'available' | 'busy' | 'offline', number>
    );

    return {
      deliveredOrders: deliveredOrders.length,
      totalRevenue: payments.reduce((sum, payment) => sum + payment.amount, 0),
      avgDelivery,
      cancellationRate,
      revenueSeries,
      topCuisines,
      paymentBreakdown,
      riderAvailability,
    };
  }, [orders, restaurants, payments, riders]);

  const isLoading = ordersLoading || restaurantsLoading || paymentsLoading || ridersLoading;

  if (isLoading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  const exportToCSV = () => {
    const csvRows: string[] = [];
    
    // Revenue data
    csvRows.push('Date,Revenue');
    analytics.revenueSeries.forEach(([day, amount]) => {
      csvRows.push(`${day},${amount.toFixed(2)}`);
    });
    
    // Payment breakdown
    csvRows.push('\nPayment Method,Amount');
    Object.entries(analytics.paymentBreakdown).forEach(([method, amount]) => {
      csvRows.push(`${method},${amount.toFixed(2)}`);
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">Operational intelligence across the food delivery network</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">KSh {analytics.totalRevenue.toFixed(2)}</p>
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Completed payments across all restaurants</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Delivered Orders</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{analytics.deliveredOrders}</p>
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Successful deliveries recorded</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Avg Delivery Time</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">{analytics.avgDelivery.toFixed(1)} min</p>
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Timer className="text-indigo-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">From order placed to delivered</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Cancellation Rate</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-red-600">{analytics.cancellationRate.toFixed(1)}%</p>
            <div className="p-3 bg-red-50 rounded-lg">
              <TrendingDown className="text-red-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">All restaurants combined</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Revenue (last 7 days)</h2>
            <CalendarDays size={18} className="text-gray-400" />
          </div>
          <div className="space-y-3">
            {analytics.revenueSeries.length === 0 && (
              <p className="text-sm text-gray-500">Not enough data yet.</p>
            )}
            {analytics.revenueSeries.map(([day, amount]) => (
              <div key={day}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{new Date(day).toLocaleDateString()}</span>
                  <span className="font-semibold">KSh {amount.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                  <div
                    className="bg-primary-500 h-2 rounded-full"
                    style={{ width: `${Math.min((amount / analytics.totalRevenue) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Payment Breakdown</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(analytics.paymentBreakdown).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium uppercase">{method}</p>
                  <p className="text-xs text-gray-500">
                    {((amount / analytics.totalRevenue) * 100).toFixed(1)}% of revenue
                  </p>
                </div>
                <span className="font-semibold">KSh {amount.toFixed(2)}</span>
              </div>
            ))}
            {Object.keys(analytics.paymentBreakdown).length === 0 && (
              <p className="text-sm text-gray-500">No payments recorded.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Top Cuisines</h2>
            <Flame size={18} className="text-orange-500" />
          </div>
          <div className="space-y-3">
            {analytics.topCuisines.map(([cuisine, count]) => (
              <div key={cuisine} className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{cuisine}</p>
                <span className="font-semibold">{count} restaurants</span>
              </div>
            ))}
            {analytics.topCuisines.length === 0 && (
              <p className="text-sm text-gray-500">No cuisine data available.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Rider Availability</h2>
          </div>
          <div className="space-y-3">
            {(['available', 'busy', 'offline'] as const).map((status) => (
              <div key={status} className="flex items-center justify-between">
                <p className="text-sm text-gray-600 capitalize">{status}</p>
                <span className="font-semibold">{analytics.riderAvailability[status]}</span>
              </div>
            ))}
            {riders.length === 0 && <p className="text-sm text-gray-500">No riders in the system.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

