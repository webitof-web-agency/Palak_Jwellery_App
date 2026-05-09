import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../sale_entry/data/sale_repository.dart';


class SalesHistoryQuery {
  const SalesHistoryQuery({
    required this.page,
    required this.searchTerm,
    required this.searchScope,
    required this.sortBy,
    required this.sortOrder,
    required this.duplicatesOnly,
  });

  final int page;
  final String searchTerm;
  final String searchScope;
  final String sortBy;
  final String sortOrder;
  final bool duplicatesOnly;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SalesHistoryQuery &&
          runtimeType == other.runtimeType &&
          page == other.page &&
          searchTerm == other.searchTerm &&
          searchScope == other.searchScope &&
          sortBy == other.sortBy &&
          sortOrder == other.sortOrder &&
          duplicatesOnly == other.duplicatesOnly;

  @override
  int get hashCode =>
      Object.hash(page, searchTerm, searchScope, sortBy, sortOrder, duplicatesOnly);
}

final recentSalesPageProvider =
    FutureProvider.autoDispose.family<RecentSalesPage, SalesHistoryQuery>(
  (ref, query) {
    return ref.watch(saleRepositoryProvider).getRecentSales(
          page: query.page,
          limit: 10,
          q: query.searchTerm,
          searchScope: query.searchScope,
          duplicatesOnly: query.duplicatesOnly,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        );
  },
);
