import '../../customers/domain/customer_record.dart';
import 'scan_session_draft.dart';
import 'dart:math' as math;

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

class ScanSessionSyncStatus {
  static const localOnly = 'localOnly';
  static const pendingSync = 'pendingSync';
  static const synced = 'synced';
  static const syncFailed = 'syncFailed';
}

class ScanSessionSummary {
  const ScanSessionSummary({
    required this.sessionId,
    required this.clientSessionId,
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
    required this.updatedAt,
    required this.notes,
    this.backendSessionId,
    this.syncStatus = ScanSessionSyncStatus.localOnly,
    this.syncedAt,
    this.syncError,
    this.lastEditedAt,
    this.status = 'active',
    this.amendmentCount = 0,
    this.removedItems = const <ScannedSessionItem>[],
  });

  final String sessionId;
  final String clientSessionId;
  final String? backendSessionId;
  final String syncStatus;
  final DateTime? syncedAt;
  final String? syncError;
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
  final DateTime updatedAt;
  final DateTime? lastEditedAt;
  final String status;
  final int amendmentCount;
  final List<ScannedSessionItem> removedItems;
  final String notes;

  bool get isCancelled => status.trim().toLowerCase() == 'cancelled';

  bool get isSameDayEditable {
    if (isCancelled) {
      return false;
    }
    final now = DateTime.now().toLocal();
    final created = createdAt.toLocal();
    return created.year == now.year && created.month == now.month && created.day == now.day;
  }

  bool get hasAmendmentHistory => amendmentCount > 0 || lastEditedAt != null;

