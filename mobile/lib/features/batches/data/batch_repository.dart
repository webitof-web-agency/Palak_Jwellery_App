import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../domain/batch_models.dart';

final batchRepositoryProvider = Provider<BatchRepository>(
  (ref) => BatchRepository(ref.watch(dioClientProvider)),
);

class BatchApiException implements Exception {
  const BatchApiException(
    this.message, {
    this.code = 'BATCH_ERROR',
    this.statusCode,
  });

  final String message;
  final String code;
  final int? statusCode;

  @override
  String toString() => message;
}

class BatchRepository {
  const BatchRepository(this._dio);

  final Dio _dio;

  static const _batchesPath = '/api/v1/batches';

  Future<BatchListPage> getBatches({
    int page = 1,
    int limit = 10,
    String q = '',
    String? supplier,
    String? status,
    String? entryMode,
    String sortBy = 'updatedAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        _batchesPath,
        queryParameters: {
          'page': page,
          'limit': limit,
          if (q.trim().isNotEmpty) 'q': q.trim(),
          if (supplier != null && supplier.trim().isNotEmpty)
            'supplier': supplier.trim(),
          if (status != null && status.trim().isNotEmpty)
            'status': status.trim(),
          if (entryMode != null && entryMode.trim().isNotEmpty)
            'entryMode': entryMode.trim(),
          if (sortBy.trim().isNotEmpty) 'sortBy': sortBy.trim(),
          if (sortOrder.trim().isNotEmpty) 'sortOrder': sortOrder.trim(),
        },
      );

      final data = _dataMap(response);
      if (data == null) {
        throw const BatchApiException(
          'Failed to load batches',
          code: 'INVALID_RESPONSE',
        );
      }

      return BatchListPage.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<BatchDetail> createBatch({
    required String supplierId,
    String? customerName,
    String? customerPhone,
    String? referenceNote,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        _batchesPath,
        data: {
          'supplierId': supplierId,
          if (_cleanText(customerName) != null)
            'customerName': _cleanText(customerName),
          if (_cleanText(customerPhone) != null)
            'customerPhone': _cleanText(customerPhone),
          if (_cleanText(referenceNote) != null)
            'referenceNote': _cleanText(referenceNote),
        },
      );

      final data = _dataMap(response);
      if (data == null) {
        throw const BatchApiException(
          'Failed to create batch',
          code: 'INVALID_RESPONSE',
        );
      }

      return BatchDetail.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<BatchDetail> getBatchDetail(String batchId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_batchesPath/$batchId',
      );
      final data = _dataMap(response);
      if (data == null) {
        throw const BatchApiException(
          'Failed to load batch details',
          code: 'INVALID_RESPONSE',
        );
      }

      return BatchDetail.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<BatchRevisionsResponse> getBatchRevisions(String batchId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_batchesPath/$batchId/revisions',
      );
      final data = _dataMap(response);
      if (data == null) {
        throw const BatchApiException(
          'Failed to load batch revisions',
          code: 'INVALID_RESPONSE',
        );
      }

      return BatchRevisionsResponse.fromJson(data);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
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

    if (body.containsKey('data') == false) {
      return body;
    }

    return null;
  }

  String? _cleanText(String? value) {
    final text = value?.trim();
    return text == null || text.isEmpty ? null : text;
  }

  BatchApiException _mapDioError(DioException error) {
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      return BatchApiException(
        data['error']?.toString() ?? error.message ?? 'Request failed',
        code: data['code']?.toString() ?? 'BATCH_ERROR',
        statusCode: error.response?.statusCode,
      );
    }

    return BatchApiException(
      error.message ?? 'Request failed',
      code: 'BATCH_ERROR',
      statusCode: error.response?.statusCode,
    );
  }
}
