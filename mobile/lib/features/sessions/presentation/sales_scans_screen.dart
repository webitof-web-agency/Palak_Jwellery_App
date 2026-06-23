import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../customers/domain/customer_record.dart';
import '../domain/scan_session_summary.dart';
import 'saved_scan_sessions_provider.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

class SalesScansScreen extends ConsumerStatefulWidget {
  const SalesScansScreen({super.key});

  @override
  ConsumerState<SalesScansScreen> createState() => _SalesScansScreenState();
}

class _SalesScansScreenState extends ConsumerState<SalesScansScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchTerm = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatWeight(double value) => value.toStringAsFixed(3);

  List<_CustomerSessionsGroup> _groups(List<ScanSessionSummary> sessions) {
    final grouped = <String, _CustomerSessionsGroup>{};
    for (final session in sessions) {
      final customer = session.customer;
      if (customer == null) {
        continue;
      }
      grouped.putIfAbsent(
        customer.id,
        () => _CustomerSessionsGroup(customer: customer, sessions: <ScanSessionSummary>[]),
      ).sessions.add(session);
    }

    final groups = grouped.values.toList(growable: false);
    groups.sort((a, b) => b.latestSession.createdAt.compareTo(a.latestSession.createdAt));
    return groups;
  }

  void _openGroup(BuildContext context, _CustomerSessionsGroup group) {
    if (group.sessions.length > 1) {
      context.push('/customers/${group.customer.id}');
      return;
    }
    context.push('/sales-scans/${group.latestSession.sessionId}');
  }

  @override
  Widget build(BuildContext context) {
    final sessionsAsync = ref.watch(savedScanSessionsProvider);
    final sessions = sessionsAsync.maybeWhen(data: (value) => value, orElse: () => const <ScanSessionSummary>[]);
    final query = _searchTerm.trim().toLowerCase();
    final filteredSessions = sessions.where((session) {
      final customer = session.customer;
      if (customer == null) {
        return false;
      }
      if (query.isEmpty) {
        return true;
      }
      return customer.name.toLowerCase().contains(query) ||
          customer.phone.toLowerCase().contains(query);
    }).toList(growable: false);
    final groups = _groups(filteredSessions);
    final loading = sessionsAsync.isLoading && sessions.isEmpty;
    final hasSearchQuery = query.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Sales / Scans'),
        leading: IconButton(
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/dashboard');
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
            const AppSectionHeader(
              title: 'Recent saved sales',
              subtitle: 'Search by customer name or phone, then open a saved session.',
            ),
            const SizedBox(height: AppSpacing.md),
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
                    Text('Loading saved sessions...'),
                  ],
                ),
              )
            else if (sessions.isEmpty)
              const AppBanner(
                title: 'No saved sessions yet',
                message: 'Save a scan session to see it here.',
                tone: AppBannerTone.info,
              )
            else if (hasSearchQuery && groups.isEmpty)
              const AppBanner(
                title: 'No matching sessions',
                message: 'Try a different customer name or phone number.',
                tone: AppBannerTone.info,
              )
            else
              ...groups.map((group) {
                final latest = group.latestSession;
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AppCard(
                    onTap: () => _openGroup(context, group),
                    padding: const EdgeInsets.all(AppSpacing.lg),
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
                                    group.customer.name,
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: AppTypography.titleSize,
                                      fontWeight: AppTypography.titleWeight,
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    '${group.customer.phone} | ${group.customer.area}',
                                    style: TextStyle(color: AppColors.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            AppBadge(
                              label: '${group.sessions.length} sessions',
                              tone: AppBadgeTone.accent,
                              icon: Icons.receipt_long_rounded,
                              compact: true,
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Wrap(
                          spacing: AppSpacing.xs,
                          runSpacing: AppSpacing.xs,
                          children: [
                            AppBadge(
                              label: 'Latest ${latest.totalItems} items',
                              tone: AppBadgeTone.neutral,
                              icon: Icons.inventory_2_rounded,
                              compact: true,
                            ),
                            AppBadge(
                              label: 'Fine ${_formatWeight(group.totalFine)} g',
                              tone: AppBadgeTone.neutral,
                              icon: Icons.balance_rounded,
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
                        for (final session in group.sessions.take(2)) ...[
                          InkWell(
                            onTap: () => context.push('/sales-scans/${session.sessionId}'),
                            borderRadius: BorderRadius.circular(AppRadius.md),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Saved ${_formatDateTime(session.createdAt)}',
                                          style: TextStyle(
                                            color: AppColors.textPrimary,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Session ${session.totalItems} items',
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
                            ),
                          ),
                        ],
                        if (group.sessions.length > 2)
                          Text(
                            '+ ${group.sessions.length - 2} more sessions',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                          ),
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

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day}/${local.month}/${local.year} $hour:$minute $period';
  }
}

class _CustomerSessionsGroup {
  _CustomerSessionsGroup({
    required this.customer,
    required this.sessions,
  });

  final CustomerRecord customer;
  final List<ScanSessionSummary> sessions;

  ScanSessionSummary get latestSession => sessions.first;

  double get totalFine => sessions.fold(0, (sum, session) => sum + session.totalFineWeight);
}
