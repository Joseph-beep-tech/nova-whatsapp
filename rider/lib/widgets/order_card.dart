import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../core/theme.dart';
import '../models/order.dart';
import 'status_badge.dart';

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, required this.onTap});

  final DeliveryOrder order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final currency = NumberFormat.currency(symbol: 'KSh ', decimalDigits: 0);
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Order #${order.shortCode}',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  StatusBadge(status: order.status),
                ],
              ),
              const SizedBox(height: 12),
              _InfoRow(icon: Icons.storefront_outlined, text: order.restaurantLocAddr ?? 'Restaurant'),
              const SizedBox(height: 6),
              _InfoRow(icon: Icons.location_on_outlined, text: order.deliveryAddress, color: AppColors.gold700),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('${order.items.length} item${order.items.length == 1 ? '' : 's'}',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13)),
                  Text(currency.format(order.total),
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text, this.color});

  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: color ?? Colors.grey.shade500),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 13, color: color ?? Colors.grey.shade700),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}
