import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../domain/capture_session_models.dart';

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

class CaptureSessionRepository {
  const CaptureSessionRepository(this._dio);

  final Dio _dio;

  static const _path = '/api/v1/capture-sessions';

  Future<CaptureSessionListPage> getMySessions({
    String? status,
    int page = 1,
    int limit = 10,
    String query = '',
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        _path,
        queryParameters: {
          'page': page,
          'limit': limit,
          if ((status ?? '').trim().isNotEmpty) 'status': status!.trim(),
          if (query.trim().isNotEmpty) 'q': query.trim(),
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
      default:
        return 'Internet connection is required for this action.';
    }
  }

  String _friendlyMessage(String code, String fallback) {
    switch (code) {
      case 'INVALID_ID':
        return 'This session is invalid.';
      case 'NOT_FOUND':
        return 'This session is no longer available.';
      case 'FORBIDDEN':
        return 'You do not have access to this session.';
      case 'SESSION_LOCKED':
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
        _friendlyMessage(code, fallback),
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
