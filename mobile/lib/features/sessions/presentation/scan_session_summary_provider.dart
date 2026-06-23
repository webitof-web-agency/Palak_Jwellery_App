import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/scan_session_summary.dart';

class ScanSessionSummaryNotifier extends Notifier<ScanSessionSummary?> {
  @override
  ScanSessionSummary? build() => null;

  void setSummary(ScanSessionSummary summary) {
    state = summary;
  }

  void clear() {
    state = null;
  }
}

final scanSessionSummaryProvider =
    NotifierProvider<ScanSessionSummaryNotifier, ScanSessionSummary?>(
  ScanSessionSummaryNotifier.new,
);
