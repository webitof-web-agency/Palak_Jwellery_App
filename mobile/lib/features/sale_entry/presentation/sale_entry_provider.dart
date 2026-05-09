import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../features/auth/presentation/auth_notifier.dart';
import '../data/pending_sale_queue.dart';
import '../data/sale_repository.dart';
import 'pending_sale_queue_provider.dart';

// ─── Providers ────────────────────────────────────────────────────────────────



final suppliersProvider = FutureProvider<List<SupplierModel>>((ref) {
  return ref.watch(saleRepositoryProvider).getSuppliers();
});

final businessOverviewProvider = FutureProvider<BusinessOverview>((ref) {
  return ref.watch(saleRepositoryProvider).getBusinessOverview();
});

// ─── Sale Entry State ─────────────────────────────────────────────────────────

enum SaleSubmitStatus { idle, loading, duplicateWarning, success, error }

class SaleEntryState {
  const SaleEntryState({
    this.status = SaleSubmitStatus.idle,
    this.parseResult,
    this.createdSale,
    this.errorMessage,
    this.duplicateDate,
    this.retryCount = 0,
    this.pendingDraftId,
    this.submissionKey,
  });

  final SaleSubmitStatus status;
  final ParseQrResult? parseResult;
  final CreatedSale? createdSale;
  final String? errorMessage;
  final DateTime? duplicateDate;
  final int retryCount;
  final String? pendingDraftId;
  final String? submissionKey;

  SaleEntryState copyWith({
    SaleSubmitStatus? status,
    ParseQrResult? parseResult,
    CreatedSale? createdSale,
    String? errorMessage,
    DateTime? duplicateDate,
    int? retryCount,
    String? pendingDraftId,
    String? submissionKey,
  }) {
    return SaleEntryState(
      status: status ?? this.status,
      parseResult: parseResult ?? this.parseResult,
      createdSale: createdSale ?? this.createdSale,
      errorMessage: errorMessage ?? this.errorMessage,
      duplicateDate: duplicateDate ?? this.duplicateDate,
      retryCount: retryCount ?? this.retryCount,
      pendingDraftId: pendingDraftId ?? this.pendingDraftId,
      submissionKey: submissionKey ?? this.submissionKey,
    );
  }
}

class SaleEntryNotifier extends AsyncNotifier<SaleEntryState> {
  @override
  Future<SaleEntryState> build() async {
    return const SaleEntryState();
  }

  void reset() {
    state = const AsyncData(SaleEntryState());
  }

  void setParseResult(ParseQrResult parseResult) {
    state = AsyncData(
      SaleEntryState(
        status: SaleSubmitStatus.idle,
        parseResult: parseResult,
      ),
    );
  }

