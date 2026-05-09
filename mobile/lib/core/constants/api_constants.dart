class ApiConstants {
  // Override this at build time:
  // flutter run --dart-define=API_BASE_URL=https://api.example.com
  // flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com
  static const String _defaultBaseUrl = 'http://192.168.1.43:3000';
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _defaultBaseUrl,
  );
  static const String apiPrefix = '/api/v1';
}
