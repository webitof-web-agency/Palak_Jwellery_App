import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/theme/app_theme.dart';
import '../../batches/presentation/widgets/batch_ui.dart';
import '../domain/capture_session_models.dart';
import 'capture_sessions_provider.dart';

const _sessionStatusOptions = <String>[
  'All',
  'draft',
  'open',
  'submitted',
  'finalized',
];

class MySessionsScreen extends ConsumerStatefulWidget {
  const MySessionsScreen({super.key});

  @override
  ConsumerState<MySessionsScreen> createState() => _MySessionsScreenState();
}

class _MySessionsScreenState extends ConsumerState<MySessionsScreen> {
  int _page = 1;
  String _searchTerm = '';
  String? _status;
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  CaptureSessionListQuery get _query {
    return CaptureSessionListQuery(
      page: _page,
      limit: 10,
      searchTerm: _searchTerm.trim(),
      status: _status,
    );
  }

  Future<void> _refresh() async {
    ref.invalidate(captureSessionsPageProvider(_query));
    await ref.read(captureSessionsPageProvider(_query).future);
  }

  void _setFilterState({
    String? searchTerm,
    String? status,
  }) {
    setState(() {
      if (searchTerm != null) {
        _searchTerm = searchTerm;
      }
      if (status != null) {
        _status = status;
      }
      _page = 1;
    });
  }

  Future<void> _openCreateSession() async {
    final createdId = await context.push<String>('/sessions/create');
    if (!mounted || createdId == null || createdId.isEmpty) {
      return;
    }

    await context.push('/sessions/$createdId');
  }

  void _openSession(String? sessionId) {
    if (sessionId == null || sessionId.isEmpty) {
      return;
    }
    context.push('/sessions/$sessionId');
  }

