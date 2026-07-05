import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../customers/domain/customer_record.dart';
import '../data/capture_session_repository.dart';
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

  Future<ScanSessionSummary> syncSingleSession(ScanSessionSummary summary) async {
    var updatedSummary = summary;

    try {
      final syncResult = await ref
          .read(captureSessionRepositoryProvider)
          .mobileSyncSession(summary);

      final syncedCustomerId = syncResult.customerId;
      final updatedCustomer = syncedCustomerId != null &&
              syncedCustomerId.isNotEmpty &&
              summary.customer != null
          ? CustomerRecord(
              id: syncedCustomerId,
              name: summary.customer!.name,
              phone: summary.customer!.phone,
              area: summary.customer!.area,
              email: summary.customer!.email,
              isRecent: summary.customer!.isRecent,
              lastSeenLabel: summary.customer!.lastSeenLabel,
            )
          : summary.customer;

      updatedSummary = summary.copyWith(
        backendSessionId: syncResult.backendSessionId,
        syncStatus: syncResult.syncStatus,
        syncedAt: syncResult.syncedAt,
        syncError: '',
        customer: updatedCustomer,
      );
    } catch (error) {
      if (error is CaptureSessionApiException) {
        final nextStatus = error.code == 'NETWORK_ERROR'
            ? ScanSessionSyncStatus.pendingSync
            : ScanSessionSyncStatus.syncFailed;
        updatedSummary = summary.copyWith(
          syncStatus: nextStatus,
          syncError: error.message,
        );
      } else {
        updatedSummary = summary.copyWith(
          syncStatus: ScanSessionSyncStatus.syncFailed,
          syncError: error.toString(),
        );
      }
    }

    await ref.read(savedScanSessionsStoreProvider).save(updatedSummary);
    await reload();
    return updatedSummary;
  }

  Future<Map<String, int>> syncAllPending() async {
    final sessions = state.maybeWhen(
      data: (value) => value,
      orElse: () => const <ScanSessionSummary>[],
    );
    
    final pendingSessions = sessions.where((s) =>
        s.syncStatus == ScanSessionSyncStatus.pendingSync ||
        s.syncStatus == ScanSessionSyncStatus.syncFailed).toList();

    int successCount = 0;
    int failCount = 0;

    for (final session in pendingSessions) {
      final result = await syncSingleSession(session);
      if (result.syncStatus == ScanSessionSyncStatus.synced) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return {'success': successCount, 'fail': failCount};
  }

  int pendingSyncCount() {
    final sessions = state.maybeWhen(
      data: (value) => value,
      orElse: () => const <ScanSessionSummary>[],
    );
    return sessions.where((session) {
      return session.syncStatus == ScanSessionSyncStatus.pendingSync ||
          session.syncStatus == ScanSessionSyncStatus.syncFailed;
    }).length;
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
