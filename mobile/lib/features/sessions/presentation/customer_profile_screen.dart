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
          onPressed: () => context.go('/sales-scans'),
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
                      customer.phone,
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
                ...customerSessions.map(
                  (session) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AppCard(
                      onTap: () => context.push('/sales-scans/${session.sessionId}'),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Saved ${_formatDateTime(session.createdAt)}',
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${session.totalItems} items',
                                      style: TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 11,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: AppSpacing.xs,
                            runSpacing: AppSpacing.xs,
                            children: [
                              AppBadge(
                                label: 'Gross ${_formatWeight(session.totalGrossWeight)} g',
                                tone: AppBadgeTone.neutral,
                                icon: Icons.scale_rounded,
                                compact: true,
                              ),
                              AppBadge(
                                label: 'Net ${_formatWeight(session.totalNetWeight)} g',
                                tone: AppBadgeTone.neutral,
                                icon: Icons.inventory_2_rounded,
                                compact: true,
                              ),
                              AppBadge(
                                label: 'Fine ${_formatWeight(session.totalFineWeight)} g',
                                tone: AppBadgeTone.accent,
                                icon: Icons.balance_rounded,
                                compact: true,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppActionButton(
              label: 'Back to My Sales / Scans',
              onPressed: () => context.go('/sales-scans'),
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

