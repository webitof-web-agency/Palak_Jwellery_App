import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum PendingSaleStatus { pending, failed, synced }

const _copyWithUnset = Object();

PendingSaleStatus _pendingSaleStatusFromString(String? value) {
  switch (value) {
    case 'pending':
      return PendingSaleStatus.pending;
    case 'failed':
      return PendingSaleStatus.failed;
    case 'synced':
      return PendingSaleStatus.synced;
    default:
      return PendingSaleStatus.pending;
  }
}

String _pendingSaleStatusToString(PendingSaleStatus status) => status.name;

class PendingSalePayload {
  const PendingSalePayload({
    required this.supplierId,
    required this.grossWeight,
    required this.stoneWeight,
    required this.netWeight,
    this.supplierName,
    this.category,
    this.itemCode,
    this.metalType,
    this.purity,
    this.notes,
    this.qrRaw,
    this.overrideDuplicate = false,
    this.parseSnapshot = const {},
  });

  final String supplierId;
  final String? supplierName;
  final String? category;
  final String? itemCode;
  final String? metalType;
  final String? purity;
  final String? notes;
  final double grossWeight;
  final double stoneWeight;
  final double netWeight;
  final String? qrRaw;
  final bool overrideDuplicate;
  final Map<String, dynamic> parseSnapshot;

  Map<String, dynamic> toJson() {
    return {
      'supplierId': supplierId,
      'supplierName': supplierName,
      'category': category,
      'itemCode': itemCode,
      'metalType': metalType,
      'purity': purity,
      'notes': notes,
      'grossWeight': grossWeight,
      'stoneWeight': stoneWeight,
      'netWeight': netWeight,
      'qrRaw': qrRaw,
      'overrideDuplicate': overrideDuplicate,
      'parseSnapshot': parseSnapshot,
    };
  }

  factory PendingSalePayload.fromJson(Map<String, dynamic> json) {
    return PendingSalePayload(
      supplierId: json['supplierId']?.toString() ?? '',
      supplierName: json['supplierName']?.toString(),
      category: json['category']?.toString(),
      itemCode: json['itemCode']?.toString(),
      metalType: json['metalType']?.toString(),
      purity: json['purity']?.toString(),
      notes: json['notes']?.toString(),
      grossWeight: (json['grossWeight'] as num?)?.toDouble() ?? 0,
      stoneWeight: (json['stoneWeight'] as num?)?.toDouble() ?? 0,
      netWeight: (json['netWeight'] as num?)?.toDouble() ?? 0,
      qrRaw: json['qrRaw']?.toString(),
      overrideDuplicate: json['overrideDuplicate'] == true,
      parseSnapshot: (json['parseSnapshot'] as Map?)?.cast<String, dynamic>() ?? const {},
    );
  }

  String get displayTitle {
    if ((supplierName ?? '').isNotEmpty && (itemCode ?? '').isNotEmpty) {
      return '$supplierName • $itemCode';
    }

    if ((supplierName ?? '').isNotEmpty) {
      return supplierName!;
    }

    if ((itemCode ?? '').isNotEmpty) {
      return itemCode!;
    }

    if ((category ?? '').isNotEmpty) {
      return category!;
    }

    return 'Pending sale';
  }

  String get subtitle {
    final parts = <String>[];
    if ((category ?? '').isNotEmpty) parts.add(category!);
    if ((purity ?? '').isNotEmpty) parts.add(purity!);
    if ((metalType ?? '').isNotEmpty) parts.add(metalType!);
    if (parts.isEmpty) return 'Manual review required';
    return parts.join(' • ');
  }
}

class PendingSaleDraft {
  const PendingSaleDraft({
    required this.id,
    required this.idempotencyKey,
    required this.payload,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    required this.retryCount,
    this.errorMessage,
    this.createdByUserId,
    this.createdByUserName,
  });

  final String id;
  final String idempotencyKey;
  final PendingSalePayload payload;
  final PendingSaleStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int retryCount;
  final String? errorMessage;
  final String? createdByUserId;
  final String? createdByUserName;

  bool get isResolved => status == PendingSaleStatus.synced;

  PendingSaleDraft copyWith({
    String? id,
    String? idempotencyKey,
    PendingSalePayload? payload,
    PendingSaleStatus? status,
    DateTime? createdAt,
    DateTime? updatedAt,
    int? retryCount,
    Object? errorMessage = _copyWithUnset,
    Object? createdByUserId = _copyWithUnset,
    Object? createdByUserName = _copyWithUnset,
  }) {
    return PendingSaleDraft(
      id: id ?? this.id,
      idempotencyKey: idempotencyKey ?? this.idempotencyKey,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      retryCount: retryCount ?? this.retryCount,
      errorMessage: identical(errorMessage, _copyWithUnset)
          ? this.errorMessage
          : errorMessage as String?,
      createdByUserId: identical(createdByUserId, _copyWithUnset)
          ? this.createdByUserId
          : createdByUserId as String?,
      createdByUserName: identical(createdByUserName, _copyWithUnset)
          ? this.createdByUserName
          : createdByUserName as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'idempotencyKey': idempotencyKey,
      'payload': payload.toJson(),
      'status': _pendingSaleStatusToString(status),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
      'retryCount': retryCount,
      'errorMessage': errorMessage,
      'createdByUserId': createdByUserId,
      'createdByUserName': createdByUserName,
    };
  }

  factory PendingSaleDraft.fromJson(Map<String, dynamic> json) {
    return PendingSaleDraft(
      id: json['id']?.toString() ?? '',
      idempotencyKey: json['idempotencyKey']?.toString() ?? '',
      payload: PendingSalePayload.fromJson(
        (json['payload'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{},
      ),
      status: _pendingSaleStatusFromString(json['status']?.toString()),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt']?.toString() ?? '') ?? DateTime.now(),
      retryCount: (json['retryCount'] as num?)?.toInt() ?? 0,
      errorMessage: json['errorMessage']?.toString(),
      createdByUserId: json['createdByUserId']?.toString(),
      createdByUserName: json['createdByUserName']?.toString(),
    );
  }
}

class PendingSaleQueueStore {
  const PendingSaleQueueStore(this._storage);

  static const _queueKey = 'pending_sale_queue_v1';

  final FlutterSecureStorage _storage;

  Future<List<PendingSaleDraft>> load() async {
    final raw = await _storage.read(key: _queueKey);
    if (raw == null || raw.isEmpty) {
      return const [];
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! List) {
        return const [];
      }

      return decoded
          .whereType<Map>()
          .map((value) => PendingSaleDraft.fromJson(value.cast<String, dynamic>()))
          .toList()
        ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    } catch (_) {
      return const [];
    }
  }

  Future<void> save(List<PendingSaleDraft> drafts) async {
    final payload = drafts.map((draft) => draft.toJson()).toList();
    await _storage.write(key: _queueKey, value: jsonEncode(payload));
  }
}
