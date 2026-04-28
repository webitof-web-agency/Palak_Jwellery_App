import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/dio_client.dart';
import '../../../core/auth/token_storage.dart';
import '../../auth/data/auth_repository.dart';

final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => TokenStorage(FlutterSecureStorage()),
);

final authSessionProvider =
    AsyncNotifierProvider<AuthSessionNotifier, AuthSession?>(
  AuthSessionNotifier.new,
);

final dioClientProvider = Provider<Dio>((ref) {
  final tokenStorage = ref.watch(tokenStorageProvider);

  return createDioClient(
    tokenStorage: tokenStorage,
    onUnauthorized: () async {
      await ref.read(authSessionProvider.notifier).clearSession();
    },
  );
});

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(dioClientProvider)),
);

final authNotifierProvider = AsyncNotifierProvider<AuthNotifier, void>(
  AuthNotifier.new,
);

class AuthSessionNotifier extends AsyncNotifier<AuthSession?> {
  @override
  Future<AuthSession?> build() async {
    final token = await ref.read(tokenStorageProvider).getToken();

    if (token == null || token.isEmpty) {
      return null;
    }

    return AuthSession(token: token);
  }

  Future<void> setSession(AuthSession session) async {
    await ref.read(tokenStorageProvider).saveToken(session.token);
    state = AsyncData(session);
  }

  Future<void> clearSession() async {
    await ref.read(tokenStorageProvider).deleteToken();
    state = const AsyncData(null);
  }
}

class AuthNotifier extends AsyncNotifier<void> {
  @override
  Future<void> build() async {}

  Future<void> login(String identifier, String password) async {
    state = const AsyncLoading();

    try {
      final session = await ref.read(authRepositoryProvider).login(identifier, password);
      await ref.read(authSessionProvider.notifier).setSession(session);
      state = const AsyncData(null);
    } catch (error, stackTrace) {
      state = AsyncError(error, stackTrace);
      rethrow;
    }
  }
}
