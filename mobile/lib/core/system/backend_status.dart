import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../constants/api_constants.dart';

class BackendStatusException implements Exception {
  const BackendStatusException(this.message);

  final String message;

  @override
  String toString() => message;
}

class BackendStatusRepository {
  const BackendStatusRepository();

  Future<void> check() async {
    if (ApiConstants.baseUrl.trim().isEmpty) {
      throw const BackendStatusException('API base URL is missing.');
    }

    final dio = Dio(
      BaseOptions(
        baseUrl: ApiConstants.baseUrl,
        connectTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );

    try {
      final response = await dio.get<Map<String, dynamic>>(
        '${ApiConstants.apiPrefix}/health',
      );

      final body = response.data;
      if (body?['success'] != true) {
        throw const BackendStatusException(
          'Backend health endpoint returned an invalid response.',
        );
      }
    } on DioException catch (error) {
      throw BackendStatusException(
        error.message ??
            'Could not connect to the backend. Check the server and network path.',
      );
    }
  }
}

final backendStatusRepositoryProvider = Provider<BackendStatusRepository>(
  (ref) => const BackendStatusRepository(),
);

final backendStatusProvider = FutureProvider.autoDispose<void>((ref) {
  return ref.watch(backendStatusRepositoryProvider).check();
});
