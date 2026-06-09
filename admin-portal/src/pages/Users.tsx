import { useQuery, useMutation, useQueryClient } from 'react-query';
import { userService } from '../services/user.service';
import { Plus, Edit, Trash2, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { User, UserRole } from '../types';

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  operations_admin: 'Operations Admin',
  restaurant_admin: 'Restaurant Admin',
  rider: 'Rider',
  finance_admin: 'Finance Admin',
};

const roleColors: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  operations_admin: 'bg-blue-100 text-blue-800',
  restaurant_admin: 'bg-green-100 text-green-800',
  rider: 'bg-orange-100 text-orange-800',
  finance_admin: 'bg-yellow-100 text-yellow-800',
};

export default function Users() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    role: 'restaurant_admin' as UserRole,
    restaurantId: '',
  });

  const { data: users = [], isLoading } = useQuery('users', userService.getAll);

  const createMutation = useMutation(userService.create, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
      setShowModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation(
    ({ id, data }: { id: string; data: Partial<User> }) => userService.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        setShowModal(false);
        setEditingUser(null);
        resetForm();
      },
    }
  );

  const deleteMutation = useMutation(userService.delete, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
    },
  });

  const toggleActiveMutation = useMutation(
    ({ id, isActive }: { id: string; isActive: boolean }) => userService.toggleActive(id, isActive),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
      },
    }
  );

  const resetForm = () => {
    setFormData({
      email: '',
      name: '',
      password: '',
      role: 'restaurant_admin',
      restaurantId: '',
    });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      password: '',
      role: user.role,
      restaurantId: user.restaurantId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        data: {
          email: formData.email,
          name: formData.name,
          role: formData.role,
          restaurantId: formData.restaurantId || undefined,
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (isLoading) {
    return <div className="text-center py-12">Loading users...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage users, roles, and permissions</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setEditingUser(null);
            resetForm();
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              roleFilter === 'all'
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            All Roles
          </button>
          {(Object.keys(roleLabels) as UserRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                roleFilter === role
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              {roleLabels[role]}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Name</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Email</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Role</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Last Login</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-gray-400" />
                    <span className="font-medium">{user.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">{user.email}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${roleColors[user.role]}`}>
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => toggleActiveMutation.mutate({ id: user.id, isActive: !(user.isActive ?? true) })}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                      user.isActive !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.isActive !== false ? (
                      <>
                        <UserCheck size={12} />
                        Active
                      </>
                    ) : (
                      <>
                        <UserX size={12} />
                        Inactive
                      </>
                    )}
                  </button>
                </td>
                <td className="py-3 px-4 text-sm text-gray-600">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                      title="Edit User"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center py-6 text-gray-500">No users found.</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {editingUser ? 'Edit User' : 'Add User'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingUser(null);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ×
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
                <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="input-field"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role *</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                  className="input-field"
                >
                  {(Object.keys(roleLabels) as UserRole[]).map((role) => (
                    <option key={role} value={role}>
                      {roleLabels[role]}
                    </option>
                  ))}
                </select>
              </div>

              {formData.role === 'restaurant_admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Restaurant ID</label>
                  <input
                    type="text"
                    value={formData.restaurantId}
                    onChange={(e) => setFormData({ ...formData, restaurantId: e.target.value })}
                    className="input-field"
                    placeholder="Optional"
                  />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 btn-primary">
                  {editingUser ? 'Update User' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingUser(null);
                    resetForm();
                  }}
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

