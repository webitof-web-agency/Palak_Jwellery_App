import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/auth/presentation/auth_notifier.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/sale_entry/data/sale_repository.dart';
import 'features/sale_entry/presentation/sale_entry_screen.dart';
import 'features/scanner/presentation/scanner_screen.dart';
import 'shared/theme/app_theme.dart';
import 'shared/widgets/app_logo.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ProviderScope(child: JewelleryApp()));
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final authSession = ref.watch(authSessionProvider);

  return GoRouter(
    initialLocation: '/login',
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/scanner',
        builder: (context, state) => const ScannerScreen(),
      ),
      GoRoute(
        path: '/sale-entry',
        builder: (context, state) {
          final parseResult = state.extra is ParseQrResult
              ? state.extra as ParseQrResult
              : ParseQrResult.empty('');
          return SaleEntryScreen(parseResult: parseResult);
        },
      ),
      GoRoute(
        path: '/sale-success',
        builder: (context, state) {
          final sale = state.extra is CreatedSale ? state.extra as CreatedSale : null;
          return sale == null ? const DashboardScreen() : SaleSuccessScreen(sale: sale);
        },
      ),
    ],
    redirect: (context, state) {
      if (authSession.isLoading) {
        return null;
      }

      final isLoggedIn = authSession.value?.token.isNotEmpty == true;
      final location = state.uri.path;
      final isLoginRoute = location == '/login';

      if (!isLoggedIn) {
        return isLoginRoute ? null : '/login';
      }

      if (isLoginRoute || location == '/') {
        return '/dashboard';
      }

      return null;
    },
  );
});

class JewelleryApp extends ConsumerWidget {
  const JewelleryApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authSession = ref.watch(authSessionProvider);
    final router = ref.watch(appRouterProvider);
    final theme = AppTheme.theme();

    if (authSession.isLoading) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: const _BootScreen(),
      );
    }

    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      theme: theme,
      routerConfig: router,
    );
  }
}

class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: SizedBox(
          width: 28,
          height: 28,
          child: CircularProgressIndicator(strokeWidth: 3),
        ),
      ),
    );
  }
}

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authSessionProvider).value?.user?.name ?? 'Salesman';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            onPressed: () => ref.read(authSessionProvider.notifier).clearSession(),
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [AppColors.warningSoft, AppColors.surface],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const AppLogo(size: 56),
                    const SizedBox(height: 16),
                    const Text(
                      'Jewellery Sales Management',
                      style: TextStyle(
                        color: AppColors.accent,
                        letterSpacing: 1.2,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Welcome, $user',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Start a QR scan or enter a sale manually.',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () => context.push('/scanner'),
                  icon: const Icon(Icons.qr_code_scanner_rounded),
                  label: const Text('Scan QR'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => context.push(
                    '/sale-entry',
                    extra: ParseQrResult.empty(''),
                  ),
                  icon: const Icon(Icons.edit_note_rounded),
                  label: const Text('Enter Manually'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: const Text(
                  'Sale entry flow is ready. Dashboard metrics will come in the next slice.',
                  style: TextStyle(color: AppColors.textSecondary, height: 1.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
