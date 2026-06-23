import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

import '../domain/scan_session_draft.dart';
import '../domain/sales_report_aggregation.dart';
import '../domain/sales_report_mode.dart';
import '../domain/scan_session_summary.dart';
import 'saved_scan_sessions_provider.dart';
import 'scan_session_summary_provider.dart';
import '../services/sales_report_pdf_service.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

part 'scan_session_summary_screen_parts.dart';

class ScanSessionSummaryScreen extends ConsumerStatefulWidget {
  const ScanSessionSummaryScreen({super.key, this.sessionId});

  final String? sessionId;

  @override
  ConsumerState<ScanSessionSummaryScreen> createState() =>
      _ScanSessionSummaryScreenState();
}

class _ScanSessionSummaryScreenState extends ConsumerState<ScanSessionSummaryScreen> {
  final SalesReportPdfService _pdfService = const SalesReportPdfService();
  final ScrollController _scrollController = ScrollController();
  SalesReportMode _reportMode = SalesReportMode.itemWise;
  bool _isExportingPdf = false;
  bool _itemsExpanded = false;
  static const int _collapsedItemCount = 5;

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

  Future<void> _handlePdfAction(
    BuildContext context, {
    required ScanSessionSummary summary,
    required bool share,
  }) async {
    if (_isExportingPdf) {
      return;
    }

    final messenger = ScaffoldMessenger.of(context);
    setState(() => _isExportingPdf = true);
    try {
      if (share) {
        await _pdfService.sharePdf(summary: summary, mode: _reportMode);
      } else {
        final savedFile = await _pdfService.downloadPdf(summary: summary, mode: _reportMode);
        if (!mounted) {
          return;
        }
        messenger.showSnackBar(
          SnackBar(
            content: Text('Saved ${savedFile.fileName} to ${savedFile.storageLabel}.'),
          ),
        );
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      messenger.showSnackBar(
        SnackBar(content: Text('PDF generation failed: ${error.toString()}')),
      );
    } finally {
      if (mounted) {
        setState(() => _isExportingPdf = false);
      }
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  ScanSessionSummary? _activeSummary(WidgetRef ref) {
    if (widget.sessionId == null) {
      return ref.watch(scanSessionSummaryProvider);
    }

    final sessionsAsync = ref.watch(savedScanSessionsProvider);
    final sessions = sessionsAsync.maybeWhen(
      data: (value) => value,
      orElse: () => null,
    );
    if (sessions == null) {
      return null;
    }

    for (final session in sessions) {
      if (session.sessionId == widget.sessionId) {
        return session;
      }
    }
    return null;
  }

  Widget _buildCustomerCard(ScanSessionSummary summary) {
    final customer = summary.customer;
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Customer',
            subtitle: 'Saved with the scan session.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            customer?.name ?? 'Unknown customer',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: AppTypography.titleSize,
              fontWeight: AppTypography.titleWeight,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            customer == null
                ? 'No customer snapshot available.'
                : '${customer.phone} | ${customer.area}',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          if ((customer?.email ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(customer!.email!, style: TextStyle(color: AppColors.textMuted)),
          ],
          const SizedBox(height: AppSpacing.md),
          DecoratedBox(
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
              child: Text(
                'Session date/time: ${_formatDateTime(summary.createdAt)}',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTotalsCard(ScanSessionSummary summary) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Session totals',
            subtitle: 'Copied from the saved local summary.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _summaryMetricChip('Items', summary.totalItems.toString(), 'Total items'),
              _summaryMetricChip('Gross', '${_formatWeight(summary.totalGrossWeight)} g', 'Total gross'),
              _summaryMetricChip('Net', '${_formatWeight(summary.totalNetWeight)} g', 'Total net'),
              _summaryMetricChip('Stone', '${_formatWeight(summary.totalStoneWeight)} g', 'Total stone'),
              _summaryMetricChip('Other', '${_formatWeight(summary.totalOtherWeight)} g', 'Total other'),
              _summaryMetricChip('Fine', '${_formatWeight(summary.totalFineWeight)} g', 'Total fine'),
              _summaryMetricChip(
                'Stone Amt',
                _formatCurrency(summary.totalStoneAmount),
                'Total amount',
              ),
              // otherAmount is a separate amount bucket, not making charge.
              if (summary.totalOtherAmount > 0)
                _summaryMetricChip(
                  'Other Amount',
                  _formatCurrency(summary.totalOtherAmount),
                  'Total amount',
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryMetricChip(String label, String value, String helper) {
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 96, maxWidth: 140),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.border),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                label,
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 10,
                  letterSpacing: 1.0,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                helper,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 10),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildShareDownloadRow(
    BuildContext context,
    ScanSessionSummary summary,
  ) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Share / download',
            subtitle: 'Placeholders for future export actions.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _buildWhatsAppShareButton(
                  context,
                  summary,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppActionButton(
                  label: 'Download PDF',
                  onPressed: _isExportingPdf
                      ? null
                      : () =>
                          _handlePdfAction(context, summary: summary, share: false),
                  variant: AppActionButtonVariant.secondary,
                  expanded: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildWhatsAppShareButton(
    BuildContext context,
    ScanSessionSummary summary,
  ) {
    final disabled = _isExportingPdf;
    return SizedBox(
      height: 52,
      child: OutlinedButton(
        onPressed: disabled ? null : () => _handlePdfAction(context, summary: summary, share: true),
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: Color(0xFF25D366)),
          foregroundColor: AppColors.textPrimary,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(
                color: Color(0xFF25D366),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: FaIcon(
                  FontAwesomeIcons.whatsapp,
                  color: Colors.white,
                  size: 15,
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Flexible(
              child: Text(
                'WhatsApp',
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNavigationActions(ScanSessionSummary summary) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.swap_horiz_rounded, size: 16),
              const SizedBox(width: AppSpacing.xs),
              Text(
                'Go to',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.4,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (summary.customer != null) ...[
            _navRow(
              icon: Icons.person_rounded,
              label: summary.customer!.name,
              sublabel: 'Customer Profile',
              onTap: () => context.go('/customers/${summary.customer!.id}'),
            ),
            const Divider(height: AppSpacing.md),
          ],
          _navRow(
            icon: Icons.receipt_long_rounded,
            label: 'My Sales / Scans',
            sublabel: 'View all saved sessions',
            onTap: () => context.go('/sales-scans'),
          ),
          const Divider(height: AppSpacing.md),
          _navRow(
            icon: Icons.dashboard_rounded,
            label: 'Dashboard',
            sublabel: 'Back to home',
            onTap: () => context.go('/dashboard'),
          ),
        ],
      ),
    );
  }

  Widget _navRow({
    required IconData icon,
    required String label,
    required String sublabel,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppColors.accentSoft.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(icon, size: 18, color: AppColors.accent),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    sublabel,
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, color: AppColors.textMuted, size: 18),
          ],
        ),
      ),
    );
  }

  Widget _buildReportModeChips() {
    Widget chip(String label, SalesReportMode mode) {
      final selected = _reportMode == mode;
      return ChoiceChip(
        label: Text(label),
        selected: selected,
        onSelected: (_) => setState(() => _reportMode = mode),
      );
    }

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        chip('Item-wise', SalesReportMode.itemWise),
        chip('Supplier-wise', SalesReportMode.supplierWise),
        chip('Karat-wise', SalesReportMode.karatWise),
        chip('Wastage-wise', SalesReportMode.wastageWise),
        chip('Category-wise', SalesReportMode.categoryWise),
      ],
    );
  }

  Widget _buildEmptyState() {
    return const AppBanner(
      title: 'No saved items yet',
      message: 'Finish and save a scan session to see the item table here.',
      tone: AppBannerTone.info,
    );
  }

  List<SalesReportGroup> _groupItems(ScanSessionSummary summary) {
    return buildSalesReportGroups(summary, _reportMode);
  }

  Widget _buildGroupedSection(SalesReportGroup group, ScanSessionSummary summary) {
    return AppCard(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  group.groupLabel,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              AppBadge(
                label: '${group.itemCount} items',
                tone: AppBadgeTone.neutral,
                icon: Icons.inventory_2_rounded,
                compact: true,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${group.detailLabel}\nGross ${_formatWeight(group.grossWeight)} g | Stone ${_formatWeight(group.stoneWeight)} g | Other ${_formatWeight(group.otherWeight)} g | Net ${_formatWeight(group.netWeight)} g | Fine ${_formatWeight(group.fineWeight)} g',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
          if (group.stoneAmount > 0 || group.otherAmount > 0) ...[
            const SizedBox(height: AppSpacing.xs),
            // otherAmount is a separate amount bucket, not making charge.
            if (group.stoneAmount > 0 && group.otherAmount > 0)
              Text('Stone Amt ${_formatCurrency(group.stoneAmount)} | Other Amount ${_formatCurrency(group.otherAmount)}',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11))
            else if (group.stoneAmount > 0)
              Text('Stone Amt ${_formatCurrency(group.stoneAmount)}',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11))
            else if (group.otherAmount > 0)
              Text('Other Amount ${_formatCurrency(group.otherAmount)}',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11)),
          ],
          const SizedBox(height: AppSpacing.sm),
          for (final item in group.items) ...[
            _SummaryItemRow(
              item: item,
              serialNumber: summary.items.indexOf(item) + 1,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = _activeSummary(ref);
    if (widget.sessionId != null) {
      final loading = ref.watch(savedScanSessionsProvider).isLoading;
      if (summary == null && loading) {
        return const Scaffold(
          body: SafeArea(
            child: Center(child: CircularProgressIndicator()),
          ),
        );
      }
    }

    if (summary == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Sales Summary'),
          leading: IconButton(
            onPressed: () => context.go('/sales-scans'),
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.screenPadding),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const AppBanner(
                  title: 'No saved session yet',
                  message: 'Finish and save a scan session to see its summary here.',
                  tone: AppBannerTone.info,
                ),
                const SizedBox(height: AppSpacing.md),
                AppActionButton(
                  label: 'Back to Dashboard',
                  onPressed: () => context.go('/dashboard'),
                  expanded: true,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final reportGroups = _groupItems(summary);
    final totalItems = summary.items.length;
    final visibleItems = summary.items;
    final visibleCount = visibleItems.length;
    final visibleItemCount = _itemsExpanded
        ? visibleCount
        : (visibleCount > _collapsedItemCount ? _collapsedItemCount : visibleCount);
    final showToggle = visibleCount > _collapsedItemCount;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sales Summary'),
        leading: IconButton(
          onPressed: () => context.go('/sales-scans'),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'fab_top',
            onPressed: () => _scrollController.animateTo(
              0,
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOut,
            ),
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.textPrimary,
            elevation: 3,
            child: const Icon(Icons.arrow_upward_rounded, size: 18),
          ),
          const SizedBox(height: AppSpacing.xs),
          FloatingActionButton.small(
            heroTag: 'fab_bottom',
            onPressed: () {
              if (_scrollController.hasClients) {
                _scrollController.animateTo(
                  _scrollController.position.maxScrollExtent,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                );
              }
            },
            backgroundColor: AppColors.surface,
            foregroundColor: AppColors.textPrimary,
            elevation: 3,
            child: const Icon(Icons.arrow_downward_rounded, size: 18),
          ),
        ],
      ),
      body: SafeArea(
        child: CustomScrollView(
          controller: _scrollController,
          slivers: [
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenPadding,
                AppSpacing.lg,
                AppSpacing.screenPadding,
                AppSpacing.sm,
              ),
              sliver: SliverToBoxAdapter(
                child: AppSectionHeader(
                  title: 'Saved locally',
                  subtitle: 'Ready for later backend wiring.',
                  trailing: Text(
                    '$totalItems items',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: _buildCustomerCard(summary)),
            ),
            const SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: _buildTotalsCard(summary)),
            ),
            const SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
            ),
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: _buildShareDownloadRow(context, summary)),
            ),
            const SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
            ),
            // ── Report options ──────────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(
                child: AppCard(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const AppSectionHeader(
                        title: 'Report options',
                        subtitle: 'Same saved session, different grouping modes.',
                        tight: true,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _buildReportModeChips(),
                    ],
                  ),
                ),
              ),
            ),
            const SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
            ),
            // ── Navigation actions ───────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: _buildNavigationActions(summary)),
            ),
            const SliverPadding(
              padding: EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(child: SizedBox(height: AppSpacing.lg)),
            ),
            // ── Item list header ─────────────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
              sliver: SliverToBoxAdapter(
                child: AppSectionHeader(
                  title: _reportMode == SalesReportMode.itemWise ? 'Item list' : 'Grouped report',
                  subtitle: 'Invoice-style rows for compact review on mobile.',
                  trailing: Text(
                    'Total $totalItems',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                  ),
                ),
              ),
            ),
            // ── Item list (collapsed/expanded) ───────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenPadding,
                AppSpacing.md,
                AppSpacing.screenPadding,
                AppSpacing.xs,
              ),
              sliver: visibleItems.isEmpty
                  ? SliverToBoxAdapter(child: _buildEmptyState())
                  : _reportMode == SalesReportMode.itemWise
                      ? SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final item = visibleItems[index];
                              final serial = summary.items.indexOf(item) + 1;
                              return _SummaryItemRow(
                                item: item,
                                serialNumber: serial,
                              );
                            },
                            childCount: visibleItemCount,
                          ),
                        )
                      : SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (context, index) {
                              final group = reportGroups[index];
                              return _buildGroupedSection(group, summary);
                            },
                            childCount: reportGroups.length,
                          ),
                        ),
            ),
            // ── View more / show less toggle ─────────────────────────────────────
            if (showToggle && _reportMode == SalesReportMode.itemWise)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPadding),
                sliver: SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: AppActionButton(
                      label: _itemsExpanded
                          ? 'Show less'
                          : 'View all $visibleCount items',
                      onPressed: () => setState(() => _itemsExpanded = !_itemsExpanded),
                      variant: AppActionButtonVariant.secondary,
                      icon: _itemsExpanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      expanded: true,
                    ),
                  ),
                ),
              ),
            // ── Extra bottom padding for FABs ─────────────────────────────────────
            const SliverPadding(padding: EdgeInsets.only(bottom: 80)),
          ],
        ),
      ),
    );
  }
}












