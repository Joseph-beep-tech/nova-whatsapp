import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'core/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/order_provider.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/order_detail_screen.dart';
import 'screens/splash_screen.dart';

void main() {
  runApp(const NovaGoRiderApp());
}

class NovaGoRiderApp extends StatelessWidget {
  const NovaGoRiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..bootstrap()),
        ChangeNotifierProvider(create: (_) => OrderProvider()),
      ],
      child: Builder(
        builder: (context) {
          final router = _buildRouter(context);
          return MaterialApp.router(
            title: 'NovaGo Rider',
            debugShowCheckedModeBanner: false,
            theme: AppTheme.light,
            routerConfig: router,
          );
        },
      ),
    );
  }

  GoRouter _buildRouter(BuildContext context) {
    final auth = context.watch<AuthProvider>();

    return GoRouter(
      initialLocation: '/',
      refreshListenable: auth,
      redirect: (context, state) {
        final loggingIn = state.matchedLocation == '/login';
        switch (auth.status) {
          case AuthStatus.unknown:
            return state.matchedLocation == '/' ? null : '/';
          case AuthStatus.unauthenticated:
            return loggingIn ? null : '/login';
          case AuthStatus.authenticated:
            return (loggingIn || state.matchedLocation == '/') ? '/home' : null;
        }
      },
      routes: [
        GoRoute(path: '/', builder: (context, state) => const SplashScreen()),
        GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
        GoRoute(path: '/home', builder: (context, state) => const HomeShell()),
        GoRoute(
          path: '/order/:id',
          builder: (context, state) => OrderDetailScreen(orderId: state.pathParameters['id']!),
        ),
      ],
    );
  }
}
