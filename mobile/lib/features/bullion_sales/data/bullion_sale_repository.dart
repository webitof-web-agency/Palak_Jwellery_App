import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../../customers/domain/customer_record.dart';
import '../domain/bullion_sale.dart';
import '../domain/bullion_sale_entry.dart';

final bullionSaleRepositoryProvider = Provider<BullionSaleRepository>((ref) {
  return BullionSaleRepository(ref.watch(dioClientProvider));
});

final todayBullionCustomersProvider = FutureProvider.autoDispose<List<CustomerRecord>>((ref) {
  return ref.watch(bullionSaleRepositoryProvider).getTodayBullionCustomers();
});

final bullionSalesHistoryProvider = FutureProvider.autoDispose<BullionSalesPage>((ref) {
  return ref.watch(bullionSaleRepositoryProvider).getBullionSales(page: 1, limit: 50);
});

final bullionSalesByCustomerProvider =
    FutureProvider.autoDispose.family<List<BullionSale>, String>((ref, customerId) {
  return ref.watch(bullionSaleRepositoryProvider).getBullionSalesByCustomer(customerId);
});

class BullionSaleRepository {
  const BullionSaleRepository(this._dio);

  final Dio _dio;

  Future<void> createBullionSale(BullionSaleEntry entry) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/v1/bullion-sales',
        data: entry.toJson(),
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw Exception(body?['error']?.toString() ?? 'Bullion sale save failed');
      }
    } catch (error) {
      debugPrint('Bullion sale save failed for ${entry.clientEntryId}: $error');
      rethrow;
    }
  }

  Future<List<CustomerRecord>> getTodayBullionCustomers() async {
    try {
      final now = DateTime.now();
      final todayStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/bullion-sales',
        queryParameters: {
          'startDate': todayStr,
          'limit': 200,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) return [];
      
      final dynamic responseData = body['data'];
      List<dynamic> salesList = [];
      if (responseData is List) {
        salesList = responseData;
      } else if (responseData is Map && responseData['data'] is List) {
        salesList = responseData['data'];
      }

      final Map<String, CustomerRecord> uniqueCustomers = {};

      for (final saleJson in salesList) {
        if (saleJson is! Map<String, dynamic>) continue;
        final customerObj = saleJson['customer'];
        if (customerObj is Map<String, dynamic>) {
          final customer = CustomerRecord(
            id: customerObj['id']?.toString() ?? customerObj['_id']?.toString() ?? '',
            name: customerObj['name']?.toString() ?? '',
            phone: customerObj['phone']?.toString() ?? '',
            area: customerObj['area']?.toString() ?? '',
            email: customerObj['email']?.toString(),
            isRecent: true,
          );
          if (customer.name.isNotEmpty) {
             final key = customer.id.isNotEmpty ? customer.id : customer.name;
             if (!uniqueCustomers.containsKey(key)) {
                uniqueCustomers[key] = customer;
             }
          }
        } else {
           final id = saleJson['customerId']?.toString() ?? '';
           final name = saleJson['customerName']?.toString() ?? '';
           final phone = saleJson['customerPhone']?.toString() ?? '';
           final area = saleJson['customerArea']?.toString() ?? '';
           final email = saleJson['customerEmail']?.toString();
           
           if (name.isNotEmpty) {
             final key = id.isNotEmpty ? id : name;
             if (!uniqueCustomers.containsKey(key)) {
                uniqueCustomers[key] = CustomerRecord(
                  id: id,
                  name: name,
                  phone: phone,
                  area: area,
                  email: email,
                  isRecent: true,
                );
             }
           }
        }
      }
      return uniqueCustomers.values.toList();
    } catch (e) {
      debugPrint('Failed to get today bullion customers: $e');
      return [];
    }
  }

  Future<BullionSalesPage> getBullionSales({int page = 1, int limit = 50, String? q}) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (q != null && q.isNotEmpty) params['q'] = q;

      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/bullion-sales',
        queryParameters: params,
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        return const BullionSalesPage(sales: [], total: 0, page: 1, pages: 1);
      }
      final dynamic responseData = body['data'];
      if (responseData is Map<String, dynamic>) {
        return BullionSalesPage.fromJson(responseData);
      }
      return const BullionSalesPage(sales: [], total: 0, page: 1, pages: 1);
    } catch (e) {
      debugPrint('getBullionSales failed: $e');
      rethrow;
    }
  }

  Future<List<BullionSale>> getBullionSalesByCustomer(String customerId) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/api/v1/bullion-sales/customer/$customerId',
        queryParameters: {'limit': 100},
      );
      final body = response.data;
      if (body == null || body['success'] != true) return [];
      final dynamic responseData = body['data'];
      if (responseData is Map<String, dynamic>) {
        return BullionSalesPage.fromJson(responseData).sales;
      }
      if (responseData is List) {
        return responseData
            .whereType<Map<String, dynamic>>()
            .map(BullionSale.fromJson)
            .toList(growable: false);
      }
      return [];
    } catch (e) {
      debugPrint('getBullionSalesByCustomer failed: $e');
      return [];
    }
  }
}
