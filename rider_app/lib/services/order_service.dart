import '../core/api_client.dart';
import '../models/order.dart';

class OrderService {
  final _dio = ApiClient.instance.dio;

  /// Orders currently assigned to this rider (any non-final status).
  Future<List<DeliveryOrder>> myActiveOrders(String riderId) async {
    final resp = await _dio.get('/orders', queryParameters: {'driverId': riderId});
    final all = (resp.data as List<dynamic>)
        .map((e) => DeliveryOrder.fromJson(e as Map<String, dynamic>))
        .toList();
    return all.where((o) => o.status != 'delivered' && o.status != 'cancelled').toList();
  }

  Future<List<DeliveryOrder>> myDeliveredOrders(String riderId) async {
    final resp = await _dio.get('/orders', queryParameters: {
      'driverId': riderId,
      'status': 'delivered',
    });
    return (resp.data as List<dynamic>)
        .map((e) => DeliveryOrder.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<DeliveryOrder> updateStatus(String orderId, String status) async {
    final resp = await _dio.patch('/orders/$orderId/status', data: {'status': status});
    return DeliveryOrder.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<DeliveryOrder> getById(String orderId) async {
    final resp = await _dio.get('/orders/$orderId');
    return DeliveryOrder.fromJson(resp.data as Map<String, dynamic>);
  }
}
