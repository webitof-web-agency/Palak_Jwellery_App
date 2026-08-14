import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../../sessions/presentation/active_scan_session_draft_provider.dart';
import '../../sessions/presentation/saved_scan_sessions_provider.dart';
import '../../../shared/constants/app_brand.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';

import '../../../shared/widgets/app_logo.dart';
import '../../../shared/widgets/app_metric_card.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../../../shared/widgets/brand_doodle_background.dart';
import '../../../shared/widgets/theme_toggle_button.dart';

class DashboardHomeScreen extends ConsumerWidget {
  const DashboardHomeScreen({super.key});

  String _formatDateTime(DateTime value) {
    const monthNames = <String>[
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    final hour12 = value.hour % 12 == 0 ? 12 : value.hour % 12;
    final minute = value.minute.toString().padLeft(2, '0');
    final period = value.hour >= 12 ? 'PM' : 'AM';
    return '${value.day} ${monthNames[value.month - 1]} ${value.year}, $hour12:$minute $period';
  }

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
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
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

  void _startSyncWithDelay(BuildContext context, WidgetRef ref) {
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    
    bool cancelled = false;
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: StatefulBuilder(
          builder: (context, setState) {
            int secondsLeft = 5;
            Timer.periodic(const Duration(seconds: 1), (timer) {
              if (cancelled || !context.mounted) {
                timer.cancel();
                return;
              }
              if (secondsLeft > 1) {
                setState(() {
                  secondsLeft--;
                });
              } else {
                timer.cancel();
              }
            });
            return Text('Starting sync in $secondsLeft seconds...');
          },
        ),
        duration: const Duration(seconds: 5),
        action: SnackBarAction(
          label: 'Undo',
          onPressed: () {
            cancelled = true;
          },
        ),
      ),
    );

