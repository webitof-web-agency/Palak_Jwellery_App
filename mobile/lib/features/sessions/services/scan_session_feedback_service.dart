import 'dart:io';

import 'package:flutter/services.dart';

const MethodChannel _scanSessionFeedbackChannel = MethodChannel(
  'scan_session_feedback',
);

Future<void> playScanSessionSuccessTone() async {
  if (Platform.isAndroid) {
    try {
      await _scanSessionFeedbackChannel.invokeMethod<void>('playSuccessTone');
      return;
    } on PlatformException {
      // Fall through to the Flutter system sound below.
    }
  }

  SystemSound.play(SystemSoundType.alert);
}
