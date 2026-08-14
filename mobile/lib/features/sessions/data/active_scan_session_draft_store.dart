import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/scan_session_draft.dart';

class ActiveScanSessionDraftStore {
  ActiveScanSessionDraftStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _draftKey = 'active_scan_session_draft_v1';

  Future<ScanSessionDraft?> load() async {
    final raw = await _storage.read(key: _draftKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }
      return ScanSessionDraft.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(ScanSessionDraft draft) {
    return _storage.write(
      key: _draftKey,
      value: jsonEncode(draft.toJson()),
    );
  }

  Future<void> clear() {
    return _storage.delete(key: _draftKey);
  }
}