  String _statusLabel(String? status) {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'open':
        return 'Open';
      case 'submitted':
        return 'Submitted';
      case 'finalized':
        return 'Finalized';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'All statuses';
    }
  }

  Widget _buildStatusChips() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in _sessionStatusOptions)
          FilterChip(
            label: Text(_statusLabel(option == 'All' ? null : option)),
            selected: (_status ?? '') == (option == 'All' ? '' : option),
            onSelected: (value) {
              _setFilterState(status: value ? (option == 'All' ? null : option) : null);
            },
          ),
      ],
    );
  }

  Widget _buildSessionCard(CaptureSessionListItem session) {
    final customerText = [
      if (session.customerName.trim().isNotEmpty) session.customerName.trim(),
      if (session.customerPhone.trim().isNotEmpty) session.customerPhone.trim(),
    ].join(' • ');
    final referenceText = session.referenceNote.trim();
    final canOpen = session.id.isNotEmpty;

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: canOpen ? () => _openSession(session.id) : null,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        session.sessionRef.isEmpty ? '—' : session.sessionRef,
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        customerText.isEmpty ? 'No customer details yet' : customerText,
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      if (referenceText.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          referenceText,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 13,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    BatchStatusPill(status: session.status),
                    const SizedBox(height: 8),
                    Text(
                      '${session.supplierCount} supplier${session.supplierCount == 1 ? '' : 's'}',
                      style: TextStyle(
                        color: AppColors.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 420;
                final suppliersCard = BatchMetricCard(
                  label: 'Suppliers',
                  value: '${session.supplierCount}',
                  icon: Icons.store_rounded,
                );
                final itemsCard = BatchMetricCard(
                  label: 'Items',
                  value: '${session.itemCount}',
                  icon: Icons.format_list_bulleted_rounded,
                );
                final netCard = BatchMetricCard(
                  label: 'Net',
                  value: formatBatchWeight(session.totals.netWeight),
                  icon: Icons.filter_2_rounded,
                );
                final fineCard = BatchMetricCard(
                  label: 'Fine',
                  value: formatBatchWeight(session.totals.fineWeight),
                  icon: Icons.workspace_premium_rounded,
                );

                if (isCompact) {
                  return Column(
                    children: [
                      suppliersCard,
                      const SizedBox(height: 10),
                      itemsCard,
                      const SizedBox(height: 10),
                      netCard,
                      const SizedBox(height: 10),
                      fineCard,
                    ],
                  );
                }

                return Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    SizedBox(width: (constraints.maxWidth - 10) / 2, child: suppliersCard),
                    SizedBox(width: (constraints.maxWidth - 10) / 2, child: itemsCard),
                    SizedBox(width: (constraints.maxWidth - 10) / 2, child: netCard),
                    SizedBox(width: (constraints.maxWidth - 10) / 2, child: fineCard),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: canOpen ? () => _openSession(session.id) : null,
                    icon: const Icon(Icons.visibility_rounded),
                    label: const Text('Open session'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPagination(CaptureSessionListPage page) {
    if (page.pages <= 1) {
      return const SliverToBoxAdapter(child: SizedBox.shrink());
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      sliver: SliverToBoxAdapter(
        child: Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _page > 1
                    ? () {
                        setState(() {
                          _page -= 1;
                        });
                      }
                    : null,
                icon: const Icon(Icons.chevron_left_rounded),
                label: const Text('Previous'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Text(
                'Page ${page.page} / ${page.pages}',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: page.page < page.pages
                    ? () {
                        setState(() {
                          _page += 1;
                        });
                      }
                    : null,
                icon: const Icon(Icons.chevron_right_rounded),
                label: const Text('Next'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(CaptureSessionListPage page) {
    if (page.sessions.isEmpty) {
      return const SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: BatchEmptyState(
              icon: Icons.hub_rounded,
              title: 'No capture sessions yet',
              message:
                  'Create one when a request includes items from multiple suppliers.',
            ),
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          final session = page.sessions[index];
          return Padding(
            padding: EdgeInsets.only(
              bottom: index == page.sessions.length - 1 ? 0 : 12,
            ),
            child: _buildSessionCard(session),
          );
        }, childCount: page.sessions.length),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final sessionsAsync = ref.watch(captureSessionsPageProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text('My Sessions')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: BatchSectionCard(
                    title: 'Capture sessions',
                    subtitle:
                        'Track multi-supplier requests and move each supplier batch through the mobile capture flow.',
                    trailing: SizedBox(
                      height: 44,
                      child: ElevatedButton.icon(
                        onPressed: _openCreateSession,
                        icon: const Icon(Icons.add_rounded),
                        label: const Text('Create Session'),
                      ),
                    ),
                    child: Text(
                      'Sessions group supplier batches for one customer request. Quick single-supplier work still belongs in My Batches.',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        height: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: BatchSectionCard(
                    title: 'Filters',
                    subtitle: 'Search sessions by reference, customer, or note.',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _searchController,
                          onChanged: (value) => _setFilterState(searchTerm: value),
                          decoration: InputDecoration(
                            labelText: 'Search sessions',
                            hintText: 'Session ref, customer, note',
                            prefixIcon: const Icon(Icons.search_rounded),
                            suffixIcon: _searchTerm.isEmpty
                                ? null
                                : IconButton(
                                    tooltip: 'Clear search',
                                    onPressed: () {
                                      _searchController.clear();
                                      _setFilterState(searchTerm: '');
                                    },
                                    icon: const Icon(Icons.close_rounded),
                                  ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Status',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.8,
                          ),
                        ),
                        const SizedBox(height: 8),
                        _buildStatusChips(),
                      ],
                    ),
                  ),
                ),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: Text(
                    'Assigned sessions',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
              ),
              sessionsAsync.when(
                loading: () => const SliverPadding(
                  padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
                  sliver: SliverToBoxAdapter(
                    child: BatchEmptyState(
                      icon: Icons.hourglass_bottom_rounded,
                      title: 'Loading sessions',
                      message: 'Fetching your assigned capture sessions.',
                    ),
                  ),
                ),
                error: (error, stackTrace) => SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  sliver: SliverToBoxAdapter(
                    child: BatchEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: 'Could not load sessions',
                      message: error.toString(),
                      action: OutlinedButton(
                        onPressed: () => ref.invalidate(captureSessionsPageProvider(_query)),
                        child: const Text('Retry'),
                      ),
                    ),
                  ),
                ),
                data: _buildResults,
              ),
              sessionsAsync.maybeWhen(
                data: (page) => _buildPagination(page),
                orElse: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 20)),
            ],
          ),
        ),
      ),
    );
  }
}
