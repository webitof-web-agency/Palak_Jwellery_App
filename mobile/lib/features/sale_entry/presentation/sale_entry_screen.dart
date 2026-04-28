import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';
import 'widgets/sale_entry_app_bar.dart';
import 'widgets/sale_entry_form_body.dart';

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

    _showSnack('Form reset');
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

  void _showSnack(
    String msg, {
    bool isError = false,
    bool showCloseButton = true,
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        content: Row(
          children: [
            Expanded(child: Text(msg)),
            if (showCloseButton)
              IconButton(
                onPressed: () =>
                    ScaffoldMessenger.of(context).hideCurrentSnackBar(),
                icon: const Icon(Icons.close_rounded, size: 18),
                tooltip: 'Dismiss',
                color: AppColors.accent,
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
              ),
          ],
        ),
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

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: SaleEntryAppBar(
        isLoading: isLoading,
        onReset: _resetForm,
        onSave: () => _submit(),
        onBack: () => context.pop(),
      ),
      body: SaleEntryFormBody(
        formKey: _formKey,
        parseResult: widget.parseResult,
        suppliers: suppliers,
        supplierId: _supplierId,
        supplierName: _supplierName,
        selectedCategories: selectedCategories,
        categoryController: _categoryCtrl,
        itemCodeController: _itemCodeCtrl,
        metalTypeController: _metalTypeCtrl,
        purityController: _purityCtrl,
        notesController: _notesCtrl,
        grossController: _grossCtrl,
        stoneController: _stoneCtrl,
        netController: _netCtrl,
        categoryParsed: _categoryParsed,
        itemCodeParsed: _itemCodeParsed,
        purityParsed: _purityParsed,
        grossParsed: _grossParsed,
        stoneParsed: _stoneParsed,
        netParsed: _netParsed,
        useCustomCategory: _useCustomCategory,
        useCustomMetal: _useCustomMetal,
        debugExpanded: _debugExpanded,
        isLoading: isLoading,
        onSupplierChanged: (id, name, categories) {
          _setSupplier(id, name, categories);
        },
        onSupplierCleared: () => _setSupplier(null, null, const []),
        onUseCustomCategoryChanged: (value) {
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
        onUseCustomMetalChanged: (value) {
          setState(() {
            _useCustomMetal = value;
          });
        },
        onFieldChanged: _onFieldChanged,
        onSubmit: _submit,
        onConfirmDuplicate: _confirmDuplicate,
        onRetry: () => _submit(),
        onToggleDebug: () =>
            setState(() => _debugExpanded = !_debugExpanded),
      ),
    );
  }
}
