import 'package:flutter_test/flutter_test.dart';
import 'package:jwellery_mobile/features/customers/domain/customer_record.dart';
import 'package:jwellery_mobile/features/sessions/domain/scan_session_draft.dart';
import 'package:jwellery_mobile/features/sessions/domain/scan_session_summary.dart';

void main() {
  test('locked karat stays applied while qr karat is tracked separately', () {
    const sampleQr =
        '2318120/201526/18K/4.56/0/4.493/242/HGR - 782/22/Y+W/2J0Y0/0/0/WHITE/0.067/0';

    const item = ScannedSessionItem(
      id: 'sample-1',
      itemCode: 'HGR - 782',
      supplier: 'YUG',
      qrKarat: '18K',
      karat: '14K',
      purityPercent: 58.4,
      wastagePercent: 12.5,
      grossWeight: 4.56,
      stoneWeight: 0.067,
      otherWeight: 0,
      stoneAmount: 242.0,
      rawQr: sampleQr,
      hasKaratMismatch: true,
    );

    expect(item.qrKarat, '18K');
    expect(item.karat, '14K');
    expect(item.hasKaratMismatch, isTrue);
    expect(item.grossWeight.toStringAsFixed(3), '4.560');
    expect(item.stoneWeight.toStringAsFixed(3), '0.067');
    expect(item.netWeight.toStringAsFixed(3), '4.493');
    expect(item.fineWeight.toStringAsFixed(3), '3.186');
    expect(item.stoneAmount, 242.0);

    final summary = ScanSessionSummary.fromDraft(
      ScanSessionDraft(
        customer: const CustomerRecord(
          id: 'cust-1',
          name: 'Aadinath Jewels',
          phone: '+91 98765 43210',
          area: 'Andheri West',
        ),
        supplier: 'YUG',
        categoryOriginal: 'Orange',
        categorySelected: 'Orange',
        karat: '14K',
        purityOriginal: 58.4,
        puritySelected: 58.4,
        wastageOriginal: 12.5,
        wastageSelected: 12.5,
        scannedItems: [item],
      ),
    );

    expect(summary.totalFineWeight.toStringAsFixed(3), '3.186');
    final counts = ScanSessionWarningCounts.fromItems([item]);
    expect(counts.karatMismatch, 1);
    expect(counts.hasAny, isTrue);
  });
}

