import 'dart:async';
import 'package:flutter/foundation.dart';
import '../core/constants.dart';
import '../models/order.dart';
import '../services/order_service.dart';

class OrderProvider extends ChangeNotifier {
  final _orderService = OrderService();
  Timer? _pollTimer;

  List<DeliveryOrder> activeOrders = [];
  List<DeliveryOrder> history = [];
  bool loading = false;
  String? error;
  String? _riderId;

  DeliveryOrder? get currentDelivery => activeOrders.isNotEmpty ? activeOrders.first : null;

  void startPolling(String riderId) {
    _riderId = riderId;
    _pollTimer?.cancel();
    refreshActive();
    _pollTimer = Timer.periodic(AppConstants.orderPollInterval, (_) => refreshActive());
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> refreshActive() async {
    if (_riderId == null) return;
    try {
      activeOrders = await _orderService.myActiveOrders(_riderId!);
      error = null;
    } catch (e) {
      // Keep showing the last known list on a transient failure — don't
      // flash an error banner for a single missed poll.
    }
    notifyListeners();
  }

  Future<void> loadHistory(String riderId) async {
    loading = true;
    notifyListeners();
    try {
      history = await _orderService.myDeliveredOrders(riderId);
      error = null;
    } catch (e) {
      error = e.toString();
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<DeliveryOrder> advanceStatus(String orderId, String nextStatus) async {
    final updated = await _orderService.updateStatus(orderId, nextStatus);
    final idx = activeOrders.indexWhere((o) => o.id == orderId);
    if (idx != -1) {
      if (nextStatus == OrderStatus.delivered || nextStatus == OrderStatus.cancelled) {
        activeOrders.removeAt(idx);
      } else {
        activeOrders[idx] = updated;
      }
      notifyListeners();
    }
    return updated;
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
