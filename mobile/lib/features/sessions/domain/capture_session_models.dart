String? _asText(dynamic value) {
  if (value == null) {
    return null;
  }

  final text = value.toString().trim();
  return text.isEmpty ? null : text;
}

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

String _resolveId(dynamic value) {
  final data = _asMap(value);
  if (data != null) {
    return _resolveId(data['_id'] ?? data['id']);
  }

  final text = _asText(value);
  return text ?? '';
}

int _asInt(dynamic value, {int fallback = 0}) {
  if (value == null) {
    return fallback;
  }
  if (value is num) {
    return value.toInt();
  }
  return int.tryParse(value.toString()) ?? fallback;
}

double _asDouble(dynamic value, {double fallback = 0}) {
  if (value == null) {
    return fallback;
  }
  if (value is num) {
    return value.toDouble();
  }
  return double.tryParse(value.toString()) ?? fallback;
}

DateTime? _asDate(dynamic value) {
  if (value == null) {
    return null;
  }

  final text = value.toString();
  if (text.isEmpty) {
    return null;
  }

  return DateTime.tryParse(text);
}

class CaptureSessionUserSummary {
  const CaptureSessionUserSummary({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.isActive,
  });

  final String id;
  final String? name;
  final String? email;
  final String? phone;
  final String? role;
  final bool? isActive;

  factory CaptureSessionUserSummary.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return CaptureSessionUserSummary(
        id: _resolveId(json),
        name: null,
        email: null,
        phone: null,
        role: null,
        isActive: null,
      );
    }

    return CaptureSessionUserSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      name: _asText(data['name']),
      email: _asText(data['email']),
      phone: _asText(data['phone']),
      role: _asText(data['role']),
      isActive: data['isActive'] is bool ? data['isActive'] as bool : null,
    );
  }
}

class CaptureSessionSupplierSummary {
  const CaptureSessionSupplierSummary({
    required this.id,
    required this.name,
    required this.code,
    required this.isActive,
  });

  final String id;
  final String? name;
  final String? code;
  final bool? isActive;

  factory CaptureSessionSupplierSummary.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return CaptureSessionSupplierSummary(
        id: _resolveId(json),
        name: null,
        code: null,
        isActive: null,
      );
    }

    return CaptureSessionSupplierSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      name: _asText(data['name']),
      code: _asText(data['code']),
      isActive: data['isActive'] is bool ? data['isActive'] as bool : null,
    );
  }
}

class CaptureSessionTotals {
  const CaptureSessionTotals({
    required this.supplierCount,
    required this.itemCount,
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    required this.netWeight,
    required this.fineWeight,
    required this.stoneAmount,
  });

  final int supplierCount;
  final int itemCount;
  final double grossWeight;
  final double stoneWeight;
  final double otherWeight;
  final double netWeight;
  final double fineWeight;
  final double stoneAmount;

  factory CaptureSessionTotals.fromJson(dynamic json) {
    final data = _asMap(json);
    if (data == null) {
      return const CaptureSessionTotals(
        supplierCount: 0,
        itemCount: 0,
        grossWeight: 0,
        stoneWeight: 0,
        otherWeight: 0,
        netWeight: 0,
        fineWeight: 0,
        stoneAmount: 0,
      );
    }

    return CaptureSessionTotals(
      supplierCount: _asInt(data['supplierCount']),
      itemCount: _asInt(data['itemCount']),
      grossWeight: _asDouble(data['grossWeight']),
      stoneWeight: _asDouble(data['stoneWeight']),
      otherWeight: _asDouble(data['otherWeight']),
      netWeight: _asDouble(data['netWeight']),
      fineWeight: _asDouble(data['fineWeight']),
      stoneAmount: _asDouble(data['stoneAmount']),
    );
  }
}

class CaptureSessionBatchSummary {
  const CaptureSessionBatchSummary({
    required this.id,
    required this.batchRef,
    required this.supplier,
    required this.assignedSalesman,
    required this.status,
    required this.revision,
    required this.itemCount,
    required this.totals,
    required this.warningsCount,
    required this.reviewCount,
    required this.duplicateCount,
    required this.manualOverrideCount,
    required this.createdAt,
    required this.submittedAt,
    required this.finalizedAt,
    required this.reopenedAt,
    required this.reopenReason,
  });

