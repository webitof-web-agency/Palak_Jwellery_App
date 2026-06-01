import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/batch_repository.dart';
import '../domain/batch_models.dart';

class BatchListQuery {
  const BatchListQuery({
    required this.page,
    required this.searchTerm,
    required this.supplierId,
    required this.status,
    required this.entryMode,
    required this.sortBy,
    required this.sortOrder,
    required this.limit,
  });

  final int page;
  final String searchTerm;
  final String? supplierId;
  final String? status;
  final String? entryMode;
  final String sortBy;
  final String sortOrder;
  final int limit;

  BatchListQuery copyWith({
    int? page,
    String? searchTerm,
    String? supplierId,
    String? status,
    String? entryMode,
    String? sortBy,
    String? sortOrder,
    int? limit,
  }) {
    return BatchListQuery(
      page: page ?? this.page,
      searchTerm: searchTerm ?? this.searchTerm,
      supplierId: supplierId ?? this.supplierId,
      status: status ?? this.status,
      entryMode: entryMode ?? this.entryMode,
      sortBy: sortBy ?? this.sortBy,
      sortOrder: sortOrder ?? this.sortOrder,
      limit: limit ?? this.limit,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is BatchListQuery &&
            runtimeType == other.runtimeType &&
            page == other.page &&
            searchTerm == other.searchTerm &&
            supplierId == other.supplierId &&
            status == other.status &&
            entryMode == other.entryMode &&
            sortBy == other.sortBy &&
            sortOrder == other.sortOrder &&
            limit == other.limit;
  }

  @override
  int get hashCode => Object.hash(
    page,
    searchTerm,
    supplierId,
    status,
    entryMode,
    sortBy,
    sortOrder,
    limit,
  );
}

final batchesPageProvider = FutureProvider.autoDispose
    .family<BatchListPage, BatchListQuery>((ref, query) {
      return ref
          .watch(batchRepositoryProvider)
          .getBatches(
            page: query.page,
            limit: query.limit,
            q: query.searchTerm,
            supplier: query.supplierId,
            status: query.status,
            entryMode: query.entryMode,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder,
          );
    });

final batchDetailProvider = FutureProvider.autoDispose
    .family<BatchDetail, String>((ref, batchId) {
      return ref.watch(batchRepositoryProvider).getBatchDetail(batchId);
    });

final batchRevisionsProvider = FutureProvider.autoDispose
    .family<BatchRevisionsResponse, String>((ref, batchId) {
      return ref.watch(batchRepositoryProvider).getBatchRevisions(batchId);
    });
