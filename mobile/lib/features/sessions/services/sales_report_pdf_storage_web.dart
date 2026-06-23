// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter

import 'dart:html' as html;
import 'dart:typed_data';

import 'saved_pdf_file.dart';

Future<SavedPdfFile> saveSalesReportPdf(
  Uint8List bytes,
  String fileName,
) async {
  final blob = html.Blob([bytes], 'application/pdf');
  final url = html.Url.createObjectUrlFromBlob(blob);
  final anchor = html.AnchorElement(href: url)
    ..download = fileName
    ..style.display = 'none';

  html.document.body?.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);

  return SavedPdfFile(
    fileName: fileName,
    filePath: fileName,
    storageLabel: 'Downloads',
  );
}
