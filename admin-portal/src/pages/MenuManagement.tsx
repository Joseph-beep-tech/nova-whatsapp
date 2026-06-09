import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { menuService } from '../services/menu.service';
import { restaurantService } from '../services/restaurant.service';
import { ArrowLeft, Plus, Edit, Trash2, X, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { MenuItem } from '../types';

export default function MenuManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Popular',
    isVegetarian: false,
    isAvailable: true,
    image: null as File | null,
  });

  const { data: restaurant } = useQuery(
    ['restaurant', id],
    () => restaurantService.getById(id!),
    { enabled: !!id }
  );

  const { data: menuItems = [], isLoading } = useQuery(
    ['menu', id],
    () => menuService.getByRestaurant(id!),
    { enabled: !!id }
  );

  const createMutation = useMutation(menuService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries(['menu', id]);
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation(
    (data: FormData) => menuService.update(editingItem!.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['menu', id]);
        setShowModal(false);
        setEditingItem(null);
        resetForm();
      },
    }
  );

  const deleteMutation = useMutation(menuService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries(['menu', id]);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: 'Popular',
      isVegetarian: false,
      isAvailable: true,
      image: null,
    });
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      category: item.category,
      isVegetarian: item.isVegetarian || false,
      isAvailable: item.isAvailable,
      image: null,
    });
    setShowModal(true);
  };

  const toggleAvailabilityMutation = useMutation(
    (item: MenuItem) => {
      const formDataObj = new FormData();
      formDataObj.append('restaurantId', id!);
      formDataObj.append('name', item.name);
      formDataObj.append('description', item.description || '');
      formDataObj.append('price', item.price.toString());
      formDataObj.append('category', item.category);
      formDataObj.append('isVegetarian', (item.isVegetarian || false).toString());
      formDataObj.append('isAvailable', (!item.isAvailable).toString());
      
      return menuService.update(item.id, formDataObj);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['menu', id]);
      },
    }
  );

  const filteredMenuItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === null || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formDataObj = new FormData();
    
    formDataObj.append('restaurantId', id!);
    formDataObj.append('name', formData.name);
    formDataObj.append('description', formData.description);
    formDataObj.append('price', formData.price);
    formDataObj.append('category', formData.category);
    formDataObj.append('isVegetarian', formData.isVegetarian.toString());
    formDataObj.append('isAvailable', formData.isAvailable.toString());
    
    if (formData.image) {
      formDataObj.append('image', formData.image);
    }

    if (editingItem) {
      updateMutation.mutate(formDataObj);
    } else {
      createMutation.mutate(formDataObj);
    }
  };

  const handleDelete = (itemId: string) => {
    if (confirm('Are you sure you want to delete this menu item?')) {
      deleteMutation.mutate(itemId);
    }
  };

  const categories = Array.from(new Set(menuItems.map((item) => item.category)));

  if (isLoading) {
    return <div className="text-center py-12">Loading menu...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/restaurants')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {restaurant?.name} - Menu
            </h1>
            <p className="text-gray-600 mt-1">Manage menu items</p>
          </div>
        </div>
        <button onClick={() => { setShowModal(true); resetForm(); setEditingItem(null); }} className="btn-primary flex items-center gap-2">
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMenuItems.map((item) => (
          <div key={item.id} className="card hover:shadow-lg transition-shadow">
            <div className="relative h-48 mb-4 rounded-lg overflow-hidden">
              <img
                src={`http://localhost:4000${item.imageUrl}`}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300';
                }}
              />
              {item.isVegetarian && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
                  V
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-1">{item.name}</h3>
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">{item.description}</p>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-bold text-primary-500">
                {(restaurant?.currencySymbol || 'KSh')}{item.price.toFixed(2)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{item.category}</span>
                <button
                  onClick={() => toggleAvailabilityMutation.mutate(item)}
                  className={`p-1 rounded ${
                    item.isAvailable
                      ? 'text-green-600 hover:bg-green-50'
                      : 'text-gray-400 hover:bg-gray-50'
                  }`}
                  title={item.isAvailable ? 'Available - Click to disable' : 'Unavailable - Click to enable'}
                >
                  {item.isAvailable ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="flex-1 btn-secondary flex items-center justify-center gap-2"
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredMenuItems.length === 0 && menuItems.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          No menu items match your search or filter criteria.
        </div>
      )}

      {menuItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No menu items yet. Add your first item to get started.
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); setEditingItem(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price * ({restaurant?.currencySymbol || 'KSh'})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                    className="input-field"
                    placeholder="Popular, Pizza, etc."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isVegetarian}
                    onChange={(e) => setFormData({ ...formData, isVegetarian: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Vegetarian</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">Available</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image {!editingItem && '(optional)'}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                  className="input-field"
                />
                {editingItem && formData.image && (
                  <p className="text-xs text-gray-500 mt-1">
                    Leave empty to keep current image
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 btn-primary">
                  {editingItem ? 'Update Item' : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); setEditingItem(null); }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

