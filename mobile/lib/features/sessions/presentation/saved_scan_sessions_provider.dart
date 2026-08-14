import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';

import '../../customers/domain/customer_record.dart';
import '../data/capture_session_repository.dart';
import '../data/saved_scan_sessions_store.dart';
import '../domain/capture_session_models.dart';
import '../domain/scan_session_draft.dart';
import '../domain/scan_session_summary.dart';

final savedScanSessionsStoreProvider = Provider<SavedScanSessionsStore>(
  (ref) => SavedScanSessionsStore(const FlutterSecureStorage()),
);

final savedScanSessionsProvider =
    AsyncNotifierProvider<SavedScanSessionsNotifier, List<ScanSessionSummary>>(
  SavedScanSessionsNotifier.new,
);

final salesScansSessionsProvider = FutureProvider.autoDispose<List<ScanSessionSummary>>((ref) async {
  final localSessions = await ref.watch(savedScanSessionsProvider.future);
  final repository = ref.watch(captureSessionRepositoryProvider);

  try {
    final remotePage = await repository.getMySessions(page: 1, limit: 100);
    final remoteSessions = remotePage.sessions.map(_buildMergedSessionFromCaptureItem).toList(growable: false);

    final localKeys = localSessions.map(_sessionMergeKey).toSet();
    final mergedRemote = remoteSessions.where((session) => !localKeys.contains(_sessionMergeKey(session))).toList(growable: false);

    final allSessions = [...localSessions, ...mergedRemote];
    allSessions.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return allSessions;
  } catch (error) {
    debugPrint('Failed to load remote sessions for My Sales / Scans: $error');
  }

  final fallback = [...localSessions];
  fallback.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return fallback;
});

ScanSessionSummary _buildSummaryFromCaptureDetail(CaptureSessionDetail detail) {
  final customerName = detail.customerName.trim().isNotEmpty ? detail.customerName.trim() : 'Unknown customer';
  final customer = CustomerRecord(
    id: detail.customerId?.trim().isNotEmpty == true ? detail.customerId!.trim() : '',
    name: customerName,
    phone: detail.customerPhone.trim(),
    area: detail.customerArea?.trim().isNotEmpty == true ? detail.customerArea!.trim() : '',
    email: detail.customerEmail?.trim().isNotEmpty == true ? detail.customerEmail!.trim() : null,
    isRecent: true,
    lastSeenLabel: null,
    lastSessionAt: detail.createdAt,
  );

  final lockedSettings = detail.lockedSettings == null
      ? const ScanSessionLockedSettings(
          supplier: null,
          category: null,
          karat: null,
          originalPurity: null,
          selectedPurity: null,
          originalWastage: null,
          selectedWastage: null,
          originalStonePrice: null,
          selectedStonePrice: null,
        )
      : ScanSessionLockedSettings.fromJson(detail.lockedSettings!);

  final items = detail.items
      .map(
        (item) => ScannedSessionItem(
          id: item.id,
          itemCode: item.itemCode,
          supplier: item.supplierName,
          category: item.category,
          jewelType: item.jewelType,
          qrKarat: item.qrKarat,
          karat: item.appliedKarat ?? item.qrKarat ?? lockedSettings.karat ?? '',
          purityPercent: item.purityPercent,
          wastagePercent: item.wastagePercent,
          grossWeight: item.grossWeight,
          stoneWeight: item.stoneWeight,
          otherWeight: item.otherWeight,
          stoneAmount: item.stoneAmount == 0 ? null : item.stoneAmount,
          otherAmount: item.otherAmount == 0 ? null : item.otherAmount,
          msAmount: null,
          ssAmount: null,
          totalStoneAmount: item.stoneAmount == 0 ? null : item.stoneAmount,
          rawQr: item.rawQr,
          addedAt: item.addedAt,
          status: null,
          requiresReview: item.requiresReview,
          hasKaratMismatch: item.hasKaratMismatch,
          isDuplicate: item.isDuplicate,
          hasSupplierMismatch: item.hasSupplierMismatch,
          hasWeightMismatch: item.hasWeightMismatch,
          hasPurityOverride: item.hasPurityOverride,
          hasWastageOverride: item.hasWastageOverride,
          warningLabel: item.warningLabel,
        ),
      )
      .toList(growable: false);

  final warningCounts = ScanSessionWarningCounts(
    duplicates: detail.duplicateCount,
    supplierMismatch: 0,
    karatMismatch: 0,
    weightMismatch: detail.warningsCount,
    customPurityOverrides: 0,
    customWastageOverrides: detail.manualOverrideCount,
  );

  return ScanSessionSummary(
    sessionId: detail.id,
    clientSessionId: detail.id,
    backendSessionId: detail.id,
    customer: customer,
    lockedSettings: lockedSettings,
    items: items,
    totalItems: detail.itemCount,
    totalGrossWeight: detail.totals.grossWeight,
    totalStoneWeight: detail.totals.stoneWeight,
    totalOtherWeight: detail.totals.otherWeight,
    totalNetWeight: detail.totals.netWeight,
    totalFineWeight: detail.totals.fineWeight,
    totalStoneAmount: detail.totals.stoneAmount,
    totalOtherAmount: 0.0,
    warningCounts: warningCounts,
    supplierBreakdown: const <ScanSessionSupplierSummary>[],
    createdAt: detail.createdAt ?? DateTime.now(),
    updatedAt: detail.updatedAt ?? detail.createdAt ?? DateTime.now(),
    notes: detail.referenceNote,
    status: detail.status,
    syncStatus: ScanSessionSyncStatus.synced,
    syncedAt: detail.updatedAt ?? detail.createdAt,
  );
}