  final String id;
  final String batchRef;
  final CaptureSessionSupplierSummary? supplier;
  final CaptureSessionUserSummary? assignedSalesman;
  final String status;
  final int revision;
  final int itemCount;
  final CaptureSessionTotals totals;
  final int warningsCount;
  final int reviewCount;
  final int duplicateCount;
  final int manualOverrideCount;
  final DateTime? createdAt;
  final DateTime? submittedAt;
  final DateTime? finalizedAt;
  final DateTime? reopenedAt;
  final String? reopenReason;

  factory CaptureSessionBatchSummary.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return CaptureSessionBatchSummary(
      id: _resolveId(data['_id'] ?? data['id']),
      batchRef: _asText(data['batchRef']) ?? '',
      supplier: _asMap(data['supplier']) != null
          ? CaptureSessionSupplierSummary.fromJson(data['supplier'])
          : null,
      assignedSalesman: _asMap(data['assignedSalesman']) != null
          ? CaptureSessionUserSummary.fromJson(data['assignedSalesman'])
          : null,
      status: _asText(data['status']) ?? 'draft',
      revision: _asInt(data['revision'], fallback: 1),
      itemCount: _asInt(data['itemCount']),
      totals: CaptureSessionTotals.fromJson(data['totals']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      createdAt: _asDate(data['createdAt']),
      submittedAt: _asDate(data['submittedAt']),
      finalizedAt: _asDate(data['finalizedAt']),
      reopenedAt: _asDate(data['reopenedAt']),
      reopenReason: _asText(data['reopenReason']),
    );
  }
}

class CaptureSessionListItem {
  const CaptureSessionListItem({
    required this.id,
    required this.sessionRef,
    required this.customerName,
    required this.customerPhone,
    required this.referenceNote,
    required this.assignedSalesman,
    required this.status,
    required this.supplierCount,
    required this.itemCount,
    required this.totals,
    required this.warningsCount,
    required this.reviewCount,
    required this.duplicateCount,
    required this.manualOverrideCount,
    required this.createdAt,
    required this.updatedAt,
    required this.submittedAt,
    required this.finalizedAt,
  });

  final String id;
  final String sessionRef;
  final String customerName;
  final String customerPhone;
  final String referenceNote;
  final CaptureSessionUserSummary? assignedSalesman;
  final String status;
  final int supplierCount;
  final int itemCount;
  final CaptureSessionTotals totals;
  final int warningsCount;
  final int reviewCount;
  final int duplicateCount;
  final int manualOverrideCount;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? submittedAt;
  final DateTime? finalizedAt;

  factory CaptureSessionListItem.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return CaptureSessionListItem(
      id: _resolveId(data['_id'] ?? data['id']),
      sessionRef: _asText(data['sessionRef']) ?? '',
      customerName: _asText(data['customerName']) ?? '',
      customerPhone: _asText(data['customerPhone']) ?? '',
      referenceNote: _asText(data['referenceNote']) ?? '',
      assignedSalesman: _asMap(data['assignedSalesman']) != null
          ? CaptureSessionUserSummary.fromJson(data['assignedSalesman'])
          : null,
      status: _asText(data['status']) ?? 'draft',
      supplierCount: _asInt(data['supplierCount']),
      itemCount: _asInt(data['itemCount']),
      totals: CaptureSessionTotals.fromJson(data['totals']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      createdAt: _asDate(data['createdAt']),
      updatedAt: _asDate(data['updatedAt']),
      submittedAt: _asDate(data['submittedAt']),
      finalizedAt: _asDate(data['finalizedAt']),
    );
  }
}

class CaptureSessionDetail extends CaptureSessionListItem {
  const CaptureSessionDetail({
    required super.id,
    required super.sessionRef,
    required super.customerName,
    required super.customerPhone,
    required super.referenceNote,
    required super.assignedSalesman,
    required super.status,
    required super.supplierCount,
    required super.itemCount,
    required super.totals,
    required super.warningsCount,
    required super.reviewCount,
    required super.duplicateCount,
    required super.manualOverrideCount,
    required super.createdAt,
    required super.updatedAt,
    required super.submittedAt,
    required super.finalizedAt,
    required this.createdBy,
    required this.submittedBy,
    required this.finalizedBy,
    required this.cancelledBy,
    required this.cancelledAt,
    required this.cancelReason,
    required this.batchIds,
    required this.batches,
  });

