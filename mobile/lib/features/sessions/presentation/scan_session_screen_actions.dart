part of 'scan_session_screen.dart';

String _scanSessionNormalizeText(String? value) {
  return (value ?? '').trim().toLowerCase();
}

String _scanSessionDisplayWarningLabel(String label) {
  final trimmed = label.trim();
  if (trimmed.isEmpty) {
    return trimmed;
  }

  final normalized = trimmed.toLowerCase();
  if (normalized.contains('expected number') ||
      normalized.contains('not a valid number') ||
      normalized.contains('invalid number')) {
    return 'Invalid QR value';
  }
  if (normalized.contains('missing') && normalized.contains('value')) {
    return 'Missing QR value';
  }
  if (normalized.contains('supplier mismatch')) {
    return 'Supplier mismatch';
  }
  if (normalized.contains('duplicate')) {
    return 'Duplicate item';
  }
  if (normalized.contains('requires review')) {
    return 'Needs review';
  }
  if (normalized.contains('manual entry')) {
    return 'Manual entry';
  }
  if (normalized.contains('karat mismatch')) {
    return 'QR Karat Mismatch';
  }

  final compact = trimmed.split(';').first.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (compact.length <= 28) {
    return compact;
  }

  return '${compact.substring(0, 25).trimRight()}...';
}



SupplierModel? _scanSessionSupplierModelFor(
  _ScanSessionScreenState state,
  String? supplier,
) {
  final normalized = _scanSessionNormalizeText(supplier);
  if (normalized.isEmpty) {
    return null;
  }

  final suppliers = state.ref
      .read(suppliersProvider)
      .maybeWhen(data: (value) => value, orElse: () => const <SupplierModel>[]);
  for (final candidate in suppliers) {
    final names = <String>[candidate.name, candidate.code];
    for (final rawName in names) {
      final name = _scanSessionNormalizeText(rawName);
      if (name.isEmpty) {
        continue;
      }
      if (name == normalized || name.contains(normalized) || normalized.contains(name)) {
        return candidate;
      }
    }
  }

  return null;
}

double? _scanSessionProviderPurityForKarat(
  _ScanSessionScreenState state,
  String? supplier,
  String? karat,
) {
  final normalized = (karat ?? '').trim();
  if (normalized.isEmpty) {
    return null;
  }

  final karatOptions = state.ref
      .read(karatOptionsProvider)
      .maybeWhen(data: (value) => value, orElse: () => KaratOption.defaults());
  final resolved = resolvePurityPercentForKarat(
    supplier: _scanSessionSupplierModelFor(state, supplier),
    karat: normalized,
    karatOptions: karatOptions.isEmpty ? KaratOption.defaults() : karatOptions,
  );
  if (resolved != null) {
    return resolved;
  }

  for (final option in karatOptions.isEmpty ? KaratOption.defaults() : karatOptions) {
    if (option.name.trim().toUpperCase() == normalized.toUpperCase()) {
      return option.purityPercent;
    }
  }

  return null;
}

double? _scanSessionCategoryDefaultWastageFor(_ScanSessionScreenState state, String? supplier, String? category) {
  final normalized = (category ?? '').trim().toLowerCase();
  if (normalized.isEmpty) {
    return null;
  }
  
  final supplierModel = _scanSessionSupplierModelFor(state, supplier);
  if (supplierModel == null) return null;
  
  final categories = supplierModel.businessSettings['categories'];
  if (categories is! List) return null;
  
  for (final item in categories) {
    if (item is Map<String, dynamic> && 
        (item['name']?.toString().toLowerCase() == normalized || item['code']?.toString().toLowerCase() == normalized) && 
        item['isActive'] != false) {
      final val = item['wastagePercent'];
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val);
    }
  }
  return null;
}

