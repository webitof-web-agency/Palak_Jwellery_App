import '../../batches/domain/batch_capture_context.dart';

enum ScannerLaunchMode {
  saleEntry,
  scanSession,
}

class ScannerLaunchArgs {
  const ScannerLaunchArgs({
    required this.sessionKey,
    this.batchContext,
    this.mode = ScannerLaunchMode.saleEntry,
  });

  final String sessionKey;
  final BatchCaptureContext? batchContext;
  final ScannerLaunchMode mode;
}
