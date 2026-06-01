Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return null;
}

List<dynamic> _asList(dynamic value) {
  if (value is List) {
    return value;
  }
  return const [];
}

String? _asText(dynamic value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

bool _asBool(dynamic value) {
  return value == true;
}

int _asInt(dynamic value, {int fallback = 0}) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value.trim()) ?? fallback;
  }
  return fallback;
}

double _asDouble(dynamic value, {double fallback = 0}) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value.trim()) ?? fallback;
  }
  return fallback;
}

DateTime? _asDate(dynamic value) {
  if (value == null) {
    return null;
  }
  if (value is DateTime) {
    return value;
  }
  final parsed = DateTime.tryParse(value.toString());
  if (parsed == null) {
    return null;
  }
  return parsed.toLocal();
}

String? _resolveId(dynamic value) {
  final map = _asMap(value);
  if (map != null) {
    return _resolveId(map['_id'] ?? map['id']);
  }
  return _asText(value);
}

class BatchUserSummary {
  const BatchUserSummary({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.isActive,
  });

  final String? id;
  final String? name;
  final String? email;
  final String? phone;
  final String? role;
  final bool? isActive;

  factory BatchUserSummary.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return BatchUserSummary(
        id: _resolveId(json),
        name: null,
        email: null,
        phone: null,
        role: null,
        isActive: null,
      );
    }

    return BatchUserSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      name: _asText(data['name']),
      email: _asText(data['email']),
      phone: _asText(data['phone']),
      role: _asText(data['role']),
      isActive: data['isActive'] is bool ? data['isActive'] as bool : null,
    );
  }
}

class BatchSupplierSummary {
  const BatchSupplierSummary({
    required this.id,
    required this.name,
    required this.code,
    required this.isActive,
  });

  final String? id;
  final String? name;
  final String? code;
  final bool? isActive;

  factory BatchSupplierSummary.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return BatchSupplierSummary(
        id: _resolveId(json),
        name: null,
        code: null,
        isActive: null,
      );
    }

    return BatchSupplierSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      name: _asText(data['name']),
      code: _asText(data['code']),
      isActive: data['isActive'] is bool ? data['isActive'] as bool : null,
    );
  }
}

class BatchTotals {
  const BatchTotals({
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    required this.netWeight,
    required this.fineWeight,
    required this.stoneAmount,
  });

  final double grossWeight;
  final double stoneWeight;
  final double otherWeight;
  final double netWeight;
  final double fineWeight;
  final double stoneAmount;

  factory BatchTotals.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return const BatchTotals(
        grossWeight: 0,
        stoneWeight: 0,
        otherWeight: 0,
        netWeight: 0,
        fineWeight: 0,
        stoneAmount: 0,
      );
    }

    return BatchTotals(
      grossWeight: _asDouble(data['grossWeight']),
      stoneWeight: _asDouble(data['stoneWeight']),
      otherWeight: _asDouble(data['otherWeight']),
      netWeight: _asDouble(data['netWeight']),
      fineWeight: _asDouble(data['fineWeight']),
      stoneAmount: _asDouble(data['stoneAmount']),
    );
  }
}

class BatchRevisionSummary {
  const BatchRevisionSummary({
    required this.revision,
    required this.status,
    required this.totals,
    required this.itemCount,
    required this.warningsCount,
    required this.reviewCount,
    required this.duplicateCount,
    required this.manualOverrideCount,
    required this.saleCount,
    required this.entryMode,
    required this.submittedAt,
    required this.submittedBy,
    required this.finalizedAt,
    required this.finalizedBy,
    required this.reopenedAt,
    required this.reopenedBy,
    required this.reopenReason,
    required this.exportsCount,
  });

  final int revision;
  final String status;
  final BatchTotals totals;
  final int itemCount;
  final int warningsCount;
  final int reviewCount;
  final int duplicateCount;
  final int manualOverrideCount;
  final int saleCount;
  final String? entryMode;
  final DateTime? submittedAt;
  final BatchUserSummary? submittedBy;
  final DateTime? finalizedAt;
  final BatchUserSummary? finalizedBy;
  final DateTime? reopenedAt;
  final BatchUserSummary? reopenedBy;
  final String? reopenReason;
  final int exportsCount;

