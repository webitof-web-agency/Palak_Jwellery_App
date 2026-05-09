import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/auth/presentation/auth_notifier.dart';
import '../data/pending_sale_queue.dart';
import '../data/sale_repository.dart';

final pendingSaleQueueStoreProvider = Provider<PendingSaleQueueStore>(
  (ref) => PendingSaleQueueStore(const FlutterSecureStorage()),
);

class PendingSaleRetryResult {
  const PendingSaleRetryResult({
    required this.success,
    required this.message,
  });

  final bool success;
  final String message;
}

final pendingSaleQueueProvider =
    AsyncNotifierProvider<PendingSaleQueueNotifier, List<PendingSaleDraft>>(
  PendingSaleQueueNotifier.new,
);

class PendingSaleQueueNotifier extends AsyncNotifier<List<PendingSaleDraft>> {
  @override
  Future<List<PendingSaleDraft>> build() async {
    return ref.read(pendingSaleQueueStoreProvider).load();
  }

  PendingSaleQueueStore get _store => ref.read(pendingSaleQueueStoreProvider);

  List<PendingSaleDraft> _currentDrafts() {
    return [...(state.value ?? const <PendingSaleDraft>[])];
  }

  Future<void> _persist(List<PendingSaleDraft> drafts) async {
    final sorted = [...drafts]..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    state = AsyncData(sorted);
    await _store.save(sorted);
  }

  Future<PendingSaleDraft?> findMatchingDraft({
    required String rawQr,
    required String supplierId,
  }) async {
    if (rawQr.trim().isEmpty) {
      return null;
    }

    final drafts = state.value ?? await _store.load();
    final matches = drafts.where((draft) {
      final payload = draft.payload;
      final sameRaw = (payload.qrRaw ?? '') == rawQr;
      final sameSupplier = payload.supplierId == supplierId;
      return sameRaw && sameSupplier && !draft.isResolved;
    }).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    return matches.isEmpty ? null : matches.first;
  }

  Future<PendingSaleDraft> savePending({
    PendingSaleDraft? draft,
    required PendingSalePayload payload,
    required String createdByUserName,
    String? createdByUserId,
    String? errorMessage,
    PendingSaleStatus status = PendingSaleStatus.pending,
  }) async {
    final now = DateTime.now();
    final currentDrafts = _currentDrafts();
    final baseDraft = draft ??
        PendingSaleDraft(
          id: now.microsecondsSinceEpoch.toString(),
          idempotencyKey: now.microsecondsSinceEpoch.toString(),
          payload: payload,
          status: status,
          createdAt: now,
          updatedAt: now,
          retryCount: 0,
          errorMessage: errorMessage,
          createdByUserId: createdByUserId,
          createdByUserName: createdByUserName,
        );

    final draftToSave = baseDraft.copyWith(
      payload: payload,
      status: status,
      updatedAt: now,
      errorMessage: errorMessage,
      createdByUserId: createdByUserId,
      createdByUserName: createdByUserName,
    );

    final index = currentDrafts.indexWhere((item) => item.id == draftToSave.id);
    if (index >= 0) {
      currentDrafts[index] = draftToSave;
    } else {
      currentDrafts.add(draftToSave);
    }

    await _persist(currentDrafts);
    return draftToSave;
  }

  Future<void> markSynced(String draftId) async {
    final currentDrafts = _currentDrafts()..removeWhere((item) => item.id == draftId);
    await _persist(currentDrafts);
  }

  Future<PendingSaleDraft?> markFailed(
    String draftId,
    String message, {
    int? retryCount,
  }) async {
    final currentDrafts = _currentDrafts();
    final index = currentDrafts.indexWhere((item) => item.id == draftId);
    if (index < 0) {
      return null;
    }

    final now = DateTime.now();
    final updated = currentDrafts[index].copyWith(
      status: PendingSaleStatus.failed,
      errorMessage: message,
      retryCount: retryCount ?? currentDrafts[index].retryCount,
      updatedAt: now,
    );
    currentDrafts[index] = updated;
    await _persist(currentDrafts);
    return updated;
  }

  Future<PendingSaleDraft?> retryDraft(String draftId) async {
    final currentDrafts = _currentDrafts();
    final index = currentDrafts.indexWhere((item) => item.id == draftId);
    if (index < 0) {
      return null;
    }

    final updated = currentDrafts[index].copyWith(
      status: PendingSaleStatus.pending,
      errorMessage: null,
      retryCount: currentDrafts[index].retryCount + 1,
      updatedAt: DateTime.now(),
    );
    currentDrafts[index] = updated;
    await _persist(currentDrafts);
    return updated;
  }

  Future<PendingSaleRetryResult> submitDraft(PendingSaleDraft draft) async {
    final repo = ref.read(saleRepositoryProvider);
    final currentUserName =
        ref.read(authSessionProvider).value?.user?.name ?? 'Salesman';
    final currentUserId = ref.read(authSessionProvider).value?.user?.id;

    await savePending(
      draft: draft,
      payload: draft.payload,
      createdByUserName: currentUserName,
      createdByUserId: currentUserId,
      status: PendingSaleStatus.pending,
    );

    try {
      final created = await repo.createSale(
        supplierId: draft.payload.supplierId,
        category: draft.payload.category,
        itemCode: draft.payload.itemCode,
        metalType: draft.payload.metalType,
        purity: draft.payload.purity,
        notes: draft.payload.notes,
        grossWeight: draft.payload.grossWeight,
        stoneWeight: draft.payload.stoneWeight,
        netWeight: draft.payload.netWeight,
        qrRaw: draft.payload.qrRaw,
        overrideDuplicate: draft.payload.overrideDuplicate,
        idempotencyKey: draft.idempotencyKey,
      );

      await markSynced(draft.id);
      return PendingSaleRetryResult(
        success: true,
        message: created.ref.isNotEmpty
            ? 'Sale synced: ${created.ref}'
            : 'Sale synced successfully',
      );
    } on DuplicateQrException catch (error) {
      await markFailed(
        draft.id,
        error.message,
        retryCount: draft.retryCount + 1,
      );
      return PendingSaleRetryResult(
        success: false,
        message: error.message,
      );
    } on SaleException catch (error) {
      await markFailed(
        draft.id,
        error.message,
        retryCount: draft.retryCount + 1,
      );
      return PendingSaleRetryResult(
        success: false,
        message: error.message,
      );
    } catch (error) {
      await markFailed(
        draft.id,
        error.toString(),
        retryCount: draft.retryCount + 1,
      );
      return PendingSaleRetryResult(
        success: false,
        message: error.toString(),
      );
    }
  }
}
