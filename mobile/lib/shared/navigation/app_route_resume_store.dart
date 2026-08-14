import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AppRouteResumeStore {
  AppRouteResumeStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _routeKey = 'app_resume_route_v1';
  static String? _currentRoute;

  static String? get currentRoute => _currentRoute;

  Future<String?> load() async {
    final raw = await _storage.read(key: _routeKey);
    _currentRoute = _normalize(raw);
    return _currentRoute;
  }

  Future<void> save(String? location) async {
    final normalized = _normalize(location);
    _currentRoute = normalized;
    if (normalized == null) {
      await clear();
      return;
    }
    await _storage.write(key: _routeKey, value: normalized);
  }

  Future<void> clear() async {
    _currentRoute = null;
    await _storage.delete(key: _routeKey);
  }

  static String? normalizeForResume(String? location) {
    return _normalize(location);
  }

  static String? _normalize(String? location) {
    final raw = location?.trim();
    if (raw == null || raw.isEmpty) {
      return null;
    }

    final uri = Uri.tryParse(raw);
    if (uri == null) {
      return null;
    }

    final path = uri.path.trim();
    if (path.isEmpty || path == '/' || path == '/login') {
      return null;
    }

    if (path == '/scan-session/finish' ||
        path == '/scan-session/warnings' ||
        path == '/scanner') {
      return '/scan-session';
    }

    return uri.toString();
  }
}
