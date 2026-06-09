import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { riderService } from '../services/rider.service';
import { orderService } from '../services/order.service';
import { Rider } from '../types';
import { MapPin, Phone, Mail, Star, RefreshCw, Clock, Award } from 'lucide-react';

const statusColors: Record<Rider['status'], string> = {
  available: 'text-green-600 bg-green-50',
  busy: 'text-orange-600 bg-orange-50',
  offline: 'text-gray-500 bg-gray-100',
};

export default function Riders() {
  const queryClient = useQueryClient();
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const { data: riders = [], isLoading } = useQuery('riders', riderService.getAll);
  const { data: orders = [] } = useQuery('orders', orderService.getAll);

  // Calculate rider performance metrics
  const riderPerformance = useMemo(() => {
    return riders.map((rider) => {
      const riderOrders = orders.filter((o) => o.driverId === rider.id && o.status === 'delivered');
      const acceptanceRate = orders.filter((o) => o.driverId === rider.id).length > 0
        ? (riderOrders.length / orders.filter((o) => o.driverId === rider.id).length) * 100
        : 0;
      
      // Calculate average delivery time (mock calculation)
      const avgDeliveryTime = riderOrders.length > 0 ? 25 : 0; // minutes
      
      // Calculate earnings (assuming KSh 50 per delivery)
      const earnings = riderOrders.length * 50;
      
      return {
        ...rider,
        acceptanceRate,
        avgDeliveryTime,
        earnings,
        completedDeliveries: riderOrders.length,
      };
    });
  }, [riders, orders]);

  const statusMutation = useMutation(
    ({ id, status }: { id: string; status: Rider['status'] }) => riderService.updateStatus(id, status),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('riders');
      },
    }
  );

  const sortedRiders = [...riderPerformance].sort((a, b) => b.completedDeliveries - a.completedDeliveries);

  if (isLoading) {
    return <div className="text-center py-12">Loading riders...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Riders</h1>
          <p className="text-gray-600 mt-1">Manage fleet availability and track performance</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRiders.map((rider) => (
          <div key={rider.id} className="card space-y-4 border border-gray-100 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{rider.name}</h3>
                <p className="text-sm text-gray-500">{rider.vehicle} • {rider.vehicleNumber}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[rider.status]}`}>
                {rider.status.toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <Star size={16} className="text-yellow-500" />
                {rider.rating.toFixed(1)} rating
              </p>
              <p className="flex items-center gap-1">
                <Award size={14} className="text-blue-500" />
                {rider.completedDeliveries} completed
              </p>
            </div>

            {/* Performance Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-500">Acceptance Rate</p>
                <p className="font-semibold">{rider.acceptanceRate.toFixed(0)}%</p>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <p className="text-gray-500">Avg Time</p>
                <p className="font-semibold flex items-center gap-1">
                  <Clock size={12} />
                  {rider.avgDeliveryTime} min
                </p>
              </div>
              <div className="p-2 bg-gray-50 rounded col-span-2">
                <p className="text-gray-500">Earnings</p>
                <p className="font-semibold text-green-600">KSh {rider.earnings.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <Phone size={16} className="text-gray-400" />
                {rider.phone}
              </p>
              <p className="flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                {rider.email}
              </p>
              {rider.currentLocation && (
                <p className="flex items-center gap-2">
                  <MapPin size={16} className="text-gray-400" />
                  {rider.currentLocation.lat.toFixed(4)}, {rider.currentLocation.lng.toFixed(4)}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={rider.status}
                onChange={(e) => statusMutation.mutate({ id: rider.id, status: e.target.value as Rider['status'] })}
                className="flex-1 input-field text-sm"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
              <button
                onClick={() => setSelectedRider(rider)}
                className="btn-secondary text-sm"
              >
                Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {sortedRiders.length === 0 && (
        <div className="text-center py-12 text-gray-500">No riders found.</div>
      )}

      {selectedRider && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{selectedRider.name}</h2>
                <p className="text-sm text-gray-500">Joined {new Date(selectedRider.createdAt).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => setSelectedRider(null)}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Deliveries</p>
                <p className="text-xl font-semibold">{selectedRider.totalDeliveries}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Current Status</p>
                <p className="text-xl font-semibold capitalize">{selectedRider.status}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Acceptance Rate</p>
                <p className="text-xl font-semibold">
                  {riderPerformance.find((r) => r.id === selectedRider.id)?.acceptanceRate.toFixed(0) || 0}%
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Avg Delivery Time</p>
                <p className="text-xl font-semibold">
                  {riderPerformance.find((r) => r.id === selectedRider.id)?.avgDeliveryTime || 0} min
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg col-span-2">
                <p className="text-xs text-gray-500">Total Earnings</p>
                <p className="text-2xl font-bold text-green-600">
                  KSh {riderPerformance.find((r) => r.id === selectedRider.id)?.earnings.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>

            {selectedRider.currentOrderId && (
              <div className="p-3 bg-primary-50 rounded-lg">
                <p className="text-xs text-primary-600">Active Order</p>
                <p className="text-sm font-medium">{selectedRider.currentOrderId}</p>
              </div>
            )}

            <button
              onClick={() => setSelectedRider(null)}
              className="btn-primary w-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

