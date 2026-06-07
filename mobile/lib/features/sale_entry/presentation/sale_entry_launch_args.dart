import '../../batches/domain/batch_capture_context.dart';
import '../data/sale_repository.dart';

class SaleEntryLaunchArgs {
  const SaleEntryLaunchArgs({
    required this.parseResult,
    this.batchContext,
  });

  final ParseQrResult parseResult;
  final BatchCaptureContext? batchContext;
}

