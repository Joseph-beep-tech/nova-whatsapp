import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { restaurantService } from '../services/restaurant.service';
import { Plus, Edit, Trash2, Eye, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { useState } from 'react';

export default function Restaurants() {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: restaurants = [], isLoading } = useQuery(
    'restaurants',
    restaurantService.getAll
  );

  const toggleStatusMutation = useMutation(
    ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      const restaurant = restaurants.find((r) => r.id === id);
      if (!restaurant) throw new Error('Restaurant not found');
      
      const formData = new FormData();
      Object.entries(restaurant).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (key === 'features' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else if (key !== 'id' && key !== 'imageUrl') {
            formData.append(key, value.toString());
          }
        }
      });
      formData.append('isOpen', isOpen.toString());
      
      return restaurantService.update(id, formData);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries('restaurants');
      },
    }
  );

  const filteredRestaurants = restaurants.filter((restaurant) =>
    restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    restaurant.cuisine.toLowerCase().includes(searchQuery.toLowerCase()) ||
    restaurant.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const deleteMutation = useMutation(restaurantService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('restaurants');
      setDeleteId(null);
    },
  });

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this restaurant?')) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading restaurants...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Restaurants</h1>
          <p className="text-gray-600 mt-1">Manage all restaurants</p>
        </div>
        <Link
          to="/restaurants/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Restaurant
        </Link>
      </div>

      {/* Search Bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search restaurants by name, cuisine, or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRestaurants.map((restaurant) => (
          <div key={restaurant.id} className="card hover:shadow-lg transition-shadow">
            <div className="relative h-48 mb-4 rounded-lg overflow-hidden">
              <img
                src={`http://localhost:4000${restaurant.imageUrl}`}
                alt={restaurant.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200';
                }}
              />
              <div className="absolute top-2 right-2 flex gap-2">
                {restaurant.isPromoted && (
                  <div className="bg-yellow-400 text-yellow-900 px-2 py-1 rounded text-xs font-bold">
                    Promoted
                  </div>
                )}
                <button
                  onClick={() =>
                    toggleStatusMutation.mutate({
                      id: restaurant.id,
                      isOpen: !restaurant.isOpen,
                    })
                  }
                  className={`p-1 rounded ${
                    restaurant.isOpen
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-400 text-white'
                  }`}
                  title={restaurant.isOpen ? 'Open - Click to close' : 'Closed - Click to open'}
                >
                  {restaurant.isOpen ? (
                    <ToggleRight size={16} />
                  ) : (
                    <ToggleLeft size={16} />
                  )}
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-2">{restaurant.name}</h3>
            <p className="text-gray-600 text-sm mb-2">{restaurant.cuisine}</p>
            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span>⭐ {restaurant.rating.toFixed(1)}</span>
              <span>•</span>
              <span>{restaurant.deliveryTimeMinutesMin}-{restaurant.deliveryTimeMinutesMax} min</span>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to={`/restaurants/${restaurant.id}`}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                Orders
              </Link>
              <Link
                to={`/restaurants/${restaurant.id}/menu`}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                Menu
              </Link>
              <Link
                to={`/restaurants/${restaurant.id}/details`}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <Eye size={16} />
                Details
              </Link>
              <button
                onClick={() => handleDelete(restaurant.id)}
                disabled={deleteId === restaurant.id}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRestaurants.length === 0 && restaurants.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No restaurants match your search query.
        </div>
      )}

      {restaurants.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No restaurants found. Add your first restaurant to get started.
        </div>
      )}
    </div>
  );
}

