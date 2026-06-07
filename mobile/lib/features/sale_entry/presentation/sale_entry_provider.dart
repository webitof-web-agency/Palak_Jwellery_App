import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/sale_repository.dart';

final suppliersProvider = FutureProvider<List<SupplierModel>>((ref) {
  return ref.watch(saleRepositoryProvider).getSuppliers();
});

final businessOverviewProvider = FutureProvider<BusinessOverview>((ref) {
  return ref.watch(saleRepositoryProvider).getBusinessOverview();
});

final karatOptionsProvider = FutureProvider<List<KaratOption>>((ref) {
  return ref.watch(saleRepositoryProvider).getKaratOptions();
});

enum SaleSubmitStatus { idle, loading, duplicateWarning, success, error }

class SaleEntryState {
  const SaleEntryState({
    this.status = SaleSubmitStatus.idle,
    this.parseResult,
    this.createdSale,
    this.errorMessage,
    this.duplicateDate,
    this.submissionKey,
    this.isNetworkError = false,
  });

  final SaleSubmitStatus status;
  final ParseQrResult? parseResult;
  final CreatedSale? createdSale;
  final String? errorMessage;
  final DateTime? duplicateDate;
  final String? submissionKey;
  final bool isNetworkError;

  SaleEntryState copyWith({
    SaleSubmitStatus? status,
    ParseQrResult? parseResult,
    CreatedSale? createdSale,
    String? errorMessage,
    DateTime? duplicateDate,
    String? submissionKey,
    bool? isNetworkError,
  }) {
    return SaleEntryState(
      status: status ?? this.status,
      parseResult: parseResult ?? this.parseResult,
      createdSale: createdSale ?? this.createdSale,
      errorMessage: errorMessage ?? this.errorMessage,
      duplicateDate: duplicateDate ?? this.duplicateDate,
      submissionKey: submissionKey ?? this.submissionKey,
      isNetworkError: isNetworkError ?? this.isNetworkError,
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

  Future<void> submit({
    required String supplierId,
    String? batchId,
    String? batchRef,
    int? batchRevision,
    String? category,
    String? itemCode,
    String? metalType,
    String? karat,
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

    final currentKey = idempotencyKey ?? current.submissionKey ?? DateTime.now().microsecondsSinceEpoch.toString();
    final rawQr = qrRaw?.trim().isNotEmpty == true ? qrRaw!.trim() : null;
    final parseSnapshot = current.parseResult == null
        ? const <String, dynamic>{}
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
            'karat': {
              'value': current.parseResult!.karat.value,
              'parsed': current.parseResult!.karat.parsed,
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
          };

    state = AsyncData(
      current.copyWith(
        status: SaleSubmitStatus.loading,
        errorMessage: null,
        isNetworkError: false,
        submissionKey: currentKey,
      ),
    );

    try {
      final created = await ref.read(saleRepositoryProvider).createSale(
        supplierId: supplierId,
        batchId: batchId,
        category: category,
        itemCode: itemCode,
        metalType: metalType,
        karat: karat,
        purity: purity,
        notes: notes,
        grossWeight: grossWeight,
        stoneWeight: stoneWeight,
        netWeight: netWeight,
        qrRaw: rawQr,
        displaySnapshot: current.parseResult?.displaySnapshot,
        parsedSnapshot: current.parseResult?.normalizedSnapshot ?? (parseSnapshot.isEmpty ? null : parseSnapshot),
        overrideDuplicate: overrideDuplicate,
        idempotencyKey: currentKey,
      );

      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.success,
          createdSale: created,
          parseResult: current.parseResult,
          submissionKey: null,
        ),
      );
    } on DuplicateQrException catch (e) {
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.duplicateWarning,
          duplicateDate: e.previousSaleDate,
          errorMessage: e.message,
          parseResult: current.parseResult,
          submissionKey: currentKey,
        ),
      );
    } on SaleException catch (e) {
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.error,
          errorMessage: e.code == 'NETWORK_ERROR'
              ? 'No internet connection. Try again when connected.'
              : e.message,
          parseResult: current.parseResult,
          submissionKey: currentKey,
          isNetworkError: e.code == 'NETWORK_ERROR',
        ),
      );
    } catch (e) {
      state = AsyncData(
        SaleEntryState(
          status: SaleSubmitStatus.error,
          errorMessage: e.toString(),
          parseResult: current.parseResult,
          submissionKey: currentKey,
        ),
      );
    }
  }

  Future<void> confirmDuplicate({
    required String supplierId,
    String? batchId,
    String? batchRef,
    int? batchRevision,
    String? category,
    String? itemCode,
    String? metalType,
    String? karat,
    String? purity,
    String? notes,
    required double grossWeight,
    required double stoneWeight,
    required double netWeight,
    String? qrRaw,
  }) async {
    await submit(
      supplierId: supplierId,
      batchId: batchId,
      batchRef: batchRef,
      batchRevision: batchRevision,
      category: category,
      itemCode: itemCode,
      metalType: metalType,
      karat: karat,
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