double? _scanSessionSupplierDefaultWastageFor(SupplierModel? supplierModel, String? karatLabel) {
  if (supplierModel == null || karatLabel == null) return null;
  final normalized = karatLabel.trim().toUpperCase();
  if (normalized.isEmpty) return null;
  
  final karats = supplierModel.businessSettings['karats'];
  if (karats is! List) return null;
  
  for (final item in karats) {
    if (item is Map<String, dynamic> && 
        (item['name']?.toString().toUpperCase() == normalized || item['code']?.toString().toUpperCase() == normalized) && 
        item['isActive'] != false) {
      final val = item['wastagePercent'];
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val);
    }
  }
  return null;
}

({double purity, double wastage})? _scanSessionDefaultsFor(
  _ScanSessionScreenState state,
  String? supplier,
  String? category,
  String? karat,
) {
  final karatLabel = (karat ?? '').trim().toUpperCase();
  if (karatLabel.isEmpty) {
    return null;
  }

  final supplierModel = _scanSessionSupplierModelFor(state, supplier);
  final karatPurity = _scanSessionProviderPurityForKarat(state, supplier, karatLabel);
  if (karatPurity == null) {
    return null;
  }

  final categoryDefaultWastage = _scanSessionCategoryDefaultWastageFor(state, supplier, category);
  final supplierDefaultWastage = _scanSessionSupplierDefaultWastageFor(supplierModel, karatLabel);

  return (
    purity: karatPurity,
    wastage: categoryDefaultWastage ?? supplierDefaultWastage ?? 10.0,
  );
}

void _scanSessionApplyDefaultsForSelection(_ScanSessionScreenState state) {
  final defaults = _scanSessionDefaultsFor(
    state,
    state._draft.supplier,
    state._draft.selectedCategory,
    state._draft.karat,
  );
  
  final supplierModel = _scanSessionSupplierModelFor(state, state._draft.supplier);
  final catWastage = _scanSessionCategoryDefaultWastageFor(state, state._draft.supplier, state._draft.selectedCategory);
  final suppWastage = _scanSessionSupplierDefaultWastageFor(supplierModel, state._draft.karat);
  
  state._draft = state._draft.copyWith(
    purityOriginal: defaults?.purity,
    puritySelected: defaults?.purity,
    clearPurity: defaults == null,
    wastageOriginal: defaults?.wastage,
    wastageSelected: defaults?.wastage,
    clearWastage: defaults == null,
    categoryDefaultWastage: catWastage,
    clearCategoryDefaultWastage: catWastage == null,
    supplierDefaultWastage: suppWastage,
    clearSupplierDefaultWastage: suppWastage == null,
    clearValidationMessage: true,
  );
  state._purityController.text =
      defaults == null ? '' : defaults.purity.toStringAsFixed(2);
  state._wastageController.text =
      defaults == null ? '' : defaults.wastage.toStringAsFixed(2);
  state._localValidationMessage = null;
}

void _scanSessionSetSupplier(_ScanSessionScreenState state, String? supplier) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      supplier: supplier,
      clearSupplier: supplier == null,
    );
    _scanSessionApplyDefaultsForSelection(state);
  });
}

void _scanSessionSetCategory(_ScanSessionScreenState state, String? category) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      categoryOriginal: category,
      categorySelected: category,
      clearCategory: category == null,
    );
    _scanSessionApplyDefaultsForSelection(state);
  });
}

void _scanSessionSetKarat(_ScanSessionScreenState state, String? karat) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      karat: karat,
      clearKarat: karat == null,
    );
    _scanSessionApplyDefaultsForSelection(state);
  });
}

void _scanSessionSetPurity(_ScanSessionScreenState state, String value) {
  final parsed = double.tryParse(value.trim());
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      puritySelected: parsed,
      clearValidationMessage: true,
    );
    state._localValidationMessage = null;
  });
}

void _scanSessionSetWastage(_ScanSessionScreenState state, String value) {
  final parsed = double.tryParse(value.trim());
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      wastageSelected: parsed,
      clearValidationMessage: true,
    );
    state._localValidationMessage = null;
  });
}

