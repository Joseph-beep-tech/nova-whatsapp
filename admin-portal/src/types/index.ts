export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  deliveryFee: number;
  deliveryTimeMinutesMin: number;
  deliveryTimeMinutesMax: number;
  currencyCode?: string;
  currencySymbol?: string;
  address: string;
  imageUrl: string;
  phone?: string;
  hours?: string;
  minOrder?: number;
  features?: string[];
  isPromoted?: boolean;
  discount?: string;
  isOpen: boolean;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl: string;
  category: string;
  isAvailable: boolean;
  isVegetarian?: boolean;
  rating?: number;
  prepTimeMinutes?: number;
}

export interface Order {
  id: string;
  restaurantId: string;
  restaurantLocation?: OrderLocation;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  status: OrderStatus;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryLocation?: OrderLocation;
  driverId?: string;
  etaMinutes?: number;
  statusHistory?: TrackingStep[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface TrackingStep {
  id: string;
  status: OrderStatus | 'created';
  message: string;
  timestamp: string;
}

export interface OrderTrackingSnapshot {
  orderId: string;
  driverId?: string;
  driverLocation?: OrderLocation;
  customerLocation?: OrderLocation;
  restaurantLocation?: OrderLocation;
  status: OrderStatus;
  etaMinutes?: number;
  steps: TrackingStep[];
}

export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: 'card' | 'cash' | 'wallet' | 'online';
  status: PaymentStatus;
  transactionId?: string;
  paidAt?: string;
  createdAt: string;
  customerName: string;
  restaurantId: string;
}

export type RiderStatus = 'available' | 'busy' | 'offline';

export interface Rider {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicle: string;
  vehicleNumber: string;
  status: RiderStatus;
  currentLocation?: OrderLocation;
  currentOrderId?: string;
  rating: number;
  totalDeliveries: number;
  isActive: boolean;
  createdAt: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'assigned'
  | 'picked_up'
  | 'on_the_way'
  | 'delivered'
  | 'cancelled';

export type UserRole = 'super_admin' | 'operations_admin' | 'restaurant_admin' | 'rider' | 'finance_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId?: string;
  isActive?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

