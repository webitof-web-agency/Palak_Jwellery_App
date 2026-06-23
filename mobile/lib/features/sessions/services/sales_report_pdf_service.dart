import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';

import '../domain/sales_report_aggregation.dart';
import '../domain/sales_report_mode.dart';
import '../domain/scan_session_draft.dart';
import '../domain/scan_session_summary.dart';
import 'saved_pdf_file.dart';
import 'sales_report_pdf_storage.dart';

class SalesReportPdfService {
  const SalesReportPdfService();

  String buildFileName(ScanSessionSummary summary, SalesReportMode mode) {
    final customerName = _sanitizeForFileName(summary.customer?.name ?? '') ?? 'Customer';
    final phone = _sanitizePhone(summary.customer?.phone) ?? 'Phone';
    final modeName = _sanitizeForFileName(mode.shortLabel) ?? 'Report';
    return '${customerName}_${phone}_$modeName.pdf';
  }

  String buildShareText(ScanSessionSummary summary, SalesReportMode mode) {
    final customerName = (summary.customer?.name ?? '').trim();
    final phone = (summary.customer?.phone ?? '').trim();
    final modeLabel = mode.label;

    final lines = <String>[
      'Palak Jewellery sales report for ${customerName.isNotEmpty ? customerName : 'customer'}',
      if (phone.isNotEmpty) 'Phone: $phone',
      'Report: $modeLabel',
    ];

    return lines.join('\n');
  }

  Future<Uint8List> buildPdfBytes({
    required ScanSessionSummary summary,
    required SalesReportMode mode,
    PdfPageFormat pageFormat = PdfPageFormat.a4,
  }) async {
    final baseFont = await PdfGoogleFonts.notoSansRegular();
    final boldFont = await PdfGoogleFonts.notoSansBold();
    final document = pw.Document(
      theme: pw.ThemeData.withFont(
        base: baseFont,
        bold: boldFont,
        fontFallback: [baseFont],
      ),
    );
    final groups = buildSalesReportGroups(summary, mode);
    final generatedAt = _formatDateTime(summary.createdAt);
    final logoData = await rootBundle.load('assets/images/app_logo_dark.png');
    final logo = pw.MemoryImage(logoData.buffer.asUint8List());

    document.addPage(
      pw.MultiPage(
        pageFormat: pageFormat,
        margin: const pw.EdgeInsets.all(24),
        build: (context) => [
          _buildHeader(logo, summary, mode, generatedAt),
          pw.SizedBox(height: 12),
          _buildTable(summary, groups, mode),
          pw.SizedBox(height: 12),
          _buildFooter(summary),
        ],
      ),
    );

    return document.save();
  }

  Future<SavedPdfFile> downloadPdf({
    required ScanSessionSummary summary,
    required SalesReportMode mode,
  }) async {
    return _saveGeneratedPdf(summary: summary, mode: mode);
  }

  Future<void> sharePdf({
    required ScanSessionSummary summary,
    required SalesReportMode mode,
  }) async {
    await _shareGeneratedPdf(
      summary: summary,
      mode: mode,
      shareText: buildShareText(summary, mode),
    );
  }

  Future<void> _shareGeneratedPdf({
    required ScanSessionSummary summary,
    required SalesReportMode mode,
    required String? shareText,
  }) async {
    final bytes = await buildPdfBytes(summary: summary, mode: mode);
    final fileName = buildFileName(summary, mode);
    final params = ShareParams(
      files: [
        XFile.fromData(
          bytes,
          name: fileName,
          mimeType: 'application/pdf',
        ),
      ],
      text: shareText,
      fileNameOverrides: [fileName],
      subject: 'Palak Jewellery report',
    );
    await SharePlus.instance.share(params);
  }

  Future<SavedPdfFile> _saveGeneratedPdf({
    required ScanSessionSummary summary,
    required SalesReportMode mode,
  }) async {
    final bytes = await buildPdfBytes(summary: summary, mode: mode);
    final fileName = buildFileName(summary, mode);
    return saveSalesReportPdf(bytes, fileName);
  }

