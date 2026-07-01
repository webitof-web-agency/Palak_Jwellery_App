import '../../customers/domain/customer_record.dart';
import 'scan_session_summary.dart';

enum ScanSessionMode { setup, lockedActiveScanning }

double _roundToPrecision(double value, {int digits = 3}) {
  return double.parse(value.toStringAsFixed(digits));
}

class ScannedSessionItem {
  const ScannedSessionItem({
    required this.id,
    required this.itemCode,
    required this.supplier,
    this.category,
    this.jewelType,
    this.qrKarat,
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
    this.rawQr,
    this.addedAt,
    this.status,
    this.removedAt,
    this.removedReason,
    this.removedBy,
    this.requiresReview = false,
    this.hasKaratMismatch = false,
    this.isDuplicate = false,
    this.hasSupplierMismatch = false,
    this.hasWeightMismatch = false,
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
  // qrKarat preserves what the QR parsed, while karat stays the applied locked setting.
  final String? qrKarat;
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
  final String? rawQr;
  final DateTime? addedAt;
  final String? status;
  final DateTime? removedAt;
  final String? removedReason;
  final String? removedBy;
  final bool requiresReview;
  final bool hasKaratMismatch;
  final bool isDuplicate;
  final bool hasSupplierMismatch;
  final bool hasWeightMismatch;
  final bool hasPurityOverride;
  final bool hasWastageOverride;
  final String? warningLabel;

  bool get isRemoved =>
      removedAt != null || (status ?? '').trim().toLowerCase() == 'removed';

  double get netWeight {
    final net = grossWeight - stoneWeight - otherWeight;
    return net < 0 ? 0 : _roundToPrecision(net);
  }

  double get fineWeight {
    return _roundToPrecision(netWeight * (purityPercent + wastagePercent) / 100);
  }

  bool get hasAnyWarning {
    return warningLabel != null ||
        hasKaratMismatch ||
        isDuplicate ||
        hasSupplierMismatch ||
        hasWeightMismatch ||
        hasPurityOverride ||
        hasWastageOverride ||
        requiresReview;
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'itemCode': itemCode,
      'supplier': supplier,
      'category': category,
      'jewelType': jewelType,
      'qrKarat': qrKarat,
      'karat': karat,
      'purityPercent': purityPercent,
      'wastagePercent': wastagePercent,
      'grossWeight': grossWeight,
      'stoneWeight': stoneWeight,
      'otherWeight': otherWeight,
      'stoneAmount': stoneAmount,
      'otherAmount': otherAmount,
      'msAmount': msAmount,
      'ssAmount': ssAmount,
      'totalStoneAmount': totalStoneAmount,
      'rawQr': rawQr,
      'addedAt': addedAt?.toIso8601String(),
      'status': status,
      'removedAt': removedAt?.toIso8601String(),
      'removedReason': removedReason,
      'removedBy': removedBy,
      'requiresReview': requiresReview,
      'hasKaratMismatch': hasKaratMismatch,
      'isDuplicate': isDuplicate,
      'hasSupplierMismatch': hasSupplierMismatch,
      'hasWeightMismatch': hasWeightMismatch,
      'hasPurityOverride': hasPurityOverride,
      'hasWastageOverride': hasWastageOverride,
      'warningLabel': warningLabel,
    };
  }

  factory ScannedSessionItem.fromJson(Map<String, dynamic> json) {
    double? asDouble(dynamic value) {
      if (value == null) {
        return null;
      }
      if (value is num) {
        return value.toDouble();
      }
      return double.tryParse(value.toString());
    }

    return ScannedSessionItem(
      id: json['id']?.toString() ?? '',
      itemCode: json['itemCode']?.toString() ?? '',
      supplier: json['supplier']?.toString() ?? '',
      category: json['category']?.toString(),
      jewelType: json['jewelType']?.toString(),
      qrKarat: json['qrKarat']?.toString(),
      karat: json['karat']?.toString() ?? '',
      purityPercent: asDouble(json['purityPercent']) ?? 0,
      wastagePercent: asDouble(json['wastagePercent']) ?? 0,
      grossWeight: asDouble(json['grossWeight']) ?? 0,
      stoneWeight: asDouble(json['stoneWeight']) ?? 0,
      otherWeight: asDouble(json['otherWeight']) ?? 0,
      stoneAmount: asDouble(json['stoneAmount']),
      otherAmount: asDouble(json['otherAmount']),
      msAmount: asDouble(json['msAmount']),
      ssAmount: asDouble(json['ssAmount']),
      totalStoneAmount: asDouble(json['totalStoneAmount']),
      rawQr: json['rawQr']?.toString(),
      addedAt: json['addedAt'] == null
          ? null
          : DateTime.tryParse(json['addedAt'].toString()),
      status: json['status']?.toString(),
      removedAt: json['removedAt'] == null
          ? null
          : DateTime.tryParse(json['removedAt'].toString()),
      removedReason: json['removedReason']?.toString(),
      removedBy: json['removedBy']?.toString(),
      requiresReview: json['requiresReview'] == true,
      hasKaratMismatch: json['hasKaratMismatch'] == true,
      isDuplicate: json['isDuplicate'] == true,
      hasSupplierMismatch: json['hasSupplierMismatch'] == true,
      hasWeightMismatch: json['hasWeightMismatch'] == true,
      hasPurityOverride: json['hasPurityOverride'] == true,
      hasWastageOverride: json['hasWastageOverride'] == true,
      warningLabel: json['warningLabel']?.toString(),
    );
  }
}

class ScanSessionWarningCounts {
  const ScanSessionWarningCounts({
    required this.duplicates,
    required this.supplierMismatch,
    required this.karatMismatch,
    required this.weightMismatch,
    required this.customPurityOverrides,
    required this.customWastageOverrides,
  });