  factory BatchRevisionSummary.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return BatchRevisionSummary(
      revision: _asInt(data['revision'], fallback: 1),
      status: _asText(data['status']) ?? 'finalized',
      totals: BatchTotals.fromJson(data['totals']),
      itemCount: _asInt(data['itemCount']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      saleCount: _asInt(
        data['saleCount'],
        fallback: _asList(data['saleIds']).length,
      ),
      entryMode: _asText(data['entryMode']),
      submittedAt: _asDate(data['submittedAt']),
      submittedBy: _asMap(data['submittedBy']) != null
          ? BatchUserSummary.fromJson(data['submittedBy'])
          : null,
      finalizedAt: _asDate(data['finalizedAt']),
      finalizedBy: _asMap(data['finalizedBy']) != null
          ? BatchUserSummary.fromJson(data['finalizedBy'])
          : null,
      reopenedAt: _asDate(data['reopenedAt']),
      reopenedBy: _asMap(data['reopenedBy']) != null
          ? BatchUserSummary.fromJson(data['reopenedBy'])
          : null,
      reopenReason: _asText(data['reopenReason']),
      exportsCount: _asInt(
        data['exportsCount'],
        fallback: _asList(data['exports']).length,
      ),
    );
  }
}

class BatchItemSummary {
  const BatchItemSummary({
    required this.id,
    required this.ref,
    required this.batchId,
    required this.revisionAdded,
    required this.entryMode,
    required this.addedBy,
    required this.addedAt,
    required this.supplier,
    required this.salesman,
    required this.category,
    required this.itemCode,
    required this.metalType,
    required this.purity,
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    required this.netWeight,
    required this.fineWeight,
    required this.ratePerGram,
    required this.totalValue,
    required this.isDuplicate,
    required this.wasManuallyEdited,
    required this.qrRaw,
    required this.settlementInputs,
    required this.calculationSnapshot,
    required this.parsedSnapshot,
    required this.saleDate,
    required this.createdAt,
    required this.updatedAt,
  });

  final String? id;
  final String ref;
  final String? batchId;
  final int? revisionAdded;
  final String? entryMode;
  final BatchUserSummary? addedBy;
  final DateTime? addedAt;
  final BatchSupplierSummary? supplier;
  final BatchUserSummary? salesman;
  final String? category;
  final String? itemCode;
  final String? metalType;
  final String? purity;
  final double? grossWeight;
  final double? stoneWeight;
  final double? otherWeight;
  final double? netWeight;
  final double? fineWeight;
  final double? ratePerGram;
  final double? totalValue;
  final bool isDuplicate;
  final bool wasManuallyEdited;
  final String? qrRaw;
  final Map<String, dynamic>? settlementInputs;
  final Map<String, dynamic>? calculationSnapshot;
  final Map<String, dynamic>? parsedSnapshot;
  final DateTime? saleDate;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory BatchItemSummary.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return BatchItemSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      ref: _asText(data['ref']) ?? '',
      batchId: _resolveId(data['batchId']),
      revisionAdded: data['revisionAdded'] == null
          ? null
          : _asInt(data['revisionAdded']),
      entryMode: _asText(data['entryMode']),
      addedBy: _asMap(data['addedBy']) != null
          ? BatchUserSummary.fromJson(data['addedBy'])
          : null,
      addedAt: _asDate(data['addedAt']),
      supplier: _asMap(data['supplier']) != null
          ? BatchSupplierSummary.fromJson(data['supplier'])
          : null,
      salesman: _asMap(data['salesman']) != null
          ? BatchUserSummary.fromJson(data['salesman'])
          : null,
      category: _asText(data['category']),
      itemCode: _asText(data['itemCode']),
      metalType: _asText(data['metalType']),
      purity: _asText(data['purity']),
      grossWeight: data['grossWeight'] == null
          ? null
          : _asDouble(data['grossWeight']),
      stoneWeight: data['stoneWeight'] == null
          ? null
          : _asDouble(data['stoneWeight']),
      otherWeight: data['otherWeight'] == null
          ? null
          : _asDouble(data['otherWeight']),
      netWeight: data['netWeight'] == null
          ? null
          : _asDouble(data['netWeight']),
      fineWeight: data['fineWeight'] == null
          ? null
          : _asDouble(data['fineWeight']),
      ratePerGram: data['ratePerGram'] == null
          ? null
          : _asDouble(data['ratePerGram']),
      totalValue: data['totalValue'] == null
          ? null
          : _asDouble(data['totalValue']),
      isDuplicate: _asBool(data['isDuplicate']),
      wasManuallyEdited: _asBool(data['wasManuallyEdited']),
      qrRaw: _asText(data['qrRaw']),
      settlementInputs: _asMap(data['settlementInputs']),
      calculationSnapshot: _asMap(data['calculationSnapshot']),
      parsedSnapshot: _asMap(data['parsedSnapshot']),
      saleDate: _asDate(data['saleDate']),
      createdAt: _asDate(data['createdAt']),
      updatedAt: _asDate(data['updatedAt']),
    );
  }
}