void _scanSessionSetStonePrice(_ScanSessionScreenState state, String value) {
  final parsed = double.tryParse(value.trim());
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      stonePriceSelected: parsed,
      clearStonePrice: parsed == null,
      clearValidationMessage: true,
    );
    state._localValidationMessage = null;
  });
}

void _scanSessionSetNotes(_ScanSessionScreenState state, String value) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(notes: value);
  });
}

void _scanSessionChangeCustomer(_ScanSessionScreenState state) {
  state.context.push('/customers');
}

Future<void> _scanSessionPickSupplier(_ScanSessionScreenState state) async {
  final chosen = await showModalBottomSheet<String>(
    context: state.context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return _SupplierPickerSheet(selectedValue: state._draft.supplier);
    },
  );
  if (!state.mounted || chosen == null) {
    return;
  }
  if (chosen == _clearSelectionSentinel) {
    _scanSessionSetSupplier(state, null);
    return;
  }
  _scanSessionSetSupplier(state, chosen);
}

Future<void> _scanSessionPickCategory(_ScanSessionScreenState state) async {
  final values = <String>{};
  
  try {
    final overview = await state.ref.read(businessOverviewProvider.future);
    values.addAll(overview.categories);
  } catch (_) {}

  final chosen = await _scanSessionShowSelectionSheet(
    state,
    title: 'Select Category',
    searchHint: 'Search category',
    options: values.toList(),
    selectedValue: state._draft.selectedCategory,
    allowCustomValue: true,
    customValueHint: 'Enter custom category',
    allowClearSelection: true,
  );
  if (!state.mounted || chosen == null) {
    return;
  }
  _scanSessionSetCategory(state, chosen == _clearSelectionSentinel ? null : chosen);
}

Future<void> _scanSessionPickKarat(_ScanSessionScreenState state) async {
  final chosen = await showModalBottomSheet<String>(
    context: state.context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return _KaratPickerSheet(
        selectedValue: state._draft.karat,
        supplierName: state._draft.supplier,
        supplierModel: _scanSessionSupplierModelFor(state, state._draft.supplier),
      );
    },
  );
  if (!state.mounted || chosen == null) {
    return;
  }
  if (chosen == _clearSelectionSentinel) {
    _scanSessionSetKarat(state, null);
    return;
  }
  _scanSessionSetKarat(state, chosen);
}

Future<void> _scanSessionPickWastage(_ScanSessionScreenState state) async {
  final values = <double>{};
  final selectedSupplier = _scanSessionSupplierModelFor(state, state._draft.supplier);
  try {
    final suppliers = await state.ref.read(suppliersProvider.future);
    final pool = selectedSupplier != null
        ? suppliers.where((supplier) => supplier.id == selectedSupplier.id).toList(growable: false)
        : suppliers;
    final targetSuppliers = pool.isEmpty && selectedSupplier != null
        ? <SupplierModel>[selectedSupplier]
        : pool;

    for (final supplier in targetSuppliers) {
      final karats = supplier.businessSettings['karats'];
      if (karats is List) {
        for (final item in karats) {
          if (item is! Map<String, dynamic>) continue;
          if (item['isActive'] == false) continue;
          final val = item['wastagePercent'];
          if (val is num) values.add(val.toDouble());
          if (val is String && double.tryParse(val) != null) values.add(double.parse(val));
        }
      }

      final categories = supplier.businessSettings['categories'];
      if (categories is List) {
        for (final item in categories) {
          if (item is! Map<String, dynamic>) continue;
          if (item['isActive'] == false) continue;
          final val = item['wastagePercent'];
          if (val is num) values.add(val.toDouble());
          if (val is String && double.tryParse(val) != null) values.add(double.parse(val));
        }
      }
    }
  } catch (_) {
    // Fallback handled below.
  }

  try {
    final overview = await state.ref.read(businessOverviewProvider.future);
    if (overview.wastages.isNotEmpty) {
      values.addAll(overview.wastages);
    }
  } catch (_) {
    // Ignore errors for global wastages
  }

  if (values.isEmpty) {
    final fallback = state._draft.globalDefaultWastage;
    values.add(fallback);
  }

  final list = values.map((value) => value.toStringAsFixed(2)).toList(growable: false);
  list.sort((a, b) {
    final aValue = double.tryParse(a) ?? 0;
    final bValue = double.tryParse(b) ?? 0;
    return aValue.compareTo(bValue);
  });

  final chosen = await _scanSessionShowSelectionSheet(
    state,
    title: 'Select Wastage',
    searchHint: 'Search wastage',
    options: list,
    selectedValue: state._draft.wastageSelected?.toStringAsFixed(2),
    allowCustomValue: true,
    customValueIsNumeric: true,
    customValueHint: 'Enter custom wastage',
  );
  if (!state.mounted || chosen == null) {
    return;
  }

  state._wastageController.text = chosen;
  _scanSessionSetWastage(state, chosen);
}

