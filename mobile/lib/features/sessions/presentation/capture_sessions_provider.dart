import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/capture_session_repository.dart';
import '../domain/capture_session_models.dart';

class CaptureSessionListQuery {
  const CaptureSessionListQuery({
    required this.page,
    required this.searchTerm,
    required this.status,
    required this.limit,
  });

  final int page;
  final String searchTerm;
  final String? status;
  final int limit;

  CaptureSessionListQuery copyWith({
    int? page,
    String? searchTerm,
    String? status,
    int? limit,
  }) {
    return CaptureSessionListQuery(
      page: page ?? this.page,
      searchTerm: searchTerm ?? this.searchTerm,
      status: status ?? this.status,
      limit: limit ?? this.limit,
    );
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CaptureSessionListQuery &&
            runtimeType == other.runtimeType &&
            page == other.page &&
            searchTerm == other.searchTerm &&
            status == other.status &&
            limit == other.limit;
  }

  @override
  int get hashCode => Object.hash(page, searchTerm, status, limit);
}

final captureSessionsPageProvider = FutureProvider.autoDispose
    .family<CaptureSessionListPage, CaptureSessionListQuery>((ref, query) {
  return ref.watch(captureSessionRepositoryProvider).getMySessions(
        page: query.page,
        limit: query.limit,
        status: query.status,
        query: query.searchTerm,
      );
});

final captureSessionDetailProvider = FutureProvider.autoDispose
    .family<CaptureSessionDetail, String>((ref, sessionId) {
  return ref.watch(captureSessionRepositoryProvider).getSessionDetail(sessionId);
});
