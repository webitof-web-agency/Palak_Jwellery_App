import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';

String _normalizeKarat(String? value) {
  return (value ?? '').replaceAll(RegExp(r'\s+'), '').toUpperCase();
}

// ─── Domain models ────────────────────────────────────────────────────────────

class SupplierModel {
  const SupplierModel({
    required this.id,
    required this.name,
    required this.code,
    required this.isActive,
    this.categories = const [],
    this.businessSettings = const {},
  });

  final String id;
  final String name;
  final String code;
  final bool isActive;
  final List<String> categories;
  final Map<String, dynamic> businessSettings;

  factory SupplierModel.fromJson(Map<String, dynamic> json) {
    final cats = json['categories'];
    return SupplierModel(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      code: json['code']?.toString() ?? '',
      isActive: json['isActive'] == true,
      categories: cats is List ? cats.map((e) => e.toString()).toList() : [],
      businessSettings: json['businessSettings'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['businessSettings'] as Map)
          : <String, dynamic>{},
    );
  }
}

class KaratOption {
  const KaratOption({
    required this.id,
    required this.name,
    required this.isActive,
    this.code,
    this.purityPercent,
    this.sortOrder,
  });

  final String id;
  final String name;
  final String? code;
  final bool isActive;
  final double? purityPercent;
  final int? sortOrder;

  factory KaratOption.fromJson(Map<String, dynamic> json) {
    return KaratOption(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      name: json['name']?.toString().trim() ?? '',
      code: json['code']?.toString().trim(),
      isActive: json['isActive'] != false,
      purityPercent: json['purityPercent'] is num
          ? (json['purityPercent'] as num).toDouble()
          : double.tryParse(json['purityPercent']?.toString() ?? ''),
      sortOrder: json['sortOrder'] is int
          ? json['sortOrder'] as int
          : int.tryParse(json['sortOrder']?.toString() ?? ''),
    );
  }

  static List<KaratOption> defaults() {
    return const [
      KaratOption(id: '', name: '9K', isActive: true, purityPercent: 37.5, sortOrder: 100),
      KaratOption(id: '', name: '14K', isActive: true, purityPercent: 58.5, sortOrder: 110),
      KaratOption(id: '', name: '18K', isActive: true, purityPercent: 75, sortOrder: 120),
      KaratOption(id: '', name: '20K', isActive: true, purityPercent: 83.3, sortOrder: 130),
      KaratOption(id: '', name: '22K', isActive: true, purityPercent: 91.6, sortOrder: 140),
      KaratOption(id: '', name: '24K', isActive: true, purityPercent: 99.9, sortOrder: 150),
    ];
  }

  String get displayLabel {
    final purity = purityPercent;
    if (purity == null) return name;
    final isWhole = purity % 1 == 0;
    return '$name (${purity.toStringAsFixed(isWhole ? 0 : 1)}%)';
  }
}

double? resolvePurityPercentForKarat({
  SupplierModel? supplier,
  required String karat,
  required List<KaratOption> karatOptions,
}) {
  final normalized = _normalizeKarat(karat);
  if (normalized.isEmpty) {
    return null;
  }

  final overrides = supplier?.businessSettings['purityOverrides'];
  if (overrides is List) {
    for (final item in overrides) {
      if (item is! Map<String, dynamic>) continue;
      if (item['isActive'] == false) continue;
      final overrideKarat = _normalizeKarat(item['karat']?.toString());
      if (overrideKarat != normalized) continue;
      final purity = item['purityPercent'];
      if (purity is num) {
        return purity.toDouble();
      }
      final parsedPurity = double.tryParse(purity?.toString() ?? '');
      if (parsedPurity != null) {
        return parsedPurity;
      }
    }
  }

  for (final option in karatOptions) {
    if (!option.isActive) continue;
    final optionKarat = _normalizeKarat(option.name.isNotEmpty ? option.name : option.code);
    if (optionKarat != normalized) continue;
    return option.purityPercent;
  }

  return null;
}