Future<void> _scanSessionPickStonePrice(_ScanSessionScreenState state) async {
  final chosen = await _scanSessionShowSelectionSheet(
    state,
    title: 'Select Stone Price',
    searchHint: 'Search or enter price',
    options: ['800', '1000', '1200', '1400', '1500', '2000'],
    selectedValue: state._draft.stonePriceSelected?.toStringAsFixed(0),
    allowCustomValue: true,
    customValueIsNumeric: true,
    customValueHint: 'Enter custom price per gram',
    allowClearSelection: true,
  );
  if (!state.mounted || chosen == null) {
    return;
  }
  
  if (chosen == _clearSelectionSentinel) {
    state._stonePriceController.text = '';
    _scanSessionSetStonePrice(state, '');
    return;
  }
  
  state._stonePriceController.text = chosen;
  _scanSessionSetStonePrice(state, chosen);
}

void _scanSessionLockDetails(_ScanSessionScreenState state) {
  final form = state._formKey.currentState;
  if (form == null || !form.validate()) {
    return;
  }

  final validation = state._draft.validateForLock();
  if (validation != null) {
    state._updateDraftState(() {
      state._localValidationMessage = validation;
      state._draft = state._draft.copyWith(validationMessage: validation);
    });
    return;
  }

  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      mode: ScanSessionMode.lockedActiveScanning,
      clearValidationMessage: true,
    );
    state._localValidationMessage = null;
  });
}

void _scanSessionUnlockDetails(_ScanSessionScreenState state) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      mode: ScanSessionMode.setup,
      clearValidationMessage: true,
    );
    state._localValidationMessage = null;
  });
}

Future<void> _scanSessionStartScanner(_ScanSessionScreenState state) async {
  if (!state._draft.isLocked) {
    return;
  }

  final rawQr = await state.context.push<String>(
    '/scanner',
    extra: ScannerLaunchArgs(
      sessionKey: 'scan-session-${DateTime.now().microsecondsSinceEpoch}',
      mode: ScannerLaunchMode.scanSession,
      onContinuousScan: state._draft.continuousScan ? (qr) => _processScannedQr(state, qr) : null,
    ),
  );
  if (rawQr == null || rawQr.trim().isEmpty) {
    return;
  }
  
  if (!state._draft.continuousScan) {
    await _processScannedQr(state, rawQr);
  }
}

