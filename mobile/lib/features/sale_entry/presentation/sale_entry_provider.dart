import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/auth/presentation/auth_notifier.dart';
import '../data/sale_repository.dart';

// ─── Providers ────────────────────────────────────────────────────────────────

final saleRepositoryProvider = Provider<SaleRepository>(
  (ref) => SaleRepository(ref.watch(dioClientProvider)),
);

final suppliersProvider = FutureProvider<List<SupplierModel>>((ref) {
  return ref.watch(saleRepositoryProvider).getSuppliers();
});

// ─── Sale Entry State ─────────────────────────────────────────────────────────

enum SaleSubmitStatus {
  idle,
  loading,
  duplicateWarning,
  success,
  error,
}

class SaleEntryState {
  const SaleEntryState({
    this.status = SaleSubmitStatus.idle,
    this.parseResult,
    this.createdSale,
    this.errorMessage,
    this.duplicateDate,
    this.retryCount = 0,
  });

  final SaleSubmitStatus status;
  final ParseQrResult? parseResult;
  final CreatedSale? createdSale;
  final String? errorMessage;
  final DateTime? duplicateDate;
  final int retryCount;

  SaleEntryState copyWith({
    SaleSubmitStatus? status,
    ParseQrResult? parseResult,
    CreatedSale? createdSale,
    String? errorMessage,
    DateTime? duplicateDate,
    int? retryCount,
  }) {
    return SaleEntryState(
      status: status ?? this.status,
      parseResult: parseResult ?? this.parseResult,
      createdSale: createdSale ?? this.createdSale,
      errorMessage: errorMessage ?? this.errorMessage,
      duplicateDate: duplicateDate ?? this.duplicateDate,
      retryCount: retryCount ?? this.retryCount,
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
    state = AsyncData((state.value ?? const SaleEntryState()).copyWith(
      parseResult: parseResult,
      status: SaleSubmitStatus.idle,
      errorMessage: null,
      duplicateDate: null,
    ));
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
    final retryCount = overrideDuplicate ? 0 : current.retryCount;
    final currentKey =
        idempotencyKey ?? DateTime.now().microsecondsSinceEpoch.toString();

    state = AsyncData(current.copyWith(
      status: SaleSubmitStatus.loading,
      errorMessage: null,
    ));

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
        idempotencyKey: currentKey,
      );

      state = AsyncData(SaleEntryState(
        status: SaleSubmitStatus.success,
        createdSale: created,
        parseResult: current.parseResult,
      ));
    } on DuplicateQrException catch (e) {
      state = AsyncData(SaleEntryState(
        status: SaleSubmitStatus.duplicateWarning,
        duplicateDate: e.previousSaleDate,
        errorMessage: e.message,
        parseResult: current.parseResult,
        retryCount: 0,
      ));
    } on SaleException catch (e) {
      final newRetry = retryCount + 1;
      state = AsyncData(SaleEntryState(
        status: SaleSubmitStatus.error,
        errorMessage: e.message,
        parseResult: current.parseResult,
        retryCount: newRetry,
      ));
    } catch (e) {
      state = AsyncData(SaleEntryState(
        status: SaleSubmitStatus.error,
        errorMessage: e.toString(),
        parseResult: current.parseResult,
        retryCount: retryCount + 1,
      ));
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
    );
  }
}

final saleEntryProvider = AsyncNotifierProvider<SaleEntryNotifier, SaleEntryState>(
  SaleEntryNotifier.new,
);
