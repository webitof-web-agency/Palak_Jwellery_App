import '../../customers/domain/customer_record.dart';
import 'scan_session_draft.dart';

class ScanSessionLockedSettings {
  const ScanSessionLockedSettings({
    required this.supplier,
    required this.category,
    required this.karat,
    required this.originalPurity,
    required this.selectedPurity,
    required this.originalWastage,
    required this.selectedWastage,
  });

  final String? supplier;
  final String? category;
  final String? karat;
  final double? originalPurity;
  final double? selectedPurity;
  final double? originalWastage;
  final double? selectedWastage;

  Map<String, dynamic> toJson() {
    return {
      'supplier': supplier,
      'category': category,
      'karat': karat,
      'originalPurity': originalPurity,
      'selectedPurity': selectedPurity,
      'originalWastage': originalWastage,
      'selectedWastage': selectedWastage,
    };
  }

  factory ScanSessionLockedSettings.fromJson(Map<String, dynamic> json) {
    double? asDouble(dynamic value) {
      if (value == null) {
        return null;
      }
      if (value is num) {
        return value.toDouble();
      }
      return double.tryParse(value.toString());
    }

    return ScanSessionLockedSettings(
      supplier: json['supplier']?.toString(),
      category: json['category']?.toString(),
      karat: json['karat']?.toString(),
      originalPurity: asDouble(json['originalPurity']),
      selectedPurity: asDouble(json['selectedPurity']),
      originalWastage: asDouble(json['originalWastage']),
      selectedWastage: asDouble(json['selectedWastage']),
    );
  }
}

class ScanSessionSupplierSummary {
  const ScanSessionSupplierSummary({
    required this.supplier,
    required this.items,
    required this.grossWeight,
    required this.netWeight,
    required this.fineWeight,
  });

  final String supplier;
  final int items;
  final double grossWeight;
  final double netWeight;
  final double fineWeight;
}

class ScanSessionSummary {
  const ScanSessionSummary({
    required this.sessionId,
    required this.customer,
    required this.lockedSettings,
    required this.items,
    required this.totalItems,
    required this.totalGrossWeight,
    required this.totalStoneWeight,
    required this.totalOtherWeight,
    required this.totalNetWeight,
    required this.totalFineWeight,
    required this.totalStoneAmount,
    required this.totalOtherAmount,
    required this.warningCounts,
    required this.supplierBreakdown,
    required this.createdAt,
    required this.notes,
  });

  final String sessionId;
  final CustomerRecord? customer;
  final ScanSessionLockedSettings lockedSettings;
  final List<ScannedSessionItem> items;
  final int totalItems;
  final double totalGrossWeight;
  final double totalStoneWeight;
  final double totalOtherWeight;
  final double totalNetWeight;
  final double totalFineWeight;
  final double totalStoneAmount;
  final double totalOtherAmount;
  final ScanSessionWarningCounts warningCounts;
  final List<ScanSessionSupplierSummary> supplierBreakdown;
  final DateTime createdAt;
  final String notes;

  factory ScanSessionSummary.fromDraft(
    ScanSessionDraft draft, {
    DateTime? createdAt,
    String? sessionId,
  }) {
    final itemsBySupplier = <String, List<ScannedSessionItem>>{};
    for (final item in draft.scannedItems) {
      itemsBySupplier.putIfAbsent(item.supplier, () => <ScannedSessionItem>[]).add(item);
    }

    final supplierBreakdown = itemsBySupplier.entries
        .map(
          (entry) => ScanSessionSupplierSummary(
            supplier: entry.key,
            items: entry.value.length,
            grossWeight: entry.value.fold(0, (sum, item) => sum + item.grossWeight),
            netWeight: entry.value.fold(0, (sum, item) => sum + item.netWeight),
            fineWeight: entry.value.fold(0, (sum, item) => sum + item.fineWeight),
          ),
        )
        .toList(growable: false);

    return ScanSessionSummary(
      sessionId: sessionId ?? DateTime.now().microsecondsSinceEpoch.toString(),
      customer: draft.customer,
      lockedSettings: ScanSessionLockedSettings(
        supplier: draft.supplier,
        category: draft.selectedCategory,
        karat: draft.karat,
        originalPurity: draft.originalPurity,
        selectedPurity: draft.selectedPurity,
        originalWastage: draft.originalWastage,
        selectedWastage: draft.selectedWastage,
      ),
      items: List<ScannedSessionItem>.unmodifiable(draft.scannedItems),
      totalItems: draft.totalItems,
      totalGrossWeight: draft.totalGrossWeight,
      totalStoneWeight: draft.totalStoneWeight,
      totalOtherWeight: draft.totalOtherWeight,
      totalNetWeight: draft.totalNetWeight,
      totalFineWeight: draft.totalFineWeight,
      totalStoneAmount: draft.totalStoneAmount,
      totalOtherAmount: draft.totalOtherAmount,
      warningCounts: draft.warningCounts,
      supplierBreakdown: supplierBreakdown,
      createdAt: createdAt ?? DateTime.now(),
      notes: draft.notes,
    );
  }

