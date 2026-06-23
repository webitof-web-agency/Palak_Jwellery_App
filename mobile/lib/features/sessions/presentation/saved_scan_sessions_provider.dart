import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../customers/domain/customer_record.dart';
import '../data/saved_scan_sessions_store.dart';
import '../domain/scan_session_summary.dart';

final savedScanSessionsStoreProvider = Provider<SavedScanSessionsStore>(
  (ref) => SavedScanSessionsStore(const FlutterSecureStorage()),
);

final savedScanSessionsProvider =
    AsyncNotifierProvider<SavedScanSessionsNotifier, List<ScanSessionSummary>>(
  SavedScanSessionsNotifier.new,
);

class SavedScanSessionsNotifier extends AsyncNotifier<List<ScanSessionSummary>> {
  @override
  Future<List<ScanSessionSummary>> build() async {
    return ref.read(savedScanSessionsStoreProvider).loadAll();
  }

  Future<void> reload() async {
    state = const AsyncLoading();
    state = AsyncData(await ref.read(savedScanSessionsStoreProvider).loadAll());
  }

  Future<void> saveSession(ScanSessionSummary summary) async {
    await ref.read(savedScanSessionsStoreProvider).save(summary);
    await reload();
  }

  Future<void> deleteSession(String sessionId) async {
    await ref.read(savedScanSessionsStoreProvider).delete(sessionId);
    await reload();
  }

  Future<void> updateCustomer(CustomerRecord customer) async {
    final sessions = state.value ?? [];
    for (final session in sessions) {
      if (session.customer?.id == customer.id) {
        final updatedSession = session.copyWith(customer: customer);
        await ref.read(savedScanSessionsStoreProvider).save(updatedSession);
      }
    }
    await reload();
  }

  ScanSessionSummary? byId(String sessionId) {
    final sessions = state.maybeWhen(
      data: (value) => value,
      orElse: () => null,
    );
    if (sessions == null) {
      return null;
    }
    for (final session in sessions) {
      if (session.sessionId == sessionId) {
        return session;
      }
    }
    return null;
  }
}
