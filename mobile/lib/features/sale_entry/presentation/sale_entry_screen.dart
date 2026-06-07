import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../batches/domain/batch_capture_context.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';
import 'widgets/sale_entry_app_bar.dart';
import 'widgets/sale_entry_form_body.dart';

class SaleEntryScreen extends ConsumerStatefulWidget {
  const SaleEntryScreen({
    super.key,
    required this.parseResult,
    this.batchContext,
  });

  final ParseQrResult parseResult;
  final BatchCaptureContext? batchContext;

  @override
  ConsumerState<SaleEntryScreen> createState() => _SaleEntryScreenState();
}

class _SaleEntryScreenState extends ConsumerState<SaleEntryScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _categoryCtrl;
  late final TextEditingController _itemCodeCtrl;
  late final TextEditingController _karatCtrl;
  late final TextEditingController _purityCtrl;
  late final TextEditingController _notesCtrl;
  late final TextEditingController _grossCtrl;
  late final TextEditingController _stoneCtrl;
  late final TextEditingController _netCtrl;

  String? _supplierId;
  String? _supplierName;
  bool _useCustomCategory = false;
  bool _debugExpanded = false;
  String _lastCalculatedNet = '';

  late final bool _categoryParsed;
  late final bool _itemCodeParsed;
  late final bool _karatParsed;
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
    _karatParsed = pr.karat.parsed;
    _grossParsed = pr.grossWeight.parsed;
    _stoneParsed = pr.stoneWeight.parsed;
    _netParsed = pr.netWeight.parsed;

    _categoryCtrl = TextEditingController(
      text: pr.category.value != null ? _normalizeCategory(pr.category.value!) : '',
    );
    _itemCodeCtrl = TextEditingController(text: pr.itemCode.value ?? '');
    _karatCtrl = TextEditingController(text: pr.karat.value ?? '');
    _purityCtrl = TextEditingController(text: '');
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
    if (widget.batchContext != null) {
      _supplierId = widget.batchContext!.supplierId;
      _supplierName = widget.batchContext!.supplierName;
    } else if (pr.supplierDetected) {
      _supplierId = pr.supplier!.id;
      _supplierName = pr.supplier!.name;
    }
  }

  String _formatNumber(double value) => value == value.truncateToDouble()
      ? value.toInt().toString()
      : value.toString();

  String _normalizeCategory(String val) =>
      val.replaceAll(RegExp(r'\d'), '').toUpperCase().trim();

  String _resolvePurityPreview({
    required String karat,
    required SupplierModel? supplier,
    required List<KaratOption> karatOptions,
  }) {
    final resolved = resolvePurityPercentForKarat(
      supplier: supplier,
      karat: karat,
      karatOptions: karatOptions,
    );

    if (resolved == null) {
      return '';
    }

    return _formatNumber(resolved);
  }

  @override
  void dispose() {
    _categoryCtrl.dispose();
    _itemCodeCtrl.dispose();
    _karatCtrl.dispose();
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

  bool get _isBatchSupplierMismatch {
    final batchContext = widget.batchContext;
    final detectedSupplier = widget.parseResult.supplier;
    if (batchContext == null || detectedSupplier == null) {
      return false;
    }

    return detectedSupplier.id.isNotEmpty &&
        detectedSupplier.id != batchContext.supplierId;
  }

  void _setSupplier(String? id, String? name, List<String> categories) {
    if (widget.batchContext != null) {
      return;
    }

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

  void _onFieldChanged() {
    setState(() {
      final grossStr = _grossCtrl.text.trim();
      final stoneStr = _stoneCtrl.text.trim();
      final otherVal = widget.parseResult.otherWeight.value ?? 0.0;

      if (grossStr.isNotEmpty) {
        final gross = double.tryParse(grossStr) ?? 0.0;
        final stone = double.tryParse(stoneStr) ?? 0.0;
        final net = gross - stone - otherVal;
        final formattedNet = _formatNumber(net >= 0 ? net : 0.0);

        if (_netCtrl.text.trim().isEmpty || _netCtrl.text.trim() == _lastCalculatedNet) {
          if (_netCtrl.text != formattedNet) {
            _netCtrl.text = formattedNet;
          }
          _lastCalculatedNet = formattedNet;
        }
      } else {
        if (_netCtrl.text.trim() == _lastCalculatedNet) {
          if (_netCtrl.text.isNotEmpty) {
            _netCtrl.clear();
          }
          _lastCalculatedNet = '';
        }
      }
    });
  }

  void _resetForm() {
    FocusScope.of(context).unfocus();
    _formKey.currentState?.reset();
    setState(() {
      final pr = widget.parseResult;
      _categoryCtrl.text = pr.category.value ?? '';
      _itemCodeCtrl.text = pr.itemCode.value ?? '';
      _karatCtrl.text = pr.karat.value ?? '';
      _purityCtrl.clear();
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
      if (widget.batchContext != null) {
        _supplierId = widget.batchContext!.supplierId;
        _supplierName = widget.batchContext!.supplierName;
      } else {
        _supplierId = pr.supplierDetected ? pr.supplier!.id : null;
        _supplierName = pr.supplierDetected ? pr.supplier!.name : null;
      }
      _useCustomCategory = false;
      _debugExpanded = false;
      ref.read(saleEntryProvider.notifier).setParseResult(pr);
    });

    _showSnack(
      'Scan restored',
      showCloseButton: false,
      duration: const Duration(seconds: 2),
    );
  }

  Future<void> _submit({bool overrideDuplicate = false}) async {
    if (_supplierId == null) {
      _showSnack('Please select a supplier', isError: true);
      return;
    }
    if (_isBatchSupplierMismatch) {
      _showSnack(
        'This QR belongs to a different supplier. Use the matching batch.',
        isError: true,
      );
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
      supplierId: widget.batchContext?.supplierId ?? _supplierId!,
      batchId: widget.batchContext?.batchId,
      batchRef: widget.batchContext?.batchRef,
      batchRevision: widget.batchContext?.revision,
      category: _categoryCtrl.text.trim().isEmpty
          ? null
          : _categoryCtrl.text.trim(),
      itemCode: _itemCodeCtrl.text.trim().isEmpty
          ? null
          : _itemCodeCtrl.text.trim(),
      metalType: null,
      karat: _karatCtrl.text.trim().isEmpty ? null : _karatCtrl.text.trim(),
      notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      grossWeight: grossWeight,
      stoneWeight: stoneWeight,
      netWeight: netWeight,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
      overrideDuplicate: overrideDuplicate,
    );
  }

  Future<void> _confirmDuplicate() async {
    if (_isBatchSupplierMismatch) {
      _showSnack(
        'This QR belongs to a different supplier. Use the matching batch.',
        isError: true,
      );
      return;
    }

    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.confirmDuplicate(
      supplierId: widget.batchContext?.supplierId ?? _supplierId!,
      batchId: widget.batchContext?.batchId,
      batchRef: widget.batchContext?.batchRef,
      batchRevision: widget.batchContext?.revision,
      category: _categoryCtrl.text.trim().isEmpty
          ? null
          : _categoryCtrl.text.trim(),
      itemCode: _itemCodeCtrl.text.trim().isEmpty
          ? null
          : _itemCodeCtrl.text.trim(),
      metalType: null,
      karat: _karatCtrl.text.trim().isEmpty ? null : _karatCtrl.text.trim(),
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
    Duration duration = const Duration(seconds: 3),
  }) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: duration,
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
    final karatOptionsAsync = ref.watch(karatOptionsProvider);
    final businessAsync = ref.watch(businessOverviewProvider);
    final suppliers = suppliersAsync.maybeWhen(
      data: (items) => items,
      orElse: () => const <SupplierModel>[],
    );
    final karatOptions = karatOptionsAsync.maybeWhen(
      data: (items) => items,
      orElse: () => const <KaratOption>[],
    );
    final businessOverview = businessAsync.maybeWhen(
      data: (value) => value,
      orElse: () => const BusinessOverview(categories: [], metalTypes: [], settings: {}),
    );
    final selectedSupplier = _findSupplierById(suppliers, _supplierId);
    final selectedCategories = selectedSupplier?.categories ?? const <String>[];
    final availableCategories = selectedCategories.isNotEmpty
        ? selectedCategories
        : businessOverview.categories;
    final currentCategory = _categoryCtrl.text.trim();
    final currentKarat = _karatCtrl.text.trim();
    final resolvedPurityText = currentKarat.isNotEmpty
        ? _resolvePurityPreview(
            karat: currentKarat,
            supplier: selectedSupplier,
            karatOptions: karatOptions,
          )
        : '';

    if (_purityCtrl.text != resolvedPurityText) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (_purityCtrl.text != resolvedPurityText) {
          _purityCtrl.text = resolvedPurityText;
        }
      });
    }

    if (availableCategories.isNotEmpty &&
        currentCategory.isNotEmpty &&
        !_useCustomCategory &&
        !availableCategories.contains(currentCategory)) {
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
        onBack: () => context.pop(),
        title: widget.batchContext != null ? 'Batch item' : 'New Sale',
      ),
      body: SaleEntryFormBody(
        formKey: _formKey,
        parseResult: widget.parseResult,
        batchContext: widget.batchContext,
        suppliers: suppliers,
        supplierId: _supplierId,
        supplierName: _supplierName,
        supplierLocked: widget.batchContext != null,
        selectedCategories: availableCategories,
        categoryController: _categoryCtrl,
        itemCodeController: _itemCodeCtrl,
        karatController: _karatCtrl,
        purityController: _purityCtrl,
        notesController: _notesCtrl,
        grossController: _grossCtrl,
        stoneController: _stoneCtrl,
        netController: _netCtrl,
        categoryParsed: _categoryParsed,
        itemCodeParsed: _itemCodeParsed,
        karatParsed: _karatParsed,
        grossParsed: _grossParsed,
        stoneParsed: _stoneParsed,
        netParsed: _netParsed,
        karatOptions: karatOptions,
        useCustomCategory: _useCustomCategory,
        debugExpanded: _debugExpanded,
        isLoading: isLoading,
        onSupplierChanged: widget.batchContext == null
            ? (id, name, categories) {
                _setSupplier(id, name, categories);
              }
            : (id, name, categories) {},
        onSupplierCleared: widget.batchContext == null
            ? () => _setSupplier(null, null, const [])
            : () {},
        onUseCustomCategoryChanged: (value) {
          setState(() {
            _useCustomCategory = value;
            if (!value &&
                availableCategories.isNotEmpty &&
                !availableCategories.contains(_categoryCtrl.text.trim())) {
              _categoryCtrl.text = availableCategories.first;
            }
          });
        },
        onCategorySelected: (value) {
          _categoryCtrl.text = value;
          _onFieldChanged();
        },
        onFieldChanged: _onFieldChanged,
        onSubmit: _submit,
        onConfirmDuplicate: _confirmDuplicate,
        onToggleDebug: () =>
            setState(() => _debugExpanded = !_debugExpanded),
      ),
    );
  }
}