    Future.delayed(const Duration(seconds: 5), () async {
      if (cancelled) return;
      if (!context.mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Syncing pending sessions...')),
      );
      
      final result = await ref.read(savedScanSessionsProvider.notifier).syncAllPending();
      
      if (!context.mounted) return;
      
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      final success = result['success'] ?? 0;
      final fail = result['fail'] ?? 0;
      
      if (fail > 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Synced $success sessions. $fail failed (Network error).'),
            backgroundColor: AppColors.danger,
          ),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Successfully synced $success sessions.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(themeControllerProvider);
    ref.watch(savedScanSessionsProvider);
    final user = ref.watch(authSessionProvider).value?.user?.name ?? 'Salesman';
    final activeDraft = ref.watch(activeScanSessionDraftProvider).maybeWhen(data: (value) => value, orElse: () => null);
    final pendingCount = ref.read(savedScanSessionsProvider.notifier).pendingSyncCount();

    final allSessions = ref.watch(savedScanSessionsProvider).value ?? [];
    final now = DateTime.now();
    final todaySessions = allSessions.where((s) {
      final created = s.createdAt.toLocal();
      return created.year == now.year && created.month == now.month && created.day == now.day;
    }).toList();
    
    final totalSessionsToday = todaySessions.length;
    final latestSession = todaySessions.isNotEmpty 
        ? todaySessions.reduce((a, b) => a.createdAt.isAfter(b.createdAt) ? a : b) 
        : null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
          IconButton(
            onPressed: () => _startSyncWithDelay(context, ref),
            icon: const Icon(Icons.sync_rounded),
            tooltip: 'Sync now',
          ),
          const Padding(
            padding: EdgeInsets.only(right: 8),
            child: ThemeToggleButton(size: 40),
          ),
          IconButton(
            onPressed: () => _confirmLogout(context, ref),
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: Stack(
        children: [
          Positioned.fill(
            child: Opacity(
              opacity: 0.55,
              child: BrandDoodleBackground(
                opacity: activePreset == AppThemePreset.midnightRose ? 1 : 0.72,
              ),
            ),
          ),
          SafeArea(
            child: RefreshIndicator(
              onRefresh: () async {
                await ref.read(savedScanSessionsProvider.notifier).syncAllPending();
              },
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.screenPadding,
                  AppSpacing.lg,
                  AppSpacing.screenPadding,
                  AppSpacing.xxl,
                ),
                children: [
                  if (pendingCount > 0) ...[
                    AppBanner(
                      title: '$pendingCount session(s) pending sync',
                      message: 'Data is saved locally but not yet sent to the backend.',
                      tone: AppBannerTone.warning,
                      actionLabel: 'Sync Now',
                      onAction: () => _startSyncWithDelay(context, ref),
                    ),
                    const SizedBox(height: AppSpacing.lg),
                  ],
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          AppColors.surfaceStrong,
                          AppColors.surface,
                          AppColors.surfaceAlt.withValues(alpha: 0.96),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.xl),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const AppLogo(size: 54),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    AppBrand.mobileDashboardTitle,
                                    style: TextStyle(
                                      color: AppColors.accent,
                                      letterSpacing: 1.1,
                                      fontSize: AppTypography.labelSize,
                                      fontWeight: AppTypography.labelWeight,
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    'Welcome, $user',
                                    style: TextStyle(
                                      fontSize: AppTypography.displaySize,
                                      fontWeight: AppTypography.displayWeight,
                                      height: 1.05,
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    'Start a customer scan session.',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      height: 1.45,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppActionButton(
                    label: 'Start Scan',
                    onPressed: () => context.push('/customers'),
                    icon: Icons.qr_code_scanner_rounded,
                    expanded: true,
                    height: 54,
                  ),
                  if (activeDraft != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    AppActionButton(
                      label: 'Continue Draft',
                      onPressed: () => context.push('/scan-session'),
                      icon: Icons.restore_rounded,
                      variant: AppActionButtonVariant.secondary,
                      expanded: true,
                      height: 52,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  AppActionButton(
                    label: 'My Sessions / Scans',
                    onPressed: () => context.push('/sales-scans'),
                    icon: Icons.receipt_long_rounded,
                    variant: AppActionButtonVariant.secondary,
                    expanded: true,
                    height: 52,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AppActionButton(
                    label: 'Bullion Sales',
                    onPressed: () => context.push('/bullion-sale'),
                    icon: Icons.monetization_on_rounded,
                    variant: AppActionButtonVariant.secondary,
                    expanded: true,
                    height: 52,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Builder(
                    builder: (context) {
                      final latestLabel = latestSession == null
                          ? 'No sessions today'
                          : '${latestSession.customer?.name ?? 'Unknown'}${latestSession.totalItems > 0 ? ' | ${latestSession.totalItems} items' : ''}';

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          AppSectionHeader(
                            title: 'Today\'s Summary',
                            subtitle: 'A quick snapshot of your scan sessions today.',
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (pendingCount == 0 && totalSessionsToday > 0) ...[
                                  const AppBadge(
                                    label: 'Synced',
                                    tone: AppBadgeTone.success,
                                    icon: Icons.cloud_done_rounded,
                                    compact: true,
                                  ),
                                  const SizedBox(width: AppSpacing.xs),
                                ],
                                AppBadge(
                                  label: '$totalSessionsToday entries',
                                  tone: AppBadgeTone.success,
                                  icon: Icons.insights_rounded,
                                  compact: true,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final narrow = constraints.maxWidth < 380;
                              final countCard = AppMetricCard(
                                label: 'Sessions today',
                                value: '$totalSessionsToday',
                                helper: 'Total local sessions',
                                compact: true,
                              );
                              final latestCard = AppMetricCard(
                                label: 'Latest session',
                                value: latestSession == null
                                    ? '-'
                                    : _formatDateTime(latestSession.createdAt),
                                helper: latestLabel,
                                compact: true,
                              );

                              if (narrow) {
                                return Column(
                                  children: [
                                    countCard,
                                    const SizedBox(height: AppSpacing.sm),
                                    latestCard,
                                  ],
                                );
                              }

                              return Row(
                                children: [
                                  Expanded(child: countCard),
                                  const SizedBox(width: AppSpacing.sm),
                                  Expanded(child: latestCard),
                                ],
                              );
                            },
                          ),
                          const SizedBox(height: AppSpacing.md),
                        ],
                      );
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}