class BusinessOverview {
  const BusinessOverview({
    required this.categories,
    required this.metalTypes,
    required this.settings,
  });

  final List<String> categories;
  final List<String> metalTypes;
  final Map<String, dynamic> settings;

  static List<String> _extractLabels(dynamic value) {
    if (value is! List) {
      return const [];
    }

    return value
        .map((item) {
          if (item is Map<String, dynamic>) {
            final label = item['name'] ?? item['label'] ?? item['code'] ?? item['key'];
            final text = label?.toString().trim() ?? '';
            return text.isEmpty ? null : text;
          }
          final text = item?.toString().trim() ?? '';
          return text.isEmpty ? null : text;
        })
        .whereType<String>()
        .toList(growable: false);
  }

  factory BusinessOverview.fromJson(Map<String, dynamic> json) {
    return BusinessOverview(
      categories: _extractLabels(json['categories']),
      metalTypes: _extractLabels(json['metalTypes']),
      settings: json['settings'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['settings'] as Map)
          : <String, dynamic>{},
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

Map<String, dynamic>? _cloneMap(dynamic value) {
  if (value is Map<String, dynamic>) {
    return Map<String, dynamic>.from(value);
  }
  if (value is Map) {
    return value.map((key, val) => MapEntry(key.toString(), val));
  }
  return null;
}

final saleRepositoryProvider = Provider<SaleRepository>(
  (ref) => SaleRepository(ref.watch(dioClientProvider)),
);

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
    required this.itemCode,
    required this.category,
    required this.karat,
    required this.purity,
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    required this.netWeight,
    required this.errors,
    this.supplier,
    this.matchType,
    this.normalizedSnapshot,
    this.displaySnapshot,
  });

  final bool success;
  final String raw;
  final ParsedField<String> itemCode;
  final ParsedField<String> category;
  final ParsedField<String> karat;
  final ParsedField<String> purity;
  final ParsedField<double> grossWeight;
  final ParsedField<double> stoneWeight;
  final ParsedField<double> otherWeight;
  final ParsedField<double> netWeight;
  final List<ParseError> errors;
  final SupplierModel? supplier;
  final String? matchType;
  final Map<String, dynamic>? normalizedSnapshot;
  final Map<String, dynamic>? displaySnapshot;

  bool get supplierDetected => supplier != null;
  bool get hasErrors => errors.isNotEmpty;