class BatchListItem {
  const BatchListItem({
    required this.id,
    required this.batchRef,
    required this.supplier,
    required this.supplierCode,
    required this.salesman,
    required this.assignedSalesman,
    required this.status,
    required this.revision,
    required this.entryMode,
    required this.itemCount,
    required this.totals,
    required this.warningsCount,
    required this.reviewCount,
    required this.duplicateCount,
    required this.manualOverrideCount,
    required this.customerName,
    required this.customerPhone,
    required this.referenceNote,
    required this.createdBy,
    required this.submittedAt,
    required this.finalizedAt,
    required this.reopenedAt,
    required this.reopenReason,
    required this.createdAt,
    required this.updatedAt,
  });

  final String? id;
  final String batchRef;
  final BatchSupplierSummary? supplier;
  final String? supplierCode;
  final BatchUserSummary? salesman;
  final BatchUserSummary? assignedSalesman;
  final String status;
  final int revision;
  final String? entryMode;
  final int itemCount;
  final BatchTotals totals;
  final int warningsCount;
  final int reviewCount;
  final int duplicateCount;
  final int manualOverrideCount;
  final String customerName;
  final String customerPhone;
  final String referenceNote;
  final BatchUserSummary? createdBy;
  final DateTime? submittedAt;
  final DateTime? finalizedAt;
  final DateTime? reopenedAt;
  final String? reopenReason;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory BatchListItem.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return BatchListItem(
      id: _resolveId(data['_id'] ?? data['id']),
      batchRef: _asText(data['batchRef']) ?? '',
      supplier: _asMap(data['supplier']) != null
          ? BatchSupplierSummary.fromJson(data['supplier'])
          : null,
      supplierCode: _asText(data['supplierCode']),
      salesman: _asMap(data['salesman']) != null
          ? BatchUserSummary.fromJson(data['salesman'])
          : null,
      assignedSalesman: _asMap(data['assignedSalesman']) != null
          ? BatchUserSummary.fromJson(data['assignedSalesman'])
          : null,
      status: _asText(data['status']) ?? 'draft',
      revision: _asInt(data['revision'], fallback: 1),
      entryMode: _asText(data['entryMode']),
      itemCount: _asInt(data['itemCount']),
      totals: BatchTotals.fromJson(data['totals']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      customerName: _asText(data['customerName']) ?? '',
      customerPhone: _asText(data['customerPhone']) ?? '',
      referenceNote: _asText(data['referenceNote']) ?? '',
      createdBy: _asMap(data['createdBy']) != null
          ? BatchUserSummary.fromJson(data['createdBy'])
          : null,
      submittedAt: _asDate(data['submittedAt']),
      finalizedAt: _asDate(data['finalizedAt']),
      reopenedAt: _asDate(data['reopenedAt']),
      reopenReason: _asText(data['reopenReason']),
      createdAt: _asDate(data['createdAt']),
      updatedAt: _asDate(data['updatedAt']),
    );
  }
}

class BatchDetail extends BatchListItem {
  const BatchDetail({
    required super.id,
    required super.batchRef,
    required super.supplier,
    required super.supplierCode,
    required super.salesman,
    required super.assignedSalesman,
    required super.status,
    required super.revision,
    required super.entryMode,
    required super.itemCount,
    required super.totals,
    required super.warningsCount,
    required super.reviewCount,
    required super.duplicateCount,
    required super.manualOverrideCount,
    required super.customerName,
    required super.customerPhone,
    required super.referenceNote,
    required super.createdBy,
    required super.submittedAt,
    required this.submittedBy,
    required super.finalizedAt,
    required this.finalizedBy,
    required super.reopenedAt,
    required this.reopenedBy,
    required super.reopenReason,
    required super.createdAt,
    required super.updatedAt,
    required this.currentRevision,
    required this.revisionHistory,
    required this.items,
  });

  final BatchUserSummary? submittedBy;
  final BatchUserSummary? finalizedBy;
  final BatchUserSummary? reopenedBy;
  final BatchRevisionSummary? currentRevision;
  final List<BatchRevisionSummary> revisionHistory;
  final List<BatchItemSummary> items;

