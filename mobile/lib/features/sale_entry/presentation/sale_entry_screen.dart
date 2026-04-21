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
  const SaleEntryScreen({
    super.key,
    required this.parseResult,
  });

  final ParseQrResult parseResult;

  @override
  ConsumerState<SaleEntryScreen> createState() => _SaleEntryScreenState();
}

class _SaleEntryScreenState extends ConsumerState<SaleEntryScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _categoryCtrl;
  late final TextEditingController _grossCtrl;
  late final TextEditingController _stoneCtrl;
  late final TextEditingController _netCtrl;
  late final TextEditingController _rateCtrl;

  String? _supplierId;
  String? _supplierName;
  bool _useCustomCategory = false;
  bool _debugExpanded = false;

  late final bool _categoryParsed;
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
    _grossParsed = pr.grossWeight.parsed;
    _stoneParsed = pr.stoneWeight.parsed;
    _netParsed = pr.netWeight.parsed;

    _categoryCtrl = TextEditingController(text: pr.category.value ?? '');
    _grossCtrl = TextEditingController(
      text: pr.grossWeight.value != null ? _formatNumber(pr.grossWeight.value!) : '',
    );
    _stoneCtrl = TextEditingController(
      text: pr.stoneWeight.value != null ? _formatNumber(pr.stoneWeight.value!) : '',
    );
    _netCtrl = TextEditingController(
      text: pr.netWeight.value != null ? _formatNumber(pr.netWeight.value!) : '',
    );
    _rateCtrl = TextEditingController();

    if (pr.supplierDetected) {
      _supplierId = pr.supplier!.id;
      _supplierName = pr.supplier!.name;
    }
  }

  String _formatNumber(double value) =>
      value == value.truncateToDouble() ? value.toInt().toString() : value.toString();

  @override
  void dispose() {
    _categoryCtrl.dispose();
    _grossCtrl.dispose();
    _stoneCtrl.dispose();
    _netCtrl.dispose();
    _rateCtrl.dispose();
    super.dispose();
  }

  double? get _net => double.tryParse(_netCtrl.text);
  double? get _rate => double.tryParse(_rateCtrl.text);

  double get _total {
    final net = _net;
    final rate = _rate;
    if (net == null || rate == null) return 0;
    return net * rate;
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
      _showSnack('Net Weight cannot be greater than Gross Weight.', isError: true);
      return;
    }
    if (stoneWeight >= grossWeight) {
      _showSnack('Stone Weight must be less than Gross Weight.', isError: true);
      return;
    }

    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.submit(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim(),
      grossWeight: grossWeight,
      stoneWeight: stoneWeight,
      netWeight: netWeight,
      ratePerGram: double.tryParse(_rateCtrl.text) ?? 0,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
      overrideDuplicate: overrideDuplicate,
    );
  }

  Future<void> _confirmDuplicate() async {
    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.confirmDuplicate(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim(),
      grossWeight: double.tryParse(_grossCtrl.text) ?? 0,
      stoneWeight: double.tryParse(_stoneCtrl.text) ?? 0,
      netWeight: double.tryParse(_netCtrl.text) ?? 0,
      ratePerGram: double.tryParse(_rateCtrl.text) ?? 0,
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
                      onCancel: () => ref.read(saleEntryProvider.notifier).reset(),
                    ),
                  if (submitState.status == SaleSubmitStatus.error)
                    ErrorBanner(
                      message: submitState.errorMessage ?? 'Failed to save sale',
                      retryCount: submitState.retryCount,
                      onRetry: () => _submit(),
                    ),
                  ParseStatusChip(parseResult: widget.parseResult),
                  const SizedBox(height: 16),
                  const SectionLabel('Supplier'),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: _supplierId != null
                      ? SupplierChip(
                          name: _supplierName ?? '',
                          onClear: () => _setSupplier(null, null, const []),
                        )
                        : SupplierDropdown(
                            selectedId: _supplierId,
                            onSelected: (id, name) {
                              final supplier = _findSupplierById(suppliers, id);
                              _setSupplier(id, name, supplier?.categories ?? const []);
                            },
                          ),
                  ),
                  const SizedBox(height: 20),
                  const SectionLabel('Item Details'),
                  const SizedBox(height: 12),
                  CategorySelector(
                    controller: _categoryCtrl,
                    parsed: _categoryParsed,
                    categories: selectedCategories,
                    useCustomCategory: _useCustomCategory,
                    onUseCustomChanged: (value) {
                      setState(() {
                        _useCustomCategory = value;
                        if (!value &&
                            selectedCategories.isNotEmpty &&
                            !selectedCategories.contains(_categoryCtrl.text.trim())) {
                          _categoryCtrl.text = selectedCategories.first;
                        }
                      });
                    },
                    onCategorySelected: (value) {
                      _categoryCtrl.text = value;
                      _onFieldChanged();
                    },
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: SaleField(
                          label: 'Gross Weight (g)',
                          controller: _grossCtrl,
                          parsed: _grossParsed,
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
                    hint: '0.0',
                    numeric: true,
                    required: true,
                  ),
                  const SizedBox(height: 12),
                  SaleField(
                    label: 'Rate per Gram (Rs)',
                    controller: _rateCtrl,
                    parsed: false,
                    parsedOverride: true,
                    hint: 'Enter gold rate',
                    numeric: true,
                    required: true,
                  ),
                  const SizedBox(height: 24),
                  TotalCard(total: _total),
                  const SizedBox(height: 24),
                  if (widget.parseResult.raw.isNotEmpty || widget.parseResult.hasErrors)
                    QrDebugPanel(
                      parseResult: widget.parseResult,
                      expanded: _debugExpanded,
                      onToggle: () => setState(() => _debugExpanded = !_debugExpanded),
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
            child: SaveBar(
              isLoading: isLoading,
              total: _total,
              onSave: () => _submit(),
            ),
          ),
        ],
      ),
    );
  }
}
