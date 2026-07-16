import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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

class _CustomerProfileScreenState extends ConsumerState<CustomerProfileScreen> {
  String _formatWeight(double value) => value.toStringAsFixed(3);

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day}/${local.month}/${local.year} $hour:$minute $period';
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

    if (!mounted || updated == null) {
      return;
    }

    await ref.read(savedScanSessionsProvider.notifier).updateCustomer(updated);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Customer details updated.')),
      );
    }
  }

  void _openAllSessionsSheet(List<ScanSessionSummary> sessions) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _AllSessionsSheet(sessions: sessions, formatter: _formatDateTime, weightFormatter: _formatWeight),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(savedScanSessionsProvider);
    final sessions = sessionsAsync.maybeWhen(
      data: (value) => value,
      orElse: () => const <ScanSessionSummary>[],
    );

    final customerSessions = sessions
        .where((session) => session.customer?.id == widget.customerId)
        .toList(growable: false)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

    final customer = customerSessions.isNotEmpty ? customerSessions.first.customer : null;

    if (sessionsAsync.isLoading && sessions.isEmpty) {
      return const Scaffold(
        body: SafeArea(
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Profile'),
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
            if (customer == null)
              const AppBanner(
                title: 'Customer not found',
                message: 'This customer has no saved sessions yet.',
                tone: AppBannerTone.info,
              )
            else ...[
              AppCard(
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
              ),
              const SizedBox(height: AppSpacing.lg),
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
              if (customerSessions.isEmpty)
                const AppBanner(
                  title: 'No saved sessions yet',
                  message: 'Save a scan session to start building the customer profile.',
                  tone: AppBannerTone.info,
                )
              else
                ...customerSessions.take(5).map(
                  (session) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: InkWell(
                      onTap: () => context.push('/sales-scans/${session.sessionId}'),
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
                      context.push('/sales-scans/${session.sessionId}');
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


