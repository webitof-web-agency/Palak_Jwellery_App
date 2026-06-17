part of 'scan_session_screen.dart';

class _SupplierPickerSheet extends ConsumerStatefulWidget {
  const _SupplierPickerSheet({required this.selectedValue});

  final String? selectedValue;

  @override
  ConsumerState<_SupplierPickerSheet> createState() => _SupplierPickerSheetState();
}

class _SupplierPickerSheetState extends ConsumerState<_SupplierPickerSheet> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final suppliersState = ref.watch(suppliersProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        border: Border.all(color: AppColors.border),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.screenPadding,
            AppSpacing.lg,
            AppSpacing.screenPadding,
            AppSpacing.screenPadding + bottomInset,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.borderStrong,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const AppSectionHeader(
                title: 'Choose supplier',
                subtitle: 'Choose supplier for this scan.',
              ),
              if ((widget.selectedValue ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context).pop(_clearSelectionSentinel),
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    label: const Text('Clear selection'),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              suppliersState.when(
                loading: () => const _PickerStateCard(
                  icon: Icons.sync_rounded,
                  title: 'Loading suppliers',
                  message: 'Pulling the live supplier list from the backend.',
                ),
                error: (_, _) => _PickerStateCard(
                  icon: Icons.cloud_off_rounded,
                  title: 'Supplier list unavailable',
                  message: 'Could not load live suppliers right now.',
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(suppliersProvider),
                ),
                data: (suppliers) {
                  if (suppliers.isEmpty) {
                    return const _PickerStateCard(
                      icon: Icons.storefront_outlined,
                      title: 'No active suppliers',
                      message: 'Ask an admin to publish suppliers before starting this scan.',
                    );
                  }

                  final query = _searchController.text.trim().toLowerCase();
                  final filtered = suppliers.where((supplier) {
                    if (query.isEmpty) return true;
                    return supplier.name.toLowerCase().contains(query) ||
                        supplier.code.toLowerCase().contains(query);
                  }).toList(growable: false);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _searchController,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          labelText: 'Search supplier',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: _searchController.text.trim().isEmpty
                              ? null
                              : IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _searchController.clear();
                                    });
                                  },
                                  icon: const Icon(Icons.clear_rounded),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (filtered.isEmpty)
                        const _PickerStateCard(
                          icon: Icons.search_off_rounded,
                          title: 'No match found',
                          message: 'Try a different supplier name or clear the search.',
                        )
                      else
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 420),
                          child: ListView.separated(
                            shrinkWrap: true,
                            itemCount: filtered.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final supplier = filtered[index];
                              final selected = supplier.name == widget.selectedValue;
                              return AppCard(
                                onTap: () => Navigator.of(context).pop(supplier.name),
                                padding: const EdgeInsets.all(AppSpacing.lg),
                                borderColor: selected ? AppColors.accent : AppColors.border,
                                backgroundColor: selected
                                    ? AppColors.accentSoft.withValues(alpha: 0.08)
                                    : AppColors.surface,
                                child: Row(
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceAlt,
                                        borderRadius: BorderRadius.circular(AppRadius.md),
                                      ),
                                      child: Icon(Icons.storefront_rounded, color: AppColors.accent),
                                    ),
                                    const SizedBox(width: AppSpacing.md),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            supplier.name,
                                            style: TextStyle(
                                              color: AppColors.textPrimary,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: AppSpacing.xs),
                                          Text(
                                            supplier.code.isNotEmpty
                                                ? 'Code: ${supplier.code}'
                                                : 'Live backend supplier',
                                            style: TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (selected)
                                      const AppBadge(
                                        label: 'Selected',
                                        tone: AppBadgeTone.accent,
                                        icon: Icons.check_rounded,
                                        compact: true,
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _KaratPickerSheet extends ConsumerStatefulWidget {
  const _KaratPickerSheet({
    required this.selectedValue,
    required this.supplierName,
    required this.supplierModel,
  });

  final String? selectedValue;
  final String? supplierName;
  final SupplierModel? supplierModel;

  @override
  ConsumerState<_KaratPickerSheet> createState() => _KaratPickerSheetState();
}

class _KaratPickerSheetState extends ConsumerState<_KaratPickerSheet> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String? _supplierKeyFor(String? supplier) {
    final normalized = (supplier ?? '').trim().toUpperCase();
    if (normalized.isEmpty) return null;
    if (normalized.contains('YUG')) return 'YUG';
    if (normalized.contains('AADINATH')) return 'Aadinath';
    if (normalized.contains('VENZORA')) return 'Venzora Trading';
    if (normalized.contains('PALAK')) return 'Palak Jewellery';
    return supplier;
  }

  String _previewLabel(KaratOption option, List<KaratOption> options) {
    final supplierKey = _supplierKeyFor(widget.supplierName);
    final matrixEntry = supplierKey == null
        ? null
        : _ScanSessionScreenState._defaultMatrix[supplierKey]?[option.name.toUpperCase()];
    if (matrixEntry != null) {
      return '${option.name} - ${matrixEntry.purity.toStringAsFixed(2)}%';
    }

    final resolved = resolvePurityPercentForKarat(
      supplier: widget.supplierModel,
      karat: option.name,
      karatOptions: options,
    );
    if (resolved == null) {
      return option.name;
    }
    return '${option.name} - ${resolved.toStringAsFixed(2)}%';
  }

  @override
  Widget build(BuildContext context) {
    final karatState = ref.watch(karatOptionsProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        border: Border.all(color: AppColors.border),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.screenPadding,
            AppSpacing.lg,
            AppSpacing.screenPadding,
            AppSpacing.screenPadding + bottomInset,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.borderStrong,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              const AppSectionHeader(
                title: 'Choose karat',
                subtitle: 'Choose jewellery karat.',
              ),
              if ((widget.selectedValue ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context).pop(_clearSelectionSentinel),
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    label: const Text('Clear selection'),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              karatState.when(
                loading: () => const _PickerStateCard(
                  icon: Icons.hourglass_empty_rounded,
                  title: 'Loading karats',
                  message: 'Pulling karat defaults from the backend.',
                ),
                error: (_, _) => _PickerStateCard(
                  icon: Icons.warning_amber_rounded,
                  title: 'Karat list unavailable',
                  message: 'Using the default karat list for now.',
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(karatOptionsProvider),
                ),
                data: (options) {
                  final karatOptions = options.isEmpty ? KaratOption.defaults() : options;
                  final sortedOptions = List<KaratOption>.from(karatOptions)
                    ..sort((a, b) {
                      final aIndex = _ScanSessionScreenState._karatOrder.indexOf(a.name.toUpperCase());
                      final bIndex = _ScanSessionScreenState._karatOrder.indexOf(b.name.toUpperCase());
                      if (aIndex == -1 && bIndex == -1) return a.name.compareTo(b.name);
                      if (aIndex == -1) return 1;
                      if (bIndex == -1) return -1;
                      return aIndex.compareTo(bIndex);
                    });
                  final query = _searchController.text.trim().toLowerCase();
                  final filtered = sortedOptions.where((option) {
                    if (query.isEmpty) return true;
                    return option.name.toLowerCase().contains(query) ||
                        _previewLabel(option, sortedOptions).toLowerCase().contains(query);
                  }).toList(growable: false);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextField(
                        controller: _searchController,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          labelText: 'Search karat',
                          prefixIcon: const Icon(Icons.search_rounded),
                          suffixIcon: _searchController.text.trim().isEmpty
                              ? null
                              : IconButton(
                                  onPressed: () {
                                    setState(() {
                                      _searchController.clear();
                                    });
                                  },
                                  icon: const Icon(Icons.clear_rounded),
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (filtered.isEmpty)
                        const _PickerStateCard(
                          icon: Icons.search_off_rounded,
                          title: 'No karat matched',
                          message: 'Try another karat name or clear the search.',
                        )
                      else
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 420),
                          child: ListView.separated(
                            shrinkWrap: true,
                            itemCount: filtered.length,
                            separatorBuilder: (context, index) =>
                                const SizedBox(height: AppSpacing.sm),
                            itemBuilder: (context, index) {
                              final option = filtered[index];
                              final preview = _previewLabel(option, sortedOptions);
                              final selected = option.name == widget.selectedValue;
                              return AppCard(
                                onTap: () => Navigator.of(context).pop(option.name),
                                padding: const EdgeInsets.all(AppSpacing.lg),
                                borderColor: selected ? AppColors.accent : AppColors.border,
                                backgroundColor: selected
                                    ? AppColors.accentSoft.withValues(alpha: 0.08)
                                    : AppColors.surface,
                                child: Row(
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceAlt,
                                        borderRadius: BorderRadius.circular(AppRadius.md),
                                      ),
                                      child: Icon(Icons.diamond_rounded, color: AppColors.accent),
                                    ),
                                    const SizedBox(width: AppSpacing.md),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            preview,
                                            style: TextStyle(
                                              color: AppColors.textPrimary,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                          const SizedBox(height: AppSpacing.xs),
                                          Text(
                                            option.purityPercent == null
                                                ? 'Purity preview unavailable'
                                                : 'Default purity from karat settings',
                                            style: TextStyle(
                                              color: AppColors.textSecondary,
                                              fontSize: 12,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    if (selected)
                                      const AppBadge(
                                        label: 'Selected',
                                        tone: AppBadgeTone.accent,
                                        icon: Icons.check_rounded,
                                        compact: true,
                                      ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
