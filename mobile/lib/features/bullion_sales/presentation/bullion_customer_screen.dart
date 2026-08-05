import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/bullion_sale_repository.dart';
import '../../customers/data/customer_repository.dart';
import '../../customers/domain/customer_record.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

class BullionCustomerScreen extends ConsumerStatefulWidget {
  const BullionCustomerScreen({super.key});

  @override
  ConsumerState<BullionCustomerScreen> createState() => _BullionCustomerScreenState();
}

class _BullionCustomerScreenState extends ConsumerState<BullionCustomerScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;
  String _searchTerm = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  List<CustomerRecord> _filterCustomers(List<CustomerRecord> customers) {
    final query = _searchTerm.trim().toLowerCase();
    final sorted = [...customers]
      ..sort((a, b) {
        if (a.isRecent != b.isRecent) {
          return a.isRecent ? -1 : 1;
        }
        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

    if (query.isEmpty) {
      return sorted;
    }

    return sorted.where((customer) {
      return customer.name.toLowerCase().contains(query) ||
          customer.phone.toLowerCase().contains(query) ||
          customer.area.toLowerCase().contains(query) ||
          (customer.email?.toLowerCase().contains(query) ?? false);
    }).toList(growable: false);
  }

  void _openEntry(CustomerRecord? customer) {
    if (!mounted) return;
    context.push('/bullion-sale/entry', extra: customer);
  }

  void _continueWithoutCustomer() {
    if (!mounted) return;
    context.push('/bullion-sale/entry');
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchTerm.trim();

    // When searching: use full customer list. When idle: show today's bullion customers.
    final customersAsync = query.isNotEmpty
        ? ref.watch(customerSearchProvider(query))
        : ref.watch(todayBullionCustomersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bullion Sales'),
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
        actions: [
          IconButton(
            onPressed: () => context.push('/bullion-history'),
            icon: const Icon(Icons.history_rounded),
            tooltip: 'View Bullion History',
          ),
        ],
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
              title: 'Bullion Sales - Select Customer',
              subtitle: 'Search recent customers by name, phone, area, or email. Anonymous sales are allowed too.',
            ),
            const SizedBox(height: AppSpacing.md),
            const AppBanner(
              title: 'Walk-in sales supported',
              message: 'You can continue without a customer and attach one later if needed.',
              tone: AppBannerTone.info,
              icon: Icons.manage_search_rounded,
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: _searchController,
              onChanged: (value) {
                if (_debounce?.isActive ?? false) _debounce!.cancel();
                _debounce = Timer(const Duration(milliseconds: 200), () {
                  setState(() => _searchTerm = value);
                });
              },
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                labelText: 'Search customer',
                hintText: 'Name, phone, area, or email',
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
              label: 'Continue without customer',
              onPressed: _continueWithoutCustomer,
              variant: AppActionButtonVariant.secondary,
              expanded: true,
              height: 52,
            ),
            const SizedBox(height: AppSpacing.lg),
            customersAsync.when(
              loading: () => const Center(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                ),
              ),
              error: (error, _) => AppBanner(
                title: 'Could not load customers',
                message: error.toString(),
                tone: AppBannerTone.warning,
                actionLabel: 'Retry',
                onAction: () => ref.invalidate(todayBullionCustomersProvider),
              ),
              data: (customers) {
                final visible = _filterCustomers(customers);
                final hasQuery = query.isNotEmpty;

                if (visible.isEmpty) {
                  return AppBanner(
                    title: hasQuery ? 'No customer found' : 'No recent bullion customers',
                    message: hasQuery
                        ? 'Try a different name, phone, area, or email.'
                        : 'Only customers with recent activity are shown here.',
                    tone: AppBannerTone.info,
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppSectionHeader(
                      title: hasQuery ? 'Search results' : 'Recent customers',
                      subtitle: hasQuery
                          ? 'Tap a customer to continue.'
                          : 'Recent bullion customers only.',
                      tight: true,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    ...visible.map((customer) {
                      final contactLine = <String>[
                        if (customer.phone.trim().isNotEmpty) customer.phone.trim(),
                        if (customer.area.trim().isNotEmpty) customer.area.trim(),
                      ].join(' | ');

                      return Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: AppCard(
                          onTap: () => _openEntry(customer),
                          padding: const EdgeInsets.all(AppSpacing.md),
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
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                  const Icon(Icons.chevron_right_rounded),
                                ],
                              ),
                              if (contactLine.isNotEmpty) ...[
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  contactLine,
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                              if ((customer.email ?? '').trim().isNotEmpty) ...[
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  customer.email!.trim(),
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    }),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
