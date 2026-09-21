import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../domain/capture_session_models.dart';
import '../domain/scan_session_summary.dart';

final captureSessionRepositoryProvider = Provider<CaptureSessionRepository>(
  (ref) => CaptureSessionRepository(ref.watch(dioClientProvider)),
);

class CaptureSessionApiException implements Exception {
  const CaptureSessionApiException(
    this.message, {
    this.code = 'SESSION_ERROR',
    this.statusCode,
  });

  final String message;
  final String code;
  final int? statusCode;

  @override
  String toString() => message;
}

class MobileSessionSyncResult {
  const MobileSessionSyncResult({
    required this.backendSessionId,
    required this.syncStatus,
    required this.syncedAt,
    required this.sessionRef,
    this.customerId,
  });

  final String backendSessionId;
  final String syncStatus;
  final DateTime? syncedAt;
  final String? sessionRef;
  final String? customerId;

  factory MobileSessionSyncResult.fromJson(Map<String, dynamic> json) {
    return MobileSessionSyncResult(
      backendSessionId: json['backendSessionId']?.toString() ?? '',
      syncStatus: json['syncStatus']?.toString() ?? ScanSessionSyncStatus.synced,
      syncedAt: json['syncedAt'] == null
          ? null
          : DateTime.tryParse(json['syncedAt'].toString()),
      sessionRef: json['sessionRef']?.toString(),
      customerId: json['customerId']?.toString(),
    );
  }
}

class CaptureSessionRepository {
  const CaptureSessionRepository(this._dio);

  final Dio _dio;

  static const _path = '/api/v1/capture-sessions';

