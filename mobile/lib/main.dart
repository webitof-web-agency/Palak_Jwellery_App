import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/system/backend_status.dart';
import 'features/auth/presentation/auth_notifier.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/history/presentation/sales_history_screen.dart';
import 'features/sale_entry/data/sale_repository.dart';
import 'features/sale_entry/presentation/sale_entry_screen.dart';
import 'features/sale_entry/presentation/sale_success_screen.dart';
import 'features/scanner/presentation/scanner_screen.dart';
import 'shared/theme/app_theme.dart';
import 'shared/widgets/app_logo.dart';
import 'shared/widgets/backend_fallback_screen.dart';
import 'shared/widgets/theme_toggle_button.dart';

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
      GoRoute(
        path: '/sales-history',
        builder: (context, state) => const SalesHistoryScreen(),
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
    final backendStatus = ref.watch(backendStatusProvider);
    final router = ref.watch(appRouterProvider);
    final themePreset = ref.watch(themeControllerProvider);
    activePreset = themePreset;
    final theme = AppTheme.theme(themePreset);

    if (authSession.isLoading || backendStatus.isLoading) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: const _BootScreen(),
      );
    }

    if (backendStatus.hasError) {
      final errorMessage = backendStatus.whenOrNull(
            error: (error, _) => error.toString(),
          ) ??
          'Could not connect to the backend. Check the server and try again.';

      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme,
        home: BackendFallbackScreen(
          error: errorMessage,
          onRetry: () => ref.invalidate(backendStatusProvider),
        ),
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

  Future<void> _confirmLogout(BuildContext context, WidgetRef ref) async {
    final shouldLogout = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
          contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          title: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const AppLogo(size: 52),
              const SizedBox(height: 16),
              Text(
                'Sign out?',
                style: TextStyle(
                  color: AppColors.accent,
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          content: Text(
            'You will be returned to the login screen. Unsaved sale entry changes will be lost.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textSecondary,
              height: 1.5,
            ),
          ),
          actions: [
            SizedBox(
              width: double.infinity,
              child: Column(
                children: [
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => Navigator.of(dialogContext).pop(true),
                      child: const Text('Yes, sign out'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => Navigator.of(dialogContext).pop(false),
                      child: const Text('Cancel'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );

    if (shouldLogout == true) {
      ref.read(authSessionProvider.notifier).clearSession();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(themeControllerProvider);
    final user = ref.watch(authSessionProvider).value?.user?.name ?? 'Salesman';
    final recentSalesAsync = ref.watch(recentSalesPageProvider(1));

    return Scaffold(
      appBar: AppBar(
        title: Text('Dashboard'),
        actions: [
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: ThemeToggleButton(size: 40),
          ),
          IconButton(
            onPressed: () => _confirmLogout(context, ref),
            icon: Icon(Icons.logout_rounded),
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
                    const AppLogo(size: 60),
                    SizedBox(height: 16),
                    Text(
                      'Jewellery Sales Management',
                      style: TextStyle(
                        color: AppColors.accent,
                        letterSpacing: 1.2,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Welcome, $user',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'Start a QR scan or enter a sale manually.',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton.icon(
                  onPressed: () => context.push('/scanner'),
                  icon: Icon(Icons.qr_code_scanner_rounded),
                  label: Text('Scan QR'),
                ),
              ),
              SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: OutlinedButton.icon(
                  onPressed: () => context.push(
                    '/sale-entry',
                    extra: ParseQrResult.empty(''),
                  ),
                  icon: Icon(Icons.edit_note_rounded),
                  label: Text('Enter Manually'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textPrimary,
                    side: BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
              SizedBox(height: 24),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  'Sale entry flow is ready. Dashboard metrics will come in the next slice.',
                  style: TextStyle(color: AppColors.textSecondary, height: 1.5),
                ),
              ),
              SizedBox(height: 16),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.border),
                ),
                child: recentSalesAsync.when(
                  loading: () => Row(
                    children: [
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Loading your entries...',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  error: (error, stackTrace) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your Entries',
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Could not load entry count right now.',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  data: (page) => Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your Entries',
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${page.total}',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'See how many sales you have already recorded.',
                        style: TextStyle(color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 14),
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => context.push('/sales-history'),
                          icon: const Icon(Icons.receipt_long_rounded),
                          label: const Text('View entries'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

