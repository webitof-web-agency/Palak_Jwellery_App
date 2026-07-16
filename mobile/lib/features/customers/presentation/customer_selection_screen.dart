import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/customer_repository.dart';
import '../domain/customer_record.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

part 'customer_selection_screen_parts.dart';

class CustomerSelectionScreen extends ConsumerStatefulWidget {
  const CustomerSelectionScreen({super.key});

  @override
  ConsumerState<CustomerSelectionScreen> createState() => _CustomerSelectionScreenState();
}

class _CustomerSelectionScreenState extends ConsumerState<CustomerSelectionScreen> {
  final TextEditingController _searchController = TextEditingController();
  final List<CustomerRecord> _localCustomers = <CustomerRecord>[];

  String _searchTerm = '';
  // Store full object to avoid flash during API reload (no ID lookup on every build)
  CustomerRecord? _selectedCustomer;

  String _customerContactLine(CustomerRecord customer) {
    final phone = customer.phone.trim();
    final area = customer.area.trim();
    if (phone.isNotEmpty && area.isNotEmpty) return '$phone | $area';
    if (phone.isNotEmpty) return phone;
    if (area.isNotEmpty) return area;
    return 'No contact info';
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CustomerRecord> get _searchResults {
    final query = _searchTerm.trim().toLowerCase();
    if (query.isEmpty) return const [];

    final apiCustomers = ref.watch(customersListProvider).value ?? <CustomerRecord>[];
    final Map<String, CustomerRecord> combined = {};
    for (final c in apiCustomers) {
      combined[c.id] = c;
    }
    for (final c in _localCustomers) {
      combined[c.id] = c;
    }

    return combined.values.where((customer) {
      return customer.name.toLowerCase().contains(query) ||
          customer.phone.toLowerCase().contains(query);
    }).toList(growable: false);
  }

  void _selectCustomer(CustomerRecord customer) {
    FocusScope.of(context).unfocus();
    setState(() {
      _selectedCustomer = customer;
      // Clear search after selection for clean UX
      _searchTerm = '';
      _searchController.clear();
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedCustomer = null;
    });
  }

  Future<void> _openAddCustomerSheet() async {
    final created = await showModalBottomSheet<CustomerRecord>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _AddCustomerSheet(
          onSave: (customer) => Navigator.of(sheetContext).pop(customer),
        );
      },
    );

    if (!mounted || created == null) return;

    final saved = await ref.read(customerRepositoryProvider).createCustomer(created);
    final finalCustomer = saved ?? created;

    if (!mounted) return;

    setState(() {
      _localCustomers.insert(0, finalCustomer);
      _selectedCustomer = finalCustomer;
      _searchTerm = '';
      _searchController.clear();
    });
    FocusScope.of(context).unfocus();

    if (saved != null) {
      ref.invalidate(customersListProvider);
    }

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${finalCustomer.name} added and selected.')),
    );
  }

  void _continueWithSelected() {
    final selected = _selectedCustomer;
    if (selected == null) return;
    context.push('/scan-session', extra: selected);
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedCustomer;
    final query = _searchTerm.trim();
    final results = _searchResults;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer Selection'),
        leading: IconButton(
          onPressed: () => context.pop(),
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
              title: 'Choose a customer',
              subtitle: 'Search by name or phone to find and select a customer.',
            ),
            const SizedBox(height: AppSpacing.md),

            // ── Search + Add row ──────────────────────────────────────────────
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) => setState(() => _searchTerm = value),
                    textInputAction: TextInputAction.search,
                    autofocus: selected == null,
                    decoration: InputDecoration(
                      labelText: 'Search customer',
                      hintText: 'Name or phone number',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: query.isEmpty
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
                ),
                const SizedBox(width: AppSpacing.sm),
                Container(
                  height: 56,
                  width: 56,
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: IconButton(
                    onPressed: _openAddCustomerSheet,
                    icon: const Icon(Icons.add_rounded, color: Colors.white),
                    tooltip: 'Add New Customer',
                  ),
                ),
              ],
            ),

            // ── Selected customer compact card ────────────────────────────────
            if (selected != null) ...[
              const SizedBox(height: AppSpacing.md),
              AppCard(
                padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                borderColor: AppColors.accent.withValues(alpha: 0.5),
                backgroundColor: AppColors.accentSoft.withValues(alpha: 0.10),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                selected.name,
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Icon(Icons.check_circle_rounded,
                                  color: AppColors.accent, size: 16),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _customerContactLine(selected),
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: _clearSelection,
                      icon: const Icon(Icons.close_rounded),
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Clear Selection',
                    ),
                  ],
                ),
              ),
            ],

            // ── Search results (only while actively searching) ─────────────
            if (query.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              if (results.isEmpty)
                AppBanner(
                  title: 'No match found',
                  message: 'No customer with that name or phone. Add a new one?',
                  tone: AppBannerTone.warning,
                  actionLabel: 'Add New Customer',
                  onAction: _openAddCustomerSheet,
                )
              else
                ...results.map((customer) {
                  final isSelected = customer.id == selected?.id;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AppCard(
                      onTap: () => _selectCustomer(customer),
                      padding: const EdgeInsets.all(AppSpacing.md),
                      borderColor:
                          isSelected ? AppColors.accent : AppColors.border,
                      backgroundColor: isSelected
                          ? AppColors.accentSoft.withValues(alpha: 0.08)
                          : AppColors.surface,
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  customer.name,
                                  style: TextStyle(
                                    color: AppColors.textPrimary,
                                    fontSize: AppTypography.titleSize,
                                    fontWeight: AppTypography.titleWeight,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _customerContactLine(customer),
                                  style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 13),
                                ),
                              ],
                            ),
                          ),
                          if (isSelected)
                            Icon(Icons.check_circle_rounded,
                                color: AppColors.accent, size: 20),
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ],
        ),
      ),
      bottomNavigationBar: selected == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.screenPadding),
                child: AppActionButton(
                  label: 'Continue with ${selected.name}',
                  onPressed: _continueWithSelected,
                  icon: Icons.arrow_forward_rounded,
                  expanded: true,
                ),
              ),
            ),
    );
  }
}