Future<void> _processScannedQr(_ScanSessionScreenState state, String rawQr) async {
  if (!state.mounted) {
    return;
  }

  final supplierModel = _scanSessionSupplierModelFor(state, state._draft.supplier);
  ParseQrResult parsed;
  try {
    parsed = await state.ref.read(saleRepositoryProvider).parseQr(
          rawQr,
          supplierId: supplierModel?.id,
        );
  } catch (_) {
    parsed = ParseQrResult.empty(rawQr);
  }

  if (!state.mounted) {
    return;
  }

  final item = _scanSessionBuildScannedItemFromParse(
    state: state,
    rawQr: rawQr,
    parseResult: parsed,
  );

  final shouldWarn =
      item.isDuplicate || item.hasSupplierMismatch || item.requiresReview || item.warningLabel != null;
  if (shouldWarn) {
    final warnings = <String>[
      if (item.isDuplicate) 'This item already exists in this session.',
      if (item.hasSupplierMismatch) 'This scan belongs to a different supplier.',
      if (item.requiresReview) 'Net mismatch requires review.',
      if (item.warningLabel != null && item.warningLabel!.trim().isNotEmpty) item.warningLabel!.trim(),
    ];

    final keepItem = await showDialog<bool>(
      context: state.context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Scan warning'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('This scan has warnings. Choose whether to keep it in the session.'),
              const SizedBox(height: 12),
              ...warnings.map(
                (warning) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Text('- ${_scanSessionDisplayWarningLabel(warning)}'),
                ),
              ),
              const SizedBox(height: 16),
              const Text('Raw QR:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: AppColors.surfaceAlt,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SelectableText(
                        item.rawQr ?? '',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    InkWell(
                      onTap: () {
                        Clipboard.setData(ClipboardData(text: item.rawQr ?? ''));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Raw QR copied'),
                            behavior: SnackBarBehavior.floating,
                            duration: Duration(seconds: 1),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(4),
                      child: Padding(
                        padding: const EdgeInsets.all(4.0),
                        child: Icon(
                          Icons.copy,
                          size: 14,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              child: const Text('Discard item'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Keep item'),
            ),
          ],
        );
      },
    );

    if (keepItem != true || !state.mounted) {
      return;
    }
  }

  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      scannedItems: <ScannedSessionItem>[
        ...state._draft.scannedItems,
        item,
      ],
    );
  });
  await state._playSuccessTone();
  HapticFeedback.selectionClick();
}

