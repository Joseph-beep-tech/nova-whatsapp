import 'package:flutter/foundation.dart';
import '../core/api_client.dart';
import '../models/rider.dart';
import '../services/auth_service.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthProvider extends ChangeNotifier {
  final _authService = AuthService();

  AuthStatus status = AuthStatus.unknown;
  Rider? rider;
  String? error;
  bool loading = false;

  Future<void> bootstrap() async {
    final hasSession = await _authService.hasSession();
    if (!hasSession) {
      status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      rider = await _authService.me();
      status = AuthStatus.authenticated;
    } catch (_) {
      await _authService.logout();
      status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String phone, String password) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      rider = await _authService.login(phone, password);
      status = AuthStatus.authenticated;
      return true;
    } catch (e) {
      error = ApiClient.messageFor(e);
      return false;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    rider = null;
    status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  Future<void> setOnlineStatus(bool online) async {
    if (rider == null) return;
    final newStatus = online ? 'available' : 'offline';
    final updated = await _authService.updateStatus(rider!.id, newStatus);
    rider = updated;
    notifyListeners();
  }

  void updateRiderStatusLocally(String newStatus) {
    if (rider == null) return;
    rider = rider!.copyWith(status: newStatus);
    notifyListeners();
  }
}
