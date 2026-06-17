import '../../customers/domain/customer_record.dart';

enum ScanSessionMode { setup, lockedActiveScanning }

class ScannedSessionItem {
  const ScannedSessionItem({
    required this.id,
    required this.itemCode,
    required this.supplier,
    this.category,
    this.jewelType,
    required this.karat,
    required this.purityPercent,
    required this.wastagePercent,
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    this.stoneAmount,
    this.otherAmount,
    this.msAmount,
    this.ssAmount,
    this.totalStoneAmount,
    this.hasPurityOverride = false,
    this.hasWastageOverride = false,
    this.warningLabel,
  });

  final String id;
  final String itemCode;
  final String supplier;
  // Future parser formats may provide both a broad category and a more
  // specific jewel type at item level.
  final String? category;
  final String? jewelType;
  final String karat;
  final double purityPercent;
  final double wastagePercent;
  final double grossWeight;
  final double stoneWeight;
  final double otherWeight;
  final double? stoneAmount;
  final double? otherAmount;
  final double? msAmount;
  final double? ssAmount;
  final double? totalStoneAmount;
  final bool hasPurityOverride;
  final bool hasWastageOverride;
  final String? warningLabel;

  double get netWeight {
    final net = grossWeight - stoneWeight - otherWeight;
    return net < 0 ? 0 : net;
  }

  double get fineWeight {
    return netWeight * (purityPercent + wastagePercent) / 100;
  }
}

class ScanSessionDraft {
  const ScanSessionDraft({
    required this.customer,
    this.supplier,
    this.categoryOriginal,
    this.categorySelected,
    this.karat,
    this.purityOriginal,
    this.puritySelected,
    this.wastageOriginal,
    this.wastageSelected,
    this.categoryDefaultWastage,
    this.supplierDefaultWastage,
    this.globalDefaultWastage = 10.0,
    this.scannedItems = const <ScannedSessionItem>[],
    this.notes = '',
    this.mode = ScanSessionMode.setup,
    this.validationMessage,
  });

  final CustomerRecord? customer;
  final String? supplier;
  final String? categoryOriginal;
  final String? categorySelected;
  final String? karat;
  final double? purityOriginal;
  final double? puritySelected;
  final double? wastageOriginal;
  final double? wastageSelected;
  // Future fallback order: custom selected -> category default -> supplier default -> global fallback.
  final double? categoryDefaultWastage;
  final double? supplierDefaultWastage;
  final double globalDefaultWastage;
  final List<ScannedSessionItem> scannedItems;
  final String notes;
  final ScanSessionMode mode;
  final String? validationMessage;

  bool get hasCustomer => customer != null;
  bool get isLocked => mode == ScanSessionMode.lockedActiveScanning;
  String? get selectedCategory => categorySelected ?? categoryOriginal;
  bool get purityIsCustom =>
      purityOriginal != null &&
      puritySelected != null &&
      purityOriginal!.toStringAsFixed(2) != puritySelected!.toStringAsFixed(2);
  double? get originalPurity => purityOriginal;
  double? get selectedPurity => puritySelected;
  bool get wastageIsCustom =>
      wastageOriginal != null &&
      wastageSelected != null &&
      wastageOriginal!.toStringAsFixed(2) != wastageSelected!.toStringAsFixed(2);
  double? get originalWastage => wastageOriginal;
  double? get selectedWastage => wastageSelected;
  double get resolvedWastageDefault =>
      categoryDefaultWastage ??
      supplierDefaultWastage ??
      globalDefaultWastage;
  bool get hasScannedItems => scannedItems.isNotEmpty;
  int get totalItems => scannedItems.length;
  double get totalGrossWeight =>
      scannedItems.fold(0, (total, item) => total + item.grossWeight);
  double get totalStoneWeight =>
      scannedItems.fold(0, (total, item) => total + item.stoneWeight);
  double get totalOtherWeight =>
      scannedItems.fold(0, (total, item) => total + item.otherWeight);
  double get totalNetWeight =>
      scannedItems.fold(0, (total, item) => total + item.netWeight);
  double get totalFineWeight =>
      scannedItems.fold(0, (total, item) => total + item.fineWeight);
  double get totalStoneAmount =>
      scannedItems.fold(
        0,
        (total, item) => total + (item.totalStoneAmount ?? item.stoneAmount ?? 0),
      );
  double get totalOtherAmount =>
      scannedItems.fold(0, (total, item) => total + (item.otherAmount ?? 0));
  Map<String, int> get supplierCounts {
    final counts = <String, int>{};
    for (final item in scannedItems) {
      counts[item.supplier] = (counts[item.supplier] ?? 0) + 1;
    }
    return counts;
  }

  ScanSessionDraft copyWith({
    CustomerRecord? customer,
    String? supplier,
    bool clearSupplier = false,
    String? categoryOriginal,
    String? categorySelected,
    bool clearCategory = false,
    String? karat,
    bool clearKarat = false,
    double? purityOriginal,
    double? puritySelected,
    bool clearPurity = false,
    double? wastageOriginal,
    double? wastageSelected,
    bool clearWastage = false,
    double? categoryDefaultWastage,
    bool clearCategoryDefaultWastage = false,
    double? supplierDefaultWastage,
    bool clearSupplierDefaultWastage = false,
    double? globalDefaultWastage,
    List<ScannedSessionItem>? scannedItems,
    String? notes,
    ScanSessionMode? mode,
    String? validationMessage,
    bool clearValidationMessage = false,
  }) {
    return ScanSessionDraft(
      customer: customer ?? this.customer,
      supplier: clearSupplier ? null : (supplier ?? this.supplier),
      categoryOriginal: clearCategory ? null : (categoryOriginal ?? this.categoryOriginal),
      categorySelected: clearCategory ? null : (categorySelected ?? this.categorySelected),
      karat: clearKarat ? null : (karat ?? this.karat),
      purityOriginal: clearPurity ? null : (purityOriginal ?? this.purityOriginal),
      puritySelected: clearPurity ? null : (puritySelected ?? this.puritySelected),
      wastageOriginal: clearWastage ? null : (wastageOriginal ?? this.wastageOriginal),
      wastageSelected: clearWastage ? null : (wastageSelected ?? this.wastageSelected),
      categoryDefaultWastage: clearCategoryDefaultWastage ? null : (categoryDefaultWastage ?? this.categoryDefaultWastage),
      supplierDefaultWastage: clearSupplierDefaultWastage ? null : (supplierDefaultWastage ?? this.supplierDefaultWastage),
      globalDefaultWastage: globalDefaultWastage ?? this.globalDefaultWastage,
      scannedItems: scannedItems ?? this.scannedItems,
      notes: notes ?? this.notes,
      mode: mode ?? this.mode,
      validationMessage: clearValidationMessage
          ? null
          : validationMessage ?? this.validationMessage,
    );
  }

  String? validateForLock() {
    if (!hasCustomer) {
      return 'Choose a customer first.';
    }
    if ((supplier ?? '').trim().isEmpty) {
      return 'Select a supplier.';
    }
    if ((karat ?? '').trim().isEmpty) {
      return 'Select a karat.';
    }
    if (puritySelected == null) {
      return 'Enter a purity percentage.';
    }
    if (wastageSelected == null) {
      return 'Enter a wastage percentage.';
    }
    return null;
  }
}