  ScanSessionSummary copyWith({
    String? sessionId,
    CustomerRecord? customer,
    ScanSessionLockedSettings? lockedSettings,
    List<ScannedSessionItem>? items,
    int? totalItems,
    double? totalGrossWeight,
    double? totalStoneWeight,
    double? totalOtherWeight,
    double? totalNetWeight,
    double? totalFineWeight,
    double? totalStoneAmount,
    double? totalOtherAmount,
    ScanSessionWarningCounts? warningCounts,
    List<ScanSessionSupplierSummary>? supplierBreakdown,
    DateTime? createdAt,
    String? notes,
  }) {
    return ScanSessionSummary(
      sessionId: sessionId ?? this.sessionId,
      customer: customer ?? this.customer,
      lockedSettings: lockedSettings ?? this.lockedSettings,
      items: items ?? this.items,
      totalItems: totalItems ?? this.totalItems,
      totalGrossWeight: totalGrossWeight ?? this.totalGrossWeight,
      totalStoneWeight: totalStoneWeight ?? this.totalStoneWeight,
      totalOtherWeight: totalOtherWeight ?? this.totalOtherWeight,
      totalNetWeight: totalNetWeight ?? this.totalNetWeight,
      totalFineWeight: totalFineWeight ?? this.totalFineWeight,
      totalStoneAmount: totalStoneAmount ?? this.totalStoneAmount,
      totalOtherAmount: totalOtherAmount ?? this.totalOtherAmount,
      warningCounts: warningCounts ?? this.warningCounts,
      supplierBreakdown: supplierBreakdown ?? this.supplierBreakdown,
      createdAt: createdAt ?? this.createdAt,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'customer': customer?.toJson(),
      'lockedSettings': lockedSettings.toJson(),
      'items': items.map((item) => item.toJson()).toList(growable: false),
      'totalItems': totalItems,
      'totalGrossWeight': totalGrossWeight,
      'totalStoneWeight': totalStoneWeight,
      'totalOtherWeight': totalOtherWeight,
      'totalNetWeight': totalNetWeight,
      'totalFineWeight': totalFineWeight,
      'totalStoneAmount': totalStoneAmount,
      'totalOtherAmount': totalOtherAmount,
      'createdAt': createdAt.toIso8601String(),
      'notes': notes,
    };
  }

  factory ScanSessionSummary.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic value) {
      if (value == null) {
        return DateTime.now();
      }
      return DateTime.tryParse(value.toString()) ?? DateTime.now();
    }

    final items = (json['items'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(ScannedSessionItem.fromJson)
        .toList(growable: false);
    final lockedSettings = json['lockedSettings'] is Map<String, dynamic>
        ? ScanSessionLockedSettings.fromJson(
            json['lockedSettings'] as Map<String, dynamic>,
          )
        : const ScanSessionLockedSettings(
            supplier: null,
            category: null,
            karat: null,
            originalPurity: null,
            selectedPurity: null,
            originalWastage: null,
            selectedWastage: null,
          );
    final customer = json['customer'] is Map<String, dynamic>
        ? CustomerRecord.fromJson(json['customer'] as Map<String, dynamic>)
        : null;

    final summary = ScanSessionSummary(
      sessionId: json['sessionId']?.toString() ?? DateTime.now().microsecondsSinceEpoch.toString(),
      customer: customer,
      lockedSettings: lockedSettings,
      items: List<ScannedSessionItem>.unmodifiable(items),
      totalItems: items.length,
      totalGrossWeight: items.fold(0, (sum, item) => sum + item.grossWeight),
      totalStoneWeight: items.fold(0, (sum, item) => sum + item.stoneWeight),
      totalOtherWeight: items.fold(0, (sum, item) => sum + item.otherWeight),
      totalNetWeight: items.fold(0, (sum, item) => sum + item.netWeight),
      totalFineWeight: items.fold(0, (sum, item) => sum + item.fineWeight),
      totalStoneAmount: items.fold(
        0,
        (sum, item) => sum + (item.totalStoneAmount ?? item.stoneAmount ?? 0),
      ),
      totalOtherAmount: items.fold(0, (sum, item) => sum + (item.otherAmount ?? 0)),
      warningCounts: ScanSessionWarningCounts.fromItems(items),
      supplierBreakdown: _supplierBreakdownFromItems(items),
      createdAt: parseDate(json['createdAt']),
      notes: json['notes']?.toString() ?? '',
    );
    return summary;
  }

  static List<ScanSessionSupplierSummary> _supplierBreakdownFromItems(
    List<ScannedSessionItem> items,
  ) {
    final itemsBySupplier = <String, List<ScannedSessionItem>>{};
    for (final item in items) {
      itemsBySupplier.putIfAbsent(item.supplier, () => <ScannedSessionItem>[]).add(item);
    }

    return itemsBySupplier.entries
        .map(
          (entry) => ScanSessionSupplierSummary(
            supplier: entry.key,
            items: entry.value.length,
            grossWeight: entry.value.fold(0, (sum, item) => sum + item.grossWeight),
            netWeight: entry.value.fold(0, (sum, item) => sum + item.netWeight),
            fineWeight: entry.value.fold(0, (sum, item) => sum + item.fineWeight),
          ),
        )
        .toList(growable: false);
  }
}