  final int duplicates;
  final int supplierMismatch;
  final int karatMismatch;
  final int weightMismatch;
  final int customPurityOverrides;
  final int customWastageOverrides;

  bool get hasAny =>
      duplicates > 0 ||
      supplierMismatch > 0 ||
      karatMismatch > 0 ||
      weightMismatch > 0 ||
      customPurityOverrides > 0 ||
      customWastageOverrides > 0;

  factory ScanSessionWarningCounts.fromItems(List<ScannedSessionItem> items) {
    var duplicates = 0;
    var supplierMismatch = 0;
    var karatMismatch = 0;
    var weightMismatch = 0;
    var customPurityOverrides = 0;
    var customWastageOverrides = 0;

    for (final item in items) {
      if (item.isDuplicate) duplicates++;
      if (item.hasSupplierMismatch) supplierMismatch++;
      if (item.hasKaratMismatch) karatMismatch++;
      if (item.hasWeightMismatch) weightMismatch++;
      if (item.hasPurityOverride) customPurityOverrides++;
      if (item.hasWastageOverride) customWastageOverrides++;
    }

    return ScanSessionWarningCounts(
      duplicates: duplicates,
      supplierMismatch: supplierMismatch,
      karatMismatch: karatMismatch,
      weightMismatch: weightMismatch,
      customPurityOverrides: customPurityOverrides,
      customWastageOverrides: customWastageOverrides,
    );
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
    this.removedItems = const <ScannedSessionItem>[],
    this.notes = '',
    this.mode = ScanSessionMode.setup,
    this.validationMessage,
    this.amendmentSessionId,
    this.amendmentCreatedAt,
    this.amendmentCount = 0,
    this.amendmentOriginalTotalItems = 0,
    this.amendmentOriginalGrossWeight = 0,
    this.amendmentOriginalStoneWeight = 0,
    this.amendmentOriginalOtherWeight = 0,
    this.amendmentOriginalNetWeight = 0,
    this.amendmentOriginalFineWeight = 0,
    this.amendmentOriginalStoneAmount = 0,
    this.amendmentOriginalOtherAmount = 0,
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
  final List<ScannedSessionItem> removedItems;
  final String notes;
  final ScanSessionMode mode;
  final String? validationMessage;
  final String? amendmentSessionId;
  final DateTime? amendmentCreatedAt;
  final int amendmentCount;
  final int amendmentOriginalTotalItems;
  final double amendmentOriginalGrossWeight;
  final double amendmentOriginalStoneWeight;
  final double amendmentOriginalOtherWeight;
  final double amendmentOriginalNetWeight;
  final double amendmentOriginalFineWeight;
  final double amendmentOriginalStoneAmount;
  final double amendmentOriginalOtherAmount;

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
      categoryDefaultWastage ?? supplierDefaultWastage ?? globalDefaultWastage;
  bool get hasScannedItems => scannedItems.isNotEmpty;
  bool get hasAnyWarnings => warningCounts.hasAny;
  bool get isAmendment => amendmentSessionId != null;
  bool get hasAmendmentBaseline => amendmentSessionId != null;
  int get addedItemCount =>
      amendmentSessionId == null
          ? 0
          : (totalItems - amendmentOriginalTotalItems).clamp(0, totalItems).toInt();
  double get addedGrossWeight =>
      amendmentSessionId == null
          ? totalGrossWeight
          : _roundToPrecision((totalGrossWeight - amendmentOriginalGrossWeight).clamp(0, double.infinity));
  double get addedNetWeight =>
      amendmentSessionId == null
          ? totalNetWeight
          : _roundToPrecision((totalNetWeight - amendmentOriginalNetWeight).clamp(0, double.infinity));
  double get addedFineWeight =>
      amendmentSessionId == null
          ? totalFineWeight
          : _roundToPrecision((totalFineWeight - amendmentOriginalFineWeight).clamp(0, double.infinity));

  factory ScanSessionDraft.fromSummary(ScanSessionSummary summary) {
    return ScanSessionDraft(
      customer: summary.customer,
      supplier: summary.lockedSettings.supplier,
      categoryOriginal: summary.lockedSettings.category,
      categorySelected: summary.lockedSettings.category,
      karat: summary.lockedSettings.karat,
      purityOriginal: summary.lockedSettings.selectedPurity ?? summary.lockedSettings.originalPurity,
      puritySelected: summary.lockedSettings.selectedPurity ?? summary.lockedSettings.originalPurity,
      wastageOriginal: summary.lockedSettings.selectedWastage ?? summary.lockedSettings.originalWastage,
      wastageSelected: summary.lockedSettings.selectedWastage ?? summary.lockedSettings.originalWastage,
      scannedItems: summary.items,
      removedItems: summary.removedItems,
      notes: summary.notes,
      mode: ScanSessionMode.lockedActiveScanning,
      amendmentSessionId: summary.sessionId,
      amendmentCreatedAt: summary.createdAt,
      amendmentCount: summary.amendmentCount,
      amendmentOriginalTotalItems: summary.totalItems,
      amendmentOriginalGrossWeight: summary.totalGrossWeight,
      amendmentOriginalStoneWeight: summary.totalStoneWeight,
      amendmentOriginalOtherWeight: summary.totalOtherWeight,
      amendmentOriginalNetWeight: summary.totalNetWeight,
      amendmentOriginalFineWeight: summary.totalFineWeight,
      amendmentOriginalStoneAmount: summary.totalStoneAmount,
      amendmentOriginalOtherAmount: summary.totalOtherAmount,
    );
  }

  int get totalItems => scannedItems.length;

  double get totalGrossWeight =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + item.grossWeight));

