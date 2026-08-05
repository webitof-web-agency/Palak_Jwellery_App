import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/bullion_sale_repository.dart';
import '../domain/bullion_sale.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

class BullionHistoryScreen extends ConsumerStatefulWidget {
  const BullionHistoryScreen({super.key});

  @override
  ConsumerState<BullionHistoryScreen> createState() => _BullionHistoryScreenState();
}

class _BullionHistoryScreenState extends ConsumerState<BullionHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchTerm = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatWeight(double value) =>
      '${value.toStringAsFixed(3).replaceFirst(RegExp(r'\.?0+$'), '')} g';

  String _formatAmount(double value) {
    if (value >= 10000000) {
      return '₹${(value / 10000000).toStringAsFixed(2)} Cr';
    } else if (value >= 100000) {
      return '₹${(value / 100000).toStringAsFixed(2)} L';
    }
    return '₹${value.toStringAsFixed(0)}';
  }

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute $period';
  }

  List<_CustomerBullionGroup> _buildGroups(List<BullionSale> sales) {
    final grouped = <String, _CustomerBullionGroup>{};
    for (final sale in sales) {
      if (sale.customerName.isEmpty) continue;
      final key = sale.customerId.isNotEmpty ? sale.customerId : sale.customerName;
      grouped
          .putIfAbsent(
            key,
            () => _CustomerBullionGroup(
              customerId: sale.customerId,
              customerName: sale.customerName,
              customerPhone: sale.customerPhone,
              customerArea: sale.customerArea,
              sales: <BullionSale>[],
            ),
          )
          .sales
          .add(sale);
    }
    final groups = grouped.values.toList(growable: false);
    groups.sort((a, b) => b.latestSale.createdAt.compareTo(a.latestSale.createdAt));
    return groups;
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final salesAsync = ref.watch(bullionSalesHistoryProvider);

    final allSales = salesAsync.maybeWhen(
      data: (page) => page.sales,
      orElse: () => const <BullionSale>[],
    );

    final query = _searchTerm.trim().toLowerCase();
    final filtered = query.isEmpty
        ? allSales
        : allSales.where((sale) {
            return sale.customerName.toLowerCase().contains(query) ||
                sale.customerPhone.toLowerCase().contains(query);
          }).toList(growable: false);

    final groups = _buildGroups(filtered);
    final loading = salesAsync.isLoading && allSales.isEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bullion History'),
        leading: IconButton(
          onPressed: () => context.canPop() ? context.pop() : context.go('/bullion-sale'),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        actions: [
          IconButton(
            onPressed: () => ref.invalidate(bullionSalesHistoryProvider),
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.screenPadding,
            AppSpacing.lg,
            AppSpacing.screenPadding,
            AppSpacing.xxl,
          ),
          children: [
            const AppSectionHeader(
              title: 'Bullion Sales History',
              subtitle: 'All bullion sales. Tap a customer to see their full profile.',
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Search ───────────────────────────────────────────
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _searchTerm = value),
              decoration: InputDecoration(
                labelText: 'Search customer',
                hintText: 'Name or phone',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchTerm.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          setState(() {
                            _searchTerm = '';
                            _searchController.clear();
                          });
                        },
                        icon: const Icon(Icons.clear_rounded),
                      ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Content ──────────────────────────────────────────
            if (loading)
              const AppCard(
                padding: EdgeInsets.all(AppSpacing.lg),
                child: Row(
                  children: [
                    SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Text('Loading bullion sales...'),
                  ],
                ),
              )
            else if (salesAsync.hasError)
              AppBanner(
                title: 'Failed to load',
                message: salesAsync.error.toString(),
                tone: AppBannerTone.warning,
                actionLabel: 'Retry',
                onAction: () => ref.invalidate(bullionSalesHistoryProvider),
              )
            else if (allSales.isEmpty)
              const AppBanner(
                title: 'No bullion sales yet',
                message: 'Bullion sales will appear here after they are created.',
                tone: AppBannerTone.info,
              )
            else if (groups.isEmpty)
              const AppBanner(
                title: 'No matching customers',
                message: 'Try a different name or phone number.',
                tone: AppBannerTone.info,
              )
            else
              ...groups.map((group) {
                final latest = group.latestSale;
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AppCard(
                    onTap: group.customerId.isNotEmpty
                        ? () => context.push('/customers/${group.customerId}')
                        : null,
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // ── Customer header ──────────────────────
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    group.customerName,
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: AppTypography.titleSize,
                                      fontWeight: AppTypography.titleWeight,
                                    ),
                                  ),
                                  if (group.customerPhone.isNotEmpty ||
                                      group.customerArea.isNotEmpty) ...[
                                    const SizedBox(height: AppSpacing.xs),
                                    Text(
                                      [group.customerPhone, group.customerArea]
                                          .where((e) => e.trim().isNotEmpty)
                                          .join(' | '),
                                      style: TextStyle(color: AppColors.textSecondary),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            AppBadge(
                              label: '${group.sales.length} entries',
                              tone: AppBadgeTone.accent,
                              icon: Icons.diamond_rounded,
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // ── Summary badges ───────────────────────
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            AppBadge(
                              label: _formatWeight(group.totalWeight),
                              tone: AppBadgeTone.neutral,
                              icon: Icons.balance_rounded,
                              compact: true,
                            ),
                            AppBadge(
                              label: _formatAmount(group.totalAmount),
                              tone: AppBadgeTone.neutral,
                              icon: Icons.currency_rupee_rounded,
                              compact: true,
                            ),
                            AppBadge(
                              label: _formatDateTime(latest.createdAt),
                              tone: AppBadgeTone.neutral,
                              icon: Icons.schedule_rounded,
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),

                        // ── Latest sale row ──────────────────────
                        Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(AppRadius.sm),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 30,
                                height: 30,
                                decoration: BoxDecoration(
                                  color: latest.isSale
                                      ? AppColors.accent.withValues(alpha: 0.15)
                                      : AppColors.warning.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(
                                  latest.isSale
                                      ? Icons.arrow_upward_rounded
                                      : Icons.arrow_downward_rounded,
                                  size: 16,
                                  color: latest.isSale ? AppColors.accent : AppColors.warning,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${latest.isSale ? 'Sale' : 'Return'} — ${_formatWeight(latest.weightGrams)}',
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                    if (latest.goldPurity.isNotEmpty)
                                      Text(
                                        latest.goldPurity,
                                        style: TextStyle(
                                          color: AppColors.textMuted,
                                          fontSize: 11,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Text(
                                _formatAmount(latest.totalAmount),
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          ),
                        ),

                        if (group.customerId.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Tap to view full profile →',
                            style: TextStyle(
                              color: AppColors.accent,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

class _CustomerBullionGroup {
  _CustomerBullionGroup({
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.customerArea,
    required this.sales,
  });

  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerArea;
  final List<BullionSale> sales;

  BullionSale get latestSale => sales.first;
  double get totalWeight => sales.fold(0.0, (sum, s) => sum + s.weightGrams);
  double get totalAmount => sales.fold(0.0, (sum, s) => sum + s.totalAmount);
}
