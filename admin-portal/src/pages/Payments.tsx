import { useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { paymentService } from '../services/payment.service';
import { Payment } from '../types';
import { Search, CreditCard, TrendingUp, TrendingDown, Download, Calendar } from 'lucide-react';

const paymentMethods: Payment['method'][] = ['card', 'cash', 'wallet', 'online'];
const paymentStatuses: Payment['status'][] = ['pending', 'completed', 'failed', 'refunded'];

export default function Payments() {
  const [statusFilter, setStatusFilter] = useState<'all' | Payment['status']>('all');
  const [methodFilter, setMethodFilter] = useState<'all' | Payment['method']>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: payments = [], isLoading, error } = useQuery('payments', paymentService.getAll, {
    retry: 1,
    onError: (err) => {
      console.error('Error fetching payments:', err);
    },
  });

  const filteredPayments = useMemo(() => {
    if (!payments || !Array.isArray(payments)) return [];
    return payments.filter((payment) => {
      if (!payment) return false;
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
      const matchesSearch =
        (payment.orderId?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (payment.customerName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (payment.restaurantId?.toLowerCase() || '').includes(searchQuery.toLowerCase());
      return matchesStatus && matchesMethod && matchesSearch;
    });
  }, [payments, statusFilter, methodFilter, searchQuery]);

  const stats = useMemo(() => {
    if (!payments || !Array.isArray(payments) || payments.length === 0) {
      return {
        totalVolume: 0,
        completedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        completionRate: 0,
        averageTicket: 0,
      };
    }
    const totalVolume = payments.reduce((sum, payment) => sum + (payment?.amount || 0), 0);
    const completed = payments.filter((p) => p?.status === 'completed');
    const pending = payments.filter((p) => p?.status === 'pending');
    const failed = payments.filter((p) => p?.status === 'failed');
    return {
      totalVolume,
      completedCount: completed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      completionRate: payments.length ? (completed.length / payments.length) * 100 : 0,
      averageTicket: completed.length ? completed.reduce((sum, p) => sum + (p?.amount || 0), 0) / completed.length : 0,
    };
  }, [payments]);

  if (isLoading) {
    return <div className="text-center py-12">Loading payment data...</div>;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments & Settlements</h1>
          <p className="text-gray-600 mt-1">Monitor revenue, payouts, and payment health</p>
        </div>
        <div className="card bg-red-50 border-red-200 border-2">
          <p className="text-red-700 font-semibold">Error loading payments</p>
          <p className="text-red-600 text-sm mt-2">
            {error instanceof Error ? error.message : 'Failed to fetch payment data. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  const exportToCSV = () => {
    const csvRows: string[] = ['Order ID,Customer,Restaurant,Amount,Method,Status,Paid At'];
    filteredPayments.forEach((payment) => {
      csvRows.push(
        `${payment.orderId},${payment.customerName},${payment.restaurantId},${payment.amount.toFixed(2)},${payment.method},${payment.status},${payment.paidAt || 'N/A'}`
      );
    });
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate restaurant payouts (assuming 80% goes to restaurant, 20% commission)
  const restaurantPayouts = useMemo(() => {
    if (!payments || !Array.isArray(payments)) return [];
    const completedPayments = payments.filter((p) => p?.status === 'completed');
    const payoutByRestaurant = completedPayments.reduce((acc, payment) => {
      if (!payment) return acc;
      const restaurantId = payment.restaurantId;
      const restaurantAmount = (payment.amount || 0) * 0.8; // 80% to restaurant
      acc[restaurantId] = (acc[restaurantId] || 0) + restaurantAmount;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(payoutByRestaurant).map(([id, amount]) => ({ id, amount }));
  }, [payments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payments & Settlements</h1>
          <p className="text-gray-600 mt-1">Monitor revenue, payouts, and payment health</p>
        </div>
        <button
          onClick={exportToCSV}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <p className="text-sm text-gray-600">Total Volume</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-gray-900">KSh {stats.totalVolume.toFixed(2)}</p>
            <div className="p-3 bg-primary-100 rounded-lg">
              <CreditCard className="text-primary-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Completed + pending transactions</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Completion Rate</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-green-600">{stats.completionRate.toFixed(1)}%</p>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">{stats.completedCount} completed</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Pending Transactions</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-3xl font-bold text-yellow-600">{stats.pendingCount}</p>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <TrendingDown className="text-yellow-600" size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Awaiting confirmation</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-600">Average Ticket</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">KSh {stats.averageTicket.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">Per completed payment</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by order ID, customer, or restaurant..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Payment['status'] | 'all')}
            className="input-field w-auto min-w-[160px]"
          >
            <option value="all">All Statuses</option>
            {paymentStatuses.map((status) => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as Payment['method'] | 'all')}
            className="input-field w-auto min-w-[160px]"
          >
            <option value="all">All Methods</option>
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
+      {payments.length > 0 ? (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Restaurant</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Method</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Paid At</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-mono text-sm">{payment.orderId || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{payment.id}</p>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="font-medium">{payment.customerName || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{(payment.method || '').toUpperCase()}</p>
                    </td>
                    <td className="py-3 px-4 text-sm">{payment.restaurantId || 'N/A'}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900">
                      KSh {(payment.amount || 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-sm uppercase">{payment.method || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          payment.status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : payment.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : payment.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {payment.status || 'unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">
                      {payment.paidAt ? new Date(payment.paidAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    No payments match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12 text-gray-500">
            <CreditCard size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium">No payments found</p>
            <p className="text-sm mt-2">Payments will appear here once orders are placed and paid.</p>
          </div>
        </div>
      )}

      {/* Restaurant Payouts Section */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Restaurant Payouts</h2>
            <p className="text-sm text-gray-600 mt-1">Pending payouts to restaurants (80% of completed orders)</p>
          </div>
          <Calendar size={20} className="text-gray-400" />
        </div>
        <div className="space-y-3">
          {restaurantPayouts.length > 0 ? (
            restaurantPayouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">Restaurant {payout.id}</p>
                  <p className="text-xs text-gray-500">Pending payout</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">KSh {payout.amount.toFixed(2)}</p>
                  <button className="text-xs text-primary-600 hover:underline mt-1">
                    Process Payout
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">No pending payouts.</p>
          )}
        </div>
      </div>
    </div>
  );
}

