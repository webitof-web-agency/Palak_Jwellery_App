import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../domain/customer_record.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

part 'customer_selection_screen_parts.dart';

class CustomerSelectionScreen extends StatefulWidget {
  const CustomerSelectionScreen({super.key});

  @override
  State<CustomerSelectionScreen> createState() => _CustomerSelectionScreenState();
}

class _CustomerSelectionScreenState extends State<CustomerSelectionScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<CustomerRecord> _customers = <CustomerRecord>[
    const CustomerRecord(
      id: 'c-1001',
      name: 'Aadinath Jewels',
      phone: '+91 98765 43210',
      area: 'Andheri West',
      email: 'orders@aadinath.com',
      isRecent: true,
      lastSeenLabel: 'Seen today',
    ),
    const CustomerRecord(
      id: 'c-1002',
      name: 'Yug Traders',
      phone: '+91 98989 89898',
      area: 'Bandra East',
      isRecent: true,
      lastSeenLabel: 'Seen yesterday',
    ),
    const CustomerRecord(
      id: 'c-1003',
      name: 'Venzora Trading',
      phone: '+91 99880 11223',
      area: 'Zaveri Bazaar',
      email: 'venzora@trade.in',
      isRecent: true,
      lastSeenLabel: 'Seen 3 days ago',
    ),
    const CustomerRecord(
      id: 'c-1004',
      name: 'Shree Ornaments',
      phone: '+91 91234 56789',
      area: 'Borivali',
      lastSeenLabel: 'Seen last week',
    ),
    const CustomerRecord(
      id: 'c-1005',
      name: 'Palak Jewellery',
      phone: '+91 90000 11111',
      area: 'Ghatkopar',
      email: 'purchase@palakjewellery.com',
    ),
    const CustomerRecord(
      id: 'c-1006',
      name: 'Ruchi Gold House',
      phone: '+91 97777 66554',
      area: 'Dadar',
    ),
  ];

  String _searchTerm = '';
  String? _selectedCustomerId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<CustomerRecord> get _filteredCustomers {
    final query = _searchTerm.trim().toLowerCase();
    final customers = List<CustomerRecord>.from(_customers);

    customers.sort((a, b) {
      if (a.isRecent != b.isRecent) {
        return a.isRecent ? -1 : 1;
      }
      return a.name.toLowerCase().compareTo(b.name.toLowerCase());
    });

    if (query.isEmpty) {
      return customers;
    }

    return customers.where((customer) {
      return customer.name.toLowerCase().contains(query) ||
          customer.phone.toLowerCase().contains(query);
    }).toList(growable: false);
  }

  CustomerRecord? get _selectedCustomer {
    if (_selectedCustomerId == null) {
      return null;
    }
    for (final customer in _customers) {
      if (customer.id == _selectedCustomerId) {
        return customer;
      }
    }
    return null;
  }

  void _selectCustomer(CustomerRecord customer) {
    setState(() {
      _selectedCustomerId = customer.id;
    });
  }

  void _clearSelection() {
    setState(() {
      _selectedCustomerId = null;
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

    if (!mounted || created == null) {
      return;
    }

    setState(() {
      _customers.insert(0, created);
      _selectedCustomerId = created.id;
      _searchTerm = '';
      _searchController.clear();
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${created.name} added and selected.'),
      ),
    );
  }

  void _continueWithSelected() {
    final selected = _selectedCustomer;
    if (selected == null) {
      return;
    }

    context.push('/scan-session', extra: selected);
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedCustomer;
    final filtered = _filteredCustomers;
    final query = _searchTerm.trim();
    final showingSearchResults = query.isNotEmpty;

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
              subtitle: 'Search by name or phone, then continue with the selected customer.',
            ),
            const SizedBox(height: AppSpacing.md),
            AppBanner(
              title: 'V2 flow',
              message: 'Add a new customer from the same screen if the customer is not listed yet.',
              tone: AppBannerTone.info,
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _searchTerm = value),
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                labelText: 'Search customer',
                hintText: 'Name or phone',
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
            const SizedBox(height: AppSpacing.md),
            AppActionButton(
              label: 'Add New Customer',
              onPressed: _openAddCustomerSheet,
              icon: Icons.person_add_alt_1_rounded,
              variant: AppActionButtonVariant.secondary,
              expanded: true,
            ),
            if (selected != null) ...[
              const SizedBox(height: AppSpacing.lg),
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.lg),
                borderColor: AppColors.accent.withValues(alpha: 0.5),
                backgroundColor: AppColors.accentSoft.withValues(alpha: 0.10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'Selected customer',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        AppBadge(
                          label: 'Selected',
                          tone: AppBadgeTone.accent,
                          icon: Icons.check_circle_rounded,
                          compact: true,
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      selected.name,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: AppTypography.titleSize,
                        fontWeight: AppTypography.titleWeight,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${selected.phone} • ${selected.area}',
                      style: TextStyle(color: AppColors.textSecondary),
                    ),
                    if ((selected.email ?? '').isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        selected.email!,
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    Align(
                      alignment: Alignment.centerRight,
                      child: AppActionButton(
                        label: 'Clear Selection',
                        onPressed: _clearSelection,
                        variant: AppActionButtonVariant.tertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            AppSectionHeader(
              title: showingSearchResults ? 'Search results' : 'Recent customers',
              subtitle: filtered.isEmpty
                  ? 'No customers match that name or phone.'
                  : '${filtered.length} customer${filtered.length == 1 ? '' : 's'} shown.',
            ),
            const SizedBox(height: AppSpacing.sm),
            if (filtered.isEmpty)
              AppBanner(
                title: 'No match found',
                message: 'Add a new customer now, or clear the search and pick from the recent list.',
                tone: AppBannerTone.warning,
                actionLabel: 'Add New Customer',
                onAction: _openAddCustomerSheet,
              )
            else
              ...filtered.map((customer) {
                final isSelected = customer.id == _selectedCustomerId;
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AppCard(
                    onTap: () => _selectCustomer(customer),
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    borderColor: isSelected ? AppColors.accent : AppColors.border,
                    backgroundColor: isSelected
                        ? AppColors.accentSoft.withValues(alpha: 0.08)
                        : AppColors.surface,
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
                                    customer.name,
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontSize: AppTypography.titleSize,
                                      fontWeight: AppTypography.titleWeight,
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    customer.phone,
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 13,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (isSelected)
                              Icon(
                                Icons.check_circle_rounded,
                                color: AppColors.accent,
                                size: 20,
                              ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        AppBadgeRow(
                          children: [
                            AppBadge(
                              label: customer.area,
                              tone: AppBadgeTone.neutral,
                              icon: Icons.place_rounded,
                              compact: true,
                            ),
                            if (customer.isRecent)
                              AppBadge(
                                label: customer.lastSeenLabel ?? 'Recent',
                                tone: AppBadgeTone.warning,
                                icon: Icons.history_rounded,
                                compact: true,
                              ),
                            if ((customer.email ?? '').isNotEmpty)
                              AppBadge(
                                label: 'Email',
                                tone: AppBadgeTone.neutral,
                                icon: Icons.email_rounded,
                                compact: true,
                              ),
                            if (isSelected)
                              AppBadge(
                                label: 'Selected',
                                tone: AppBadgeTone.accent,
                                icon: Icons.check_rounded,
                                compact: true,
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
            const SizedBox(height: AppSpacing.lg),
            AppActionButton(
              label: 'Use selected customer',
              onPressed: selected == null ? null : _continueWithSelected,
              icon: Icons.arrow_forward_rounded,
              expanded: true,
            ),
          ],
        ),
      ),
    );
  }
}
