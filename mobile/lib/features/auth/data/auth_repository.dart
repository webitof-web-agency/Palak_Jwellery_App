import 'package:dio/dio.dart';

class AuthUser {
  const AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  final String id;
  final String name;
  final String email;
  final String role;

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['_id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      role: json['role']?.toString() ?? '',
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.token,
    this.user,
  });

  final String token;
  final AuthUser? user;
}

class AuthException implements Exception {
  const AuthException(this.message, {this.code = 'AUTH_ERROR', this.statusCode});

  final String message;
  final String code;
  final int? statusCode;

  @override
  String toString() => message;
}

class AuthRepository {
  const AuthRepository(this._dio);

  final Dio _dio;

  Future<AuthSession> login(String identifier, String password) async {
    try {
      final response = await _postLogin(identifier, password);
      return _sessionFromResponse(response);
    } on DioException catch (error) {
      if (_isTransientNetworkError(error)) {
        try {
          final response = await _postLogin(identifier, password);
          return _sessionFromResponse(response);
        } on DioException catch (retryError) {
          throw _mapDioError(retryError);
        }
      }

      throw _mapDioError(error);
    }
  }

  Future<Response<Map<String, dynamic>>> _postLogin(
    String identifier,
    String password,
  ) {
    return _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/login',
      data: {
        'email': identifier,
        'password': password,
      },
    );
  }

  AuthSession _sessionFromResponse(Response<Map<String, dynamic>> response) {
    final body = response.data;
    final payload = body?['data'];

    if (body == null ||
        body['success'] != true ||
        payload is! Map<String, dynamic>) {
      throw const AuthException(
        'Unexpected login response',
        code: 'INVALID_RESPONSE',
      );
    }

    final token = payload['token']?.toString();
    final userJson = payload['user'];

    if (token == null || token.isEmpty || userJson is! Map<String, dynamic>) {
      throw const AuthException(
        'Login response missing token',
        code: 'INVALID_RESPONSE',
      );
    }

    return AuthSession(token: token, user: AuthUser.fromJson(userJson));
  }

  bool _isTransientNetworkError(DioException error) {
    return error.response == null &&
        (error.type == DioExceptionType.connectionError ||
            error.type == DioExceptionType.connectionTimeout ||
            error.type == DioExceptionType.receiveTimeout ||
            error.type == DioExceptionType.sendTimeout);
  }

  Future<AuthUser> getMe() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/api/v1/auth/me');
      final body = response.data;
      final payload = body?['data'];

      if (body == null || body['success'] != true || payload is! Map<String, dynamic>) {
        throw const AuthException('Unexpected profile response', code: 'INVALID_RESPONSE');
      }

      return AuthUser.fromJson(payload);
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  AuthException _mapDioError(DioException error) {
    final data = error.response?.data;

    if (data is Map<String, dynamic>) {
      return AuthException(
        data['error']?.toString() ?? error.message ?? 'Request failed',
        code: data['code']?.toString() ?? 'AUTH_ERROR',
        statusCode: error.response?.statusCode,
      );
    }

    return AuthException(
      error.message ?? 'Request failed',
      code: 'AUTH_ERROR',
      statusCode: error.response?.statusCode,
    );
  }
}
