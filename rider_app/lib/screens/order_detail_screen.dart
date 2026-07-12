import 'package:collection/collection.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/constants.dart';
import '../core/theme.dart';
import '../models/order.dart';
import '../providers/order_provider.dart';
import '../services/location_service.dart';
import '../services/routing_service.dart';
import '../widgets/primary_button.dart';
import '../widgets/status_badge.dart';

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  final _routingService = RoutingService();
  final _locationService = LocationService('');
  List<LatLng> _route = [];
  LatLng? _riderPosition;
  bool _updating = false;
  String? _error;

  DeliveryOrder? get _order {
    final orders = context.read<OrderProvider>();
    final match = orders.activeOrders.where((o) => o.id == widget.orderId);
    return match.isNotEmpty ? match.first : null;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadRoute());
  }

  Future<void> _loadRoute() async {
    final order = _order;
    if (order == null) return;

    final pos = await _locationService.currentPosition();
    if (pos != null && mounted) {
      setState(() => _riderPosition = LatLng(pos.latitude, pos.longitude));
    }

    final from = _riderPosition ??
        (order.restaurantLocLat != null && order.restaurantLocLng != null
            ? LatLng(order.restaurantLocLat!, order.restaurantLocLng!)
            : null);
    final to = order.deliveryLocLat != null && order.deliveryLocLng != null
        ? LatLng(order.deliveryLocLat!, order.deliveryLocLng!)
        : null;

    if (from != null && to != null) {
      final route = await _routingService.route(from, to);
      if (mounted) setState(() => _route = route);
    }
  }

  String? _nextStatus(String current) {
    switch (current) {
      case OrderStatus.assigned:
        return OrderStatus.pickedUp;
      case OrderStatus.pickedUp:
        return OrderStatus.onTheWay;
      case OrderStatus.onTheWay:
        return OrderStatus.delivered;
      default:
        return null;
    }
  }

  String _actionLabel(String current) {
    switch (current) {
      case OrderStatus.assigned:
        return 'Confirm Pickup';
      case OrderStatus.pickedUp:
        return 'Start Delivery';
      case OrderStatus.onTheWay:
        return 'Mark Delivered';
      default:
        return 'Done';
    }
  }

  Future<void> _advance() async {
    final order = _order;
    if (order == null) return;
    final next = _nextStatus(order.status);
    if (next == null) return;

    setState(() {
      _updating = true;
      _error = null;
    });
    try {
      await context.read<OrderProvider>().advanceStatus(order.id, next);
      if (next == OrderStatus.delivered && mounted) {
        context.pop();
      }
    } catch (e) {
      setState(() => _error = 'Could not update status. Please try again.');
    } finally {
      if (mounted) setState(() => _updating = false);
    }
  }

  Future<void> _call(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  Future<void> _whatsapp(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    final uri = Uri.parse('https://wa.me/$digits');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final order = context.watch<OrderProvider>().activeOrders.where((o) => o.id == widget.orderId).firstOrNull;
    final currency = NumberFormat.currency(symbol: 'KSh ', decimalDigits: 0);

    if (order == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Order')),
        body: const Center(child: Text('This order is no longer active.')),
      );
    }

    final restaurantPoint = order.restaurantLocLat != null && order.restaurantLocLng != null
        ? LatLng(order.restaurantLocLat!, order.restaurantLocLng!)
        : null;
    final deliveryPoint = order.deliveryLocLat != null && order.deliveryLocLng != null
        ? LatLng(order.deliveryLocLat!, order.deliveryLocLng!)
        : null;

    final bounds = <LatLng>[
      if (restaurantPoint != null) restaurantPoint,
      if (deliveryPoint != null) deliveryPoint,
      if (_riderPosition != null) _riderPosition!,
    ];

    return Scaffold(
      appBar: AppBar(title: Text('Order #${order.shortCode}')),
      body: Column(
        children: [
          SizedBox(
            height: 260,
            child: bounds.length < 2
                ? Container(
                    color: AppColors.gold50,
                    child: const Center(child: Text('Map unavailable — missing coordinates')),
                  )
                : FlutterMap(
                    options: MapOptions(
                      initialCameraFit: CameraFit.coordinates(
                        coordinates: bounds,
                        padding: const EdgeInsets.all(48),
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.novago.rider_app',
                      ),
                      if (_route.isNotEmpty)
                        PolylineLayer(polylines: [
                          Polyline(points: _route, color: AppColors.gold600, strokeWidth: 4),
                        ]),
                      MarkerLayer(markers: [
                        if (restaurantPoint != null)
                          Marker(
                            point: restaurantPoint,
                            width: 40,
                            height: 40,
                            child: const _MapPin(icon: Icons.storefront, color: AppColors.info),
                          ),
                        if (deliveryPoint != null)
                          Marker(
                            point: deliveryPoint,
                            width: 40,
                            height: 40,
                            child: const _MapPin(icon: Icons.flag, color: AppColors.danger),
                          ),
                        if (_riderPosition != null)
                          Marker(
                            point: _riderPosition!,
                            width: 36,
                            height: 36,
                            child: const _MapPin(icon: Icons.two_wheeler, color: AppColors.gold600),
                          ),
                      ]),
                    ],
                  ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    StatusBadge(status: order.status),
                    Text(currency.format(order.total), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
                  ],
                ),
                const SizedBox(height: 20),
                _SectionCard(
                  title: 'Pickup',
                  icon: Icons.storefront_outlined,
                  child: Text(order.restaurantLocAddr ?? 'Restaurant address unavailable'),
                ),
                const SizedBox(height: 14),
                _SectionCard(
                  title: 'Deliver to',
                  icon: Icons.location_on_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(order.deliveryAddress),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _call(order.customerPhone),
                              icon: const Icon(Icons.call_outlined, size: 18),
                              label: const Text('Call'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () => _whatsapp(order.customerPhone),
                              icon: const Icon(Icons.chat_outlined, size: 18),
                              label: const Text('WhatsApp'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _SectionCard(
                  title: 'Order (${order.items.length} item${order.items.length == 1 ? '' : 's'})',
                  icon: Icons.receipt_long_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final item in order.items)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(child: Text('${item.quantity}× ${item.name}')),
                              Text(currency.format(item.price * item.quantity)),
                            ],
                          ),
                        ),
                      const Divider(height: 20),
                      _totalRow('Subtotal', currency.format(order.subtotal)),
                      _totalRow('Delivery fee', currency.format(order.deliveryFee)),
                      _totalRow('Tax', currency.format(order.tax)),
                      const SizedBox(height: 4),
                      _totalRow('Total', currency.format(order.total), bold: true),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Icon(
                            order.paymentMethod == 'mpesa' ? Icons.phone_android : Icons.payments_outlined,
                            size: 16,
                            color: Colors.grey.shade600,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '${order.paymentMethod == 'mpesa' ? 'M-Pesa' : 'Cash'} · ${order.paymentStatus}',
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                      if (order.specialInstructions != null && order.specialInstructions!.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: AppColors.gold50,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(order.specialInstructions!, style: const TextStyle(fontSize: 13)),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                if (_error != null) ...[
                  Text(_error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)),
                  const SizedBox(height: 10),
                ],
                if (_nextStatus(order.status) != null)
                  PrimaryButton(
                    label: _actionLabel(order.status),
                    loading: _updating,
                    onPressed: _advance,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(String label, String value, {bool bold = false}) {
    final style = TextStyle(
      fontSize: bold ? 15 : 13,
      fontWeight: bold ? FontWeight.w800 : FontWeight.w500,
      color: bold ? Colors.black : Colors.grey.shade600,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text(value, style: style)],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.icon, required this.child});

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 17, color: AppColors.gold600),
                const SizedBox(width: 8),
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _MapPin extends StatelessWidget {
  const _MapPin({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 4)],
      ),
      child: Icon(icon, color: Colors.white, size: 18),
    );
  }
}
