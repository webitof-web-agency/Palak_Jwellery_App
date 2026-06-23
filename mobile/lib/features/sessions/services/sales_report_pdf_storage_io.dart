import 'dart:io';

import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';

import 'saved_pdf_file.dart';

const MethodChannel _storageChannel = MethodChannel('sales_report_pdf_storage');

Future<SavedPdfFile> saveSalesReportPdf(
  Uint8List bytes,
  String fileName,
) async {
  if (Platform.isAndroid) {
    try {
      final savedPath = await _storageChannel.invokeMethod<String>(
        'savePdfToDownloads',
        <String, dynamic>{
          'bytes': bytes,
          'fileName': fileName,
        },
      );
      if (savedPath != null && savedPath.isNotEmpty) {
        return SavedPdfFile(
          fileName: fileName,
          filePath: savedPath,
          storageLabel: 'Downloads',
        );
      }
      throw const FileSystemException('Android PDF save returned no file path.');
    } on PlatformException catch (error) {
      throw FileSystemException(
        'Unable to save PDF to public Downloads',
        error.message,
      );
    }
  }

  final directory = await _preferredSaveDirectory();
  final file = File('${directory.path}${Platform.pathSeparator}$fileName');
  await file.writeAsBytes(bytes, flush: true);

  return SavedPdfFile(
    fileName: fileName,
    filePath: file.path,
    storageLabel: _storageLabelFor(directory),
  );
}

Future<Directory> _preferredSaveDirectory() async {
  try {
    final downloadsDirectory = await getDownloadsDirectory();
    if (downloadsDirectory != null) {
      return downloadsDirectory;
    }
  } catch (_) {
    // Fall back below.
  }

  try {
    return await getApplicationDocumentsDirectory();
  } catch (_) {
    return Directory.systemTemp;
  }
}

String _storageLabelFor(Directory directory) {
  final path = directory.path.toLowerCase();
  if (path.contains('download')) {
    return 'Downloads';
  }
  if (path.contains('documents')) {
    return 'Documents';
  }
  return 'local storage';
}