ScannedSessionItem _scanSessionBuildScannedItemFromParse({
  required _ScanSessionScreenState state,
  required String rawQr,
  required ParseQrResult parseResult,
}) {
  String? pickText(ParsedField<String> field) {
    final value = field.value?.trim();
    return value == null || value.isEmpty ? null : value;
  }

  double pickDouble(ParsedField<double> field, double fallback) {
    return field.value ?? fallback;
  }

  double roundToPrecision(double value, {int digits = 3}) {
    return double.parse(value.toStringAsFixed(digits));
  }

  double? readNestedDouble(Map<String, dynamic>? root, List<String> path) {
    dynamic current = root;
    for (final segment in path) {
      if (current is Map<String, dynamic>) {
        current = current[segment];
        continue;
      }
      return null;
    }

    if (current is num) {
      return current.toDouble();
    }
    return double.tryParse(current?.toString() ?? '');
  }

  final selectedSupplier = state._draft.supplier?.trim();
  final parsedSupplier = parseResult.supplier?.name.trim();
  final parsedKarat = pickText(parseResult.karat);
  final lockedKarat = state._draft.karat?.trim();
  final appliedKarat = (lockedKarat != null && lockedKarat.isNotEmpty)
      ? lockedKarat
      : (parsedKarat ?? '18K');
  final hasKaratMismatch =
      lockedKarat != null &&
      lockedKarat.isNotEmpty &&
      parsedKarat != null &&
      _scanSessionNormalizeText(parsedKarat) != _scanSessionNormalizeText(lockedKarat);
  final displayRequiresReview = parseResult.displaySnapshot?['requiresReview'] == true;
  final supplierName = (parsedSupplier != null && parsedSupplier.isNotEmpty)
      ? parsedSupplier
      : (selectedSupplier != null && selectedSupplier.isNotEmpty)
          ? selectedSupplier
          : 'Selected supplier';
  final itemCode = pickText(parseResult.itemCode) ?? rawQr.trim();
  final category = pickText(parseResult.category) ?? state._draft.selectedCategory;
  final purity = state._draft.selectedPurity ?? state._draft.originalPurity ?? 75.0;
  final wastage = state._draft.selectedWastage ?? state._draft.resolvedWastageDefault;
  final displaySnapshot = parseResult.displaySnapshot;
  final grossWeight = roundToPrecision(pickDouble(parseResult.grossWeight, 0));
  final stoneWeight = roundToPrecision(pickDouble(parseResult.stoneWeight, 0));
  final otherWeight = roundToPrecision(pickDouble(parseResult.otherWeight, 0));

  var computedStoneAmount = readNestedDouble(displaySnapshot, ['amounts', 'stoneAmount']);
  final lockedStonePrice = state._draft.stonePriceSelected;
  if (computedStoneAmount == null && lockedStonePrice != null && stoneWeight > 0) {
    computedStoneAmount = stoneWeight * lockedStonePrice;
  }
  
  final otherAmount = readNestedDouble(displaySnapshot, ['amounts', 'otherAmount']);
  
  final isDuplicate = state._draft.scannedItems.any(
    (item) =>
        _scanSessionNormalizeText(item.itemCode) == _scanSessionNormalizeText(itemCode) &&
        _scanSessionNormalizeText(item.supplier) == _scanSessionNormalizeText(supplierName),
  );
  final hasSupplierMismatch =
      selectedSupplier != null &&
      parsedSupplier != null &&
      _scanSessionNormalizeText(parsedSupplier) != _scanSessionNormalizeText(selectedSupplier);
  final warnings = <String>[];
  if (parseResult.hasErrors) {
    warnings.add(parseResult.errors.first.reason);
  }
  if (displayRequiresReview) {
    warnings.add('Net mismatch requires review');
  }
  if (hasSupplierMismatch) {
    warnings.add('Supplier mismatch');
  }
  if (hasKaratMismatch) {
    warnings.add('QR Karat Mismatch');
  }
  if (isDuplicate) {
    warnings.add('Duplicate item');
  }

  return ScannedSessionItem(
    id: 'scan-item-${DateTime.now().microsecondsSinceEpoch}',
    itemCode: itemCode,
    supplier: supplierName,
    rawQr: rawQr.trim(),
    category: category,
    jewelType: null,
    qrKarat: parsedKarat,
    karat: appliedKarat,
    purityPercent: purity,
    wastagePercent: wastage,
    grossWeight: grossWeight,
    stoneWeight: stoneWeight,
    otherWeight: otherWeight,
    stoneAmount: computedStoneAmount == null ? null : roundToPrecision(computedStoneAmount, digits: 2),
    otherAmount: otherAmount == null ? null : roundToPrecision(otherAmount, digits: 2),
    msAmount: null,
    ssAmount: null,
    totalStoneAmount: computedStoneAmount == null ? null : roundToPrecision(computedStoneAmount, digits: 2),
    addedAt: DateTime.now(),
    status: 'active',
    isDuplicate: isDuplicate,
    hasSupplierMismatch: hasSupplierMismatch,
    hasKaratMismatch: hasKaratMismatch,
    hasWeightMismatch: displayRequiresReview,
    hasPurityOverride: state._draft.purityIsCustom,
    hasWastageOverride: state._draft.wastageIsCustom,
    requiresReview: displayRequiresReview,
    warningLabel: warnings.isEmpty
        ? null
        : warnings.map(_scanSessionDisplayWarningLabel).join('; '),
  );
}

List<ScannedSessionItem> _scanSessionVisibleScannedItems(
  _ScanSessionScreenState state,
) {
  final query = state._itemSearchController.text.trim().toLowerCase();
  final items = query.isEmpty
      ? state._draft.scannedItems
      : state._draft.scannedItems.where((item) {
          return item.itemCode.toLowerCase().contains(query) ||
              item.supplier.toLowerCase().contains(query) ||
              (item.category ?? '').toLowerCase().contains(query) ||
              (item.jewelType ?? '').toLowerCase().contains(query);
        }).toList(growable: false);
  return items.reversed.toList(growable: false);
}

