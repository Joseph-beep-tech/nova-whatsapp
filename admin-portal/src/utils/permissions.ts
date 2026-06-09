import { UserRole } from '../types';

export const hasPermission = (userRole: UserRole, permission: string): boolean => {
  const permissions: Record<UserRole, string[]> = {
    super_admin: [
      'manage_all_restaurants',
      'manage_all_orders',
      'manage_all_riders',
      'manage_all_payments',
      'manage_users',
      'view_analytics',
      'manage_settings',
      'approve_restaurants',
      'manage_payouts',
    ],
    operations_admin: [
      'manage_all_orders',
      'manage_all_riders',
      'view_all_restaurants',
      'view_analytics',
      'assign_riders',
      'handle_escalations',
    ],
    restaurant_admin: [
      'manage_own_restaurant',
      'manage_own_orders',
      'view_own_analytics',
      'manage_own_menu',
      'view_own_payouts',
    ],
    rider: [
      'view_own_orders',
      'update_delivery_status',
      'view_own_earnings',
    ],
    finance_admin: [
      'view_all_payments',
      'manage_payouts',
      'view_analytics',
      'manage_settlements',
      'view_reports',
    ],
  };

  return permissions[userRole]?.includes(permission) || false;
};

export const canAccessRoute = (userRole: UserRole, route: string): boolean => {
  const routePermissions: Record<string, UserRole[]> = {
    '/': ['super_admin', 'operations_admin', 'restaurant_admin', 'finance_admin'],
    '/restaurants': ['super_admin', 'operations_admin', 'restaurant_admin'],
    '/orders': ['super_admin', 'operations_admin', 'restaurant_admin'],
    '/tracking': ['super_admin', 'operations_admin'],
    '/payments': ['super_admin', 'finance_admin', 'restaurant_admin'],
    '/riders': ['super_admin', 'operations_admin'],
    '/analytics': ['super_admin', 'operations_admin', 'restaurant_admin', 'finance_admin'],
    '/users': ['super_admin'],
    '/settings': ['super_admin'],
  };

  const allowedRoles = routePermissions[route] || [];
  return allowedRoles.includes(userRole);
};

