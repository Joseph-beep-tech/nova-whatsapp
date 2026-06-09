import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { restaurantService } from '../services/restaurant.service';
import { ArrowLeft, Edit, Save, X, Upload, UtensilsCrossed, ClipboardList } from 'lucide-react';
import { useState } from 'react';
import { Restaurant } from '../types';

export default function RestaurantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Restaurant>>({});
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { data: restaurant, isLoading } = useQuery(
    ['restaurant', id],
    () => restaurantService.getById(id!),
    {
      enabled: !!id,
      onSuccess: (data) => {
        setFormData(data);
      },
    }
  );

  const updateMutation = useMutation(
    (data: FormData) => restaurantService.update(id!, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['restaurant', id]);
        setIsEditing(false);
      },
    }
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formDataObj = new FormData();
    
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (key === 'features' && Array.isArray(value)) {
          formDataObj.append(key, JSON.stringify(value));
        } else if (key !== 'imageUrl' && key !== 'id') {
          formDataObj.append(key, value.toString());
        }
      }
    });

    if (image) {
      formDataObj.append('image', image);
    }

    updateMutation.mutate(formDataObj);
  };

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!restaurant) {
    return <div className="text-center py-12">Restaurant not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/restaurants')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-gray-600 mt-1">{restaurant.cuisine}</p>
        </div>
        <button
          onClick={() => navigate(`/restaurants/${id}`)}
          className="btn-secondary flex items-center gap-2"
        >
          <ClipboardList size={16} />
          Orders
        </button>
        <button
          onClick={() => navigate(`/restaurants/${id}/menu`)}
          className="btn-secondary flex items-center gap-2"
        >
          <UtensilsCrossed size={16} />
          Manage Menu
        </button>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className="btn-primary flex items-center gap-2">
            <Edit size={16} />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-2">
              <Save size={16} />
              Save
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData(restaurant);
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Restaurant Information</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={isEditing ? formData.name || '' : restaurant.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={isEditing ? formData.description || '' : restaurant.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!isEditing}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine</label>
                  <input
                    type="text"
                    value={isEditing ? formData.cuisine || '' : restaurant.cuisine}
                    onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <input
                    type="text"
                    value={isEditing ? formData.address || '' : restaurant.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Fee</label>
                  <input
                    type="number"
                    step="0.01"
                    value={isEditing ? formData.deliveryFee || 0 : restaurant.deliveryFee}
                    onChange={(e) => setFormData({ ...formData, deliveryFee: parseFloat(e.target.value) })}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Min Order</label>
                  <input
                    type="number"
                    step="0.01"
                    value={isEditing ? formData.minOrder || 0 : restaurant.minOrder || 0}
                    onChange={(e) => setFormData({ ...formData, minOrder: parseFloat(e.target.value) })}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={isEditing ? formData.phone || '' : restaurant.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Opening Hours / Days</label>
                  <input
                    type="text"
                    value={isEditing ? formData.hours || '' : restaurant.hours || ''}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                    placeholder="Mon-Sun: 10:00 AM - 11:00 PM"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency Code</label>
                  <select
                    value={isEditing ? formData.currencyCode || 'KES' : restaurant.currencyCode || 'KES'}
                    onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                  >
                    {['USD', 'EUR', 'GBP', 'KES', 'NGN', 'GHS', 'ZAR'].map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={isEditing ? formData.currencySymbol || restaurant.currencySymbol || 'KSh' : restaurant.currencySymbol || 'KSh'}
                    onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                    disabled={!isEditing}
                    className="input-field"
                  />
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="relative h-48 rounded-lg overflow-hidden mb-4">
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={`http://localhost:4000${restaurant.imageUrl}`}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200';
                  }}
                />
              )}
              {isEditing && (
                <div className="absolute bottom-2 right-2">
                  <label className="btn-primary flex items-center gap-2 cursor-pointer">
                    <Upload size={16} />
                    Change Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Rating</span>
                <span className="font-medium">⭐ {restaurant.rating.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Delivery Time</span>
                <span className="font-medium">
                  {restaurant.deliveryTimeMinutesMin}-{restaurant.deliveryTimeMinutesMax} min
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                <span
                  className={`font-medium ${restaurant.isOpen ? 'text-green-600' : 'text-red-600'}`}
                >
                  {restaurant.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

