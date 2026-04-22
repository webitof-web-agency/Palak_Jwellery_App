import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';
import 'widgets/sale_entry_banners.dart';
import 'widgets/sale_entry_debug_panel.dart';
import 'widgets/sale_entry_footer.dart';
import 'widgets/sale_entry_form_widgets.dart';
import 'widgets/sale_entry_status_widgets.dart';

class SaleEntryScreen extends ConsumerStatefulWidget {
  const SaleEntryScreen({super.key, required this.parseResult});

  final ParseQrResult parseResult;

  @override
  ConsumerState<SaleEntryScreen> createState() => _SaleEntryScreenState();
}

class _SaleEntryScreenState extends ConsumerState<SaleEntryScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _categoryCtrl;
  late final TextEditingController _itemCodeCtrl;
  late final TextEditingController _metalTypeCtrl;
  late final TextEditingController _purityCtrl;
  late final TextEditingController _notesCtrl;
  late final TextEditingController _grossCtrl;
  late final TextEditingController _stoneCtrl;
  late final TextEditingController _netCtrl;

  String? _supplierId;
  String? _supplierName;
  bool _useCustomCategory = false;
  bool _useCustomMetal = false;
  bool _debugExpanded = false;

  late final bool _categoryParsed;
  late final bool _itemCodeParsed;
  late final bool _purityParsed;
  late final bool _grossParsed;
  late final bool _stoneParsed;
  late final bool _netParsed;

  @override
  void initState() {
    super.initState();
    final pr = widget.parseResult;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(saleEntryProvider.notifier).setParseResult(pr);
    });

    _categoryParsed = pr.category.parsed;
    _itemCodeParsed = pr.itemCode.parsed;
    _purityParsed = pr.purity.parsed;
    _grossParsed = pr.grossWeight.parsed;
    _stoneParsed = pr.stoneWeight.parsed;
    _netParsed = pr.netWeight.parsed;

    _categoryCtrl = TextEditingController(text: pr.category.value ?? '');
    _itemCodeCtrl = TextEditingController(text: pr.itemCode.value ?? '');
    _metalTypeCtrl = TextEditingController();
    _purityCtrl = TextEditingController(text: pr.purity.value ?? '');
    _notesCtrl = TextEditingController();
    _grossCtrl = TextEditingController(
      text: pr.grossWeight.value != null
          ? _formatNumber(pr.grossWeight.value!)
          : '',
    );
    _stoneCtrl = TextEditingController(
      text: pr.stoneWeight.value != null
          ? _formatNumber(pr.stoneWeight.value!)
          : '',
    );
    _netCtrl = TextEditingController(
      text: pr.netWeight.value != null
          ? _formatNumber(pr.netWeight.value!)
          : '',
    );
    if (pr.supplierDetected) {
      _supplierId = pr.supplier!.id;
      _supplierName = pr.supplier!.name;
    }
  }

  String _formatNumber(double value) => value == value.truncateToDouble()
      ? value.toInt().toString()
      : value.toString();

  @override
  void dispose() {
    _categoryCtrl.dispose();
    _itemCodeCtrl.dispose();
    _metalTypeCtrl.dispose();
    _purityCtrl.dispose();
    _notesCtrl.dispose();
    _grossCtrl.dispose();
    _stoneCtrl.dispose();
    _netCtrl.dispose();
    super.dispose();
  }

  SupplierModel? _findSupplierById(List<SupplierModel> suppliers, String? id) {
    if (id == null || id.isEmpty) return null;

    for (final supplier in suppliers) {
      if (supplier.id == id) {
        return supplier;
      }
    }

    return null;
  }

  void _setSupplier(String? id, String? name, List<String> categories) {
    setState(() {
      _supplierId = id;
      _supplierName = name;

      final currentCategory = _categoryCtrl.text.trim();
      if (categories.isEmpty) {
        _useCustomCategory = true;
        return;
      }

      if (currentCategory.isEmpty) {
        _categoryCtrl.text = categories.first;
        _useCustomCategory = false;
        return;
      }

      _useCustomCategory = !categories.contains(currentCategory);
    });
  }

  void _onFieldChanged() => setState(() {});

  void _resetForm() {
    setState(() {
      final pr = widget.parseResult;
      _categoryCtrl.text = pr.category.value ?? '';
      _itemCodeCtrl.text = pr.itemCode.value ?? '';
      _metalTypeCtrl.clear();
      _purityCtrl.text = pr.purity.value ?? '';
      _notesCtrl.clear();
      _grossCtrl.text = pr.grossWeight.value != null
          ? _formatNumber(pr.grossWeight.value!)
          : '';
      _stoneCtrl.text = pr.stoneWeight.value != null
          ? _formatNumber(pr.stoneWeight.value!)
          : '';
      _netCtrl.text = pr.netWeight.value != null
          ? _formatNumber(pr.netWeight.value!)
          : '';
      _supplierId = pr.supplierDetected ? pr.supplier!.id : null;
      _supplierName = pr.supplierDetected ? pr.supplier!.name : null;
      _useCustomCategory = false;
      _useCustomMetal = false;
      _debugExpanded = false;
      ref.read(saleEntryProvider.notifier).setParseResult(pr);
    });
  }

  Future<void> _submit({bool overrideDuplicate = false}) async {
    if (_supplierId == null) {
      _showSnack('Please select a supplier', isError: true);
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final grossWeight = double.tryParse(_grossCtrl.text) ?? 0;
    final netWeight = double.tryParse(_netCtrl.text) ?? 0;
    final stoneWeight = double.tryParse(_stoneCtrl.text) ?? 0;

    if (grossWeight <= 0) {
      _showSnack('Gross Weight must be greater than zero.', isError: true);
      return;
    }
    if (netWeight <= 0) {
      _showSnack('Net Weight must be greater than zero.', isError: true);
      return;
    }
    if (netWeight > grossWeight) {
      _showSnack(
        'Net Weight cannot be greater than Gross Weight.',
        isError: true,
      );
      return;
    }
    if (stoneWeight >= grossWeight) {
      _showSnack('Stone Weight must be less than Gross Weight.', isError: true);
      return;
    }

    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.submit(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim().isEmpty
          ? null
          : _categoryCtrl.text.trim(),
      itemCode: _itemCodeCtrl.text.trim().isEmpty
          ? null
          : _itemCodeCtrl.text.trim(),
      metalType: _metalTypeCtrl.text.trim().isEmpty
          ? null
          : _metalTypeCtrl.text.trim(),
      purity: _purityCtrl.text.trim().isEmpty ? null : _purityCtrl.text.trim(),
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      grossWeight: grossWeight,
      stoneWeight: stoneWeight,
      netWeight: netWeight,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
      overrideDuplicate: overrideDuplicate,
    );
  }

  Future<void> _confirmDuplicate() async {
    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.confirmDuplicate(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim().isEmpty
          ? null
          : _categoryCtrl.text.trim(),
      itemCode: _itemCodeCtrl.text.trim().isEmpty
          ? null
          : _itemCodeCtrl.text.trim(),
      metalType: _metalTypeCtrl.text.trim().isEmpty
          ? null
          : _metalTypeCtrl.text.trim(),
      purity: _purityCtrl.text.trim().isEmpty ? null : _purityCtrl.text.trim(),
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      grossWeight: double.tryParse(_grossCtrl.text) ?? 0,
      stoneWeight: double.tryParse(_stoneCtrl.text) ?? 0,
      netWeight: double.tryParse(_netCtrl.text) ?? 0,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final suppliersAsync = ref.watch(suppliersProvider);
    final suppliers = suppliersAsync.maybeWhen(
      data: (items) => items,
      orElse: () => const <SupplierModel>[],
    );
    final selectedSupplier = _findSupplierById(suppliers, _supplierId);
    final selectedCategories = selectedSupplier?.categories ?? const <String>[];
    final currentCategory = _categoryCtrl.text.trim();

    if (selectedCategories.isNotEmpty &&
        currentCategory.isNotEmpty &&
        !_useCustomCategory &&
        !selectedCategories.contains(currentCategory)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        setState(() {
          _useCustomCategory = true;
        });
      });
    }

    final saleState = ref.watch(saleEntryProvider);
    final submitState = saleState.value ?? const SaleEntryState();
    final isLoading = submitState.status == SaleSubmitStatus.loading;

    ref.listen(saleEntryProvider, (previous, next) {
      final nextState = next.value;
      final previousStatus = previous?.value?.status;
      if (previousStatus != SaleSubmitStatus.success &&
          nextState?.status == SaleSubmitStatus.success &&
          nextState?.createdSale != null) {
        context.pushReplacement('/sale-success', extra: nextState!.createdSale);
      }
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('New Sale'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: isLoading ? null : _resetForm,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.accent,
              padding: EdgeInsets.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Container(
              margin: const EdgeInsets.only(right: 8, top: 2, bottom: 2),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              decoration: BoxDecoration(
                border: Border(
                  bottom: BorderSide(color: AppColors.accent, width: 1.4),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.restart_alt_rounded,
                    size: 16,
                    color: AppColors.accent,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Reset',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: AppColors.accent,
                    ),
                  ),
                ],
              ),
            ),
          ),
          TextButton(
            onPressed: isLoading ? null : () => _submit(),
            child: Text(
              'Save',
              style: TextStyle(
                color: AppColors.accent,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
            child: Form(
              key: _formKey,
              onChanged: _onFieldChanged,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (submitState.status == SaleSubmitStatus.duplicateWarning)
                    DuplicateWarningBanner(
                      date: submitState.duplicateDate!,
                      onSaveAnyway: _confirmDuplicate,
                      onCancel: () =>
                          ref.read(saleEntryProvider.notifier).reset(),
                    ),
                  if (submitState.status == SaleSubmitStatus.error)
                    ErrorBanner(
                      message:
                          submitState.errorMessage ?? 'Failed to save sale',
                      retryCount: submitState.retryCount,
                      onRetry: () => _submit(),
                    ),
                  ParseStatusChip(parseResult: widget.parseResult),
                  const SizedBox(height: 16),
                  const SectionLabel('Supplier'),
                  const SizedBox(height: 8),
                  Align(
                    alignment: Alignment.center,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: _supplierId != null
                          ? SupplierChip(
                              name: _supplierName ?? '',
                              onClear: () => _setSupplier(null, null, const []),
                            )
                          : SupplierDropdown(
                              selectedId: _supplierId,
                              onSelected: (id, name) {
                                final supplier = _findSupplierById(
                                  suppliers,
                                  id,
                                );
                                _setSupplier(
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
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: CategorySelector(
                        controller: _categoryCtrl,
                        parsed: _categoryParsed,
                        showParseState: false,
                        categories: selectedCategories,
                        useCustomCategory: _useCustomCategory,
                        onUseCustomChanged: (value) {
                          setState(() {
                            _useCustomCategory = value;
                            if (!value &&
                                selectedCategories.isNotEmpty &&
                                !selectedCategories.contains(
                                  _categoryCtrl.text.trim(),
                                )) {
                              _categoryCtrl.text = selectedCategories.first;
                            }
                          });
                        },
                        onCategorySelected: (value) {
                          _categoryCtrl.text = value;
                          _onFieldChanged();
                        },
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
                          controller: _itemCodeCtrl,
                          parsed: _itemCodeParsed,
                          showParseState: false,
                          onChanged: _onFieldChanged,
                          hint: 'Optional',
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: SaleField(
                          label: 'Purity',
                          controller: _purityCtrl,
                          parsed: _purityParsed,
                          showParseState: false,
                          onChanged: _onFieldChanged,
                          hint: '18KT, 22KT, 925',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.center,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: MetalSelector(
                        controller: _metalTypeCtrl,
                        useCustomMetal: _useCustomMetal,
                        onUseCustomChanged: (value) {
                          setState(() {
                            _useCustomMetal = value;
                          });
                        },
                        onChanged: _onFieldChanged,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: SaleField(
                          label: 'Gross Weight (g)',
                          controller: _grossCtrl,
                          parsed: _grossParsed,
                          onChanged: _onFieldChanged,
                          hint: '0.0',
                          numeric: true,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: SaleField(
                          label: 'Stone Weight (g)',
                          controller: _stoneCtrl,
                          parsed: _stoneParsed,
                          onChanged: _onFieldChanged,
                          hint: '0.0',
                          numeric: true,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SaleField(
                    label: 'Net Weight (g)',
                    controller: _netCtrl,
                    parsed: _netParsed,
                    onChanged: _onFieldChanged,
                    hint: '0.0',
                    numeric: true,
                    required: true,
                  ),
                  const SizedBox(height: 24),
                  SaleField(
                    label: 'Notes',
                    controller: _notesCtrl,
                    parsed: false,
                    showParseState: false,
                    onChanged: _onFieldChanged,
                    hint: 'Optional remarks',
                    expandOnFocus: true,
                    maxLines: 4,
                  ),
                  const SizedBox(height: 24),
                  WeightSummaryCard(
                    grossWeight: double.tryParse(_grossCtrl.text),
                    stoneWeight: double.tryParse(_stoneCtrl.text),
                    netWeight: double.tryParse(_netCtrl.text),
                  ),
                  const SizedBox(height: 24),
                  if (widget.parseResult.raw.isNotEmpty ||
                      widget.parseResult.hasErrors)
                    QrDebugPanel(
                      parseResult: widget.parseResult,
                      expanded: _debugExpanded,
                      onToggle: () =>
                          setState(() => _debugExpanded = !_debugExpanded),
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
            child: SaveBar(isLoading: isLoading, onSave: () => _submit()),
          ),
        ],
      ),
    );
  }
}
