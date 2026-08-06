import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../bullion_sales/data/bullion_sale_repository.dart';
import '../../bullion_sales/domain/bullion_sale.dart';
import '../domain/scan_session_summary.dart';
import 'saved_scan_sessions_provider.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../../customers/domain/customer_record.dart';

part 'customer_profile_screen_parts.dart';

class CustomerProfileScreen extends ConsumerStatefulWidget {
  const CustomerProfileScreen({super.key, required this.customerId});

  final String customerId;

  @override
  ConsumerState<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends ConsumerState<CustomerProfileScreen>
    with SingleTickerProviderStateMixin {

  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _formatWeight(double value) => value.toStringAsFixed(3);

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    final day = local.day.toString().padLeft(2, '0');
    final month = local.month.toString().padLeft(2, '0');
    return '$day/$month/${local.year} $hour:$minute $period';
  }

  String _formatAmount(double value) {
    if (value >= 10000000) return '₹${(value / 10000000).toStringAsFixed(2)} Cr';
    if (value >= 100000) return '₹${(value / 100000).toStringAsFixed(2)} L';
    return '₹${value.toStringAsFixed(0)}';
  }

  Future<void> _openEditCustomerSheet(CustomerRecord customer) async {
    final updated = await showModalBottomSheet<CustomerRecord>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _EditCustomerSheet(
          customer: customer,
          onSave: (c) => Navigator.of(sheetContext).pop(c),
        );
      },
    );

    if (!mounted || updated == null) return;

    await ref.read(savedScanSessionsProvider.notifier).updateCustomer(updated);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Customer details updated.')),
      );
    }
  }

  void _openAllSessionsSheet(List<ScanSessionSummary> sessions) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AllSessionsSheet(
          sessions: sessions,
          formatter: _formatDateTime,
          weightFormatter: _formatWeight),
    );
  }

  void _openAllBullionSheet(List<BullionSale> bullionSales) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AllBullionSheet(
          sales: bullionSales,
          formatter: _formatDateTime,
          weightFormatter: _formatWeight,
          amountFormatter: _formatAmount),
    );
  }

  Widget _buildCustomerCard(CustomerRecord customer) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  customer.name,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: AppTypography.displaySize,
                    fontWeight: AppTypography.displayWeight,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => _openEditCustomerSheet(customer),
                icon: const Icon(Icons.edit_rounded, size: 20),
                tooltip: 'Edit Customer',
                visualDensity: VisualDensity.compact,
                color: AppColors.textSecondary,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            customer.phone.trim().isNotEmpty ? customer.phone : 'No phone added',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            customer.area,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          if ((customer.email ?? '').isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              customer.email!,
              style: TextStyle(color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSessionsTab(List<ScanSessionSummary> customerSessions) {
    if (customerSessions.isEmpty) {
      return const AppBanner(
        title: 'No saved sessions yet',
        message: 'Save a scan session to start building the customer profile.',
        tone: AppBannerTone.info,
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppSectionHeader(
                title: 'Lifetime summary',
                subtitle: 'Aggregated from saved local sessions.',
                tight: true,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  AppBadge(
                    label: '${customerSessions.length} sessions',
                    tone: AppBadgeTone.neutral,
                    icon: Icons.event_note_rounded,
                    compact: true,
                  ),
                  AppBadge(
                    label: 'Fine ${_formatWeight(_lifetimeFine(customerSessions))} g',
                    tone: AppBadgeTone.neutral,
                    icon: Icons.balance_rounded,
                    compact: true,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const AppSectionHeader(
          title: 'Recent sessions',
          subtitle: 'Tap a session to open the saved summary and report options.',
        ),
        const SizedBox(height: AppSpacing.md),
        ...customerSessions.take(5).map(
          (session) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: InkWell(
              onTap: () => context.push('/sales-scans/${session.sessionId}', extra: session),
              borderRadius: BorderRadius.circular(AppRadius.md),
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _formatDateTime(session.createdAt),
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${session.totalItems} items',
                            style: TextStyle(
                              color: AppColors.textMuted,
                              fontSize: 12,
                            ),
                          ),
                          if ((session.notes).trim().isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              session.notes,
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '${_formatWeight(session.totalFineWeight)} g',
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w800,
                            fontSize: 15,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Fine Wt',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (customerSessions.length > 5) ...[
          const SizedBox(height: AppSpacing.sm),
          AppActionButton(
            label: 'View all ${customerSessions.length} sessions',
            onPressed: () => _openAllSessionsSheet(customerSessions),
            variant: AppActionButtonVariant.secondary,
            expanded: true,
          ),
        ],
      ],
    );
  }

  Widget _buildBullionTab(List<BullionSale> bullionSales) {
    if (bullionSales.isEmpty) {
      return const AppBanner(
        title: 'No bullion sales yet',
        message: 'Bullion sales for this customer will appear here.',
        tone: AppBannerTone.info,
      );
    }

    final totalWeight = bullionSales.fold(0.0, (sum, s) => sum + s.weightGrams);
    final totalAmount = bullionSales.fold(0.0, (sum, s) => sum + s.totalAmount);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppCard(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppSectionHeader(
                title: 'Bullion summary',
                subtitle: 'Aggregated from all bullion transactions.',
                tight: true,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  AppBadge(
                    label: '${bullionSales.length} entries',
                    tone: AppBadgeTone.neutral,
                    icon: Icons.diamond_rounded,
                    compact: true,
                  ),
                  AppBadge(
                    label: '${totalWeight.toStringAsFixed(3)} g',
                    tone: AppBadgeTone.neutral,
                    icon: Icons.balance_rounded,
                    compact: true,
                  ),
                  AppBadge(
                    label: _formatAmount(totalAmount),
                    tone: AppBadgeTone.neutral,
                    icon: Icons.currency_rupee_rounded,
                    compact: true,
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        const AppSectionHeader(
          title: 'Bullion entries',
          subtitle: 'All gold/bullion transactions for this customer.',
        ),
        const SizedBox(height: AppSpacing.md),
        ...bullionSales.take(5).map(
          (sale) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: sale.isSale
                          ? AppColors.accent.withValues(alpha: 0.15)
                          : AppColors.warning.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      sale.isSale ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                      size: 18,
                      color: sale.isSale ? AppColors.accent : AppColors.warning,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              sale.isSale ? 'Sale' : 'Return',
                              style: TextStyle(
                                color: sale.isSale ? AppColors.accent : AppColors.warning,
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                            if (sale.goldPurity.isNotEmpty) ...[
                              const SizedBox(width: 6),
                              Text(
                                '• ${sale.goldPurity}',
                                style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                              ),
                            ],
                          ],
                        ),
                        Text(
                          _formatDateTime(sale.createdAt),
                          style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                        ),
                        if ((sale.notes ?? '').isNotEmpty)
                          Text(
                            sale.notes!,
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${sale.weightGrams.toStringAsFixed(3)} g',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                      Text(
                        _formatAmount(sale.totalAmount),
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        if (bullionSales.length > 5) ...[
          const SizedBox(height: AppSpacing.sm),
          AppActionButton(
            label: 'View all ${bullionSales.length} entries',
            onPressed: () => _openAllBullionSheet(bullionSales),
            variant: AppActionButtonVariant.secondary,
            expanded: true,
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(customerScanSessionsProvider(widget.customerId));
    final bullionAsync = ref.watch(bullionSalesByCustomerProvider(widget.customerId));

    final customerSessions = sessionsAsync.maybeWhen(
      data: (value) => value,
      orElse: () => const <ScanSessionSummary>[],
    );

    final customer = customerSessions.isNotEmpty ? customerSessions.first.customer : null;

    // Try getting customer name from bullion sales if not found in sessions
    final bullionSales = bullionAsync.maybeWhen(
      data: (sales) => sales,
      orElse: () => const <BullionSale>[],
    );

    final displayName = customer?.name ??
        (bullionSales.isNotEmpty ? bullionSales.first.customerName : 'Customer Profile');

    return Scaffold(
      appBar: AppBar(
        title: Text(displayName),
        leading: IconButton(
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/sales-scans');
            }
          },
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.qr_code_scanner_rounded), text: 'Sessions'),
            Tab(icon: Icon(Icons.diamond_rounded), text: 'Bullion'),
          ],
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: [
            // ── Sessions Tab ───────────────────────────────────────
            ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenPadding,
                AppSpacing.lg,
                AppSpacing.screenPadding,
                AppSpacing.xxl,
              ),
              children: [
                if (customer != null) ...[
                  _buildCustomerCard(customer),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (sessionsAsync.isLoading && customerSessions.isEmpty)
                  const Center(child: CircularProgressIndicator())
                else
                  _buildSessionsTab(customerSessions),
                const SizedBox(height: AppSpacing.lg),
                AppActionButton(
                  label: 'Back to My Sales / Scans',
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/sales-scans');
                    }
                  },
                  variant: AppActionButtonVariant.secondary,
                  expanded: true,
                ),
              ],
            ),

            // ── Bullion Tab ────────────────────────────────────────
            ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenPadding,
                AppSpacing.lg,
                AppSpacing.screenPadding,
                AppSpacing.xxl,
              ),
              children: [
                if (customer != null) ...[
                  _buildCustomerCard(customer),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (bullionAsync.isLoading)
                  const Center(child: CircularProgressIndicator())
                else if (bullionAsync.hasError)
                  AppBanner(
                    title: 'Failed to load bullion sales',
                    message: bullionAsync.error.toString(),
                    tone: AppBannerTone.warning,
                    actionLabel: 'Retry',
                    onAction: () =>
                        ref.invalidate(bullionSalesByCustomerProvider(widget.customerId)),
                  )
                else
                  _buildBullionTab(bullionSales),
              ],
            ),
          ],
        ),
      ),
    );
  }

  double _lifetimeFine(List<ScanSessionSummary> sessions) {
    return sessions.fold(0, (sum, session) => sum + session.totalFineWeight);
  }
}

class _AllSessionsSheet extends StatelessWidget {
  const _AllSessionsSheet({
    required this.sessions,
    required this.formatter,
    required this.weightFormatter,
  });

  final List<ScanSessionSummary> sessions;
  final String Function(DateTime) formatter;
  final String Function(double) weightFormatter;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'All Sessions',
                    style: TextStyle(
                      fontSize: AppTypography.titleSize,
                      fontWeight: AppTypography.titleWeight,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(AppSpacing.screenPadding),
              itemCount: sessions.length,
              itemBuilder: (context, index) {
                final session = sessions[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: InkWell(
                    onTap: () {
                      Navigator.pop(context);
                      context.push('/sales-scans/${session.sessionId}', extra: session);
                    },
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  formatter(session.createdAt),
                                  style: TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${session.totalItems} items',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                                if ((session.notes).trim().isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    session.notes,
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text(
                                '${weightFormatter(session.totalFineWeight)} g',
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Fine Wt',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 10,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _AllBullionSheet extends StatelessWidget {
  const _AllBullionSheet({
    required this.sales,
    required this.formatter,
    required this.weightFormatter,
    required this.amountFormatter,
  });

  final List<BullionSale> sales;
  final String Function(DateTime) formatter;
  final String Function(double) weightFormatter;
  final String Function(double) amountFormatter;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'All Bullion Entries',
                    style: TextStyle(
                      fontSize: AppTypography.titleSize,
                      fontWeight: AppTypography.titleWeight,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(AppSpacing.screenPadding),
              itemCount: sales.length,
              itemBuilder: (context, index) {
                final sale = sales[index];
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            color: sale.isSale
                                ? AppColors.accent.withValues(alpha: 0.15)
                                : AppColors.warning.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            sale.isSale ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                            size: 18,
                            color: sale.isSale ? AppColors.accent : AppColors.warning,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    sale.isSale ? 'Sale' : 'Return',
                                    style: TextStyle(
                                      color: sale.isSale ? AppColors.accent : AppColors.warning,
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                  if (sale.goldPurity.isNotEmpty) ...[
                                    const SizedBox(width: 6),
                                    Text(
                                      '• ${sale.goldPurity}',
                                      style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                                    ),
                                  ],
                                ],
                              ),
                              Text(
                                formatter(sale.createdAt),
                                style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                              ),
                              if ((sale.notes ?? '').isNotEmpty)
                                Text(
                                  sale.notes!,
                                  style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '${weightFormatter(sale.weightGrams)} g',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              amountFormatter(sale.totalAmount),
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
