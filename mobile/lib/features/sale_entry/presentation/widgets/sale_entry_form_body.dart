import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../data/sale_repository.dart';
import '../sale_entry_provider.dart';
import 'sale_entry_banners.dart';
import 'sale_entry_debug_panel.dart';
import 'sale_entry_footer.dart';
import 'sale_entry_form_widgets.dart';
import 'sale_entry_picker_sheet.dart';
import 'sale_entry_selectors.dart';
import 'sale_entry_status_widgets.dart';

class SaleEntryFormBody extends ConsumerWidget {
  const SaleEntryFormBody({
    super.key,
    required this.formKey,
    required this.parseResult,
    required this.suppliers,
    required this.supplierId,
    required this.supplierName,
    required this.selectedCategories,
    required this.categoryController,
    required this.itemCodeController,
    required this.metalTypeController,
    required this.purityController,
    required this.notesController,
    required this.grossController,
    required this.stoneController,
    required this.netController,
    required this.categoryParsed,
    required this.itemCodeParsed,
    required this.purityParsed,
    required this.grossParsed,
    required this.stoneParsed,
    required this.netParsed,
    required this.useCustomCategory,
    required this.useCustomMetal,
    required this.debugExpanded,
    required this.isLoading,
    required this.onSupplierChanged,
    required this.onSupplierCleared,
    required this.onUseCustomCategoryChanged,
    required this.onCategorySelected,
    required this.onUseCustomMetalChanged,
    required this.onFieldChanged,
    required this.onSubmit,
    required this.onConfirmDuplicate,
    required this.onRetry,
    required this.onToggleDebug,
  });

  final GlobalKey<FormState> formKey;
  final ParseQrResult parseResult;
  final List<SupplierModel> suppliers;
  final String? supplierId;
  final String? supplierName;
  final List<String> selectedCategories;
  final TextEditingController categoryController;
  final TextEditingController itemCodeController;
  final TextEditingController metalTypeController;
  final TextEditingController purityController;
  final TextEditingController notesController;
  final TextEditingController grossController;
  final TextEditingController stoneController;
  final TextEditingController netController;
  final bool categoryParsed;
  final bool itemCodeParsed;
  final bool purityParsed;
  final bool grossParsed;
  final bool stoneParsed;
  final bool netParsed;
  final bool useCustomCategory;
  final bool useCustomMetal;
  final bool debugExpanded;
  final bool isLoading;
  final void Function(String? id, String? name, List<String> categories)
      onSupplierChanged;
  final VoidCallback onSupplierCleared;
  final ValueChanged<bool> onUseCustomCategoryChanged;
  final ValueChanged<String> onCategorySelected;
  final ValueChanged<bool> onUseCustomMetalChanged;
  final VoidCallback onFieldChanged;
  final Future<void> Function({bool overrideDuplicate}) onSubmit;
  final Future<void> Function() onConfirmDuplicate;
  final Future<void> Function() onRetry;
  final VoidCallback onToggleDebug;

  SupplierModel? _findSupplierById(String? id) {
    if (id == null || id.isEmpty) return null;

    for (final supplier in suppliers) {
      if (supplier.id == id) return supplier;
    }

    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(themeControllerProvider);
    final saleState = ref.watch(saleEntryProvider);
    final submitState = saleState.value ?? const SaleEntryState();

    ref.listen(saleEntryProvider, (previous, next) {
      final nextState = next.value;
      final previousStatus = previous?.value?.status;
      if (previousStatus != SaleSubmitStatus.success &&
          nextState?.status == SaleSubmitStatus.success &&
          nextState?.createdSale != null) {
        context.pushReplacement('/sale-success', extra: nextState!.createdSale);
      }
    });

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
          child: Form(
            key: formKey,
            onChanged: onFieldChanged,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (submitState.status == SaleSubmitStatus.duplicateWarning)
                  DuplicateWarningBanner(
                    date: submitState.duplicateDate!,
                    onSaveAnyway: onConfirmDuplicate,
                    onCancel: () => ref.read(saleEntryProvider.notifier).reset(),
                  ),
                if (submitState.status == SaleSubmitStatus.error)
                  ErrorBanner(
                    message: submitState.errorMessage ?? 'Failed to save sale',
                    retryCount: submitState.retryCount,
                    onRetry: () => onRetry(),
                  ),
                ParseStatusChip(parseResult: parseResult),
                const SizedBox(height: 20),
                const SectionLabel('Supplier'),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.center,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: supplierId != null
                        ? SupplierChip(
                            name: supplierName ?? '',
                            onClear: onSupplierCleared,
                          )
                        : SupplierDropdown(
                            selectedId: supplierId,
                            onSelected: (id, name) {
                              final supplier = _findSupplierById(id);
                              onSupplierChanged(
                                id,
                                name,
                                supplier?.categories ?? const [],
                              );
                            },
                          ),
                  ),
                ),
                const SizedBox(height: 20),
                const SectionLabel('Item Details'),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.center,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: CategorySelector(
                      controller: categoryController,
                      parsed: categoryParsed,
                      showParseState: false,
                      categories: selectedCategories,
                      useCustomCategory: useCustomCategory,
                      onUseCustomChanged: onUseCustomCategoryChanged,
                      onCategorySelected: onCategorySelected,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const SectionLabel('Classification'),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: SaleField(
                        label: 'Item / Design No',
                        controller: itemCodeController,
                        parsed: itemCodeParsed,
                        showParseState: false,
                        onChanged: onFieldChanged,
                        hint: 'Optional',
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SaleField(
                        label: 'Purity',
                        controller: purityController,
                        parsed: purityParsed,
                        showParseState: false,
                        onChanged: onFieldChanged,
                        hint: '18KT, 22KT, 925',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.center,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: MetalSelector(
                      controller: metalTypeController,
                      useCustomMetal: useCustomMetal,
                      onUseCustomChanged: onUseCustomMetalChanged,
                      onChanged: onFieldChanged,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: SaleField(
                        label: 'Gross Weight (g)',
                        controller: grossController,
                        parsed: grossParsed,
                        onChanged: onFieldChanged,
                        hint: '0.0',
                        numeric: true,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: SaleField(
                        label: 'Stone Weight (g)',
                        controller: stoneController,
                        parsed: stoneParsed,
                        onChanged: onFieldChanged,
                        hint: '0.0',
                        numeric: true,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SaleField(
                  label: 'Net Weight (g)',
                  controller: netController,
                  parsed: netParsed,
                  onChanged: onFieldChanged,
                  hint: '0.0',
                  numeric: true,
                  required: true,
                ),
                const SizedBox(height: 24),
                SaleField(
                  label: 'Notes',
                  controller: notesController,
                  parsed: false,
                  showParseState: false,
                  onChanged: onFieldChanged,
                  hint: 'Optional remarks',
                  expandOnFocus: true,
                  maxLines: 4,
                ),
                const SizedBox(height: 24),
                WeightSummaryCard(
                  grossWeight: double.tryParse(grossController.text),
                  stoneWeight: double.tryParse(stoneController.text),
                  otherWeight: parseResult.otherWeight.value,
                  netWeight: double.tryParse(netController.text),
                ),
                const SizedBox(height: 24),
                if (parseResult.raw.isNotEmpty || parseResult.hasErrors)
                  QrDebugPanel(
                    parseResult: parseResult,
                    expanded: debugExpanded,
                    onToggle: onToggleDebug,
                  ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          child: SaveBar(isLoading: isLoading, onSave: () => onSubmit()),
        ),
      ],
    );
  }
}
