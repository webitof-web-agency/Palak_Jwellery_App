import '../../batches/domain/batch_capture_context.dart';

class ScannerLaunchArgs {
  const ScannerLaunchArgs({
    required this.sessionKey,
    this.batchContext,
  });

  final String sessionKey;
  final BatchCaptureContext? batchContext;
}