  static double _sumWeight(List<ScannedSessionItem> items, double Function(ScannedSessionItem item) pick) {
    return _roundToPrecision(items.fold(0, (sum, item) => sum + pick(item)));
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

  static ScanSessionSummary _build({
    required String sessionId,
    required String clientSessionId,
    required CustomerRecord? customer,
    required ScanSessionLockedSettings lockedSettings,
    required List<ScannedSessionItem> items,
    required DateTime createdAt,
    required DateTime updatedAt,
    String? backendSessionId,
    String syncStatus = ScanSessionSyncStatus.localOnly,
    DateTime? syncedAt,
    String? syncError,
    DateTime? lastEditedAt,
    String status = 'active',
    int amendmentCount = 0,
    List<ScannedSessionItem> removedItems = const <ScannedSessionItem>[],
    required String notes,
  }) {
    final activeItems = List<ScannedSessionItem>.unmodifiable(items);
    return ScanSessionSummary(
      sessionId: sessionId,
      clientSessionId: clientSessionId,
      backendSessionId: backendSessionId,
      syncStatus: syncStatus,
      syncedAt: syncedAt,
      syncError: syncError,
      customer: customer,
      lockedSettings: lockedSettings,
      items: activeItems,
      totalItems: activeItems.length,
      totalGrossWeight: _sumWeight(activeItems, (item) => item.grossWeight),
      totalStoneWeight: _sumWeight(activeItems, (item) => item.stoneWeight),
      totalOtherWeight: _sumWeight(activeItems, (item) => item.otherWeight),
      totalNetWeight: _sumWeight(activeItems, (item) => item.netWeight),
      totalFineWeight: _sumWeight(activeItems, (item) => item.fineWeight),
      totalStoneAmount: _sumWeight(
        activeItems,
        (item) => item.totalStoneAmount ?? item.stoneAmount ?? 0,
      ),
      totalOtherAmount: _sumWeight(activeItems, (item) => item.otherAmount ?? 0),
      warningCounts: ScanSessionWarningCounts.fromItems(activeItems),
      supplierBreakdown: _supplierBreakdownFromItems(activeItems),
      createdAt: createdAt,
      updatedAt: updatedAt,
      lastEditedAt: lastEditedAt,
      status: status,
      amendmentCount: amendmentCount,
      removedItems: List<ScannedSessionItem>.unmodifiable(removedItems),
      notes: notes,
    );
  }

  factory ScanSessionSummary.fromDraft(
    ScanSessionDraft draft, {
    DateTime? createdAt,
    String? sessionId,
    DateTime? updatedAt,
    DateTime? lastEditedAt,
    String status = 'active',
  }) {
    final now = DateTime.now();
    final created = draft.amendmentCreatedAt ?? createdAt ?? now;
    final effectiveUpdatedAt = updatedAt ?? (draft.isAmendment ? now : created);
    final effectiveLastEditedAt = draft.isAmendment ? (lastEditedAt ?? effectiveUpdatedAt) : lastEditedAt;

    return _build(
      sessionId: draft.amendmentSessionId ?? sessionId ?? now.microsecondsSinceEpoch.toString(),
      clientSessionId: draft.amendmentSessionId ?? sessionId ?? now.microsecondsSinceEpoch.toString(),
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
      items: draft.scannedItems,
      removedItems: draft.removedItems,
      createdAt: created,
      updatedAt: effectiveUpdatedAt,
      lastEditedAt: effectiveLastEditedAt,
      status: status,
      amendmentCount: draft.isAmendment ? draft.amendmentCount + 1 : draft.amendmentCount,
      notes: draft.notes,
    );
  }

  ScanSessionSummary copyWith({
    String? sessionId,
    String? clientSessionId,
    String? backendSessionId,
    String? syncStatus,
    DateTime? syncedAt,
    String? syncError,
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
    DateTime? updatedAt,
    DateTime? lastEditedAt,
    String? status,
    int? amendmentCount,
    List<ScannedSessionItem>? removedItems,
    String? notes,
  }) {
    final shouldRebuild = items != null;
    final effectiveItems = items ?? this.items;
    return ScanSessionSummary(
      sessionId: sessionId ?? this.sessionId,
      clientSessionId: clientSessionId ?? this.clientSessionId,
      backendSessionId: backendSessionId ?? this.backendSessionId,
      syncStatus: syncStatus ?? this.syncStatus,
      syncedAt: syncedAt ?? this.syncedAt,
      syncError: syncError ?? this.syncError,
      customer: customer ?? this.customer,
      lockedSettings: lockedSettings ?? this.lockedSettings,
      items: List<ScannedSessionItem>.unmodifiable(effectiveItems),
      totalItems: shouldRebuild ? effectiveItems.length : totalItems ?? this.totalItems,
      totalGrossWeight: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.grossWeight)
          : totalGrossWeight ?? this.totalGrossWeight,
      totalStoneWeight: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.stoneWeight)
          : totalStoneWeight ?? this.totalStoneWeight,
      totalOtherWeight: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.otherWeight)
          : totalOtherWeight ?? this.totalOtherWeight,
      totalNetWeight: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.netWeight)
          : totalNetWeight ?? this.totalNetWeight,
      totalFineWeight: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.fineWeight)
          : totalFineWeight ?? this.totalFineWeight,
      totalStoneAmount: shouldRebuild
          ? _sumWeight(
              effectiveItems,
              (item) => item.totalStoneAmount ?? item.stoneAmount ?? 0,
            )
          : totalStoneAmount ?? this.totalStoneAmount,
      totalOtherAmount: shouldRebuild
          ? _sumWeight(effectiveItems, (item) => item.otherAmount ?? 0)
          : totalOtherAmount ?? this.totalOtherAmount,
      warningCounts: shouldRebuild ? ScanSessionWarningCounts.fromItems(effectiveItems) : warningCounts ?? this.warningCounts,
      supplierBreakdown: shouldRebuild ? _supplierBreakdownFromItems(effectiveItems) : supplierBreakdown ?? this.supplierBreakdown,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      lastEditedAt: lastEditedAt ?? this.lastEditedAt,
      status: status ?? this.status,
      amendmentCount: amendmentCount ?? this.amendmentCount,
      removedItems: removedItems ?? this.removedItems,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'sessionId': sessionId,
      'clientSessionId': clientSessionId,
      'backendSessionId': backendSessionId,
      'syncStatus': syncStatus,
      'syncedAt': syncedAt?.toIso8601String(),
      'syncError': syncError,
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
      'updatedAt': updatedAt.toIso8601String(),
      'lastEditedAt': lastEditedAt?.toIso8601String(),
      'status': status,
      'amendmentCount': amendmentCount,
      'removedItems': removedItems.map((item) => item.toJson()).toList(growable: false),
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
    final removedItems = (json['removedItems'] as List<dynamic>? ?? const [])
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

    return _build(
      sessionId: json['sessionId']?.toString() ?? DateTime.now().microsecondsSinceEpoch.toString(),
      clientSessionId: json['clientSessionId']?.toString() ?? json['sessionId']?.toString() ?? DateTime.now().microsecondsSinceEpoch.toString(),
      customer: customer,
      lockedSettings: lockedSettings,
      items: items,
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt'] ?? json['createdAt']),
      backendSessionId: json['backendSessionId']?.toString(),
      syncStatus: json['syncStatus']?.toString() ?? ScanSessionSyncStatus.localOnly,
      syncedAt: json['syncedAt'] == null
          ? null
          : DateTime.tryParse(json['syncedAt'].toString()),
      syncError: json['syncError']?.toString(),
      lastEditedAt: json['lastEditedAt'] == null
          ? null
          : DateTime.tryParse(json['lastEditedAt'].toString()),
      status: json['status']?.toString() ?? 'active',
      amendmentCount: int.tryParse(json['amendmentCount']?.toString() ?? '') ?? 0,
      removedItems: removedItems,
      notes: json['notes']?.toString() ?? '',
    );
  }
}


double _roundToPrecision(double value, {int digits = 3}) {
  final factor = math.pow(10, digits);
  return (value * factor).truncateToDouble() / factor;
}








