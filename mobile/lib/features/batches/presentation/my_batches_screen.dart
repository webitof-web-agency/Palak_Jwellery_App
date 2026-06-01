import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/theme/app_theme.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../domain/batch_models.dart';
import 'batches_provider.dart';
import 'widgets/batch_ui.dart';

const _batchStatusOptions = <String>[
  'All',
  'draft',
  'open',
  'submitted',
  'finalized',
  'reopened',
  'cancelled',
];

const _batchEntryModeOptions = <String>['All', 'qr_scan', 'manual', 'mixed'];

const _batchSortOptions = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'updatedAt:desc', child: Text('Newest updated')),
  DropdownMenuItem(value: 'updatedAt:asc', child: Text('Oldest updated')),
  DropdownMenuItem(value: 'createdAt:desc', child: Text('Newest created')),
  DropdownMenuItem(value: 'batchRef:asc', child: Text('Batch ref A-Z')),
  DropdownMenuItem(value: 'itemCount:desc', child: Text('Items high to low')),
  DropdownMenuItem(value: 'revision:desc', child: Text('Revision high to low')),
];

class MyBatchesScreen extends ConsumerStatefulWidget {
  const MyBatchesScreen({super.key});

  @override
  ConsumerState<MyBatchesScreen> createState() => _MyBatchesScreenState();
}

class _MyBatchesScreenState extends ConsumerState<MyBatchesScreen> {
  int _page = 1;
  String _searchTerm = '';
  String? _supplierId;
  String? _status;
  String? _entryMode;
  String _sortValue = 'updatedAt:desc';
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  BatchListQuery get _query {
    final parts = _sortValue.split(':');
    final sortBy = parts.isNotEmpty ? parts[0] : 'updatedAt';
    final sortOrder = parts.length > 1 ? parts[1] : 'desc';

    return BatchListQuery(
      page: _page,
      limit: 10,
      searchTerm: _searchTerm.trim(),
      supplierId: _supplierId,
      status: _status,
      entryMode: _entryMode,
      sortBy: sortBy,
      sortOrder: sortOrder,
    );
  }

  Future<void> _refresh() async {
    ref.invalidate(batchesPageProvider(_query));
    await ref.read(batchesPageProvider(_query).future);
  }

  void _setFilterState({
    String? searchTerm,
    String? supplierId,
    String? status,
    String? entryMode,
    String? sortValue,
  }) {
    setState(() {
      if (searchTerm != null) {
        _searchTerm = searchTerm;
      }
      if (supplierId != null) {
        _supplierId = supplierId;
      }
      if (status != null) {
        _status = status;
      }
      if (entryMode != null) {
        _entryMode = entryMode;
      }
      if (sortValue != null) {
        _sortValue = sortValue;
      }
      _page = 1;
    });
  }

  Future<void> _openCreateBatch() async {
    final createdId = await context.push<String>('/batches/create');
    if (!mounted || createdId == null || createdId.isEmpty) {
      return;
    }

    await context.push('/batches/$createdId');
  }

  void _openBatch(String? batchId) {
    if (batchId == null || batchId.isEmpty) {
      return;
    }
    context.push('/batches/$batchId');
  }

