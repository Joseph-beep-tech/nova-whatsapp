import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';

/// Thin Dio wrapper that injects the rider's JWT on every request and
/// centralizes error messages so screens can show something readable
/// instead of a raw stack trace.
class ApiClient {
  ApiClient._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ));
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: AppConstants.secureStorageTokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ));
  }

  static final ApiClient instance = ApiClient._internal();
  final _storage = const FlutterSecureStorage();
  late final Dio _dio;

  Dio get dio => _dio;

  Future<void> saveToken(String token, String riderId) async {
    await _storage.write(key: AppConstants.secureStorageTokenKey, value: token);
    await _storage.write(key: AppConstants.secureStorageRiderIdKey, value: riderId);
  }

  Future<String?> readToken() => _storage.read(key: AppConstants.secureStorageTokenKey);

  Future<String?> readRiderId() => _storage.read(key: AppConstants.secureStorageRiderIdKey);

  Future<void> clearToken() async {
    await _storage.delete(key: AppConstants.secureStorageTokenKey);
    await _storage.delete(key: AppConstants.secureStorageRiderIdKey);
  }

  /// Extracts a human-readable message from a Dio error, falling back
  /// gracefully when the backend didn't send structured JSON.
  static String messageFor(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map && data['message'] is String) return data['message'] as String;
      switch (error.type) {
        case DioExceptionType.connectionTimeout:
        case DioExceptionType.sendTimeout:
        case DioExceptionType.receiveTimeout:
          return 'Connection timed out. Check your internet and try again.';
        case DioExceptionType.connectionError:
          return 'Could not reach the server. Check your internet connection.';
        default:
          return 'Something went wrong. Please try again.';
      }
    }
    return error.toString();
  }
}