  double get totalStoneWeight =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + item.stoneWeight));

  double get totalOtherWeight =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + item.otherWeight));

  double get totalNetWeight =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + item.netWeight));

  double get totalFineWeight =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + item.fineWeight));

  double get totalStoneAmount =>
      _roundToPrecision(scannedItems.fold(
        0,
        (total, item) => total + (item.totalStoneAmount ?? item.stoneAmount ?? 0),
      ));

  double get totalOtherAmount =>
      _roundToPrecision(scannedItems.fold(0, (total, item) => total + (item.otherAmount ?? 0)));

  Map<String, int> get supplierCounts {
    final counts = <String, int>{};
    for (final item in scannedItems) {
      counts[item.supplier] = (counts[item.supplier] ?? 0) + 1;
    }
    return counts;
  }

  List<ScannedSessionItem> get warningItems {
    return scannedItems.where((item) => item.hasAnyWarning).toList(growable: false);
  }

  ScanSessionWarningCounts get warningCounts =>
      ScanSessionWarningCounts.fromItems(scannedItems);

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
    List<ScannedSessionItem>? removedItems,
    String? notes,
    ScanSessionMode? mode,
    String? validationMessage,
    bool clearValidationMessage = false,
    String? amendmentSessionId,
    bool clearAmendmentSessionId = false,
    DateTime? amendmentCreatedAt,
    bool clearAmendmentCreatedAt = false,
    int? amendmentCount,
    int? amendmentOriginalTotalItems,
    double? amendmentOriginalGrossWeight,
    double? amendmentOriginalStoneWeight,
    double? amendmentOriginalOtherWeight,
    double? amendmentOriginalNetWeight,
    double? amendmentOriginalFineWeight,
    double? amendmentOriginalStoneAmount,
    double? amendmentOriginalOtherAmount,
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
      categoryDefaultWastage: clearCategoryDefaultWastage
          ? null
          : (categoryDefaultWastage ?? this.categoryDefaultWastage),
      supplierDefaultWastage: clearSupplierDefaultWastage
          ? null
          : (supplierDefaultWastage ?? this.supplierDefaultWastage),
      globalDefaultWastage: globalDefaultWastage ?? this.globalDefaultWastage,
      scannedItems: scannedItems ?? this.scannedItems,
      removedItems: removedItems ?? this.removedItems,
      notes: notes ?? this.notes,
      mode: mode ?? this.mode,
      validationMessage: clearValidationMessage
          ? null
          : validationMessage ?? this.validationMessage,
      amendmentSessionId: clearAmendmentSessionId
          ? null
          : amendmentSessionId ?? this.amendmentSessionId,
      amendmentCreatedAt: clearAmendmentCreatedAt
          ? null
          : amendmentCreatedAt ?? this.amendmentCreatedAt,
      amendmentCount: amendmentCount ?? this.amendmentCount,
      amendmentOriginalTotalItems:
          amendmentOriginalTotalItems ?? this.amendmentOriginalTotalItems,
      amendmentOriginalGrossWeight:
          amendmentOriginalGrossWeight ?? this.amendmentOriginalGrossWeight,
      amendmentOriginalStoneWeight:
          amendmentOriginalStoneWeight ?? this.amendmentOriginalStoneWeight,
      amendmentOriginalOtherWeight:
          amendmentOriginalOtherWeight ?? this.amendmentOriginalOtherWeight,
      amendmentOriginalNetWeight:
          amendmentOriginalNetWeight ?? this.amendmentOriginalNetWeight,
      amendmentOriginalFineWeight:
          amendmentOriginalFineWeight ?? this.amendmentOriginalFineWeight,
      amendmentOriginalStoneAmount:
          amendmentOriginalStoneAmount ?? this.amendmentOriginalStoneAmount,
      amendmentOriginalOtherAmount:
          amendmentOriginalOtherAmount ?? this.amendmentOriginalOtherAmount,
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

  Map<String, dynamic> toJson() {
    return {
      'customer': customer?.toJson(),
      'supplier': supplier,
      'categoryOriginal': categoryOriginal,
      'categorySelected': categorySelected,
      'karat': karat,
      'purityOriginal': purityOriginal,
      'puritySelected': puritySelected,
      'wastageOriginal': wastageOriginal,
      'wastageSelected': wastageSelected,
      'categoryDefaultWastage': categoryDefaultWastage,
      'supplierDefaultWastage': supplierDefaultWastage,
      'globalDefaultWastage': globalDefaultWastage,
      'scannedItems': scannedItems.map((item) => item.toJson()).toList(growable: false),
      'removedItems': removedItems.map((item) => item.toJson()).toList(growable: false),
      'notes': notes,
      'mode': mode.name,
      'validationMessage': validationMessage,
      'amendmentSessionId': amendmentSessionId,
      'amendmentCreatedAt': amendmentCreatedAt?.toIso8601String(),
      'amendmentCount': amendmentCount,
      'amendmentOriginalTotalItems': amendmentOriginalTotalItems,
      'amendmentOriginalGrossWeight': amendmentOriginalGrossWeight,
      'amendmentOriginalStoneWeight': amendmentOriginalStoneWeight,
      'amendmentOriginalOtherWeight': amendmentOriginalOtherWeight,
      'amendmentOriginalNetWeight': amendmentOriginalNetWeight,
      'amendmentOriginalFineWeight': amendmentOriginalFineWeight,
      'amendmentOriginalStoneAmount': amendmentOriginalStoneAmount,
      'amendmentOriginalOtherAmount': amendmentOriginalOtherAmount,
    };
  }

  factory ScanSessionDraft.fromJson(Map<String, dynamic> json) {
    double? asDouble(dynamic value) {
      if (value == null) {
        return null;
      }
      if (value is num) {
        return value.toDouble();
      }
      return double.tryParse(value.toString());
    }

    final items = (json['scannedItems'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ScannedSessionItem.fromJson)
        .toList(growable: false);

    final removedItemsList = (json['removedItems'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ScannedSessionItem.fromJson)
        .toList(growable: false);

    return ScanSessionDraft(
      customer: json['customer'] is Map<String, dynamic>
          ? CustomerRecord.fromJson(json['customer'] as Map<String, dynamic>)
          : null,
      supplier: json['supplier']?.toString(),
      categoryOriginal: json['categoryOriginal']?.toString(),
      categorySelected: json['categorySelected']?.toString(),
      karat: json['karat']?.toString(),
      purityOriginal: asDouble(json['purityOriginal']),
      puritySelected: asDouble(json['puritySelected']),
      wastageOriginal: asDouble(json['wastageOriginal']),
      wastageSelected: asDouble(json['wastageSelected']),
      categoryDefaultWastage: asDouble(json['categoryDefaultWastage']),
      supplierDefaultWastage: asDouble(json['supplierDefaultWastage']),
      globalDefaultWastage: asDouble(json['globalDefaultWastage']) ?? 10.0,
      scannedItems: items,
      removedItems: removedItemsList,
      notes: json['notes']?.toString() ?? '',
      mode: json['mode']?.toString() == ScanSessionMode.lockedActiveScanning.name
          ? ScanSessionMode.lockedActiveScanning
          : ScanSessionMode.setup,
      validationMessage: json['validationMessage']?.toString(),
      amendmentSessionId: json['amendmentSessionId']?.toString(),
      amendmentCreatedAt: json['amendmentCreatedAt'] == null
          ? null
          : DateTime.tryParse(json['amendmentCreatedAt'].toString()),
      amendmentCount: int.tryParse(json['amendmentCount']?.toString() ?? '') ?? 0,
      amendmentOriginalTotalItems: int.tryParse(json['amendmentOriginalTotalItems']?.toString() ?? '') ?? 0,
      amendmentOriginalGrossWeight: asDouble(json['amendmentOriginalGrossWeight']) ?? 0,
      amendmentOriginalStoneWeight: asDouble(json['amendmentOriginalStoneWeight']) ?? 0,
      amendmentOriginalOtherWeight: asDouble(json['amendmentOriginalOtherWeight']) ?? 0,
      amendmentOriginalNetWeight: asDouble(json['amendmentOriginalNetWeight']) ?? 0,
      amendmentOriginalFineWeight: asDouble(json['amendmentOriginalFineWeight']) ?? 0,
      amendmentOriginalStoneAmount: asDouble(json['amendmentOriginalStoneAmount']) ?? 0,
      amendmentOriginalOtherAmount: asDouble(json['amendmentOriginalOtherAmount']) ?? 0,
    );
  }
}





