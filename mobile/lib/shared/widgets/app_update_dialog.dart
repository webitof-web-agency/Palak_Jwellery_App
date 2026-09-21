import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/system/app_update_service.dart';
import '../theme/app_theme.dart';
import 'app_logo.dart';

/// Checks GitHub for a newer release and, if one is found, walks the user
/// through downloading and installing it. Safe to call from a button tap
/// ([silent] = false, shows progress/result UI) or from app startup
/// ([silent] = true, stays quiet unless an update is actually available).
Future<void> checkForAppUpdate(
  BuildContext context,
  WidgetRef ref, {
  bool silent = false,
}) async {
  final service = ref.read(appUpdateServiceProvider);
  final messenger = ScaffoldMessenger.of(context);

  AppUpdateInfo info;
  try {
    if (!silent) {
      unawaited(_showLoadingDialog(context, 'Checking for updates...'));
    }
    info = await service.checkForUpdate();
    if (!silent && context.mounted) Navigator.of(context, rootNavigator: true).pop();
  } on AppUpdateException catch (error) {
    if (!silent && context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
      messenger.showSnackBar(
        SnackBar(content: Text(error.message), backgroundColor: AppColors.danger),
      );
    }
    return;
  }

  if (!context.mounted) return;

  if (!info.updateAvailable) {
    if (!silent) {
      await _showUpToDateDialog(context, info);
    }
    return;
  }

  await _showUpdateAvailableDialog(context, ref, info);
}

Future<void> _showLoadingDialog(BuildContext context, String message) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => AlertDialog(
      content: Row(
        children: [
          const SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
          const SizedBox(width: 16),
          Expanded(child: Text(message)),
        ],
      ),
    ),
  );
}

Future<void> _showUpToDateDialog(BuildContext context, AppUpdateInfo info) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      title: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AppLogo(size: 52),
          const SizedBox(height: 16),
          Text(
            "You're up to date",
            style: TextStyle(
              color: AppColors.accent,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
      content: Text(
        'App version ${info.currentVersion} is the latest available build.',
        textAlign: TextAlign.center,
        style: TextStyle(color: AppColors.textSecondary, height: 1.5),
      ),
      actions: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('OK'),
          ),
        ),
      ],
    ),
  );
}

Future<void> _showUpdateAvailableDialog(
  BuildContext context,
  WidgetRef ref,
  AppUpdateInfo info,
) {
  return showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (dialogContext) => AlertDialog(
      titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
      contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      title: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const AppLogo(size: 52),
          const SizedBox(height: 16),
          Text(
            'Update available',
            style: TextStyle(
              color: AppColors.accent,
              fontSize: 20,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Version ${info.latestVersion} is available (you have ${info.currentVersion}).',
            textAlign: TextAlign.left,
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          if (info.releaseNotes.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceAlt,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              constraints: const BoxConstraints(maxHeight: 140),
              child: SingleChildScrollView(
                child: Text(
                  info.releaseNotes,
                  style: TextStyle(color: AppColors.textSecondary, height: 1.4, fontSize: 13),
                ),
              ),
            ),
          ],
        ],
      ),
      actions: [
        SizedBox(
          width: double.infinity,
          child: Column(
            children: [
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    Navigator.of(dialogContext).pop();
                    _downloadAndInstall(context, ref, info);
                  },
                  child: const Text('Update Now'),
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Later'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

Future<void> _downloadAndInstall(
  BuildContext context,
  WidgetRef ref,
  AppUpdateInfo info,
) async {
  final service = ref.read(appUpdateServiceProvider);
  final messenger = ScaffoldMessenger.of(context);
  final progressNotifier = ValueNotifier<double>(0);

  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => AlertDialog(
      title: const Text('Downloading update'),
      content: ValueListenableBuilder<double>(
        valueListenable: progressNotifier,
        builder: (context, progress, _) {
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LinearProgressIndicator(value: progress == 0 ? null : progress),
              const SizedBox(height: 10),
              Text('${(progress * 100).toStringAsFixed(0)}%'),
            ],
          );
        },
      ),
    ),
  );

  try {
    final filePath = await service.downloadApk(
      info,
      onProgress: (p) => progressNotifier.value = p,
    );

    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    await service.installApk(filePath);
  } on AppUpdateException catch (error) {
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    messenger.showSnackBar(
      SnackBar(content: Text(error.message), backgroundColor: AppColors.danger),
    );
  }
}