  Future<CaptureSessionListPage> getMySessions({
    String? status,
    int page = 1,
    int limit = 10,
    String query = '',
    String? customerId,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        _path,
        queryParameters: {
          'page': page,
          'limit': limit,
          if ((status ?? '').trim().isNotEmpty) 'status': status!.trim(),
          if (query.trim().isNotEmpty) 'q': query.trim(),
          if (customerId != null && customerId.isNotEmpty) 'customerId': customerId,
          'sortBy': 'updatedAt',
          'sortOrder': 'desc',
        },
      );
      return _parseListPage(response, fallbackMessage: 'Failed to load sessions');
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'listSessions');
    }
  }

  Future<CaptureSessionListItem> createSession({
    String? customerName,
    String? customerPhone,
    String? referenceNote,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        _path,
        data: {
          if (_cleanText(customerName) != null) 'customerName': _cleanText(customerName),
          if (_cleanText(customerPhone) != null) 'customerPhone': _cleanText(customerPhone),
          if (_cleanText(referenceNote) != null) 'referenceNote': _cleanText(referenceNote),
        },
      );

      final data = _dataMap(response);
      if (data == null) {
        throw const CaptureSessionApiException(
          'Failed to create session',
          code: 'INVALID_RESPONSE',
        );
      }

      return CaptureSessionListItem.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'createSession');
    }
  }

  Future<MobileSessionSyncResult> mobileSyncSession(ScanSessionSummary summary) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_path/mobile-sync',
        data: _buildMobileSyncPayload(summary),
      );

      final data = _dataMap(response);
      if (data == null) {
        throw const CaptureSessionApiException(
          'Failed to sync session',
          code: 'INVALID_RESPONSE',
        );
      }

      return MobileSessionSyncResult.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'mobileSyncSession');
    }
  }

  Future<CaptureSessionDetail> getSessionDetail(String sessionId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('$_path/$sessionId');
      final data = _dataMap(response);
      if (data == null) {
        throw const CaptureSessionApiException(
          'Failed to load session details',
          code: 'INVALID_RESPONSE',
        );
      }

      return CaptureSessionDetail.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'getSessionDetail');
    }
  }

  Future<CaptureSessionOperationResult> createSupplierBatch({
    required String sessionId,
    required String supplierId,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '$_path/$sessionId/batches',
        data: {
          'supplierId': supplierId,
        },
      );

      final data = _dataMap(response);
      if (data == null) {
        throw const CaptureSessionApiException(
          'Failed to add supplier batch',
          code: 'INVALID_RESPONSE',
        );
      }

      return CaptureSessionOperationResult.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'createSupplierBatch');
    }
  }

  Future<CaptureSessionListItem> submitSession(String sessionId) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>('$_path/$sessionId/submit');
      final data = _dataMap(response);
      if (data == null) {
        throw const CaptureSessionApiException(
          'Failed to submit session',
          code: 'INVALID_RESPONSE',
        );
      }

      return CaptureSessionListItem.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error, operation: 'submitSession');
    }
  }

  Map<String, dynamic> _buildMobileSyncPayload(ScanSessionSummary summary) {
    final customer = summary.customer;
    return {
      'clientSessionId': summary.clientSessionId,
      'createdAt': summary.createdAt.toIso8601String(),
      'updatedAt': summary.updatedAt.toIso8601String(),
      'customer': {
        if ((customer?.id ?? '').trim().isNotEmpty) 'id': customer!.id,
        'name': customer?.name ?? '',
        'phone': customer?.phone ?? '',
        'area': customer?.area ?? '',
        if ((customer?.email ?? '').trim().isNotEmpty) 'email': customer!.email,
      },
      'lockedSettings': {
        'supplierName': summary.lockedSettings.supplier ?? '',
        'category': summary.lockedSettings.category ?? '',
        'karat': summary.lockedSettings.karat ?? '',
        'purity': summary.lockedSettings.selectedPurity ?? summary.lockedSettings.originalPurity ?? 0,
        'wastage': summary.lockedSettings.selectedWastage ?? summary.lockedSettings.originalWastage ?? 0,
      },
      'totals': {
        'itemCount': summary.totalItems,
        'grossWeight': summary.totalGrossWeight,
        'stoneWeight': summary.totalStoneWeight,
        'otherWeight': summary.totalOtherWeight,
        'netWeight': summary.totalNetWeight,
        'fineWeight': summary.totalFineWeight,
        'stoneAmount': summary.totalStoneAmount,
        'otherAmount': summary.totalOtherAmount,
      },
      'warningCounts': {
        'total': summary.warningCounts.duplicates + summary.warningCounts.supplierMismatch + summary.warningCounts.karatMismatch + summary.warningCounts.weightMismatch + summary.warningCounts.customPurityOverrides + summary.warningCounts.customWastageOverrides,
        'karatMismatch': summary.warningCounts.karatMismatch,
        'supplierMismatch': summary.warningCounts.supplierMismatch,
        'netMismatch': summary.warningCounts.weightMismatch,
        'unknownQr': 0,
      },
      'items': summary.items.asMap().entries.map((entry) {
        final index = entry.key;
        final item = entry.value;
        final warnings = <String>[
          if ((item.warningLabel ?? '').trim().isNotEmpty) item.warningLabel!,
          if (item.hasKaratMismatch) 'QR Karat Mismatch',
          if (item.hasSupplierMismatch) 'Supplier Mismatch',
          if (item.hasWeightMismatch) 'Net Weight Mismatch',
          if (item.isDuplicate) 'Duplicate',
          if (item.hasPurityOverride) 'Custom Purity',
          if (item.hasWastageOverride) 'Custom Wastage',
          if (item.requiresReview) 'Needs Review',
        ];

        return {
          'clientItemId': item.id,
          'srNo': index + 1,
          'itemCode': item.itemCode,
          'supplierName': item.supplier,
          'category': item.category,
          'jewelType': item.jewelType,
          'appliedKarat': item.karat,
          'qrKarat': item.qrKarat,
          'purity': item.purityPercent,
          'wastage': item.wastagePercent,
          'grossWeight': item.grossWeight,
          'stoneWeight': item.stoneWeight,
          'otherWeight': item.otherWeight,
          'netWeight': item.netWeight,
          'fineWeight': item.fineWeight,
          'stoneAmount': item.stoneAmount ?? item.totalStoneAmount ?? 0,
          'otherAmount': item.otherAmount ?? 0,
          'rawQr': item.rawQr ?? '',
          'parsedSnapshot': {
            'display': {
              'item': {
                'itemCode': item.itemCode,
                'category': item.category,
                'jewelType': item.jewelType,
                'karat': item.qrKarat ?? item.karat,
              },
              'supplier': {
                'name': item.supplier,
              },
              'weights': {
                'grossWeight': item.grossWeight,
                'stoneWeight': item.stoneWeight,
                'otherWeight': item.otherWeight,
              },
              'amounts': {
                'stoneAmount': item.stoneAmount ?? item.totalStoneAmount ?? 0,
                'otherAmount': item.otherAmount ?? 0,
              },
              'calculation': {
                'netWeight': item.netWeight,
                'fineWeight': item.fineWeight,
              },
              'warnings': warnings,
              'requiresReview': item.requiresReview,
            },
          },
          'warnings': warnings,
          'hasKaratMismatch': item.hasKaratMismatch,
          'hasSupplierMismatch': item.hasSupplierMismatch,
          'hasWeightMismatch': item.hasWeightMismatch,
          'isDuplicate': item.isDuplicate,
          'hasPurityOverride': item.hasPurityOverride,
          'hasWastageOverride': item.hasWastageOverride,
          'requiresReview': item.requiresReview,
          if (item.addedAt != null) 'addedAt': item.addedAt!.toIso8601String(),
        };
      }).toList(growable: false),
      'syncMeta': {
        'source': 'mobile',
      },
      'notes': summary.notes,
    };
  }

  CaptureSessionListPage _parseListPage(
    Response<Map<String, dynamic>> response, {
    required String fallbackMessage,
  }) {
    final data = _dataMap(response);
    if (data == null) {
      throw CaptureSessionApiException(
        fallbackMessage,
        code: 'INVALID_RESPONSE',
      );
    }
    return CaptureSessionListPage.fromJson(data);
  }

  Map<String, dynamic>? _dataMap(Response<Map<String, dynamic>> response) {
    final body = response.data;
    if (body == null) {
      return null;
    }

    if (body['success'] != true) {
      return null;
    }

    final payload = body['data'];
    if (payload is Map<String, dynamic>) {
      return payload;
    }

    if (!body.containsKey('data')) {
      return body;
    }

    return null;
  }

  String? _cleanText(String? value) {
    final text = value?.trim();
    return text == null || text.isEmpty ? null : text;
  }

  bool _isNetworkError(DioException error) {
    return error.response == null &&
        (error.type == DioExceptionType.connectionError ||
            error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout ||
            error.type == DioExceptionType.sendTimeout);
  }

  String _networkMessageFor(String operation) {
    switch (operation) {
      case 'createSession':
        return 'Internet connection is required to create a new session.';
      case 'createSupplierBatch':
        return 'Internet connection is required to add a supplier batch.';
      case 'mobileSyncSession':
        return 'Session saved locally. Backend sync will complete when the internet connection is available.';
      default:
        return 'Internet connection is required for this action.';
    }
  }

  String _friendlyMessage(String code, String fallback, {required String operation}) {
    switch (code) {
      case 'INVALID_ID':
        return 'This session is invalid.';
      case 'NOT_FOUND':
        return 'This session is no longer available.';
      case 'FORBIDDEN':
        return 'You do not have access to this session.';
      case 'SESSION_LOCKED':
        if (operation == 'mobileSyncSession') {
          return 'This session was locked by admin (cancelled or finalized) and can no longer be edited from this device.';
        }
        return 'This session is read-only.';
      case 'SESSION_SUPPLIER_EXISTS':
        return 'This supplier already has a batch in this session.';
      case 'SESSION_EMPTY':
        return 'Add at least one supplier batch before submitting.';
      case 'SESSION_ACTIVE_BATCHES':
        return 'Submit the open supplier batches first.';
      case 'BATCH_ALREADY_SESSION_LINKED':
        return 'This batch already belongs to another session.';
      case 'ASSIGNMENT_MISMATCH':
        return 'This supplier batch does not match the assigned salesman.';
      default:
        return fallback;
    }
  }

  CaptureSessionApiException _mapDioError(
    DioException error, {
    required String operation,
  }) {
    if (_isNetworkError(error)) {
      return CaptureSessionApiException(
        _networkMessageFor(operation),
        code: 'NETWORK_ERROR',
        statusCode: error.response?.statusCode,
      );
    }

    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final code = data['code']?.toString() ?? 'SESSION_ERROR';
      final fallback = data['error']?.toString() ?? error.message ?? 'Request failed';
      return CaptureSessionApiException(
        _friendlyMessage(code, fallback, operation: operation),
        code: code,
        statusCode: error.response?.statusCode,
      );
    }

    return CaptureSessionApiException(
      error.message ?? 'Request failed',
      code: 'SESSION_ERROR',
      statusCode: error.response?.statusCode,
    );
  }
}