final salesSessionSummaryByIdProvider = FutureProvider.autoDispose.family<ScanSessionSummary?, String>((ref, sessionId) async {
  final localSessions = await ref.watch(savedScanSessionsProvider.future);
  for (final session in localSessions) {
    if (session.sessionId == sessionId || session.backendSessionId == sessionId) {
      return session;
    }
  }

  try {
    final detail = await ref.watch(captureSessionRepositoryProvider).getSessionDetail(sessionId);
    return _buildSummaryFromCaptureDetail(detail);
  } catch (error) {
    debugPrint('Failed to load session detail for My Sales / Scans: $error');
    return null;
  }
});

final customerScanSessionsProvider =
    FutureProvider.autoDispose.family<List<ScanSessionSummary>, String>((ref, customerId) async {
  final localSessionsAsync = await ref.watch(savedScanSessionsProvider.future);
  final localSessions = localSessionsAsync.where((s) => s.customer?.id == customerId).toList();

  final repository = ref.watch(captureSessionRepositoryProvider);
  try {
    final remotePage = await repository.getMySessions(customerId: customerId, page: 1, limit: 100);

    final remoteSessions = remotePage.sessions.map((item) {
      return _buildMergedSessionFromCaptureItem(
        item,
        customerId: customerId,
      );
    }).toList(growable: false);

    // Merge them, prioritizing local sessions to avoid duplicates
    final localKeys = localSessions.map(_sessionMergeKey).toSet();
    final uniqueRemoteSessions = remoteSessions.where((e) => !localKeys.contains(_sessionMergeKey(e))).toList();

    final allSessions = [...localSessions, ...uniqueRemoteSessions];
    allSessions.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return allSessions;
  } catch (e) {
    debugPrint('Failed to load remote sessions for customer: $e');
  }

  localSessions.sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return localSessions;
});

String _sessionMergeKey(ScanSessionSummary summary) {
  final backendId = summary.backendSessionId?.trim();
  if (backendId != null && backendId.isNotEmpty) {
    return 'backend:$backendId';
  }
  return 'local:${summary.sessionId.trim()}';
}

CustomerRecord _buildCustomerRecordFromCaptureItem(
  CaptureSessionListItem item, {
  String? customerId,
}) {
  return CustomerRecord(
    id: customerId?.trim().isNotEmpty == true ? customerId!.trim() : '',
    name: item.customerName.trim().isNotEmpty ? item.customerName.trim() : 'Unknown customer',
    phone: item.customerPhone.trim(),
    area: '',
    email: null,
    isRecent: true,
    lastSeenLabel: null,
    lastSessionAt: item.createdAt,
  );
}

ScanSessionSummary _buildMergedSessionFromCaptureItem(
  CaptureSessionListItem item, {
  String? customerId,
}) {
  return ScanSessionSummary(
    sessionId: item.id,
    clientSessionId: item.id,
    backendSessionId: item.id,
    customer: _buildCustomerRecordFromCaptureItem(item, customerId: customerId),
    lockedSettings: const ScanSessionLockedSettings(
      supplier: null,
      category: null,
      karat: null,
      originalPurity: null,
      selectedPurity: null,
      originalWastage: null,
      selectedWastage: null,
      originalStonePrice: null,
      selectedStonePrice: null,
    ),
    items: const [],
    totalItems: item.itemCount,
    totalGrossWeight: item.totals.grossWeight,
    totalStoneWeight: item.totals.stoneWeight,
    totalOtherWeight: item.totals.otherWeight,
    totalNetWeight: item.totals.netWeight,
    totalFineWeight: item.totals.fineWeight,
    totalStoneAmount: item.totals.stoneAmount,
    totalOtherAmount: 0.0,
    warningCounts: ScanSessionWarningCounts(
      duplicates: item.duplicateCount,
      supplierMismatch: 0,
      karatMismatch: 0,
      weightMismatch: item.warningsCount,
      customPurityOverrides: 0,
      customWastageOverrides: item.manualOverrideCount,
    ),
    supplierBreakdown: const <ScanSessionSupplierSummary>[],
    createdAt: item.createdAt ?? DateTime.now(),
    updatedAt: item.updatedAt ?? item.createdAt ?? DateTime.now(),
    notes: item.referenceNote,
    status: item.status,
    syncStatus: ScanSessionSyncStatus.synced,
    syncedAt: item.updatedAt ?? item.createdAt,
  );
}

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
              lastSessionAt: summary.customer!.lastSessionAt,
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



