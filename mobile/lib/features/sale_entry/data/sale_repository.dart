import 'package:dio/dio.dart';

// ─── Domain models ────────────────────────────────────────────────────────────

class SupplierModel {
  const SupplierModel({
    required this.id,
    required this.name,
    required this.code,
    required this.isActive,
    this.categories = const [],
  });

  final String id;
  final String name;
  final String code;
  final bool isActive;
  final List<String> categories;

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    final cats = json['categories'];
    return SupplierModel(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      isActive: json['isActive'] == true,
      categories: cats is List ? cats.map((e) => e.toString()).toList() : [],
    );
  }
}

/// Parsed field value with success flag
class ParsedField<T> {
  const ParsedField({required this.value, required this.parsed});
  final T? value;
  final bool parsed;
}

/// Parse error for one field
class ParseError {
  const ParseError({required this.field, required this.reason});
  final String field;
  final String reason;
}

Map<String, dynamic>? _asMap(dynamic value) {
  return value is Map<String, dynamic> ? value : null;
}

dynamic _readPathValue(Map<String, dynamic>? root, List<String> path) {
  dynamic current = root;

  for (final segment in path) {
    if (current is Map<String, dynamic> && current.containsKey(segment)) {
      current = current[segment];
      continue;
    }

    return null;
  }

  return current;
}

dynamic _unwrapParsedValue(dynamic value) {
  if (value is Map<String, dynamic> &&
      value.containsKey('parsed') &&
      value.containsKey('value')) {
    return value['parsed'] == true ? value['value'] : null;
  }

  return value;
}

ParsedField<T> _fieldFromPaths<T>(
  Map<String, dynamic>? data,
  List<List<String>> paths,
  T? Function(dynamic value) convert,
) {
  for (final path in paths) {
    final candidate = _unwrapParsedValue(_readPathValue(data, path));
    if (candidate == null) {
      continue;
    }

    final parsed = convert(candidate);
    if (parsed != null) {
      return ParsedField(value: parsed, parsed: true);
    }
  }

  return const ParsedField(value: null, parsed: false);
}

List<ParseError> _collectParseErrors(Map<String, dynamic>? parseResult) {
  final rawErrors = <dynamic>[];
  rawErrors.addAll((parseResult?['errors'] as List?) ?? const []);

  final meta = _asMap(parseResult?['meta']);
  rawErrors.addAll((meta?['parseErrors'] as List?) ?? const []);

  return rawErrors
      .whereType<Map<String, dynamic>>()
      .map(
        (e) => ParseError(
          field: e['field']?.toString() ?? '',
          reason: e['reason']?.toString() ?? '',
        ),
      )
      .toList();
}

/// Full result from POST /suppliers/parse-qr
class ParseQrResult {
  const ParseQrResult({
    required this.success,
    required this.raw,
    required this.category,
    required this.grossWeight,
    required this.stoneWeight,
    required this.netWeight,
    required this.errors,
    this.supplier,
    this.matchType,
  });

  final bool success;
  final String raw;
  final ParsedField<String> category;
  final ParsedField<double> grossWeight;
  final ParsedField<double> stoneWeight;
  final ParsedField<double> netWeight;
  final List<ParseError> errors;
  final SupplierModel? supplier;
  final String? matchType;

  bool get supplierDetected => supplier != null;
  bool get hasErrors => errors.isNotEmpty;

