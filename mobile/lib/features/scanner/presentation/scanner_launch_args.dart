import 'dart:async';
import '../../batches/domain/batch_capture_context.dart';

enum ScannerLaunchMode {
  saleEntry,
  scanSession,
}

class ScannerLaunchArgs {
  const ScannerLaunchArgs({
    required this.sessionKey,
    this.batchContext,
    this.mode = ScannerLaunchMode.scanSession,
    this.onContinuousScan,
  });

  final String sessionKey;
  final BatchCaptureContext? batchContext;
  final ScannerLaunchMode mode;
  final FutureOr<void> Function(String qr)? onContinuousScan;
}

