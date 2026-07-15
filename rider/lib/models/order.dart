class OrderItem {
  final String name;
  final double price;
  final int quantity;
  final String? notes;

  OrderItem({required this.name, required this.price, required this.quantity, this.notes});

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      name: json['name'] as String? ?? 'Item',
      price: (json['price'] as num?)?.toDouble() ?? 0,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      notes: json['notes'] as String?,
    );
  }
}

class StatusHistoryEntry {
  final String status;
  final String message;
  final DateTime timestamp;

  StatusHistoryEntry({required this.status, required this.message, required this.timestamp});

  factory StatusHistoryEntry.fromJson(Map<String, dynamic> json) {
    return StatusHistoryEntry(
      status: json['status'] as String? ?? '',
      message: json['message'] as String? ?? '',
      timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

class DeliveryOrder {
  final String id;
  final String restaurantId;
  final double? restaurantLocLat;
  final double? restaurantLocLng;
  final String? restaurantLocAddr;
  final List<OrderItem> items;
  final double subtotal;
  final double deliveryFee;
  final double tax;
  final double total;
  final String status;
  final String customerName;
  final String? customerPhone;
  final String deliveryAddress;
  final double? deliveryLocLat;
  final double? deliveryLocLng;
  final String? driverId;
  final int? etaMinutes;
  final String? specialInstructions;
  final String paymentMethod;
  final String paymentStatus;
  final List<StatusHistoryEntry> statusHistory;
  final DateTime createdAt;

  DeliveryOrder({
    required this.id,
    required this.restaurantId,
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.tax,
    required this.total,
    required this.status,
    required this.customerName,
    required this.deliveryAddress,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.statusHistory,
    required this.createdAt,
    this.restaurantLocLat,
    this.restaurantLocLng,
    this.restaurantLocAddr,
    this.customerPhone,
    this.deliveryLocLat,
    this.deliveryLocLng,
    this.driverId,
    this.etaMinutes,
    this.specialInstructions,
  });

  String get shortCode => id.length >= 6 ? id.substring(id.length - 6).toUpperCase() : id.toUpperCase();

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) {
    return DeliveryOrder(
      id: json['id'] as String,
      restaurantId: json['restaurantId'] as String? ?? '',
      restaurantLocLat: (json['restaurantLocLat'] as num?)?.toDouble(),
      restaurantLocLng: (json['restaurantLocLng'] as num?)?.toDouble(),
      restaurantLocAddr: json['restaurantLocAddr'] as String?,
      items: (json['items'] as List<dynamic>? ?? [])
          .map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0,
      tax: (json['tax'] as num?)?.toDouble() ?? 0,
      total: (json['total'] as num?)?.toDouble() ?? 0,
      status: json['status'] as String? ?? 'pending',
      customerName: json['customerName'] as String? ?? 'Customer',
      customerPhone: json['customerPhone'] as String?,
      deliveryAddress: json['deliveryAddress'] as String? ?? '',
      deliveryLocLat: (json['deliveryLocLat'] as num?)?.toDouble(),
      deliveryLocLng: (json['deliveryLocLng'] as num?)?.toDouble(),
      driverId: json['driverId'] as String?,
      etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
      specialInstructions: json['specialInstructions'] as String?,
      paymentMethod: json['paymentMethod'] as String? ?? 'cash',
      paymentStatus: json['paymentStatus'] as String? ?? 'pending',
      statusHistory: (json['statusHistory'] as List<dynamic>? ?? [])
          .map((e) => StatusHistoryEntry.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}