  factory ParseQrResult.from({
    required String raw,
    Map<String, dynamic>? parseResult,
    Map<String, dynamic>? normalizedResult,
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
    final normalizedSnapshot = _cloneMap(normalizedResult) ?? _cloneMap(parseResult);
    final displaySnapshot = _cloneMap(normalizedSnapshot?['display']);

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

    ParsedField<String> purityField = _fieldFromPaths<String>(
      normalizedSnapshot,
      [
        ['display', 'item', 'purityPercent'],
        ['purityPercent'],
        ['purity_percent'],
      ],
      (value) {
        if (value == null) return null;
        if (value is num) {
          return value.toString();
        }
        final text = value.toString().trim();
        return text.isEmpty ? null : text;
      },
    );
    if (!purityField.parsed) {
      purityField = fieldString([
        ['purity'],
        ['meta', 'purity'],
      ]);
    }

    ParsedField<String> karatField = _fieldFromPaths<String>(
      normalizedSnapshot,
      [
        ['display', 'item', 'karat'],
        ['item', 'karat'],
        ['karat'],
        ['meta', 'karat'],
      ],
      (value) {
        if (value == null) return null;
        final text = value.toString().trim();
        return text.isEmpty ? null : text;
      },
    );
    if (!karatField.parsed) {
      karatField = fieldString([
        ['karat'],
        ['meta', 'karat'],
      ]);
    }

    return ParseQrResult(
      success: parseResult != null && _collectParseErrors(parseResult).isEmpty,
      raw: raw,
      itemCode: fieldString([
        ['itemCode'],
        ['meta', 'itemCode'],
        if (isLegacy) ['category'],
      ]),
      category: fieldString([
        ['category'],
      ]),
      karat: karatField,
      purity: purityField,
      grossWeight: fieldDouble([
        ['grossWeight'],
      ]),
      stoneWeight: fieldDouble([
        ['stoneWeight'],
      ]),
      otherWeight: fieldDouble([
        ['otherWeight'],
        ['meta', 'otherWeight'],
      ]),
      netWeight: fieldDouble([
        ['netWeight'],
      ]),
      errors: _collectParseErrors(parseResult),
      supplier: supplier,
      matchType: matchType,
      normalizedSnapshot: normalizedSnapshot,
      displaySnapshot: displaySnapshot,
    );
  }

  /// A fully failed parse (network error, no QR, etc.)
  factory ParseQrResult.empty(String raw) {
    return ParseQrResult(
      success: false,
      raw: raw,
      itemCode: const ParsedField(value: null, parsed: false),
      category: const ParsedField(value: null, parsed: false),
      karat: const ParsedField(value: null, parsed: false),
      purity: const ParsedField(value: null, parsed: false),
      grossWeight: const ParsedField(value: null, parsed: false),
      stoneWeight: const ParsedField(value: null, parsed: false),
      otherWeight: const ParsedField(value: null, parsed: false),
      netWeight: const ParsedField(value: null, parsed: false),
      errors: const [ParseError(field: 'all', reason: 'Parse failed')],
      supplier: null,
      normalizedSnapshot: null,
      displaySnapshot: null,
    );
  }
}

/// Result from POST /sales
class CreatedSale {
  const CreatedSale({
    required this.id,
    required this.ref,
    required this.saleDate,
    this.isDuplicate = false,
    this.itemCode,
    this.category,
    this.metalType,
    this.purity,
    this.supplierName,
    this.netWeight,
    this.notes,
  });

  final String id;
  final String ref;
  final DateTime saleDate;
  final bool isDuplicate;
  final String? itemCode;
  final String? category;
  final String? metalType;
  final String? purity;
  final String? supplierName;
  final double? netWeight;
  final String? notes;

  factory CreatedSale.fromJson(Map<String, dynamic> json) {
    return CreatedSale(
      id: json['_id']?.toString() ?? '',
      ref: json['ref']?.toString() ?? '',
      saleDate: json['saleDate'] != null
          ? DateTime.parse(json['saleDate'].toString())
          : DateTime.now(),
      isDuplicate: json['isDuplicate'] == true,
      itemCode: json['itemCode']?.toString(),
      category: json['category']?.toString(),
      metalType: json['metalType']?.toString(),
      purity: json['purity']?.toString(),
      supplierName: _asMap(json['supplier'])?['name']?.toString(),
      netWeight: (json['netWeight'] as num?)?.toDouble(),
      notes: json['notes']?.toString(),
    );
  }
}

class RecentSalesPage {
  const RecentSalesPage({
    required this.sales,
    required this.total,
    required this.page,
    required this.pages,
  });

  final List<CreatedSale> sales;
  final int total;
  final int page;
  final int pages;
}

/// Result from GET /sales/summary/today
class SaleSummary {
  const SaleSummary({
    required this.count,
    required this.totalNetWeight,
  });

  final int count;
  final double totalNetWeight;

  factory SaleSummary.fromJson(Map<String, dynamic> json) {
    return SaleSummary(
      count: json['count'] as int? ?? 0,
      totalNetWeight: (json['totalNetWeight'] as num?)?.toDouble() ?? 0.0,
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
  static const _businessOverviewPath = '/api/v1/business/overview';

  Future<BusinessOverview> getBusinessOverview() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(_businessOverviewPath);
      final body = response.data;
      if (body == null) {
        return const BusinessOverview(categories: [], metalTypes: [], settings: {});
      }

      final data = body['data'];
      if (data is Map<String, dynamic>) {
        return BusinessOverview.fromJson(data);
      }
      return BusinessOverview.fromJson(body);
    } catch (_) {
      return const BusinessOverview(categories: [], metalTypes: [], settings: {});
    }
  }

