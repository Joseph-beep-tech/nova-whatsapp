import 'package:flutter/material.dart';
import '../core/constants.dart';

/// Same status vocabulary as admin-portal's .status-* badges, so a rider
/// and an admin looking at the same order see matching colors/labels.
class StatusBadge extends StatelessWidget {
  const StatusBadge({super.key, required this.status});

  final String status;

  static const _colors = <String, Color>{
    OrderStatus.pending: Color(0xFFD97706),
    OrderStatus.confirmed: Color(0xFF2563EB),
    OrderStatus.preparing: Color(0xFFEA580C),
    OrderStatus.ready: Color(0xFF4F46E5),
    OrderStatus.assigned: Color(0xFF0891B2),
    OrderStatus.pickedUp: Color(0xFF9333EA),
    OrderStatus.onTheWay: Color(0xFF7C3AED),
    OrderStatus.delivered: Color(0xFF059669),
    OrderStatus.cancelled: Color(0xFFDC2626),
  };

  static String label(String status) {
    switch (status) {
      case OrderStatus.pending:
        return 'Pending';
      case OrderStatus.confirmed:
        return 'Confirmed';
      case OrderStatus.preparing:
        return 'Preparing';
      case OrderStatus.ready:
        return 'Ready for Pickup';
      case OrderStatus.assigned:
        return 'Assigned to You';
      case OrderStatus.pickedUp:
        return 'Picked Up';
      case OrderStatus.onTheWay:
        return 'On the Way';
      case OrderStatus.delivered:
        return 'Delivered';
      case OrderStatus.cancelled:
        return 'Cancelled';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _colors[status] ?? Colors.grey;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        label(status).toUpperCase(),
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.3),
      ),
    );
  }
}
