import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/system/backend_status.dart';
import 'features/auth/presentation/auth_notifier.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/customers/domain/customer_record.dart';
import 'features/customers/presentation/customer_selection_screen.dart';
import 'features/dashboard/presentation/dashboard_home_screen.dart';
import 'features/batches/presentation/batch_detail_screen.dart';
import 'features/batches/presentation/create_batch_screen.dart';
import 'features/batches/presentation/my_batches_screen.dart';
import 'features/history/presentation/sales_history_screen.dart';
import 'features/sale_entry/data/sale_repository.dart';
import 'features/sale_entry/presentation/sale_success_screen.dart';
import 'features/scanner/presentation/scanner_screen.dart';
import 'features/scanner/presentation/scanner_launch_args.dart';
import 'features/sessions/presentation/create_session_screen.dart';
import 'features/sessions/domain/scan_session_draft.dart';
import 'features/sessions/domain/scan_session_summary.dart';
import 'features/sessions/presentation/finish_scan_confirmation_screen.dart';
import 'features/sessions/presentation/my_sessions_screen.dart';
import 'features/sessions/presentation/session_detail_screen.dart';
import 'features/sessions/presentation/customer_profile_screen.dart';
import 'features/sessions/presentation/sales_scans_screen.dart';
import 'features/sessions/presentation/scan_session_screen.dart';
import 'features/sessions/presentation/scan_session_summary_screen.dart';
import 'shared/navigation/app_route_observer.dart';
import 'shared/theme/app_theme.dart';
import 'shared/widgets/backend_fallback_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final savedPreset = await ThemePreferences.loadPreset();
  if (savedPreset != null) {
    activePreset = savedPreset;
  }
  runApp(const ProviderScope(child: JewelleryApp()));
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final authSession = ref.watch(authSessionProvider);

  return GoRouter(
    observers: [appRouteObserver],
    initialLocation: '/login',
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardHomeScreen(),
      ),
      GoRoute(
        path: '/customers',
        builder: (context, state) => const CustomerSelectionScreen(),
      ),
      GoRoute(
        path: '/scan-session',
        builder: (context, state) {
          final extra = state.extra;
          final selectedCustomer = extra is CustomerRecord ? extra : null;
          final resumeSummary = extra is ScanSessionSummary ? extra : null;
          return ScanSessionScreen(
            selectedCustomer: selectedCustomer,
            resumeSummary: resumeSummary,
          );
        },
      ),
      GoRoute(
        path: '/scan-session/finish',
        builder: (context, state) {
          final draft = state.extra is ScanSessionDraft
              ? state.extra as ScanSessionDraft
              : const ScanSessionDraft(customer: null);
          return FinishScanConfirmationScreen(draft: draft);
        },
      ),
      GoRoute(
        path: '/scan-session/warnings',
        builder: (context, state) {
          final draft = state.extra is ScanSessionDraft
              ? state.extra as ScanSessionDraft
              : const ScanSessionDraft(customer: null);
          return WarningItemsScreen(draft: draft);
        },
      ),
      GoRoute(
        path: '/scan-session/summary',
        builder: (context, state) {
          final sessionId = state.uri.queryParameters['sessionId'];
          return ScanSessionSummaryScreen(sessionId: sessionId);
        },
      ),
      GoRoute(
        path: '/sales-scans',
        builder: (context, state) => const SalesScansScreen(),
      ),
      GoRoute(
        path: '/sales-scans/:sessionId',
        builder: (context, state) {
          final sessionId = state.pathParameters['sessionId'];
          return ScanSessionSummaryScreen(sessionId: sessionId);
        },
      ),
      GoRoute(
        path: '/customers/:customerId',
        builder: (context, state) {
          final customerId = state.pathParameters['customerId'] ?? '';
          return CustomerProfileScreen(customerId: customerId);
        },
      ),
      GoRoute(
        path: '/sessions',
        builder: (context, state) => const MySessionsScreen(),
      ),
      GoRoute(
        path: '/sessions/create',
        builder: (context, state) => const CreateSessionScreen(),
      ),
      GoRoute(
        path: '/sessions/:sessionId',
        builder: (context, state) {
          final sessionId = state.pathParameters['sessionId'] ?? '';
          return SessionDetailScreen(sessionId: sessionId);
        },
      ),
      GoRoute(
        path: '/scanner',
        builder: (context, state) {
          final args = state.extra is ScannerLaunchArgs
              ? state.extra as ScannerLaunchArgs
              : ScannerLaunchArgs(
                  sessionKey: state.extra?.toString() ?? 'default',
                );
          return ScannerScreen(
            key: ValueKey('scanner-${args.sessionKey}'),
            batchContext: args.batchContext,
            launchMode: args.mode,
          );
        },
      ),
      GoRoute(
        path: '/sale-success',
        builder: (context, state) {
          final sale = state.extra is CreatedSale
              ? state.extra as CreatedSale
              : null;
          return sale == null
              ? const DashboardHomeScreen()
              : SaleSuccessScreen(sale: sale);
        },
      ),
      GoRoute(
        path: '/batches',
        builder: (context, state) => const MyBatchesScreen(),
      ),
      GoRoute(
        path: '/batches/create',
        builder: (context, state) => const CreateBatchScreen(),
      ),
      GoRoute(
        path: '/batches/:batchId',
        builder: (context, state) {
          final batchId = state.pathParameters['batchId'] ?? '';
          return BatchDetailScreen(batchId: batchId);
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
      return MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: theme,
        routerConfig: router,
        builder: (context, _) => const _BootScreen(),
      );
    }

    if (backendStatus.hasError) {
      final errorMessage =
          backendStatus.whenOrNull(error: (error, _) => error.toString()) ??
          'Could not connect to the backend. Check the server and try again.';

      return MaterialApp.router(
        debugShowCheckedModeBanner: false,
        theme: theme,
        routerConfig: router,
        builder: (context, _) => BackendFallbackScreen(
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