  final CaptureSessionUserSummary? createdBy;
  final CaptureSessionUserSummary? submittedBy;
  final CaptureSessionUserSummary? finalizedBy;
  final CaptureSessionUserSummary? cancelledBy;
  final DateTime? cancelledAt;
  final String? cancelReason;
  final List<String> batchIds;
  final List<CaptureSessionBatchSummary> batches;

  factory CaptureSessionDetail.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return CaptureSessionDetail(
      id: _resolveId(data['_id'] ?? data['id']),
      sessionRef: _asText(data['sessionRef']) ?? '',
      customerName: _asText(data['customerName']) ?? '',
      customerPhone: _asText(data['customerPhone']) ?? '',
      referenceNote: _asText(data['referenceNote']) ?? '',
      assignedSalesman: _asMap(data['assignedSalesman']) != null
          ? CaptureSessionUserSummary.fromJson(data['assignedSalesman'])
          : null,
      status: _asText(data['status']) ?? 'draft',
      supplierCount: _asInt(data['supplierCount']),
      itemCount: _asInt(data['itemCount']),
      totals: CaptureSessionTotals.fromJson(data['totals']),
      warningsCount: _asInt(data['warningsCount']),
      reviewCount: _asInt(data['reviewCount']),
      duplicateCount: _asInt(data['duplicateCount']),
      manualOverrideCount: _asInt(data['manualOverrideCount']),
      createdAt: _asDate(data['createdAt']),
      updatedAt: _asDate(data['updatedAt']),
      submittedAt: _asDate(data['submittedAt']),
      finalizedAt: _asDate(data['finalizedAt']),
      createdBy: _asMap(data['createdBy']) != null
          ? CaptureSessionUserSummary.fromJson(data['createdBy'])
          : null,
      submittedBy: _asMap(data['submittedBy']) != null
          ? CaptureSessionUserSummary.fromJson(data['submittedBy'])
          : null,
      finalizedBy: _asMap(data['finalizedBy']) != null
          ? CaptureSessionUserSummary.fromJson(data['finalizedBy'])
          : null,
      cancelledBy: _asMap(data['cancelledBy']) != null
          ? CaptureSessionUserSummary.fromJson(data['cancelledBy'])
          : null,
      cancelledAt: _asDate(data['cancelledAt']),
      cancelReason: _asText(data['cancelReason']),
      batchIds: _asList(data['batchIds']).map((value) => _resolveId(value)).where((value) => value.isNotEmpty).toList(growable: false),
      batches: _asList(data['batches'])
          .whereType<dynamic>()
          .map(CaptureSessionBatchSummary.fromJson)
          .toList(growable: false),
    );
  }
}

class CaptureSessionListPage {
  const CaptureSessionListPage({
    required this.sessions,
    required this.total,
    required this.page,
    required this.pages,
    required this.limit,
    required this.sortBy,
    required this.sortOrder,
  });

  final List<CaptureSessionListItem> sessions;
  final int total;
  final int page;
  final int pages;
  final int limit;
  final String sortBy;
  final String sortOrder;

  factory CaptureSessionListPage.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    final parsedPages = _asInt(data['pages'], fallback: 1);
    return CaptureSessionListPage(
      sessions: _asList(data['sessions'])
          .whereType<dynamic>()
          .map(CaptureSessionListItem.fromJson)
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

class CaptureSessionOperationResult {
  const CaptureSessionOperationResult({
    required this.session,
    required this.batch,
    required this.sessionSyncWarning,
  });

  final CaptureSessionListItem session;
  final CaptureSessionBatchSummary batch;
  final bool sessionSyncWarning;

  factory CaptureSessionOperationResult.fromJson(dynamic json) {
    final data = _asMap(json) ?? const <String, dynamic>{};
    return CaptureSessionOperationResult(
      session: CaptureSessionListItem.fromJson(data['session']),
      batch: CaptureSessionBatchSummary.fromJson(data['batch']),
      sessionSyncWarning: data['sessionSyncWarning'] == true,
    );
  }
}
