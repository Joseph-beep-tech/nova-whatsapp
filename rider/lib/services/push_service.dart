import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'auth_service.dart';

/// Background/terminated messages are displayed automatically by the OS from
/// the payload's `notification` block (sent by the backend's push helper) —
/// this handler only exists because the plugin requires a top-level function
/// to be registered, even when there's nothing extra to do here.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

/// Registers this device for push notifications and shows a local
/// notification for messages that arrive while the app is foregrounded
/// (bare FCM foreground messages don't auto-display on Android).
///
/// No-ops everywhere if Firebase was never configured (no
/// google-services.json/GoogleService-Info.plist yet) — the app runs fine
/// without it, just without background push; in-app socket alerts still work.
class PushService {
  PushService(this._riderId);
  final String _riderId;
  final _authService = AuthService();

  static bool _firebaseReady = false;
  static final _localNotifications = FlutterLocalNotificationsPlugin();

  /// Call once at app startup, before runApp().
  static Future<void> initializeFirebase() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _firebaseReady = true;
    } catch (_) {
      _firebaseReady = false;
    }

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosInit = DarwinInitializationSettings();
    await _localNotifications.initialize(
      settings: const InitializationSettings(android: androidInit, iOS: iosInit),
    );
  }

  /// Call once the rider is known (e.g. on the home screen), to request
  /// permission and register this device's token with the backend.
  Future<void> register() async {
    if (!_firebaseReady) return;
    try {
      final settings = await FirebaseMessaging.instance.requestPermission();
      if (settings.authorizationStatus == AuthorizationStatus.denied) return;

      final token = await FirebaseMessaging.instance.getToken();
      if (token == null) return;

      await _authService.registerPushToken(_riderId, token);

      FirebaseMessaging.onMessage.listen(_showForegroundNotification);
    } catch (_) {
      // Best-effort — this rider still gets in-app socket alerts.
    }
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        'novago_orders',
        'Order updates',
        importance: Importance.high,
        priority: Priority.high,
      ),
      iOS: DarwinNotificationDetails(),
    );
    await _localNotifications.show(
      id: message.hashCode,
      title: message.notification?.title ?? 'NovaGo',
      body: message.notification?.body ?? '',
      notificationDetails: details,
    );
  }
}
