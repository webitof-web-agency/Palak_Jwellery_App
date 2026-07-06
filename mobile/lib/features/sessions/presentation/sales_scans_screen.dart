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
  final Set<String> _syncingSessionIds = <String>{};
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

  bool _canRetry(ScanSessionSummary session) {
    return session.syncStatus == ScanSessionSyncStatus.pendingSync ||
        session.syncStatus == ScanSessionSyncStatus.syncFailed;
  }

  AppBadge _syncBadge(ScanSessionSummary session) {
    switch (session.syncStatus) {
      case ScanSessionSyncStatus.synced:
        return const AppBadge(
          label: 'Synced',
          tone: AppBadgeTone.success,
          icon: Icons.cloud_done_rounded,
          compact: true,
        );
      case ScanSessionSyncStatus.pendingSync:
        return const AppBadge(
          label: 'Pending Sync',
          tone: AppBadgeTone.warning,
          icon: Icons.cloud_upload_rounded,
          compact: true,
        );
      case ScanSessionSyncStatus.syncFailed:
        return const AppBadge(
          label: 'Sync Failed',
          tone: AppBadgeTone.warning,
          icon: Icons.cloud_off_rounded,
          compact: true,
        );
      default:
        return const AppBadge(
          label: 'Local Only',
          tone: AppBadgeTone.neutral,
          icon: Icons.phone_android_rounded,
          compact: true,
        );
    }
  }

  Future<void> _retrySync(ScanSessionSummary session) async {
    if (_syncingSessionIds.contains(session.sessionId)) {
      return;
    }

    setState(() => _syncingSessionIds.add(session.sessionId));
    try {
      final updated = await ref
          .read(savedScanSessionsProvider.notifier)
          .syncSingleSession(session);
      if (!mounted) {
        return;
      }

      final messenger = ScaffoldMessenger.of(context);
      if (updated.syncStatus == ScanSessionSyncStatus.synced) {
        messenger.showSnackBar(
          const SnackBar(content: Text('Session synced successfully.')),
        );
      } else {
        messenger.showSnackBar(
          SnackBar(
            content: Text(
              updated.syncError?.trim().isNotEmpty == true
                  ? updated.syncError!
                  : 'Session is still waiting for backend sync.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _syncingSessionIds.remove(session.sessionId));
      }
    }
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
    final pendingCount = sessions.where((session) => _canRetry(session)).length;

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
              title: 'Recent saved sessions',
              subtitle: 'Search by customer name or phone, then open a saved session.',
            ),
            const SizedBox(height: AppSpacing.md),
            if (pendingCount > 0) ...[
              AppBanner(
                title: '$pendingCount sessions pending sync',
                message: 'These sessions are saved locally. Retry sync when the internet connection is available.',
                tone: AppBannerTone.warning,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
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
                                    [group.customer.phone, group.customer.area].where((e) => e.trim().isNotEmpty).join(' | '),
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
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                'Saved ${_formatDateTime(session.createdAt)}',
                                                style: TextStyle(
                                                  color: AppColors.textPrimary,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                            _syncBadge(session),
                                          ],
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'Session ${session.totalItems} items',
                                          style: TextStyle(
                                            color: AppColors.textMuted,
                                            fontSize: 11,
                                          ),
                                        ),
                                        if (session.syncError?.trim().isNotEmpty == true) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            session.syncError!,
                                            style: TextStyle(
                                              color: AppColors.warning,
                                              fontSize: 11,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  if (_canRetry(session)) ...[
                                    const SizedBox(width: AppSpacing.sm),
                                    TextButton(
                                      onPressed: _syncingSessionIds.contains(session.sessionId)
                                          ? null
                                          : () => _retrySync(session),
                                      child: Text(
                                        _syncingSessionIds.contains(session.sessionId)
                                            ? 'Syncing...'
                                            : 'Retry Sync',
                                      ),
                                    ),
                                  ],
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