  factory ParseQrResult.from({
    required String raw,
    Map<String, dynamic>? parseResult,
    SupplierModel? supplier,
    String? matchType,
  }) {
    double? toDouble(dynamic v) {
      if (v == null) return null;
      if (v is num) return v.toDouble();
      return double.tryParse(v.toString());
    }

    final fields = _asMap(parseResult?['fields']);
    final isLegacy = fields != null;
    final source = isLegacy ? fields : parseResult;

    ParsedField<String> fieldString(List<List<String>> paths) {
      return _fieldFromPaths<String>(
        source,
        paths,
        (value) {
          final text = value?.toString();
          if (text == null) return null;
          final trimmed = text.trim();
          return trimmed.isEmpty ? null : trimmed;
        },
      );
    }

    ParsedField<double> fieldDouble(List<List<String>> paths) {
      return _fieldFromPaths<double>(
        source,
        paths,
        toDouble,
      );
    }

    return ParseQrResult(
      success: parseResult != null && _collectParseErrors(parseResult).isEmpty,
      raw: raw,
      category: isLegacy
          ? fieldString([
              ['category'],
              ['meta', 'itemCode'],
            ])
          : fieldString([
              ['itemCode'],
              ['category'],
              ['meta', 'itemCode'],
            ]),
      grossWeight: fieldDouble([
        ['grossWeight'],
      ]),
      stoneWeight: fieldDouble([
        ['stoneWeight'],
      ]),
      netWeight: fieldDouble([
        ['netWeight'],
      ]),
      errors: _collectParseErrors(parseResult),
      supplier: supplier,
      matchType: matchType,
    );
  }

  /// A fully failed parse (network error, no QR, etc.)
  factory ParseQrResult.empty(String raw) {
    return ParseQrResult(
      success: false,
      raw: raw,
      category: const ParsedField(value: null, parsed: false),
      grossWeight: const ParsedField(value: null, parsed: false),
      stoneWeight: const ParsedField(value: null, parsed: false),
      netWeight: const ParsedField(value: null, parsed: false),
      errors: const [ParseError(field: 'all', reason: 'Parse failed')],
      supplier: null,
    );
  }
}

/// Result from POST /sales
class CreatedSale {
  const CreatedSale({
    required this.id,
    required this.ref,
    required this.totalValue,
    required this.saleDate,
    this.isDuplicate = false,
  });

  final String id;
  final String ref;
  final double totalValue;
  final DateTime saleDate;
  final bool isDuplicate;

  factory CreatedSale.fromJson(Map<String, dynamic> json) {
    return CreatedSale(
      id: json['_id']?.toString() ?? '',
      ref: json['ref']?.toString() ?? '',
      totalValue: (json['totalValue'] as num?)?.toDouble() ?? 0,
      saleDate: json['saleDate'] != null
          ? DateTime.parse(json['saleDate'].toString())
          : DateTime.now(),
      isDuplicate: json['isDuplicate'] == true,
    );
  }
}

/// Result from GET /sales/summary/today
class SaleSummary {
  const SaleSummary({
    required this.count,
    required this.totalNetWeight,
    required this.totalRevenue,
  });

  final int count;
  final double totalNetWeight;
  final double totalRevenue;

