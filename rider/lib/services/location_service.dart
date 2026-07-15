import 'dart:async';

import 'package:geolocator/geolocator.dart';

import 'auth_service.dart';

/// Periodically reads GPS position and pushes it to the backend while the
/// rider is available/busy. Foreground-only for v1 — true background
/// tracking (app minimized/screen off) needs native background-service
/// configuration on both platforms, a natural v2 addition.
class LocationService {
  LocationService(this._riderId);

  final String _riderId;
  final _authService = AuthService();
  Timer? _timer;

  Future<bool> ensurePermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.deniedForever) return false;
    if (permission == LocationPermission.denied) return false;

    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    return serviceEnabled;
  }

  void start(Duration interval) {
    _timer?.cancel();
    _pingOnce();
    _timer = Timer.periodic(interval, (_) => _pingOnce());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<Position?> currentPosition() async {
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> _pingOnce() async {
    try {
      final pos = await currentPosition();
      if (pos == null) return;
      await _authService.updateLocation(_riderId, pos.latitude, pos.longitude);
    } catch (_) {
      // Best-effort — a missed ping isn't worth surfacing to the rider.
    }
  }

  void dispose() => stop();
}