  pw.Widget _buildHeader(
    pw.MemoryImage logo,
    ScanSessionSummary summary,
    SalesReportMode mode,
    String generatedAt,
  ) {
    final customer = summary.customer;
    return pw.Container(
      padding: const pw.EdgeInsets.all(16),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey400),
        borderRadius: pw.BorderRadius.circular(10),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.center,
        children: [
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.center,
            crossAxisAlignment: pw.CrossAxisAlignment.center,
            children: [
              pw.Container(
                width: 48,
                height: 48,
                decoration: pw.BoxDecoration(
                  shape: pw.BoxShape.circle,
                  color: PdfColors.black,
                  border: pw.Border.all(color: PdfColors.grey300, width: 1.5),
                ),
                child: pw.ClipOval(
                  child: pw.Image(logo, fit: pw.BoxFit.cover),
                ),
              ),
              pw.SizedBox(width: 14),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(
                    _reportTitle(mode),
                    style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold),
                  ),
                  pw.SizedBox(height: 2),
                  pw.Text(
                    'PALAK Jewellers',
                    style: pw.TextStyle(
                      fontSize: 10,
                      fontWeight: pw.FontWeight.bold,
                      color: PdfColors.grey600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 10),
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: pw.BoxDecoration(
              color: PdfColors.grey100,
              borderRadius: pw.BorderRadius.circular(6),
            ),
            child: pw.Wrap(
              spacing: 16,
              runSpacing: 4,
              children: [
                pw.Text('Customer: ${customer?.name ?? 'Unknown'}',
                    style: const pw.TextStyle(fontSize: 9)),
                pw.Text('Phone: ${customer?.phone ?? '-'}',
                    style: const pw.TextStyle(fontSize: 9)),
                pw.Text('Area: ${customer?.area ?? '-'}',
                    style: const pw.TextStyle(fontSize: 9)),
                pw.Text('Date: $generatedAt',
                    style: const pw.TextStyle(fontSize: 9)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  pw.Widget _buildTable(
    ScanSessionSummary summary,
    List<SalesReportGroup> groups,
    SalesReportMode mode,
  ) {
    final groupedMode = mode != SalesReportMode.itemWise;
    final columns = groupedMode ? _groupedHeaders() : _itemWiseHeaders();
    final columnWidths = groupedMode ? _groupedColumnWidths() : _itemWiseColumnWidths();
    final rows = <pw.TableRow>[
      _tableRow(
        columns.map((label) => _tableCell(label, header: true)).toList(growable: false),
      ),
      if (groupedMode)
        for (var index = 0; index < groups.length; index++)
          _tableRow(
            _groupedRowCells(index + 1, groups[index]),
          )
      else
        for (var index = 0; index < summary.items.length; index++)
          _tableRow(
            _itemWiseRowCells(index + 1, summary.items[index]),
          ),
      _tableRow(
        groupedMode
            ? _groupedTotalsCells(summary)
            : _itemWiseTotalsCells(summary),
        isTotals: true,
      ),
    ];

    return pw.Table(
      border: pw.TableBorder.all(color: PdfColors.grey400),
      columnWidths: columnWidths,
      children: rows,
    );
  }

  List<String> _itemWiseHeaders() {
    // otherAmount is a separate amount bucket, not making charge.
    return const [
      'Sr No.',
      'Item Code',
      'Supplier / Category',
      'Gross Weight',
      'Stone Weight',
      'Other Weight',
      'Net Weight',
      'Stone Amount',
      // otherAmount is a separate amount bucket, not making charge.
      'Other Amount',
      'Fine Weight',
    ];
  }

  List<String> _groupedHeaders() {
    return const [
      'Group',
      'Items',
      'Gross Weight',
      'Stone Weight',
      'Other Weight',
      'Net Weight',
      'Stone Amount',
      // otherAmount is a separate amount bucket, not making charge.
      'Other Amount',
      'Fine Weight',
    ];
  }

  Map<int, pw.TableColumnWidth> _itemWiseColumnWidths() {
    return const {
      0: pw.FlexColumnWidth(0.7),
      1: pw.FlexColumnWidth(1.4),
      2: pw.FlexColumnWidth(1.8),
      3: pw.FlexColumnWidth(0.9),
      4: pw.FlexColumnWidth(0.9),
      5: pw.FlexColumnWidth(0.9),
      6: pw.FlexColumnWidth(0.9),
      7: pw.FlexColumnWidth(0.9),
      8: pw.FlexColumnWidth(0.9),
      9: pw.FlexColumnWidth(0.9),
    };
  }

  Map<int, pw.TableColumnWidth> _groupedColumnWidths() {
    return const {
      0: pw.FlexColumnWidth(1.5),
      1: pw.FlexColumnWidth(0.7),
      2: pw.FlexColumnWidth(0.9),
      3: pw.FlexColumnWidth(0.9),
      4: pw.FlexColumnWidth(0.9),
      5: pw.FlexColumnWidth(0.9),
      6: pw.FlexColumnWidth(0.9),
      7: pw.FlexColumnWidth(0.9),
      8: pw.FlexColumnWidth(0.9),
    };
  }

  List<pw.Widget> _itemWiseRowCells(int serialNumber, ScannedSessionItem item) {
    final supplierCategory = buildSalesReportSupplierCategoryLabel(item);
    return <pw.Widget>[
      _tableCell(serialNumber.toString()),
      _tableCell(item.itemCode),
      _tableCell(supplierCategory),
      _tableCell(_formatWeight(item.grossWeight), alignRight: true),
      _tableCell(_formatWeight(item.stoneWeight), alignRight: true),
      _tableCell(_formatWeight(item.otherWeight), alignRight: true),
      _tableCell(_formatWeight(item.netWeight), alignRight: true),
      _tableCell(_formatCurrency(item.totalStoneAmount ?? item.stoneAmount ?? 0), alignRight: true),
      _tableCell(_formatCurrency(item.otherAmount ?? 0), alignRight: true),
      _tableCell(_formatWeight(item.fineWeight), alignRight: true),
    ];
  }

  List<pw.Widget> _groupedRowCells(int serialNumber, SalesReportGroup group) {
    return <pw.Widget>[
      _tableCell(
        group.groupLabel,
        secondaryText: group.detailLabel.trim().isEmpty || group.detailLabel == group.groupLabel
            ? null
            : group.detailLabel,
      ),
      _tableCell(group.itemCount.toString(), alignRight: true),
      _tableCell(_formatWeight(group.grossWeight), alignRight: true),
      _tableCell(_formatWeight(group.stoneWeight), alignRight: true),
      _tableCell(_formatWeight(group.otherWeight), alignRight: true),
      _tableCell(_formatWeight(group.netWeight), alignRight: true),
      _tableCell(_formatCurrency(group.stoneAmount), alignRight: true),
      _tableCell(_formatCurrency(group.otherAmount), alignRight: true),
      _tableCell(_formatWeight(group.fineWeight), alignRight: true),
    ];
  }

  List<pw.Widget> _itemWiseTotalsCells(ScanSessionSummary summary) {
    return <pw.Widget>[
      _tableCell('${summary.totalItems} items', bold: true),
      _tableCell(''),
      _tableCell(''),
      _totalCell(_formatWeight(summary.totalGrossWeight)),
      _totalCell(_formatWeight(summary.totalStoneWeight)),
      _totalCell(_formatWeight(summary.totalOtherWeight)),
      _totalCell(_formatWeight(summary.totalNetWeight)),
      _totalCell(_formatCurrencyTotal(summary.totalStoneAmount)),
      _totalCell(_formatCurrencyTotal(summary.totalOtherAmount)),
      _totalCell(_formatWeight(summary.totalFineWeight)),
    ];
  }

  List<pw.Widget> _groupedTotalsCells(ScanSessionSummary summary) {
    return <pw.Widget>[
      _tableCell('Total', bold: true),
      _totalCell(summary.totalItems.toString()),
      _totalCell(_formatWeight(summary.totalGrossWeight)),
      _totalCell(_formatWeight(summary.totalStoneWeight)),
      _totalCell(_formatWeight(summary.totalOtherWeight)),
      _totalCell(_formatWeight(summary.totalNetWeight)),
      _totalCell(_formatCurrencyTotal(summary.totalStoneAmount)),
      _totalCell(_formatCurrencyTotal(summary.totalOtherAmount)),
      _totalCell(_formatWeight(summary.totalFineWeight)),
    ];
  }

  pw.TableRow _tableRow(
    List<pw.Widget> cells, {
    bool isTotals = false,
  }) {
    return pw.TableRow(
      decoration: isTotals
          ? const pw.BoxDecoration(color: PdfColors.grey200)
          : const pw.BoxDecoration(color: PdfColors.white),
      children: cells,
    );
  }

  pw.Widget _tableCell(
    String text, {
    String? secondaryText,
    bool header = false,
    bool bold = false,
    bool alignRight = false,
  }) {
    final isEmphasis = header || bold;
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 5),
      alignment: alignRight ? pw.Alignment.centerRight : pw.Alignment.centerLeft,
      child: pw.Column(
        mainAxisAlignment: pw.MainAxisAlignment.center,
        crossAxisAlignment:
            alignRight ? pw.CrossAxisAlignment.end : pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            text,
            style: pw.TextStyle(
              fontSize: header ? 8 : 7,
              fontWeight: isEmphasis ? pw.FontWeight.bold : pw.FontWeight.normal,
            ),
          ),
          if (secondaryText != null && secondaryText.trim().isNotEmpty) ...[
            pw.SizedBox(height: 2),
            pw.Text(
              secondaryText,
              style: pw.TextStyle(
                fontSize: 6.5,
                color: PdfColors.grey700,
                fontWeight: pw.FontWeight.normal,
              ),
            ),
          ],
        ],
      ),
    );
  }

  pw.Widget _totalCell(String text) {
    return pw.Container(
      padding: const pw.EdgeInsets.symmetric(horizontal: 6, vertical: 6),
      alignment: pw.Alignment.centerRight,
      child: pw.Text(
        text,
        style: pw.TextStyle(fontSize: 7, fontWeight: pw.FontWeight.bold),
      ),
    );
  }

  pw.Widget _buildFooter(ScanSessionSummary summary) {
    return pw.Container(
      padding: const pw.EdgeInsets.all(12),
      decoration: pw.BoxDecoration(
        border: pw.Border.all(color: PdfColors.grey400),
        borderRadius: pw.BorderRadius.circular(8),
      ),
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(
            'Remark',
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 10),
          ),
          pw.SizedBox(height: 4),
          pw.Text(
            'Totals generated from the saved structured session summary.',
            style: const pw.TextStyle(fontSize: 9),
          ),
          if (summary.warningCounts.hasAny) ...[
            pw.SizedBox(height: 6),
            pw.Text(
              'Warnings: '
              '${summary.warningCounts.duplicates > 0 ? 'Duplicates ${summary.warningCounts.duplicates} ' : ''}'
              '${summary.warningCounts.supplierMismatch > 0 ? 'Supplier mismatch ${summary.warningCounts.supplierMismatch} ' : ''}'
              '${summary.warningCounts.karatMismatch > 0 ? 'QR Karat Mismatch ${summary.warningCounts.karatMismatch} ' : ''}'
              '${summary.warningCounts.weightMismatch > 0 ? 'Weight mismatch ${summary.warningCounts.weightMismatch} ' : ''}'
              '${summary.warningCounts.customPurityOverrides > 0 ? 'Custom purity ${summary.warningCounts.customPurityOverrides} ' : ''}'
              '${summary.warningCounts.customWastageOverrides > 0 ? 'Custom wastage ${summary.warningCounts.customWastageOverrides} ' : ''}',
              style: const pw.TextStyle(fontSize: 9),
            ),
          ],
          if (summary.notes.trim().isNotEmpty) ...[
            pw.SizedBox(height: 6),
            pw.Text(
              'Notes: ${summary.notes.trim()}',
              style: const pw.TextStyle(fontSize: 9),
            ),
          ],
        ],
      ),
    );
  }

  String _reportTitle(SalesReportMode mode) {
    return switch (mode) {
      SalesReportMode.itemWise => 'Item List',
      SalesReportMode.supplierWise => 'Supplier Summary',
      SalesReportMode.categoryWise => 'Category Summary',
      SalesReportMode.karatWise => 'Karat Summary',
      SalesReportMode.wastageWise => 'Wastage Summary',
    };
  }

  String? _sanitizeForFileName(String? input) {
    final trimmed = input?.trim() ?? '';
    if (trimmed.isEmpty) {
      return null;
    }
    final sanitized = trimmed.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_').replaceAll(RegExp(r'_+'), '_');
    return sanitized.replaceAll(RegExp(r'^_+|_+$'), '');
  }

  String? _sanitizePhone(String? input) {
    final trimmed = input?.trim() ?? '';
    if (trimmed.isEmpty) {
      return null;
    }
    final digits = trimmed.replaceAll(RegExp(r'[^0-9]+'), '');
    if (digits.isEmpty) {
      return null;
    }
    if (digits.length > 10 && digits.startsWith('91')) {
      return digits.substring(2);
    }
    if (digits.length > 10) {
      return digits.substring(digits.length - 10);
    }
    return digits;
  }

  String _formatWeight(double value) => value.toStringAsFixed(3);

  String _formatCurrency(double value) => value <= 0 ? '-' : 'Rs. ${value.toStringAsFixed(2)}';

  String _formatCurrencyTotal(double value) => 'Rs. ${value.toStringAsFixed(2)}';

  String _formatDateTime(DateTime value) {
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.day}/${local.month}/${local.year} $hour:$minute $period';
  }
}









