import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from 'react-query';
import { restaurantService } from '../services/restaurant.service';
import { ArrowLeft, Upload } from 'lucide-react';
import { useState } from 'react';

export default function CreateRestaurant() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    cuisine: '',
    address: '',
    deliveryFee: '0',
    deliveryTimeMinutesMin: '20',
    deliveryTimeMinutesMax: '40',
    currencyCode: 'KES',
    currencySymbol: 'KSh',
    phone: '',
    hours: '',
    minOrder: '0',
    isOpen: true,
    isPromoted: false,
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const createMutation = useMutation(restaurantService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('restaurants');
      navigate('/restaurants');
    },
  });

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

    formDataObj.append('name', formData.name);
    formDataObj.append('description', formData.description);
    formDataObj.append('cuisine', formData.cuisine);
    formDataObj.append('address', formData.address);
    formDataObj.append('deliveryFee', formData.deliveryFee);
    formDataObj.append('deliveryTimeMinutesMin', formData.deliveryTimeMinutesMin);
    formDataObj.append('deliveryTimeMinutesMax', formData.deliveryTimeMinutesMax);
    formDataObj.append('currencyCode', formData.currencyCode);
    formDataObj.append('currencySymbol', formData.currencySymbol);
    formDataObj.append('phone', formData.phone);
    formDataObj.append('hours', formData.hours);
    formDataObj.append('minOrder', formData.minOrder);
    formDataObj.append('isOpen', formData.isOpen.toString());
    formDataObj.append('isPromoted', formData.isPromoted.toString());

    if (image) {
      formDataObj.append('image', image);
    }

    createMutation.mutate(formDataObj);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/restaurants')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Restaurant</h1>
          <p className="text-gray-600 mt-1">Create a new restaurant profile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Restaurant Image
          </label>
          <div className="flex items-center gap-4">
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Preview"
                className="w-48 h-32 object-cover rounded-lg border-2 border-gray-300"
              />
            ) : (
              <div className="w-48 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                <Upload size={32} className="text-gray-400" />
              </div>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="input-field"
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: 800x400px. Max size: 5MB
              </p>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Restaurant Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="input-field"
              placeholder="e.g., Pizza Palace"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cuisine Type *
            </label>
            <input
              type="text"
              value={formData.cuisine}
              onChange={(e) => setFormData({ ...formData, cuisine: e.target.value })}
              required
              className="input-field"
              placeholder="e.g., Italian, Chinese, Fast Food"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="input-field"
            rows={3}
            placeholder="Brief description of the restaurant..."
          />
        </div>

        {/* Contact Information */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="input-field"
                placeholder="123 Main St, City, State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-field"
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Operating Hours
            </label>
            <input
              type="text"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              className="input-field"
              placeholder="Mon-Sun: 10:00 AM - 10:00 PM"
            />
          </div>
        </div>

        {/* Delivery Settings */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Delivery Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Delivery Fee
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.deliveryFee}
                onChange={(e) => setFormData({ ...formData, deliveryFee: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency Code
              </label>
              <select
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency Symbol
              </label>
              <input
                type="text"
                maxLength={3}
                value={formData.currencySymbol}
                onChange={(e) => setFormData({ ...formData, currencySymbol: e.target.value })}
                className="input-field"
                placeholder="$"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Min Delivery Time (min)
              </label>
              <input
                type="number"
                value={formData.deliveryTimeMinutesMin}
                onChange={(e) => setFormData({ ...formData, deliveryTimeMinutesMin: e.target.value })}
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Delivery Time (min)
              </label>
              <input
                type="number"
                value={formData.deliveryTimeMinutesMax}
                onChange={(e) => setFormData({ ...formData, deliveryTimeMinutesMax: e.target.value })}
                className="input-field"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Order ($)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.minOrder}
              onChange={(e) => setFormData({ ...formData, minOrder: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        {/* Status */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold mb-4">Status</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isOpen}
                onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Restaurant is Open</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPromoted}
                onChange={(e) => setFormData({ ...formData, isPromoted: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium text-gray-700">Promote Restaurant</span>
            </label>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 pt-4 border-t">
          <button
            type="submit"
            disabled={createMutation.isLoading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {createMutation.isLoading ? 'Creating...' : 'Create Restaurant'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/restaurants')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

