import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../domain/scan_session_summary.dart';

class SavedScanSessionsStore {
  SavedScanSessionsStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _indexKey = 'saved_scan_session_index';
  static const _sessionKeyPrefix = 'saved_scan_session_';
  static const _maxSessions = 40;

  Future<List<String>> _readIndex() async {
    final raw = await _storage.read(key: _indexKey);
    if (raw == null || raw.isEmpty) {
      return <String>[];
    }

    final decoded = jsonDecode(raw);
    if (decoded is! List) {
      return <String>[];
    }

    return decoded.map((entry) => entry.toString()).toList();
  }

  Future<void> _writeIndex(List<String> ids) {
    return _storage.write(
      key: _indexKey,
      value: jsonEncode(ids.take(_maxSessions).toList(growable: false)),
    );
  }

  String _sessionKey(String sessionId) => '$_sessionKeyPrefix$sessionId';

  Future<List<ScanSessionSummary>> loadAll() async {
    final ids = await _readIndex();
    final summaries = <ScanSessionSummary>[];

    for (final sessionId in ids) {
      final summary = await loadById(sessionId);
      if (summary != null) {
        summaries.add(summary);
      }
    }

    summaries.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return summaries;
  }

  Future<ScanSessionSummary?> loadById(String sessionId) async {
    final raw = await _storage.read(key: _sessionKey(sessionId));
    if (raw == null || raw.isEmpty) {
      return null;
    }

    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }
      return ScanSessionSummary.fromJson(decoded);
    } catch (_) {
      return null;
    }
  }

  Future<void> save(ScanSessionSummary summary) async {
    await _storage.write(
      key: _sessionKey(summary.sessionId),
      value: jsonEncode(summary.toJson()),
    );

    final ids = await _readIndex();
    ids.remove(summary.sessionId);
    ids.insert(0, summary.sessionId);
    await _writeIndex(ids);
  }

  Future<void> delete(String sessionId) async {
    await _storage.delete(key: _sessionKey(sessionId));
    final ids = await _readIndex();
    ids.remove(sessionId);
    await _writeIndex(ids);
  }

  Future<void> clearAll() async {
    final ids = await _readIndex();
    for (final sessionId in ids) {
      await _storage.delete(key: _sessionKey(sessionId));
    }
    await _storage.delete(key: _indexKey);
  }
}

