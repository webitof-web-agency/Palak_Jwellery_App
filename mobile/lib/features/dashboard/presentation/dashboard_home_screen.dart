import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../../history/presentation/sales_history_provider.dart';
import '../../sale_entry/presentation/sale_entry_launch_args.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/constants/app_brand.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_draft_recovery_banner.dart';
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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(themeControllerProvider);
    final user = ref.watch(authSessionProvider).value?.user?.name ?? 'Salesman';
    final saleEntryState = ref.watch(saleEntryProvider).maybeWhen(
          data: (value) => value,
          orElse: () => null,
        );
    final hasDraft = saleEntryState?.parseResult != null;

    const todayQuery = SalesHistoryQuery(
      page: 1,
      searchTerm: '',
      searchScope: 'all',
      sortBy: 'saleDate',
      sortOrder: 'desc',
      duplicatesOnly: false,
    );
    final recentSalesAsync = ref.watch(recentSalesPageProvider(todayQuery));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        actions: [
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
                ref.invalidate(recentSalesPageProvider(todayQuery));
                await ref.read(recentSalesPageProvider(todayQuery).future);
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
                  if (hasDraft) ...[
                    const SizedBox(height: AppSpacing.lg),
                    AppDraftRecoveryBanner(
                      title: 'Continue your draft',
                      message: 'A parsed scan draft is already open. Resume it instead of starting over.',
                      onResume: () {
                        final draft = saleEntryState!.parseResult!;
                        context.push(
                          '/sale-entry',
                          extra: SaleEntryLaunchArgs(parseResult: draft),
                        );
                      },
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  AppActionButton(
                    label: 'Start Scan',
                    onPressed: () => context.push('/customers'),
                    icon: Icons.qr_code_scanner_rounded,
                    expanded: true,
                    height: 54,
                  ),
                  if (hasDraft) ...[
                    const SizedBox(height: AppSpacing.sm),
                    AppActionButton(
                      label: 'Continue Draft',
                      onPressed: () {
                        final draft = saleEntryState!.parseResult!;
                        context.push(
                          '/sale-entry',
                          extra: SaleEntryLaunchArgs(parseResult: draft),
                        );
                      },
                      icon: Icons.restore_rounded,
                      variant: AppActionButtonVariant.secondary,
                      expanded: true,
                      height: 54,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.sm),
                  AppActionButton(
                    label: 'My Sales / Scans',
                    onPressed: () => context.push('/sales-history'),
                    icon: Icons.receipt_long_rounded,
                    variant: AppActionButtonVariant.secondary,
                    expanded: true,
                    height: 52,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  const AppSectionHeader(
                    title: 'Today summary',
                    subtitle: 'A quick snapshot of what has already been recorded today.',
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  recentSalesAsync.when(
                    loading: () => const AppCard(
                      padding: EdgeInsets.all(AppSpacing.lg),
                      child: Row(
                        children: [
                          SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          SizedBox(width: AppSpacing.sm),
                          Text('Loading today summary...'),
                        ],
                      ),
                    ),
                    error: (error, stackTrace) => AppBanner(
                      title: 'Today summary unavailable',
                      message: 'Could not load the current sales snapshot right now.',
                      tone: AppBannerTone.warning,
                      actionLabel: 'Retry',
                      onAction: () => ref.invalidate(recentSalesPageProvider(todayQuery)),
                    ),
                    data: (page) {
                      final latestSale = page.sales.isNotEmpty ? page.sales.first : null;
                      final latestLabel = latestSale == null
                          ? 'No sales recorded yet'
                          : '${latestSale.ref}${latestSale.supplierName == null ? '' : ' • ${latestSale.supplierName}'}';

                      return AppCard(
                        padding: const EdgeInsets.all(AppSpacing.lg),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    'Today\'s activity',
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                AppBadge(
                                  label: '${page.total} entries',
                                  tone: AppBadgeTone.success,
                                  icon: Icons.insights_rounded,
                                  compact: true,
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.md),
                            LayoutBuilder(
                              builder: (context, constraints) {
                                final narrow = constraints.maxWidth < 380;
                                final countCard = AppMetricCard(
                                  label: 'Sales recorded',
                                  value: '${page.total}',
                                  helper: 'Finalized entries today',
                                  compact: true,
                                );
                                final latestCard = AppMetricCard(
                                  label: 'Latest entry',
                                  value: latestSale == null
                                      ? '-'
                                      : _formatDateTime(latestSale.saleDate),
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
                        ),
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
