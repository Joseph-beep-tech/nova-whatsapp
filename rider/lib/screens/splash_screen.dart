import 'package:flutter/material.dart';
import '../core/theme.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.two_wheeler_rounded, color: AppColors.gold500, size: 56),
            SizedBox(height: 20),
            CircularProgressIndicator(color: AppColors.gold500, strokeWidth: 2.6),
          ],
        ),
      ),
    );
  }
}
