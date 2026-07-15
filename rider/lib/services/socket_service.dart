import 'package:flutter/services.dart';
import 'package:socket_io_client/socket_io_client.dart' as socket_io;

import '../core/api_client.dart';
import '../core/constants.dart';

/// Instant in-app alerts while the app is foregrounded — a Socket.IO
/// counterpart to the existing REST poll in OrderProvider, which stays as a
/// fallback in case the socket drops. Mirrors LocationService's shape:
/// construct with the rider id, call connect()/disconnect(), fail silently.
class SocketService {
  SocketService(String riderId, {required this.onOrderEvent});

  final void Function(String event, dynamic payload) onOrderEvent;
  socket_io.Socket? _socket;

  Future<void> connect() async {
    try {
      final token = await ApiClient.instance.readToken();
      if (token == null) return;

      final uri = Uri.parse(AppConstants.apiBaseUrl);
      final socketUrl = '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';

      _socket = socket_io.io(
        socketUrl,
        socket_io.OptionBuilder()
            .setTransports(['websocket'])
            .setAuth({'token': token})
            .disableAutoConnect()
            .build(),
      );

      _socket!
        ..onConnect((_) {})
        ..on('order:assigned', (data) {
          HapticFeedback.vibrate();
          SystemSound.play(SystemSoundType.alert);
          onOrderEvent('order:assigned', data);
        })
        ..on('order:status', (data) => onOrderEvent('order:status', data))
        ..connect();
    } catch (_) {
      // Best-effort — the REST poll in OrderProvider still covers this rider.
    }
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }
}
