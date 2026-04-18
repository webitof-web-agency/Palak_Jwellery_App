import 'package:dio/dio.dart';

import '../auth/token_storage.dart';
import '../constants/api_constants.dart';

typedef UnauthorizedCallback = Future<void> Function();

Dio createDioClient({
  required TokenStorage tokenStorage,
  required UnauthorizedCallback onUnauthorized,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      sendTimeout: const Duration(seconds: 15),
      responseType: ResponseType.json,
      contentType: Headers.jsonContentType,
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await tokenStorage.getToken();

        if (token != null && token.isNotEmpty) {
          options.headers['Authorization'] = 'Bearer $token';
        }

        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await tokenStorage.deleteToken();
          await onUnauthorized();
        }

        handler.next(error);
      },
    ),
  );

  return dio;
}
