import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../../batches/domain/batch_capture_context.dart';
import '../../../batches/presentation/batches_provider.dart';
import '../../data/sale_repository.dart';
import '../sale_entry_provider.dart';
import '../../../../shared/widgets/backend_fallback_screen.dart';
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
    this.batchContext,
    required this.suppliers,
    required this.supplierId,
    required this.supplierName,
    required this.supplierLocked,
    required this.selectedCategories,
    required this.categoryController,
    required this.itemCodeController,
    required this.karatController,
    required this.purityController,
    required this.notesController,
    required this.grossController,
    required this.stoneController,
    required this.netController,
    required this.categoryParsed,
    required this.itemCodeParsed,
    required this.karatParsed,
    required this.grossParsed,
    required this.stoneParsed,
    required this.netParsed,
    required this.karatOptions,
    required this.useCustomCategory,
    required this.debugExpanded,
    required this.isLoading,
    required this.onSupplierChanged,
    required this.onSupplierCleared,
    required this.onUseCustomCategoryChanged,
    required this.onCategorySelected,
    required this.onFieldChanged,
    required this.onSubmit,
    required this.onConfirmDuplicate,
    required this.onToggleDebug,
  });

  final GlobalKey<FormState> formKey;
  final ParseQrResult parseResult;
  final BatchCaptureContext? batchContext;
  final List<SupplierModel> suppliers;
  final String? supplierId;
  final String? supplierName;
  final bool supplierLocked;
  final List<String> selectedCategories;
  final TextEditingController categoryController;
  final TextEditingController itemCodeController;
  final TextEditingController karatController;
  final TextEditingController purityController;
  final TextEditingController notesController;
  final TextEditingController grossController;
  final TextEditingController stoneController;
  final TextEditingController netController;
  final bool categoryParsed;
  final bool itemCodeParsed;
  final bool karatParsed;
  final bool grossParsed;
  final bool stoneParsed;
  final bool netParsed;
  final List<KaratOption> karatOptions;
  final bool useCustomCategory;
  final bool debugExpanded;
  final bool isLoading;
  final void Function(String? id, String? name, List<String> categories)
      onSupplierChanged;
  final VoidCallback onSupplierCleared;
  final ValueChanged<bool> onUseCustomCategoryChanged;
  final ValueChanged<String> onCategorySelected;
  final VoidCallback onFieldChanged;
  final Future<void> Function({bool overrideDuplicate}) onSubmit;
  final Future<void> Function() onConfirmDuplicate;
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
    final detectedSupplierId = parseResult.supplier?.id;
    final batchSupplierMismatch = batchContext != null &&
        parseResult.supplierDetected &&
        detectedSupplierId != null &&
        detectedSupplierId.trim().isNotEmpty &&
        detectedSupplierId.trim() != batchContext!.supplierId;

    ref.listen(saleEntryProvider, (previous, next) {
      final nextState = next.value;
      final previousStatus = previous?.value?.status;
      if (previousStatus != SaleSubmitStatus.success &&
          nextState?.status == SaleSubmitStatus.success &&
          nextState?.createdSale != null) {
        final createdSale = nextState!.createdSale;
        if (createdSale == null) {
          return;
        }

        if (batchContext != null) {
          ref.invalidate(batchDetailProvider(batchContext!.batchId));
        }
        ref.read(saleEntryProvider.notifier).reset();
        if (batchContext != null) {
          context.push('/batches/${batchContext!.batchId}');
        } else {
          context.pushReplacement('/sale-success', extra: createdSale);
        }
        return;
      }

      if (previousStatus != SaleSubmitStatus.error &&
          nextState?.status == SaleSubmitStatus.error &&
          nextState?.isNetworkError == true &&
          context.mounted) {
        Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => BackendFallbackScreen(
              error: nextState?.errorMessage ?? 'No internet connection.',
              onRetry: () => Navigator.of(context).pop(),
            ),
          ),
        );
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
                if (submitState.status == SaleSubmitStatus.error &&
                    !submitState.isNetworkError)
                  ErrorBanner(
                    message: submitState.errorMessage ?? 'Failed to save sale',
                  ),
                if (batchSupplierMismatch)
                  BatchSupplierMismatchBanner(
                    batchSupplierName: batchContext!.supplierName,
                    detectedSupplierName: parseResult.supplier!.name,
                  ),
                if (batchContext != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceAlt,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.inventory_2_rounded,
                          color: AppColors.accent,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Batch ${batchContext!.batchRef}',
                                style: TextStyle(
                                  color: AppColors.textPrimary,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                batchContext!.noticeText,
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  height: 1.4,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                ParseStatusChip(parseResult: parseResult),
                const SizedBox(height: 20),
                const SectionLabel('Supplier'),
                const SizedBox(height: 12),
                supplierId != null
                    ? SupplierChip(
                        name: supplierName ?? '',
                        onClear: supplierLocked ? null : onSupplierCleared,
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
                const SizedBox(height: 20),
                const SectionLabel('Item Details'),
                const SizedBox(height: 12),
                CategorySelector(
                  controller: categoryController,
                  parsed: categoryParsed,
                  showParseState: false,
                  categories: selectedCategories,
                  useCustomCategory: useCustomCategory,
                  onUseCustomChanged: onUseCustomCategoryChanged,
                  onCategorySelected: onCategorySelected,
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
                      child: KaratSelector(
                        controller: karatController,
                        parsed: karatParsed,
                        karatOptions: karatOptions,
                        onSelected: onFieldChanged,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SaleField(
                  label: 'Purity %',
                  controller: purityController,
                  parsed: false,
                  showParseState: false,
                  showClearButton: false,
                  readOnly: true,
                  hint: 'Derived from karat',
                ),
                const SizedBox(height: 8),
                Text(
                  'Purity is resolved from the selected karat and supplier override.',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
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
