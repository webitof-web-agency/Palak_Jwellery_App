import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/active_scan_session_draft_store.dart';
import '../domain/scan_session_draft.dart';

final activeScanSessionDraftStoreProvider = Provider<ActiveScanSessionDraftStore>(
  (ref) => ActiveScanSessionDraftStore(const FlutterSecureStorage()),
);

final activeScanSessionDraftProvider = FutureProvider<ScanSessionDraft?>((ref) async {
  return ref.read(activeScanSessionDraftStoreProvider).load();
});