Future<String?> _scanSessionShowSelectionSheet(
  _ScanSessionScreenState state, {
  required String title,
  required String searchHint,
  required List<String> options,
  required String? selectedValue,
  bool allowCustomValue = false,
  bool customValueIsNumeric = false,
  bool allowClearSelection = false,
  String? customValueHint,
}) {
  return showModalBottomSheet<String>(
    context: state.context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return _SearchChoiceSheet(
        title: title,
        searchHint: searchHint,
        options: options,
        selectedValue: selectedValue,
        allowCustomValue: allowCustomValue,
        customValueIsNumeric: customValueIsNumeric,
        allowClearSelection: allowClearSelection,
        customValueHint: customValueHint,
      );
    },
  );
}

void _scanSessionDiscardDraft(_ScanSessionScreenState state) {
  state._updateDraftState(() {
    state._draft = const ScanSessionDraft(customer: null);
    state._purityController.clear();
    state._wastageController.clear();
    state._itemSearchController.clear();
    state._localValidationMessage = null;
  });
}

void _scanSessionClearItems(_ScanSessionScreenState state) {
  state._updateDraftState(() {
    state._draft = state._draft.copyWith(scannedItems: const <ScannedSessionItem>[]);
  });
}

void _scanSessionRemoveSelectedItems(
  _ScanSessionScreenState state,
  Set<String> selectedIds,
) {
  final remaining = state._draft.scannedItems
      .where((item) => !selectedIds.contains(item.id))
      .toList(growable: false);
  final removedItems = state._draft.scannedItems
      .where((item) => selectedIds.contains(item.id))
      .map(
        (item) => ScannedSessionItem(
          id: item.id,
          itemCode: item.itemCode,
          supplier: item.supplier,
          category: item.category,
          jewelType: item.jewelType,
          qrKarat: item.qrKarat,
          karat: item.karat,
          purityPercent: item.purityPercent,
          wastagePercent: item.wastagePercent,
          grossWeight: item.grossWeight,
          stoneWeight: item.stoneWeight,
          otherWeight: item.otherWeight,
          stoneAmount: item.stoneAmount,
          otherAmount: item.otherAmount,
          msAmount: item.msAmount,
          ssAmount: item.ssAmount,
          totalStoneAmount: item.totalStoneAmount,
          rawQr: item.rawQr,
          addedAt: item.addedAt,
          status: 'removed',
          removedAt: DateTime.now(),
          removedReason: 'Removed from same-day amendment',
          removedBy: 'salesman',
          requiresReview: item.requiresReview,
          hasKaratMismatch: item.hasKaratMismatch,
          isDuplicate: item.isDuplicate,
          hasSupplierMismatch: item.hasSupplierMismatch,
          hasWeightMismatch: item.hasWeightMismatch,
          hasPurityOverride: item.hasPurityOverride,
          hasWastageOverride: item.hasWastageOverride,
          warningLabel: item.warningLabel,
        ),
      )
      .toList(growable: false);

  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      scannedItems: remaining,
      removedItems: <ScannedSessionItem>[...state._draft.removedItems, ...removedItems],
      amendmentCount: state._draft.amendmentCount + 1,
    );
  });
}
Future<void> _scanSessionManualEntry(_ScanSessionScreenState state) async {
  if (!state._draft.isLocked) {
    return;
  }

  final item = await showModalBottomSheet<ScannedSessionItem>(
    context: state.context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return ScanSessionManualEntrySheet(draft: state._draft);
    },
  );

  if (!state.mounted || item == null) {
    return;
  }

  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      scannedItems: <ScannedSessionItem>[
        ...state._draft.scannedItems,
        item,
      ],
    );
  });
}























