import 'batch_models.dart';

class BatchCaptureContext {
  const BatchCaptureContext({
    required this.batchId,
    required this.batchRef,
    required this.supplierId,
    required this.supplierName,
    required this.status,
    required this.revision,
    this.supplierCode,
    this.assignedSalesmanId,
  });

  final String batchId;
  final String batchRef;
  final String supplierId;
  final String supplierName;
  final String? supplierCode;
  final String status;
  final int revision;
  final String? assignedSalesmanId;

  factory BatchCaptureContext.fromDetail(BatchDetail detail) {
    return BatchCaptureContext(
      batchId: detail.id ?? '',
      batchRef: detail.batchRef,
      supplierId: detail.supplier?.id ?? '',
      supplierName: detail.supplier?.name ?? detail.supplierCode ?? 'Selected supplier',
      supplierCode: detail.supplier?.code ?? detail.supplierCode,
      status: detail.status,
      revision: detail.revision,
      assignedSalesmanId: detail.assignedSalesman?.id,
    );
  }

  bool get canCaptureItems {
    switch (status.toLowerCase()) {
      case 'draft':
      case 'open':
      case 'reopened':
        return true;
      default:
        return false;
    }
  }

  String get noticeText {
    switch (status.toLowerCase()) {
      case 'draft':
      case 'open':
      case 'reopened':
        return 'Assigned salesman can add items from the mobile app.';
      case 'submitted':
        return 'This batch is awaiting admin review. Finalize it or return it for correction.';
      case 'finalized':
        return 'This batch is finalized. Reopen it to allow the assigned salesman to add more items.';
      case 'cancelled':
        return 'This batch is cancelled. No new items can be added.';
      default:
        return 'Batch item capture follows the current batch status.';
    }
  }
}