  String _supplierLabel(List<SupplierModel> suppliers) {
    if (_supplierId == null || _supplierId!.isEmpty) {
      return 'All suppliers';
    }

    final match = suppliers.where((entry) => entry.id == _supplierId).toList();
    if (match.isEmpty) {
      return 'Selected supplier';
    }

    final supplier = match.first;
    final code = supplier.code.trim();
    if (code.isEmpty) {
      return supplier.name;
    }

    return '${supplier.name} ($code)';
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
      case 'reopened':
        return 'Reopened';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'All statuses';
    }
  }

  String _entryModeLabel(String? entryMode) {
    switch (entryMode) {
      case 'qr_scan':
        return 'QR scan';
      case 'manual':
        return 'Manual';
      case 'mixed':
        return 'Mixed';
      default:
        return 'All modes';
    }
  }

  Widget _buildFilterChips() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in _batchStatusOptions)
          FilterChip(
            label: Text(_statusLabel(option == 'All' ? null : option)),
            selected: (_status ?? '') == (option == 'All' ? '' : option),
            onSelected: (value) {
              _setFilterState(
                status: value ? (option == 'All' ? null : option) : null,
              );
            },
          ),
      ],
    );
  }

  Widget _buildEntryModeChips() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final option in _batchEntryModeOptions)
          FilterChip(
            label: Text(_entryModeLabel(option == 'All' ? null : option)),
            selected: (_entryMode ?? '') == (option == 'All' ? '' : option),
            onSelected: (value) {
              _setFilterState(
                entryMode: value ? (option == 'All' ? null : option) : null,
              );
            },
          ),
      ],
    );
  }

  Widget _buildBatchCard(BatchListItem batch) {
    final supplierName = formatBatchText(
      batch.supplier?.name ?? batch.supplierCode,
    );
    final assignedSalesman = formatBatchText(
      batch.assignedSalesman?.name ?? batch.salesman?.name,
    );
    final customerText = [
      if (batch.customerName.trim().isNotEmpty) batch.customerName.trim(),
      if (batch.customerPhone.trim().isNotEmpty) batch.customerPhone.trim(),
    ].join(' • ');

    return InkWell(
      borderRadius: BorderRadius.circular(20),
      onTap: () => _openBatch(batch.id),
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
                        batch.batchRef,
                        style: TextStyle(
                          color: AppColors.accent,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Supplier: $supplierName',
                        style: TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Assigned to: $assignedSalesman',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    BatchStatusPill(status: batch.status),
                    const SizedBox(height: 8),
                    Text(
                      'Rev ${batch.revision}',
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
            if (customerText.isNotEmpty) ...[
              const SizedBox(height: 10),
              Text(
                customerText,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              ),
            ],
            if (formatBatchText(batch.referenceNote).isNotEmpty &&
                batch.referenceNote.trim() != '—') ...[
              const SizedBox(height: 6),
              Text(
                batch.referenceNote.trim(),
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
            ],
            const SizedBox(height: 14),
            LayoutBuilder(
              builder: (context, constraints) {
                final isCompact = constraints.maxWidth < 420;
                final itemCard = BatchMetricCard(
                  label: 'Items',
                  value: '${batch.itemCount}',
                  icon: Icons.format_list_bulleted_rounded,
                );
                final grossCard = BatchMetricCard(
                  label: 'Gross',
                  value: formatBatchWeight(batch.totals.grossWeight),
                  icon: Icons.balance_rounded,
                );
                final netCard = BatchMetricCard(
                  label: 'Net',
                  value: formatBatchWeight(batch.totals.netWeight),
                  icon: Icons.filter_2_rounded,
                );
                final fineCard = BatchMetricCard(
                  label: 'Fine',
                  value: formatBatchWeight(batch.totals.fineWeight),
                  icon: Icons.workspace_premium_rounded,
                );

                if (isCompact) {
                  return Column(
                    children: [
                      itemCard,
                      const SizedBox(height: 10),
                      grossCard,
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
                    SizedBox(
                      width: (constraints.maxWidth - 10) / 2,
                      child: itemCard,
                    ),
                    SizedBox(
                      width: (constraints.maxWidth - 10) / 2,
                      child: grossCard,
                    ),
                    SizedBox(
                      width: (constraints.maxWidth - 10) / 2,
                      child: netCard,
                    ),
                    SizedBox(
                      width: (constraints.maxWidth - 10) / 2,
                      child: fineCard,
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _openBatch(batch.id),
                    icon: const Icon(Icons.visibility_rounded),
                    label: const Text('View details'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildResults(BatchListPage page) {
    if (page.batches.isEmpty) {
      return const SliverFillRemaining(
        hasScrollBody: false,
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: BatchEmptyState(
              icon: Icons.inventory_2_rounded,
              title: 'No batches found',
              message: 'Try a different supplier, status, or search term.',
            ),
          ),
        ),
      );
    }

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      sliver: SliverList(
        delegate: SliverChildBuilderDelegate((context, index) {
          final batch = page.batches[index];
          return Padding(
            padding: EdgeInsets.only(
              bottom: index == page.batches.length - 1 ? 0 : 12,
            ),
            child: _buildBatchCard(batch),
          );
        }, childCount: page.batches.length),
      ),
    );
  }

  Widget _buildPagination(BatchListPage page) {
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

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final suppliersAsync = ref.watch(suppliersProvider);
    final batchesAsync = ref.watch(batchesPageProvider(_query));

    return Scaffold(
      appBar: AppBar(title: const Text('My Batches')),
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
                    title: 'Batch workflow',
                    subtitle:
                        'View the batches assigned to you, create a new one, and keep everything supplier-specific.',
                    child: Text(
                      'Salesman batch work stays simple here. Use the filters to find the right batch quickly.',
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
                    subtitle:
                        'Search batches by reference, supplier, or customer.',
                    trailing: SizedBox(
                      height: 44,
                      child: ElevatedButton.icon(
                        onPressed: _openCreateBatch,
                        icon: const Icon(Icons.add_rounded),
                        label: const Text('Create Batch'),
                      ),
                    ),
                    child: suppliersAsync.when(
                      loading: () => Column(
                        children: [
                          const SizedBox(
                            height: 36,
                            width: 36,
                            child: CircularProgressIndicator(strokeWidth: 2.5),
                          ),
                          const SizedBox(height: 10),
                          Text(
                            'Loading suppliers...',
                            style: TextStyle(color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                      error: (error, stackTrace) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Could not load suppliers.',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            error.toString(),
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              height: 1.4,
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: () => ref.invalidate(suppliersProvider),
                            child: const Text('Retry'),
                          ),
                        ],
                      ),
                      data: (suppliers) {
                        final supplierOptions = suppliers;
                        final hasSelectedSupplier =
                            _supplierId != null &&
                            supplierOptions.any(
                              (supplier) => supplier.id == _supplierId,
                            );
                        final effectiveSupplierId = hasSelectedSupplier
                            ? _supplierId
                            : null;
                        final selectedSupplierLabel = _supplierId == null
                            ? 'All suppliers'
                            : hasSelectedSupplier
                            ? _supplierLabel(supplierOptions)
                            : 'Selected supplier unavailable';
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextField(
                              controller: _searchController,
                              onChanged: (value) =>
                                  _setFilterState(searchTerm: value),
                              decoration: InputDecoration(
                                labelText: 'Search batches',
                                hintText: 'Batch ref, supplier, customer',
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
                            const SizedBox(height: 12),
                            DropdownButtonFormField<String?>(
                              initialValue: effectiveSupplierId,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Supplier',
                                hintText: 'All suppliers',
                              ),
                              items: [
                                const DropdownMenuItem<String?>(
                                  value: null,
                                  child: Text('All suppliers'),
                                ),
                                ...supplierOptions.map(
                                  (supplier) => DropdownMenuItem<String?>(
                                    value: supplier.id,
                                    child: Text(
                                      supplier.code.trim().isEmpty
                                          ? supplier.name
                                          : '${supplier.name} (${supplier.code})',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ),
                              ],
                              selectedItemBuilder: (context) => [
                                Text('All suppliers'),
                                ...supplierOptions.map(
                                  (supplier) => Text(
                                    supplier.code.trim().isEmpty
                                        ? supplier.name
                                        : '${supplier.name} (${supplier.code})',
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                              onChanged: (value) {
                                _setFilterState(supplierId: value);
                              },
                            ),
                            const SizedBox(height: 10),
                            Text(
                              selectedSupplierLabel == 'All suppliers'
                                  ? 'Showing every supplier assigned to you.'
                                  : selectedSupplierLabel ==
                                        'Selected supplier unavailable'
                                  ? 'The selected supplier is no longer available.'
                                  : 'Filtered to $selectedSupplierLabel.',
                              style: TextStyle(
                                color: AppColors.textMuted,
                                fontSize: 12,
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
                            _buildFilterChips(),
                            const SizedBox(height: 14),
                            Text(
                              'Entry mode',
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.8,
                              ),
                            ),
                            const SizedBox(height: 8),
                            _buildEntryModeChips(),
                            const SizedBox(height: 14),
                            DropdownButtonFormField<String>(
                              initialValue: _sortValue,
                              isExpanded: true,
                              decoration: const InputDecoration(
                                labelText: 'Sort',
                              ),
                              items: _batchSortOptions,
                              onChanged: (value) {
                                if (value != null) {
                                  _setFilterState(sortValue: value);
                                }
                              },
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 16)),
              batchesAsync.when(
                loading: () => const SliverPadding(
                  padding: EdgeInsets.fromLTRB(20, 0, 20, 0),
                  sliver: SliverToBoxAdapter(
                    child: Center(
                      child: Padding(
                        padding: EdgeInsets.symmetric(vertical: 36),
                        child: CircularProgressIndicator(),
                      ),
                    ),
                  ),
                ),
                error: (error, stackTrace) => SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  sliver: SliverToBoxAdapter(
                    child: BatchEmptyState(
                      icon: Icons.error_outline_rounded,
                      title: 'Could not load batches',
                      message: error.toString(),
                      action: OutlinedButton(
                        onPressed: _refresh,
                        child: const Text('Try again'),
                      ),
                    ),
                  ),
                ),
                data: (page) => SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                  sliver: SliverToBoxAdapter(
                    child: BatchSectionCard(
                      title: 'Results',
                      subtitle:
                          'Assigned batches matching your current filters.',
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final isCompact = constraints.maxWidth < 420;
                          final totalCard = BatchMetricCard(
                            label: 'Total',
                            value: '${page.total}',
                            icon: Icons.inventory_2_rounded,
                          );
                          final pageCard = BatchMetricCard(
                            label: 'Page',
                            value: '${page.page}/${page.pages}',
                            icon: Icons.layers_rounded,
                          );

                          if (isCompact) {
                            return Column(
                              children: [
                                totalCard,
                                const SizedBox(height: 10),
                                pageCard,
                              ],
                            );
                          }

                          return Row(
                            children: [
                              Expanded(child: totalCard),
                              const SizedBox(width: 10),
                              Expanded(child: pageCard),
                            ],
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 16)),
              batchesAsync.when(
                loading: () =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (error, stackTrace) =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                data: (page) => _buildResults(page),
              ),
              batchesAsync.when(
                loading: () =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                error: (error, stackTrace) =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                data: (page) => _buildPagination(page),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 20)),
            ],
          ),
        ),
      ),
    );
  }
}
