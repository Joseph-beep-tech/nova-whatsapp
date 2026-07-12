import '../core/api_client.dart';
import '../models/rider.dart';

class AuthService {
  final _dio = ApiClient.instance.dio;

  Future<Rider> login(String phone, String password) async {
    final resp = await _dio.post('/riders/login', data: {'phone': phone, 'password': password});
    final token = resp.data['token'] as String;
    final rider = Rider.fromJson(resp.data['rider'] as Map<String, dynamic>);
    await ApiClient.instance.saveToken(token, rider.id);
    return rider;
  }

  Future<Rider> me() async {
    final resp = await _dio.get('/riders/me');
    return Rider.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<bool> hasSession() async {
    final token = await ApiClient.instance.readToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> logout() => ApiClient.instance.clearToken();

  Future<Rider> updateStatus(String riderId, String status) async {
    final resp = await _dio.patch('/riders/$riderId/status', data: {'status': status});
    return Rider.fromJson(resp.data as Map<String, dynamic>);
  }

  Future<void> updateLocation(String riderId, double lat, double lng) async {
    await _dio.patch('/riders/$riderId/location', data: {'lat': lat, 'lng': lng});
  }
}
