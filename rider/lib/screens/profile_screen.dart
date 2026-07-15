import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/theme.dart';
import '../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final rider = auth.rider;

    return Scaffold(
      appBar: AppBar(title: const Text('Profile'), automaticallyImplyLeading: false),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: AppColors.gold100,
                  child: Text(
                    (rider?.name.isNotEmpty ?? false) ? rider!.name[0].toUpperCase() : '?',
                    style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: AppColors.gold700),
                  ),
                ),
                const SizedBox(height: 12),
                Text(rider?.name ?? 'Rider', style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _statusColor(rider?.status).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    (rider?.status ?? 'offline').toUpperCase(),
                    style: TextStyle(color: _statusColor(rider?.status), fontSize: 11, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),
          Card(
            child: Column(
              children: [
                _InfoTile(icon: Icons.phone_outlined, label: 'Phone', value: rider?.phone ?? '—'),
                const Divider(height: 1),
                _InfoTile(icon: Icons.email_outlined, label: 'Email', value: rider?.email ?? 'Not set'),
                const Divider(height: 1),
                _InfoTile(
                  icon: Icons.two_wheeler_outlined,
                  label: 'Vehicle',
                  value: _capitalize(rider?.vehicleType ?? '—'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          OutlinedButton.icon(
            onPressed: () => _confirmLogout(context),
            icon: const Icon(Icons.logout_rounded, color: AppColors.danger),
            label: const Text('Log Out', style: TextStyle(color: AppColors.danger)),
            style: OutlinedButton.styleFrom(side: const BorderSide(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'available':
        return AppColors.statusAvailable;
      case 'busy':
        return AppColors.statusBusy;
      default:
        return AppColors.statusOffline;
    }
  }

  String _capitalize(String s) => s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to sign in again to receive deliveries.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.read<AuthProvider>().logout();
            },
            child: const Text('Log Out', style: TextStyle(color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade500),
          const SizedBox(width: 14),
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 14)),
          const Spacer(),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
        ],
      ),
    );
  }
}
