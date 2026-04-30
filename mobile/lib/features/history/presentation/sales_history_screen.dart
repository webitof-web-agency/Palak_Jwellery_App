import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'sales_history_provider.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../../shared/theme/app_theme.dart';

const _salesHistorySortOptions = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'saleDate:desc', child: Text('Newest first')),
  DropdownMenuItem(value: 'saleDate:asc', child: Text('Oldest first')),
  DropdownMenuItem(value: 'netWeight:desc', child: Text('Net weight high to low')),
  DropdownMenuItem(value: 'netWeight:asc', child: Text('Net weight low to high')),
];

const _salesHistorySearchScopes = <DropdownMenuItem<String>>[
  DropdownMenuItem(value: 'all', child: Text('All fields')),
  DropdownMenuItem(value: 'supplier', child: Text('Supplier only')),
  DropdownMenuItem(value: 'details', child: Text('Item details')),
];

class SalesHistoryScreen extends ConsumerStatefulWidget {
  const SalesHistoryScreen({super.key});

  @override
  ConsumerState<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends ConsumerState<SalesHistoryScreen> {
  int _page = 1;
  String _searchTerm = '';
  String _searchScope = 'all';
  String _sortValue = 'saleDate:desc';
  bool _duplicatesOnly = false;
  bool _searchExpanded = false;
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  SalesHistoryQuery get _query {
    final parts = _sortValue.split(':');
    final sortBy = parts.isNotEmpty ? parts[0] : 'saleDate';
    final sortOrder = parts.length > 1 ? parts[1] : 'desc';
    return SalesHistoryQuery(
      page: _page,
      searchTerm: _searchTerm.trim(),
      searchScope: _searchScope,
      sortBy: sortBy,
      sortOrder: sortOrder,
      duplicatesOnly: _duplicatesOnly,
    );
  }

  Future<void> _refresh() async {
    ref.invalidate(recentSalesPageProvider(_query));
    await ref.read(recentSalesPageProvider(_query).future);
  }

  void _clearSearch() {
    setState(() {
      _searchTerm = '';
      _page = 1;
      _searchController.clear();
    });
  }

  Future<void> _pickSearchScope() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _ChoiceSheet(
          title: 'Search scope',
          items: _salesHistorySearchScopes,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _searchScope = picked;
        _page = 1;
      });
    }
  }

  Future<void> _pickSort() async {
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _ChoiceSheet(
          title: 'Sort entries',
          items: _salesHistorySortOptions,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _sortValue = picked;
        _page = 1;
      });
    }
  }

  Widget _buildFilterPanel(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: AppColors.border),
                ),
                child: Icon(
                  Icons.tune_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Search and filters',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'What this screen searches',
                onPressed: () {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Search finds supplier, item code, notes, and category.',
                      ),
                    ),
                  );
                },
                icon: Icon(
                  Icons.info_outline_rounded,
                  color: AppColors.textMuted,
                  size: 20,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            'Search entries by supplier, item code, category, or notes.',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 10),
          InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: () => setState(() => _searchExpanded = !_searchExpanded),
            child: Container(
              height: 56,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, color: AppColors.textMuted),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _searchTerm.isEmpty ? 'Tap to search entries' : _searchTerm,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: _searchTerm.isEmpty
                            ? AppColors.textMuted
                            : AppColors.textPrimary,
                      ),
                    ),
                  ),
                  Icon(
                    _searchExpanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textMuted,
                  ),
                ],
              ),
            ),
          ),
          if (_searchExpanded) ...[
            const SizedBox(height: 10),
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() {
                _searchTerm = value;
                _page = 1;
              }),
              decoration: InputDecoration(
                labelText: 'Search',
                hintText: 'Supplier, item code, notes',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _searchTerm.isEmpty
                    ? IconButton(
                        tooltip: 'Hide search',
                        onPressed: () => setState(() => _searchExpanded = false),
                        icon: const Icon(Icons.keyboard_arrow_up_rounded),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            tooltip: 'Clear search',
                            onPressed: _clearSearch,
                            icon: const Icon(Icons.close_rounded),
                          ),
                          IconButton(
                            tooltip: 'Hide search',
                            onPressed: () => setState(() => _searchExpanded = false),
                            icon: const Icon(Icons.keyboard_arrow_up_rounded),
                          ),
                        ],
                      ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _CompactIconPill(
                icon: Icons.filter_alt_rounded,
                label: 'Scope',
                value: _searchScope == 'all'
                    ? 'All'
                    : _searchScope == 'supplier'
                        ? 'Supplier'
                        : 'Details',
                onTap: _pickSearchScope,
              ),
              _CompactIconPill(
                icon: Icons.sort_rounded,
                label: 'Sort',
                value: _sortValue == 'saleDate:desc'
                    ? 'Newest'
                    : _sortValue == 'saleDate:asc'
                        ? 'Oldest'
                        : _sortValue == 'netWeight:desc'
                            ? 'Net high'
                            : 'Net low',
                onTap: _pickSort,
              ),
              FilterChip(
                avatar: Icon(
                  Icons.content_copy_rounded,
                  size: 18,
                  color: _duplicatesOnly
                      ? AppColors.textPrimary
                      : AppColors.textMuted,
                ),
                label: const Text('Duplicates'),
                selected: _duplicatesOnly,
                onSelected: (value) {
                  setState(() {
                    _duplicatesOnly = value;
                    _page = 1;
                  });
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(int total) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Total entries',
            style: TextStyle(
              color: AppColors.accent,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '$total',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSaleCard(CreatedSale sale) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border),
                ),
                child: Icon(
                  Icons.receipt_long_rounded,
                  color: AppColors.accent,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      sale.ref,
                      style: TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if ((sale.category ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          sale.category!,
                          style: TextStyle(
                            color: AppColors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Text(
                _formatDate(sale.saleDate),
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 12,
                ),
              ),
            ],
          ),
          if ((sale.supplierName ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(Icons.storefront_rounded, size: 16, color: AppColors.textMuted),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    sale.supplierName!,
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(Icons.monitor_weight_rounded, size: 16, color: AppColors.textMuted),
              const SizedBox(width: 6),
              Text(
                'Net weight: ${_formatWeight(sale.netWeight)}',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final salesAsync = ref.watch(recentSalesPageProvider(_query));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Your Entries'),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverPadding(
                padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
                sliver: SliverToBoxAdapter(child: SizedBox.shrink()),
              ),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
                sliver: SliverToBoxAdapter(
                  child: _buildFilterPanel(context),
                ),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 16)),
              ...salesAsync.when<List<Widget>>(
                loading: () => const [
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ],
                error: (error, _) => [
                  SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Text(
                          'Could not load entries.\n$error',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                data: (page) => _buildEntriesSlivers(page),
              ),
              const SliverToBoxAdapter(child: SizedBox(height: 20)),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildEntriesSlivers(RecentSalesPage page) {
    if (page.sales.isEmpty) {
      return const [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Text('No sales recorded yet.'),
          ),
        ),
      ];
    }

    return [
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        sliver: SliverToBoxAdapter(child: _buildSummaryCard(page.total)),
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 16)),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        sliver: SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final sale = page.sales[index];
              return Padding(
                padding: EdgeInsets.only(
                  bottom: index == page.sales.length - 1 ? 0 : 12,
                ),
                child: _buildSaleCard(sale),
              );
            },
            childCount: page.sales.length,
          ),
        ),
      ),
      const SliverToBoxAdapter(child: SizedBox(height: 16)),
      SliverPadding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        sliver: SliverToBoxAdapter(
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _page > 1 ? () => setState(() => _page -= 1) : null,
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
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: page.page < page.pages ? () => setState(() => _page += 1) : null,
                  icon: const Icon(Icons.chevron_right_rounded),
                  label: const Text('Next'),
                ),
              ),
            ],
          ),
        ),
      ),
    ];
  }

  String _formatDate(DateTime date) {
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final year = date.year.toString();
    return '$day/$month/$year';
  }

  String _formatWeight(double? value) {
    if (value == null) return '-';
    return '${value.toStringAsFixed(3).replaceFirst(RegExp(r'\.?0+$'), '')} g';
  }
}

class _CompactIconPill extends StatelessWidget {
  const _CompactIconPill({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 18, color: AppColors.accent),
            const SizedBox(width: 8),
            Text(
              '$label: ',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.expand_more_rounded, size: 18, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _ChoiceSheet extends StatelessWidget {
  const _ChoiceSheet({
    required this.title,
    required this.items,
  });

  final String title;
  final List<DropdownMenuItem<String>> items;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        margin: const EdgeInsets.all(16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            ...items.map(
              (item) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: item.child,
                onTap: () => Navigator.of(context).pop(item.value),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
