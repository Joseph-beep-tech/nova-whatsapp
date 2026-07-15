class AppConstants {
  AppConstants._();

  /// Same production backend the admin-portal and WhatsApp pipeline use.
  static const String apiBaseUrl = 'https://nova-whatsapp-production-ea60.up.railway.app/api';

  /// Free public OSRM demo routing server — no API key. Shared/rate-limited;
  /// self-host if usage grows.
  static const String osrmBaseUrl = 'https://router.project-osrm.org';

  static const String secureStorageTokenKey = 'novago_rider_token';
  static const String secureStorageRiderIdKey = 'novago_rider_id';

  static const Duration orderPollInterval = Duration(seconds: 10);
  static const Duration locationPingInterval = Duration(seconds: 15);
}

/// Order status values — mirrors backend/prisma/schema.prisma's Order.status
/// and admin-portal's status-* CSS classes for the same badge language
/// across web and mobile.
class OrderStatus {
  OrderStatus._();

  static const pending = 'pending';
  static const confirmed = 'confirmed';
  static const preparing = 'preparing';
  static const ready = 'ready';
  static const assigned = 'assigned';
  static const pickedUp = 'picked_up';
  static const onTheWay = 'on_the_way';
  static const delivered = 'delivered';
  static const cancelled = 'cancelled';

  static const active = [assigned, pickedUp, onTheWay];
}

class RiderStatus {
  RiderStatus._();

  static const available = 'available';
  static const busy = 'busy';
  static const offline = 'offline';
}
