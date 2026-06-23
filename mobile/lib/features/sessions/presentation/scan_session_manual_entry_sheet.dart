import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../domain/scan_session_draft.dart';

class ScanSessionManualEntrySheet extends ConsumerStatefulWidget {
  const ScanSessionManualEntrySheet({
    super.key,
    required this.draft,
  });

  final ScanSessionDraft draft;

  @override
  ConsumerState<ScanSessionManualEntrySheet> createState() =>
      _ScanSessionManualEntrySheetState();
}

class _ScanSessionManualEntrySheetState
    extends ConsumerState<ScanSessionManualEntrySheet> {
  final _formKey = GlobalKey<FormState>();
  
  late TextEditingController _itemCodeController;
  late TextEditingController _categoryController;
  late TextEditingController _grossWeightController;
  late TextEditingController _stoneWeightController;
  late TextEditingController _otherWeightController;
  late TextEditingController _stoneAmountController;
  late TextEditingController _otherAmountController;

  @override
  void initState() {
    super.initState();
    _itemCodeController = TextEditingController();
    _categoryController = TextEditingController(text: widget.draft.selectedCategory ?? '');
    _grossWeightController = TextEditingController();
    _stoneWeightController = TextEditingController(text: '0');
    _otherWeightController = TextEditingController(text: '0');
    _stoneAmountController = TextEditingController();
    _otherAmountController = TextEditingController();
  }

  @override
  void dispose() {
    _itemCodeController.dispose();
    _categoryController.dispose();
    _grossWeightController.dispose();
    _stoneWeightController.dispose();
    _otherWeightController.dispose();
    _stoneAmountController.dispose();
    _otherAmountController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final gross = double.tryParse(_grossWeightController.text.trim()) ?? 0;
    final stone = double.tryParse(_stoneWeightController.text.trim()) ?? 0;
    final otherW = double.tryParse(_otherWeightController.text.trim()) ?? 0;
    final stoneAmt = double.tryParse(_stoneAmountController.text.trim());
    final otherAmt = double.tryParse(_otherAmountController.text.trim());

    final itemCode = _itemCodeController.text.trim();
    final category = _categoryController.text.trim();

    final item = ScannedSessionItem(
      id: 'manual-${DateTime.now().microsecondsSinceEpoch}',
      itemCode: itemCode,
      supplier: widget.draft.supplier ?? 'Manual Entry',
      category: category.isEmpty ? null : category,
      qrKarat: null,
      karat: widget.draft.karat ?? '18K',
      purityPercent: widget.draft.selectedPurity ?? widget.draft.originalPurity ?? 75.0,
      wastagePercent: widget.draft.selectedWastage ?? widget.draft.resolvedWastageDefault,
      grossWeight: double.parse(gross.toStringAsFixed(3)),
      stoneWeight: double.parse(stone.toStringAsFixed(3)),
      otherWeight: double.parse(otherW.toStringAsFixed(3)),
      stoneAmount: stoneAmt == null ? null : double.parse(stoneAmt.toStringAsFixed(2)),
      otherAmount: otherAmt == null ? null : double.parse(otherAmt.toStringAsFixed(2)),
      warningLabel: 'Manual Entry',
    );

    Navigator.of(context).pop(item);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
      ),
      child: SafeArea(
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.lg,
            AppSpacing.lg,
            MediaQuery.of(context).viewInsets.bottom + AppSpacing.lg,
          ),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Manual Entry',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: AppTypography.headingSize,
                        fontWeight: AppTypography.headingWeight,
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                Flexible(
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          controller: _itemCodeController,
                          textInputAction: TextInputAction.next,
                          textCapitalization: TextCapitalization.characters,
                          decoration: const InputDecoration(
                            labelText: 'Item Code *',
                            prefixIcon: Icon(Icons.tag_rounded),
                          ),
                          validator: (v) => v?.trim().isEmpty == true ? 'Required' : null,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        TextFormField(
                          controller: _categoryController,
                          textInputAction: TextInputAction.next,
                          textCapitalization: TextCapitalization.words,
                          decoration: const InputDecoration(
                            labelText: 'Category / Jewel Type',
                            prefixIcon: Icon(Icons.category_rounded),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        TextFormField(
                          controller: _grossWeightController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          textInputAction: TextInputAction.next,
                          inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                          decoration: const InputDecoration(
                            labelText: 'Gross Weight (g) *',
                            prefixIcon: Icon(Icons.scale_rounded),
                          ),
                          validator: (v) => (double.tryParse(v?.trim() ?? '') ?? 0) <= 0 ? 'Invalid weight' : null,
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _stoneWeightController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                textInputAction: TextInputAction.next,
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                                decoration: const InputDecoration(
                                  labelText: 'Stone Wt (g)',
                                  prefixIcon: Icon(Icons.diamond_rounded),
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: TextFormField(
                                controller: _otherWeightController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                textInputAction: TextInputAction.next,
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                                decoration: const InputDecoration(
                                  labelText: 'Other Wt (g)',
                                  prefixIcon: Icon(Icons.line_weight_rounded),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: _stoneAmountController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                textInputAction: TextInputAction.next,
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                                decoration: const InputDecoration(
                                  labelText: 'Stone Amt (Rs)',
                                  prefixIcon: Icon(Icons.currency_rupee_rounded),
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: TextFormField(
                                controller: _otherAmountController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                textInputAction: TextInputAction.done,
                                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                                decoration: const InputDecoration(
                                  labelText: 'Other Amt (Rs)',
                                  prefixIcon: Icon(Icons.currency_rupee_rounded),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                AppActionButton(
                  label: 'Add Item',
                  onPressed: _submit,
                  expanded: true,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
