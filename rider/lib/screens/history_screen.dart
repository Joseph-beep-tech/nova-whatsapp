import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../providers/order_provider.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _loaded = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_loaded) {
      _loaded = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final riderId = context.read<AuthProvider>().rider?.id;
        if (riderId != null) context.read<OrderProvider>().loadHistory(riderId);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final orders = context.watch<OrderProvider>();
    final currency = NumberFormat.currency(symbol: 'KSh ', decimalDigits: 0);
    final dateFmt = DateFormat('MMM d, h:mm a');

    return Scaffold(
      appBar: AppBar(title: const Text('Delivery History'), automaticallyImplyLeading: false),
      body: RefreshIndicator(
        onRefresh: () async {
          final riderId = context.read<AuthProvider>().rider?.id;
          if (riderId != null) await context.read<OrderProvider>().loadHistory(riderId);
        },
        child: orders.loading && orders.history.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : orders.history.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 100),
                      Icon(Icons.inventory_2_outlined, size: 56, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Center(
                        child: Text('No completed deliveries yet',
                            style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: orders.history.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, i) {
                      final order = orders.history[i];
                      return Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            children: [
                              Container(
                                width: 40,
                                height: 40,
                                decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: const Icon(Icons.check_rounded, color: Colors.green, size: 20),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Order #${order.shortCode}', style: const TextStyle(fontWeight: FontWeight.w700)),
                                    const SizedBox(height: 2),
                                    Text(order.deliveryAddress,
                                        style: TextStyle(fontSize: 12.5, color: Colors.grey.shade600),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis),
                                    const SizedBox(height: 2),
                                    Text(dateFmt.format(order.createdAt),
                                        style: TextStyle(fontSize: 11.5, color: Colors.grey.shade400)),
                                  ],
                                ),
                              ),
                              Text(currency.format(order.total), style: const TextStyle(fontWeight: FontWeight.w700)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