  factory SaleSummary.fromJson(Map<String, dynamic> json) {
    return SaleSummary(
      count: json['count'] as int? ?? 0,
      totalNetWeight: (json['totalNetWeight'] as num?)?.toDouble() ?? 0.0,
      totalRevenue: (json['totalRevenue'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

/// 409 Duplicate QR error
class DuplicateQrException implements Exception {
  const DuplicateQrException({
    required this.message,
    required this.previousSaleDate,
  });
  final String message;
  final DateTime previousSaleDate;
}

/// Generic API exception
class SaleException implements Exception {
  const SaleException(this.message, {this.code = 'SALE_ERROR'});
  final String message;
  final String code;

  @override
  String toString() => message;
}

// ─── Repository ───────────────────────────────────────────────────────────────

class SaleRepository {
  const SaleRepository(this._dio);

  final Dio _dio;

  static const _suppliersPath = '/api/v1/suppliers';
  static const _parseQrPath = '/api/v1/suppliers/parse-qr';
  static const _salesPath = '/api/v1/sales';

  /// Load all active suppliers for the manual dropdown
  Future<List<SupplierModel>> getSuppliers() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(_suppliersPath);
      final body = response.data;
      final list = body?['data'] as List?;
      if (body?['success'] != true || list == null) {
        throw const SaleException('Failed to load suppliers');
      }
      return list
          .whereType<Map<String, dynamic>>()
          .map(SupplierModel.fromJson)
          .where((s) => s.isActive)
          .toList();
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  /// Parse a QR string (auto-detect supplier or manual supplier ID)
  Future<ParseQrResult> parseQr(String rawQr, {String? supplierId}) async {
    try {
      final body = <String, dynamic>{'rawQR': rawQr};
      if (supplierId != null && supplierId.isNotEmpty) {
        body['supplierId'] = supplierId;
      }

      final response = await _dio.post<Map<String, dynamic>>(
        _parseQrPath,
        data: body,
      );
      final respBody = response.data;
      final data = respBody?['data'] as Map<String, dynamic>?;

      if (respBody?['success'] != true || data == null) {
        return ParseQrResult.empty(rawQr);
      }

      final supplierJson = data['supplier'] as Map<String, dynamic>?;
      final supplier = supplierJson != null
          ? SupplierModel.fromJson(supplierJson)
          : null;
      final parseResult = data['parseResult'] as Map<String, dynamic>?;
      final matchType = data['matchType']?.toString();

      return ParseQrResult.from(
        raw: rawQr,
        parseResult: parseResult,
        supplier: supplier,
        matchType: matchType,
      );
    } on DioException {
      // Network failure — return empty result, never throw at scanner level
      return ParseQrResult.empty(rawQr);
    }
  }

  /// Save a sale. Throws [DuplicateQrException] on 409, [SaleException] on other errors.
  Future<CreatedSale> createSale({
    required String supplierId,
    required String category,
    required double grossWeight,
    required double stoneWeight,
    required double netWeight,
    required double ratePerGram,
    String? qrRaw,
    bool overrideDuplicate = false,
    String? idempotencyKey,
  }) async {
    try {
      final options = Options(headers: {'x-idempotency-key': idempotencyKey});

      final response = await _dio.post<Map<String, dynamic>>(
        _salesPath,
        data: {
          'supplierId': supplierId,
          'category': category,
          'grossWeight': grossWeight,
          'stoneWeight': stoneWeight,
          'netWeight': netWeight,
          'ratePerGram': ratePerGram,
          if (qrRaw != null && qrRaw.isNotEmpty) 'qrRaw': qrRaw,
          if (overrideDuplicate) 'overrideDuplicate': true,
        },
        options: options,
      );

      final body = response.data;
      final data = body?['data'] as Map<String, dynamic>?;

      if (body?['success'] != true || data == null) {
        throw const SaleException('Unexpected response from server');
      }

      return CreatedSale.fromJson(data);
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) {
        final body = e.response?.data as Map<String, dynamic>?;
        final code = body?['code']?.toString();
        if (code == 'DUPLICATE_QR') {
          final prev = body?['previousSale'] as Map<String, dynamic>?;
          final prevDate = prev?['saleDate'] != null
              ? DateTime.tryParse(prev!['saleDate'].toString()) ??
                    DateTime.now()
              : DateTime.now();
          throw DuplicateQrException(
            message: body?['error']?.toString() ?? 'Duplicate QR',
            previousSaleDate: prevDate,
          );
        }
      }
      throw _mapDio(e);
    }
  }

  SaleException _mapDio(DioException e) {
    final data = e.response?.data;
    if (data is Map<String, dynamic>) {
      return SaleException(
        data['error']?.toString() ?? e.message ?? 'Request failed',
        code: data['code']?.toString() ?? 'SALE_ERROR',
      );
    }
    return SaleException(e.message ?? 'Request failed');
  }

  /// Get today's summary metrics
  Future<SaleSummary> getTodaySummary() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '$_salesPath/summary/today',
      );
      final body = response.data;
      final data = body?['data'] as Map<String, dynamic>?;

      if (body?['success'] != true || data == null) {
        throw const SaleException('Failed to load summary metrics');
      }

      return SaleSummary.fromJson(data);
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }

  /// Get recent sale history
  Future<List<CreatedSale>> getRecentSales() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(_salesPath);
      final body = response.data;
      final list = body?['data'] as List?;

      if (body?['success'] != true || list == null) {
        throw const SaleException('Failed to load recent sales');
      }

      return list
          .whereType<Map<String, dynamic>>()
          .map(CreatedSale.fromJson)
          .toList();
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }
}
