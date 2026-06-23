import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../customers/domain/customer_record.dart';
import '../domain/scan_session_draft.dart';
import '../domain/scan_session_summary.dart';
import 'scan_session_summary_provider.dart';
import 'saved_scan_sessions_provider.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_metric_card.dart';
import '../../../shared/widgets/app_section_header.dart';

part 'finish_scan_confirmation_screen_parts.dart';

class FinishScanConfirmationScreen extends ConsumerStatefulWidget {
  const FinishScanConfirmationScreen({
    super.key,
    required this.draft,
  });

  final ScanSessionDraft draft;

  @override
  ConsumerState<FinishScanConfirmationScreen> createState() =>
      _FinishScanConfirmationScreenState();
}

class _FinishScanConfirmationScreenState
    extends ConsumerState<FinishScanConfirmationScreen> {
  late ScanSessionDraft _draft;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _draft = widget.draft;
  }

  String _formatWeight(double value) => value.toStringAsFixed(3);

  String _formatCurrency(double value) => 'Rs. ${value.toStringAsFixed(2)}';

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day} ${_monthName(local.month)} ${local.year}, $hour:$minute $period';
  }

  String _monthName(int month) {
    const months = <String>[
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
    return months[month - 1];
  }

  Future<void> _saveSession() async {
    if (_isSaving) {
      return;
    }

    final summary = ScanSessionSummary.fromDraft(_draft);
    if (summary.totalItems == 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Add at least one item before saving.')),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      await ref.read(savedScanSessionsProvider.notifier).saveSession(summary);
      ref.read(scanSessionSummaryProvider.notifier).setSummary(summary);
      if (!mounted) {
        return;
      }
      context.go('/sales-scans/${summary.sessionId}');
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save Session failed: ${error.toString()}')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  Widget _buildCustomerCard(CustomerRecord? customer) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Customer',
            subtitle: 'Review the customer attached to this session.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            customer?.name ?? 'No customer selected',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: AppTypography.titleSize,
              fontWeight: AppTypography.titleWeight,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            customer == null
                ? 'Customer details are missing.'
                : '${customer.phone} | ${customer.area}',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          if ((customer?.email ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              customer!.email!,
              style: TextStyle(color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSummaryMetrics(ScanSessionSummary summary) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: AppMetricCard(
                label: 'Items',
                value: summary.totalItems.toString(),
                helper: 'Total items',
                compact: true,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppMetricCard(
                label: 'Gross',
                value: '${_formatWeight(summary.totalGrossWeight)} g',
                helper: 'Total gross',
                compact: true,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppMetricCard(
                label: 'Stone',
                value: '${_formatWeight(summary.totalStoneWeight)} g',
                helper: 'Total stone',
                compact: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: AppMetricCard(
                label: 'Other',
                value: '${_formatWeight(summary.totalOtherWeight)} g',
                helper: 'Total other',
                compact: true,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppMetricCard(
                label: 'Net',
                value: '${_formatWeight(summary.totalNetWeight)} g',
                helper: 'Total net',
                compact: true,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: AppMetricCard(
                label: 'Fine',
                value: '${_formatWeight(summary.totalFineWeight)} g',
                helper: 'Total fine',
                compact: true,
              ),
            ),
          ],
        ),
        if (summary.totalStoneAmount > 0 || summary.totalOtherAmount > 0) ...[
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              if (summary.totalStoneAmount > 0)
                Expanded(
                  child: AppMetricCard(
                    label: 'Stone Amt',
                    value: _formatCurrency(summary.totalStoneAmount),
                    helper: 'Available',
                    compact: true,
                  ),
                ),
              if (summary.totalStoneAmount > 0 && summary.totalOtherAmount > 0)
                const SizedBox(width: AppSpacing.sm),
              if (summary.totalOtherAmount > 0)
                Expanded(
                  child: AppMetricCard(
                    label: 'Other Amount',
                    value: _formatCurrency(summary.totalOtherAmount),
                    helper: 'Available',
                    compact: true,
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildSupplierBreakdown(ScanSessionSummary summary) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const AppSectionHeader(
          title: 'Supplier breakdown',
          subtitle: 'Supplier-wise totals for the locked session.',
          tight: true,
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: summary.supplierBreakdown
              .map(
                (entry) => SizedBox(
                  width: 156,
                  child: AppCard(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    backgroundColor: AppColors.surfaceAlt,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          entry.supplier,
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          '${entry.items} items',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'Gross ${_formatWeight(entry.grossWeight)} g',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                        Text(
                          'Net ${_formatWeight(entry.netWeight)} g',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                        Text(
                          'Fine ${_formatWeight(entry.fineWeight)} g',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(growable: false),
        ),
      ],
    );
  }

  Widget _buildWarningCard(ScanSessionSummary summary) {
    final counts = summary.warningCounts;
    final hasWarnings = counts.hasAny;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: AppSectionHeader(
                  title: 'Warning summary',
                  subtitle: 'Review any items that may need attention.',
                  tight: true,
                ),
              ),
              if (hasWarnings)
                const AppBadge(
                  label: 'Review needed',
                  tone: AppBadgeTone.warning,
                  icon: Icons.warning_amber_rounded,
                  compact: true,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              AppBadge(
                label: 'Duplicates ${counts.duplicates}',
                tone: AppBadgeTone.neutral,
                icon: Icons.copy_rounded,
                compact: true,
              ),
              AppBadge(
                label: 'Supplier mismatch ${counts.supplierMismatch}',
                tone: AppBadgeTone.neutral,
                icon: Icons.swap_horiz_rounded,
                compact: true,
              ),
              AppBadge(
                label: 'Weight mismatch ${counts.weightMismatch}',
                tone: AppBadgeTone.neutral,
                icon: Icons.scale_rounded,
                compact: true,
              ),
              AppBadge(
                label: 'QR Karat mismatch ${counts.karatMismatch}',
                tone: AppBadgeTone.warning,
                icon: Icons.swap_vert_rounded,
                compact: true,
              ),
              AppBadge(
                label: 'Custom purity ${counts.customPurityOverrides}',
                tone: AppBadgeTone.warning,
                icon: Icons.tune_rounded,
                compact: true,
              ),
              AppBadge(
                label: 'Custom wastage ${counts.customWastageOverrides}',
                tone: AppBadgeTone.warning,
                icon: Icons.tune_rounded,
                compact: true,
              ),
            ],
          ),
          if (hasWarnings) ...[
            const SizedBox(height: AppSpacing.md),
            if (counts.supplierMismatch > 0) ...[
              const AppBanner(
                title: 'Supplier mismatch detected',
                message: 'Some scanned items belong to a different supplier. Please verify before saving.',
                tone: AppBannerTone.danger,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            const AppBanner(
              title: 'Some items require review.',
              message: 'Review the warning items before saving this session.',
              tone: AppBannerTone.warning,
            ),
            const SizedBox(height: AppSpacing.md),
            AppActionButton(
              label: 'Review Items',
              onPressed: () async {
                final updatedDraft = await context.push<ScanSessionDraft>(
                  '/scan-session/warnings',
                  extra: _draft,
                );
                if (!mounted || updatedDraft == null) {
                  return;
                }
                setState(() {
                  _draft = updatedDraft;
                });
              },
              variant: AppActionButtonVariant.secondary,
              expanded: true,
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = ScanSessionSummary.fromDraft(_draft);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Finish Scan Confirmation'),
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(
          AppSpacing.screenPadding,
          0,
          AppSpacing.screenPadding,
          AppSpacing.screenPadding,
        ),
        child: AppActionButton(
          label: _isSaving ? 'Saving...' : 'Save Session',
          onPressed: _isSaving || summary.totalItems == 0 ? null : () => _saveSession(),
          expanded: true,
        ),
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
            AppSectionHeader(
              title: 'Review before save',
              subtitle: 'Check the customer, totals, supplier breakdown, and warnings before saving.',
              trailing: Text(
                _formatDateTime(summary.createdAt),
                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _buildCustomerCard(summary.customer),
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const AppSectionHeader(
                    title: 'Session summary',
                    subtitle: 'Totals from the locked scan session.',
                    tight: true,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  _buildSummaryMetrics(summary),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            _buildSupplierBreakdown(summary),
            const SizedBox(height: AppSpacing.lg),
            _buildWarningCard(summary),
          ],
        ),
      ),
    );
  }
}












