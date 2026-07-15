class Rider {
  final String id;
  final String name;
  final String phone;
  final String? email;
  final String status;
  final double? currentLat;
  final double? currentLng;
  final String vehicleType;
  final DateTime createdAt;

  Rider({
    required this.id,
    required this.name,
    required this.phone,
    required this.status,
    required this.vehicleType,
    required this.createdAt,
    this.email,
    this.currentLat,
    this.currentLng,
  });

  factory Rider.fromJson(Map<String, dynamic> json) {
    return Rider(
      id: json['id'] as String,
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String?,
      status: json['status'] as String? ?? 'offline',
      currentLat: (json['currentLat'] as num?)?.toDouble(),
      currentLng: (json['currentLng'] as num?)?.toDouble(),
      vehicleType: json['vehicleType'] as String? ?? 'motorcycle',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
    );
  }

  Rider copyWith({String? status, double? currentLat, double? currentLng}) {
    return Rider(
      id: id,
      name: name,
      phone: phone,
      email: email,
      status: status ?? this.status,
      currentLat: currentLat ?? this.currentLat,
      currentLng: currentLng ?? this.currentLng,
      vehicleType: vehicleType,
      createdAt: createdAt,
    );
  }
}
