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
import 'services/push_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // No-ops until a real Firebase project is wired up (see the
  // push-notifications plan) — the app runs fine without it, just without
  // background push; in-app socket alerts still work either way.
  await PushService.initializeFirebase();
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
      child: const _RouterHost(),
    );
  }
}

/// Hosts the GoRouter instance so it's created exactly once. Building it
/// inline in NovaGoRiderApp.build() (as this used to do, via context.watch)
/// meant every AuthProvider.notifyListeners() — including the online/offline
/// toggle — constructed a brand-new GoRouter, tearing down and rebuilding
/// the whole navigator and disposing screens mid-session.
class _RouterHost extends StatefulWidget {
  const _RouterHost();

  @override
  State<_RouterHost> createState() => _RouterHostState();
}

class _RouterHostState extends State<_RouterHost> {
  late final GoRouter _router = GoRouter(
    initialLocation: '/',
    refreshListenable: context.read<AuthProvider>(),
    redirect: (context, state) {
      final auth = context.read<AuthProvider>();
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

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'NovaGo Rider',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      routerConfig: _router,
    );
  }
}