  /// Submit a sale. Handles duplicates, retries, and all error states.
  Future<void> submit({
    required String supplierId,
    String? category,
    String? itemCode,
    String? metalType,
    String? purity,
    String? notes,
    required double grossWeight,
    required double stoneWeight,
    required double netWeight,
    String? qrRaw,
    bool overrideDuplicate = false,
    String? idempotencyKey,
  }) async {
    final current = state.value ?? const SaleEntryState();
    if (current.status == SaleSubmitStatus.loading) {
      return;
    }

    final retryCount = overrideDuplicate ? 0 : current.retryCount;
    final queueNotifier = ref.read(pendingSaleQueueProvider.notifier);
    final user = ref.read(authSessionProvider).value?.user;
    final rawQr = qrRaw?.trim().isNotEmpty == true ? qrRaw!.trim() : null;
    final existingDraft = current.pendingDraftId == null
        ? await queueNotifier.findMatchingDraft(
            rawQr: rawQr ?? '',
            supplierId: supplierId,
          )
        : null;
    final currentKey = idempotencyKey ??
        current.submissionKey ??
        existingDraft?.idempotencyKey ??
        DateTime.now().microsecondsSinceEpoch.toString();
    final payload = PendingSalePayload(
      supplierId: supplierId,
      supplierName: null,
      category: category,
      itemCode: itemCode,
      metalType: metalType,
      purity: purity,
      notes: notes,
      grossWeight: grossWeight,
      stoneWeight: stoneWeight,
      netWeight: netWeight,
      qrRaw: rawQr,
      overrideDuplicate: overrideDuplicate,
      parseSnapshot: current.parseResult == null
          ? const {}
          : {
              'raw': current.parseResult!.raw,
              'success': current.parseResult!.success,
              'itemCode': {
                'value': current.parseResult!.itemCode.value,
                'parsed': current.parseResult!.itemCode.parsed,
              },
              'category': {
                'value': current.parseResult!.category.value,
                'parsed': current.parseResult!.category.parsed,
              },
              'purity': {
                'value': current.parseResult!.purity.value,
                'parsed': current.parseResult!.purity.parsed,
              },
              'grossWeight': {
                'value': current.parseResult!.grossWeight.value,
                'parsed': current.parseResult!.grossWeight.parsed,
              },
              'stoneWeight': {
                'value': current.parseResult!.stoneWeight.value,
                'parsed': current.parseResult!.stoneWeight.parsed,
              },
              'netWeight': {
                'value': current.parseResult!.netWeight.value,
                'parsed': current.parseResult!.netWeight.parsed,
              },
              'errors': current.parseResult!.errors
                  .map(
                    (error) => {
                      'field': error.field,
                      'reason': error.reason,
                    },
                  )
                  .toList(),
              if (current.parseResult!.supplier != null)
                'supplier': {
                  'id': current.parseResult!.supplier!.id,
                  'name': current.parseResult!.supplier!.name,
                  'code': current.parseResult!.supplier!.code,
                },
              if (current.parseResult!.matchType != null)
                'matchType': current.parseResult!.matchType,
            },
    );

    final draftId = existingDraft?.id ?? current.pendingDraftId ?? currentKey;
    final draft = await queueNotifier.savePending(
      draft: PendingSaleDraft(
        id: draftId,
        idempotencyKey: currentKey,
        payload: payload,
        status: PendingSaleStatus.pending,
        createdAt: existingDraft?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
        retryCount: existingDraft?.retryCount ?? retryCount,
        createdByUserName: user?.name ?? 'Salesman',
        createdByUserId: user?.id,
        errorMessage: existingDraft?.errorMessage,
      ),
      payload: payload,
      createdByUserName: user?.name ?? 'Salesman',
      createdByUserId: user?.id,
      status: PendingSaleStatus.pending,
    );

    state = AsyncData(
      current.copyWith(
        status: SaleSubmitStatus.loading,
        errorMessage: null,
        pendingDraftId: draft.id,
        submissionKey: draft.idempotencyKey,
      ),
    );

    try {
      final repo = ref.read(saleRepositoryProvider);
      final created = await repo.createSale(
        supplierId: supplierId,
        category: category,
        itemCode: itemCode,
        metalType: metalType,
        purity: purity,
        notes: notes,
        grossWeight: grossWeight,
        stoneWeight: stoneWeight,
        netWeight: netWeight,
        qrRaw: qrRaw,
        overrideDuplicate: overrideDuplicate,
        idempotencyKey: draft.idempotencyKey,
      );

      await queueNotifier.markSynced(draft.id);
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.success,
          createdSale: created,
          parseResult: current.parseResult,
          pendingDraftId: null,
          submissionKey: null,
        ),
      );
    } on DuplicateQrException catch (e) {
      final nextRetry = draft.retryCount + 1;
      await queueNotifier.markFailed(
        draft.id,
        e.message,
        retryCount: nextRetry,
      );
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.duplicateWarning,
          duplicateDate: e.previousSaleDate,
          errorMessage: e.message,
          parseResult: current.parseResult,
          retryCount: nextRetry,
          pendingDraftId: draft.id,
          submissionKey: draft.idempotencyKey,
        ),
      );
    } on SaleException catch (e) {
      final nextRetry = draft.retryCount + 1;
      await queueNotifier.markFailed(
        draft.id,
        e.message,
        retryCount: nextRetry,
      );
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.error,
          errorMessage: e.message,
          parseResult: current.parseResult,
          retryCount: nextRetry,
          pendingDraftId: draft.id,
          submissionKey: draft.idempotencyKey,
        ),
      );
    } catch (e) {
      final errorMessage = e.toString();
      final nextRetry = draft.retryCount + 1;
      await queueNotifier.markFailed(
        draft.id,
        errorMessage,
        retryCount: nextRetry,
      );
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.error,
          errorMessage: errorMessage,
          parseResult: current.parseResult,
          retryCount: nextRetry,
          pendingDraftId: draft.id,
          submissionKey: draft.idempotencyKey,
        ),
      );
    }
  }

  /// Call after user confirms "Save anyway" on duplicate warning
  Future<void> confirmDuplicate({
    required String supplierId,
    String? category,
    String? itemCode,
    String? metalType,
    String? purity,
    String? notes,
    required double grossWeight,
    required double stoneWeight,
    required double netWeight,
    String? qrRaw,
  }) async {
    await submit(
      supplierId: supplierId,
      category: category,
      itemCode: itemCode,
      metalType: metalType,
      purity: purity,
      notes: notes,
      grossWeight: grossWeight,
      stoneWeight: stoneWeight,
      netWeight: netWeight,
      qrRaw: qrRaw,
      overrideDuplicate: true,
      idempotencyKey: state.value?.submissionKey,
    );
  }
}

final saleEntryProvider =
    AsyncNotifierProvider<SaleEntryNotifier, SaleEntryState>(
      SaleEntryNotifier.new,
    );
