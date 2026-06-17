part of 'scan_session_screen.dart';

String _scanSessionNormalizeText(String? value) {
  return (value ?? '').trim().toLowerCase();
}

String? _scanSessionSupplierKeyFor(String? supplier) {
  final normalized = (supplier ?? '').trim().toUpperCase();
  if (normalized.isEmpty) {
    return null;
  }
  if (normalized.contains('YUG')) {
    return 'YUG';
  }
  if (normalized.contains('AADINATH')) {
    return 'Aadinath';
  }
  if (normalized.contains('VENZORA')) {
    return 'Venzora Trading';
  }
  if (normalized.contains('PALAK')) {
    return 'Palak Jewellery';
  }
  return supplier;
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

double? _scanSessionCategoryDefaultWastageFor(String? category) {
  final normalized = (category ?? '').trim().toUpperCase();
  if (normalized.isEmpty) {
    return null;
  }
  return _ScanSessionScreenState._categoryWastageDefaults[normalized];
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

  final supplierKey = _scanSessionSupplierKeyFor(supplier);
  final supplierMatrix = supplierKey == null
      ? null
      : _ScanSessionScreenState._defaultMatrix[supplierKey];
  final matrixEntry = supplierMatrix?[karatLabel];
  final karatPurity =
      matrixEntry?.purity ?? _scanSessionProviderPurityForKarat(state, supplier, karatLabel);
  if (karatPurity == null && matrixEntry == null) {
    return null;
  }

  final categoryDefaultWastage = _scanSessionCategoryDefaultWastageFor(category);
  final supplierDefaultWastage = matrixEntry?.wastage;

  return (
    purity: karatPurity ?? 75.0,
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
  state._draft = state._draft.copyWith(
    purityOriginal: defaults?.purity,
    puritySelected: defaults?.purity,
    clearPurity: defaults == null,
    wastageOriginal: defaults?.wastage,
    wastageSelected: defaults?.wastage,
    clearWastage: defaults == null,
    categoryDefaultWastage: _scanSessionCategoryDefaultWastageFor(state._draft.selectedCategory),
    clearCategoryDefaultWastage: _scanSessionCategoryDefaultWastageFor(state._draft.selectedCategory) == null,
    supplierDefaultWastage: state._draft.karat == null
        ? null
        : (_scanSessionSupplierKeyFor(state._draft.supplier) == null
            ? null
            : _ScanSessionScreenState
                  ._defaultMatrix[_scanSessionSupplierKeyFor(state._draft.supplier)!]?[state
                      ._draft
                      .karat!
                      .toUpperCase()]
                  ?.wastage),
    clearSupplierDefaultWastage: state._draft.karat == null || _scanSessionSupplierKeyFor(state._draft.supplier) == null || _ScanSessionScreenState._defaultMatrix[_scanSessionSupplierKeyFor(state._draft.supplier)!]?[state._draft.karat!.toUpperCase()]?.wastage == null,
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

void _scanSessionSetNotes(_ScanSessionScreenState state, String value) {
  state._draft = state._draft.copyWith(notes: value);
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
  final chosen = await _scanSessionShowSelectionSheet(
    state,
    title: 'Choose category',
    searchHint: 'Search category',
    options: _ScanSessionScreenState._categoryOptions,
    selectedValue: state._draft.selectedCategory,
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
  final chosen = await _scanSessionShowSelectionSheet(
    state,
    title: 'Select Wastage',
    searchHint: 'Search wastage',
    options: _ScanSessionScreenState._wastageOptions,
    selectedValue: state._draft.wastageSelected?.toStringAsFixed(2),
    allowCustomValue: true,
    customValueHint: 'Enter custom wastage',
  );
  if (!state.mounted || chosen == null) {
    return;
  }

  state._wastageController.text = chosen;
  _scanSessionSetWastage(state, chosen);
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

void _scanSessionSimulateScanItem(_ScanSessionScreenState state) {
  if (!state._draft.isLocked) {
    return;
  }

  final sequence = state._draft.totalItems + 1;
  const samples = <({
    String code,
    double gross,
    double stone,
    double other,
    double stoneAmount,
    double? otherAmount,
    double? msAmount,
    double? ssAmount,
    double? totalStoneAmount,
  })>[
    (
      code: 'TGGR-808',
      gross: 5.499,
      stone: 0.000,
      other: 0.000,
      stoneAmount: 0.00,
      otherAmount: null,
      msAmount: null,
      ssAmount: null,
      totalStoneAmount: 0.00,
    ),
    (
      code: 'SWJ-289',
      gross: 7.180,
      stone: 0.174,
      other: 0.000,
      stoneAmount: 0.00,
      otherAmount: null,
      msAmount: null,
      ssAmount: null,
      totalStoneAmount: 0.00,
    ),
    (
      code: 'TCCBJ-167-SIZE23',
      gross: 6.100,
      stone: 0.043,
      other: 0.000,
      stoneAmount: 0.00,
      otherAmount: null,
      msAmount: null,
      ssAmount: null,
      totalStoneAmount: 0.00,
    ),
    (
      code: 'YNGR-136-RF',
      gross: 4.840,
      stone: 0.000,
      other: 0.125,
      stoneAmount: 0.00,
      otherAmount: null,
      msAmount: null,
      ssAmount: null,
      totalStoneAmount: 0.00,
    ),
  ];
  final sample = samples[(sequence - 1) % samples.length];
  final supplierName = state._draft.supplier ?? 'Selected supplier';
  final category = state._draft.selectedCategory;
  final karat = state._draft.karat ?? '18K';
  final purity = state._draft.selectedPurity ?? 75.15;
  final wastage = state._draft.selectedWastage ?? 10.0;
  final item = ScannedSessionItem(
    id: 'scan-item-$sequence',
    itemCode: sample.code,
    supplier: supplierName,
    category: category,
    karat: karat,
    purityPercent: purity,
    wastagePercent: wastage,
    grossWeight: sample.gross,
    stoneWeight: sample.stone,
    otherWeight: sample.other,
    stoneAmount: sample.stoneAmount,
    otherAmount: sample.otherAmount,
    msAmount: sample.msAmount,
    ssAmount: sample.ssAmount,
    totalStoneAmount: sample.totalStoneAmount,
    hasPurityOverride: state._draft.purityIsCustom,
    hasWastageOverride: state._draft.wastageIsCustom,
    warningLabel: state._draft.purityIsCustom || state._draft.wastageIsCustom
        ? 'Custom values applied'
        : null,
  );

  state._updateDraftState(() {
    state._draft = state._draft.copyWith(
      scannedItems: <ScannedSessionItem>[
        ...state._draft.scannedItems,
        item,
      ],
    );
  });
  SystemSound.play(SystemSoundType.click);
  HapticFeedback.selectionClick();
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
        allowClearSelection: allowClearSelection,
        customValueHint: customValueHint,
      );
    },
  );
}
