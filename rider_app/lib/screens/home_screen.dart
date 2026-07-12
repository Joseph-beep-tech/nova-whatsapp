import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../core/constants.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/order_provider.dart';
import '../services/location_service.dart';
import '../widgets/order_card.dart';
import 'history_screen.dart';
import 'profile_screen.dart';

/// Bottom-nav shell hosting Home / History / Profile. Kept as a simple
/// IndexedStack (rather than go_router's StatefulShellRoute) to keep the
/// navigation surface small and easy to reason about.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tabIndex = 0;
  LocationService? _locationService;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    final auth = context.read<AuthProvider>();
    final rider = auth.rider;
    if (rider == null) return;

    context.read<OrderProvider>().startPolling(rider.id);

    _locationService = LocationService(rider.id);
    final granted = await _locationService!.ensurePermission();
    if (granted && rider.status != RiderStatus.offline) {
      _locationService!.start(AppConstants.locationPingInterval);
    }
  }

  @override
  void dispose() {
    _locationService?.dispose();
    context.read<OrderProvider>().stopPolling();
    super.dispose();
  }

  void _onOnlineToggle(bool online) async {
    await context.read<AuthProvider>().setOnlineStatus(online);
    if (online) {
      final granted = await _locationService?.ensurePermission() ?? false;
      if (granted) _locationService?.start(AppConstants.locationPingInterval);
    } else {
      _locationService?.stop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final tabs = [
      _HomeTab(onOnlineToggle: _onOnlineToggle),
      const HistoryScreen(),
      const ProfileScreen(),
    ];

    return Scaffold(
      body: SafeArea(child: IndexedStack(index: _tabIndex, children: tabs)),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tabIndex,
        onTap: (i) => setState(() => _tabIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.two_wheeler_outlined), label: 'Deliveries'),
          BottomNavigationBarItem(icon: Icon(Icons.history_rounded), label: 'History'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline_rounded), label: 'Profile'),
        ],
      ),
    );
  }
}

class _HomeTab extends StatelessWidget {
  const _HomeTab({required this.onOnlineToggle});

  final ValueChanged<bool> onOnlineToggle;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final orders = context.watch<OrderProvider>();
    final rider = auth.rider;
    final isOnline = rider?.status != RiderStatus.offline;
    final isBusy = rider?.status == RiderStatus.busy;

    return RefreshIndicator(
      onRefresh: () => context.read<OrderProvider>().refreshActive(),
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Hi, ${rider?.name.split(' ').first ?? 'Rider'} 👋',
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 2),
                      Text(
                        isBusy ? 'On a delivery' : (isOnline ? 'Online — ready for deliveries' : 'Offline'),
                        style: TextStyle(
                          color: isBusy
                              ? AppColors.statusBusy
                              : (isOnline ? AppColors.statusAvailable : Colors.grey.shade500),
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  if (!isBusy)
                    Switch(
                      value: isOnline,
                      activeColor: AppColors.gold500,
                      onChanged: onOnlineToggle,
                    ),
                ],
              ),
            ),
          ),
          if (orders.currentDelivery == null)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.check_circle_outline_rounded, size: 56, color: Colors.grey.shade300),
                      const SizedBox(height: 16),
                      Text(
                        isOnline ? "You're all caught up" : 'Go online to receive deliveries',
                        style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              sliver: SliverList.list(
                children: [
                  Text('ACTIVE DELIVERY',
                      style: TextStyle(
                          color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
                  const SizedBox(height: 10),
                  OrderCard(
                    order: orders.currentDelivery!,
                    onTap: () => context.push('/order/${orders.currentDelivery!.id}'),
                  ),
                  if (orders.activeOrders.length > 1) ...[
                    const SizedBox(height: 20),
                    Text('OTHER ASSIGNED',
                        style: TextStyle(
                            color: Colors.grey.shade500, fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: 0.6)),
                    const SizedBox(height: 10),
                    for (final order in orders.activeOrders.skip(1)) ...[
                      OrderCard(order: order, onTap: () => context.push('/order/${order.id}')),
                      const SizedBox(height: 12),
                    ],
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}