  factory BatchDetail.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return BatchDetail(
      id: _resolveId(data['_id'] ?? data['id']),
      batchRef: _asText(data['batchRef']) ?? '',
      supplier: _asMap(data['supplier']) != null
          ? BatchSupplierSummary.fromJson(data['supplier'])
          : null,
      supplierCode: _asText(data['supplierCode']),
      salesman: _asMap(data['salesman']) != null
          ? BatchUserSummary.fromJson(data['salesman'])
          : null,
      assignedSalesman: _asMap(data['assignedSalesman']) != null
          ? BatchUserSummary.fromJson(data['assignedSalesman'])
          : null,
      status: _asText(data['status']) ?? 'draft',
      revision: _asInt(data['revision'], fallback: 1),
      entryMode: _asText(data['entryMode']),
      itemCount: _asInt(data['itemCount']),
      totals: BatchTotals.fromJson(data['totals']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      customerName: _asText(data['customerName']) ?? '',
      customerPhone: _asText(data['customerPhone']) ?? '',
      referenceNote: _asText(data['referenceNote']) ?? '',
      createdBy: _asMap(data['createdBy']) != null
          ? BatchUserSummary.fromJson(data['createdBy'])
          : null,
      submittedAt: _asDate(data['submittedAt']),
      submittedBy: _asMap(data['submittedBy']) != null
          ? BatchUserSummary.fromJson(data['submittedBy'])
          : null,
      finalizedAt: _asDate(data['finalizedAt']),
      finalizedBy: _asMap(data['finalizedBy']) != null
          ? BatchUserSummary.fromJson(data['finalizedBy'])
          : null,
      reopenedAt: _asDate(data['reopenedAt']),
      reopenedBy: _asMap(data['reopenedBy']) != null
          ? BatchUserSummary.fromJson(data['reopenedBy'])
          : null,
      reopenReason: _asText(data['reopenReason']),
      createdAt: _asDate(data['createdAt']),
      updatedAt: _asDate(data['updatedAt']),
      currentRevision: _asMap(data['currentRevision']) != null
          ? BatchRevisionSummary.fromJson(data['currentRevision'])
          : null,
      revisionHistory: _asList(data['revisionHistory'])
          .whereType<dynamic>()
          .map(BatchRevisionSummary.fromJson)
          .toList(growable: false),
      items: _asList(data['items'])
          .whereType<dynamic>()
          .map(BatchItemSummary.fromJson)
          .toList(growable: false),
    );
  }
}

class BatchRevisionsResponse {
  const BatchRevisionsResponse({
    required this.id,
    required this.batchRef,
    required this.status,
    required this.revision,
    required this.currentRevision,
    required this.revisionHistory,
  });

  final String? id;
  final String batchRef;
  final String status;
  final int revision;
  final BatchRevisionSummary? currentRevision;
  final List<BatchRevisionSummary> revisionHistory;

  factory BatchRevisionsResponse.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return BatchRevisionsResponse(
      id: _resolveId(data['_id'] ?? data['id']),
      batchRef: _asText(data['batchRef']) ?? '',
      status: _asText(data['status']) ?? 'draft',
      revision: _asInt(data['revision'], fallback: 1),
      currentRevision: _asMap(data['currentRevision']) != null
          ? BatchRevisionSummary.fromJson(data['currentRevision'])
          : null,
      revisionHistory: _asList(data['revisionHistory'])
          .whereType<dynamic>()
          .map(BatchRevisionSummary.fromJson)
          .toList(growable: false),
    );
  }
}

class BatchListPage {
  const BatchListPage({
    required this.batches,
    required this.total,
    required this.page,
    required this.pages,
    required this.limit,
    required this.sortBy,
    required this.sortOrder,
  });

  final List<BatchListItem> batches;
  final int total;
  final int page;
  final int pages;
  final int limit;
  final String sortBy;
  final String sortOrder;

  factory BatchListPage.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    final parsedPages = _asInt(data['pages'], fallback: 1);
    return BatchListPage(
      batches: _asList(data['batches'])
          .whereType<dynamic>()
          .map(BatchListItem.fromJson)
          .toList(growable: false),
      total: _asInt(data['total']),
      page: _asInt(data['page'], fallback: 1),
      pages: parsedPages < 1 ? 1 : parsedPages,
      limit: _asInt(data['limit'], fallback: 20),
      sortBy: _asText(data['sortBy']) ?? 'updatedAt',
      sortOrder: _asText(data['sortOrder']) ?? 'desc',
    );
  }
}
