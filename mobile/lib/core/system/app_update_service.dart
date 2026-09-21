import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import '../constants/api_constants.dart';

/// Update metadata and the APK itself are served by our own backend
/// (`GET /api/v1/app-version/latest` and `/download`), which proxies the
/// GitHub Releases API server-side. This works whether the release repo is
/// public or private: a private repo just needs `GITHUB_TOKEN` set in the
/// backend's environment. The app never talks to GitHub directly, so no
/// token is ever shipped inside the APK.
class AppUpdateException implements Exception {
  const AppUpdateException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AppUpdateInfo {
  const AppUpdateInfo({
    required this.currentVersion,
    required this.latestVersion,
    required this.releaseNotes,
    required this.downloadUrl,
    required this.apkSizeBytes,
  });

  final String currentVersion;
  final String latestVersion;
  final String releaseNotes;
  final String downloadUrl;
  final int apkSizeBytes;

  bool get updateAvailable =>
      _compareVersions(latestVersion, currentVersion) > 0;
}

/// Compares two `MAJOR.MINOR.PATCH` version strings.
/// Returns > 0 if [a] is newer than [b], < 0 if older, 0 if equal.
int _compareVersions(String a, String b) {
  final partsA = a.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  final partsB = b.split('.').map((p) => int.tryParse(p) ?? 0).toList();
  final length = partsA.length > partsB.length ? partsA.length : partsB.length;

  for (var i = 0; i < length; i++) {
    final valueA = i < partsA.length ? partsA[i] : 0;
    final valueB = i < partsB.length ? partsB[i] : 0;
    if (valueA != valueB) return valueA - valueB;
  }
  return 0;
}

class AppUpdateService {
  AppUpdateService(this._dio);

  final Dio _dio;

  Future<AppUpdateInfo> checkForUpdate() async {
    final packageInfo = await PackageInfo.fromPlatform();
    final currentVersion = packageInfo.version;

    final Response<Map<String, dynamic>> response;
    try {
      response = await _dio.get<Map<String, dynamic>>(
        '${ApiConstants.baseUrl}${ApiConstants.apiPrefix}/app-version/latest',
        options: Options(
          receiveTimeout: const Duration(seconds: 10),
          sendTimeout: const Duration(seconds: 10),
        ),
      );
    } on DioException catch (error) {
      throw AppUpdateException(
        error.message ?? 'Could not reach the server to check for updates.',
      );
    }

    final body = response.data?['data'] as Map<String, dynamic>?;
    if (body == null) {
      throw const AppUpdateException('Server returned an empty response.');
    }

    final latestVersion = body['version'] as String? ?? '';
    final downloadUrl = body['downloadUrl'] as String? ?? '';
    if (latestVersion.isEmpty || downloadUrl.isEmpty) {
      throw const AppUpdateException('Latest release is missing version info.');
    }

    return AppUpdateInfo(
      currentVersion: currentVersion,
      latestVersion: latestVersion,
      releaseNotes: (body['releaseNotes'] as String? ?? '').trim(),
      downloadUrl: downloadUrl,
      apkSizeBytes: (body['apkSizeBytes'] as num?)?.toInt() ?? 0,
    );
  }

  /// Downloads the APK for [info] to a temp file, reporting progress via
  /// [onProgress] (0.0 - 1.0), and returns the local file path.
  Future<String> downloadApk(
    AppUpdateInfo info, {
    void Function(double progress)? onProgress,
  }) async {
    final dir = await getTemporaryDirectory();
    final filePath =
        '${dir.path}/palak-jewellers-${info.latestVersion}.apk';

    try {
      await _dio.download(
        info.downloadUrl,
        filePath,
        onReceiveProgress: (received, total) {
          if (total > 0 && onProgress != null) {
            onProgress(received / total);
          }
        },
      );
    } on DioException catch (error) {
      throw AppUpdateException(
        error.message ?? 'Failed to download the update.',
      );
    }

    return filePath;
  }

  /// Hands the downloaded APK to the Android package installer.
  Future<void> installApk(String filePath) async {
    if (!Platform.isAndroid) {
      throw const AppUpdateException('Auto-update is only supported on Android.');
    }

    final result = await OpenFilex.open(filePath);
    if (result.type != ResultType.done) {
      throw AppUpdateException(
        result.message.isNotEmpty
            ? result.message
            : 'Could not start the installer.',
      );
    }
  }
}

final appUpdateServiceProvider = Provider<AppUpdateService>((ref) {
  return AppUpdateService(Dio());
});
