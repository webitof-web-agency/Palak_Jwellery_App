import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_notifier.dart';
import '../domain/customer_record.dart';

final customerRepositoryProvider = Provider<CustomerRepository>((ref) {
  return CustomerRepository(ref.watch(dioClientProvider));
});

final customersListProvider = FutureProvider.autoDispose<List<CustomerRecord>>((ref) {
  return ref.watch(customerRepositoryProvider).getCustomers();
});

class CustomerRepository {
  const CustomerRepository(this._dio);
  final Dio _dio;

  Future<List<CustomerRecord>> getCustomers() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/api/v1/customers');
      final body = response.data;
      if (body == null || body['success'] != true) {
        return [];
      }
      final data = body['data'] as List?;
      if (data == null) return [];
      
      return data
          .whereType<Map<String, dynamic>>()
          .map(CustomerRecord.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<CustomerRecord?> createCustomer(CustomerRecord customer) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/api/v1/customers',
        data: {
          'name': customer.name,
          'phone': customer.phone,
          'area': customer.area,
          if (customer.email != null && customer.email!.isNotEmpty) 'email': customer.email,
        },
      );
      final body = response.data;
      if (body != null && body['success'] == true && body['data'] != null) {
        return CustomerRecord.fromJson(body['data']);
      }
    } catch (_) {
      // Ignore errors for now, return null
    }
    return null;
  }
}