  Future<List<KaratOption>> getKaratOptions() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/api/v1/business/karats');
      final body = response.data;
      final list = body?['data'] as List?;
      if (body?['success'] != true || list == null) {
        return KaratOption.defaults();
      }

      final karats = list
          .whereType<Map<String, dynamic>>()
          .map(KaratOption.fromJson)
          .where((item) => item.isActive)
          .toList();

      if (karats.isEmpty) {
        return KaratOption.defaults();
      }

      karats.sort((a, b) {
        final orderCompare = (a.sortOrder ?? 0).compareTo(b.sortOrder ?? 0);
        if (orderCompare != 0) return orderCompare;
        return a.name.compareTo(b.name);
      });
      return karats;
    } on DioException {
      return KaratOption.defaults();
    }
  }

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
      final body = <String, dynamic>{'rawQr': rawQr};
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
      final normalizedResult = data['normalizedResult'] as Map<String, dynamic>?;
      final matchType = data['matchType']?.toString();

      return ParseQrResult.from(
        raw: rawQr,
        parseResult: parseResult,
        normalizedResult: normalizedResult,
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
    String? batchId,
    String? category,
    String? itemCode,
    String? metalType,
    String? karat,
    String? purity,
    String? notes,
    required double grossWeight,
    required double stoneWeight,
    required double netWeight,
    String? qrRaw,
    Map<String, dynamic>? displaySnapshot,
    Map<String, dynamic>? parsedSnapshot,
    bool overrideDuplicate = false,
    String? idempotencyKey,
  }) async {
    try {
      final options = Options(headers: {'x-idempotency-key': idempotencyKey});

      final response = await _dio.post<Map<String, dynamic>>(
        _salesPath,
        data: {
          'supplierId': supplierId,
          if (batchId != null && batchId.isNotEmpty) 'batchId': batchId,
          if (category != null && category.isNotEmpty) 'category': category,
          if (itemCode != null && itemCode.isNotEmpty) 'itemCode': itemCode,
          if (metalType != null && metalType.isNotEmpty) 'metalType': metalType,
          if (karat != null && karat.isNotEmpty) 'karat': karat,
          if ((karat == null || karat.isEmpty) && purity != null && purity.isNotEmpty) 'purity': purity,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
          'grossWeight': grossWeight,
          'stoneWeight': stoneWeight,
          'netWeight': netWeight,
          if (qrRaw != null && qrRaw.isNotEmpty) 'qrRaw': qrRaw,
          if (displaySnapshot != null && displaySnapshot.isNotEmpty)
            'displaySnapshot': displaySnapshot,
          if (parsedSnapshot != null && parsedSnapshot.isNotEmpty)
            'parsedSnapshot': parsedSnapshot,
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
    if (e.response == null) {
      return SaleException(
        e.message ?? 'Request failed',
        code: 'NETWORK_ERROR',
      );
    }

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
  Future<RecentSalesPage> getRecentSales({
    int page = 1,
    int limit = 10,
    String q = '',
    String searchScope = 'all',
    bool duplicatesOnly = false,
    String sortBy = 'saleDate',
    String sortOrder = 'desc',
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        _salesPath,
        queryParameters: {
          'page': page,
          'limit': limit,
          'q': q,
          'searchScope': searchScope,
          'duplicatesOnly': duplicatesOnly,
          'sortBy': sortBy,
          'sortOrder': sortOrder,
        },
      );
      final body = response.data;
      final data = body?['data'] as Map<String, dynamic>?;
      final list = data?['sales'] as List?;

      if (body?['success'] != true || list == null || data == null) {
        throw const SaleException('Failed to load recent sales');
      }

      return RecentSalesPage(
        sales: list
            .whereType<Map<String, dynamic>>()
            .map(CreatedSale.fromJson)
            .toList(),
        total: (data['total'] as num?)?.toInt() ?? 0,
        page: (data['page'] as num?)?.toInt() ?? page,
        pages: (data['pages'] as num?)?.toInt() ?? 1,
      );
    } on DioException catch (e) {
      throw _mapDio(e);
    }
  }
}
