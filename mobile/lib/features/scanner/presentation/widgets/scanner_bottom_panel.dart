import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class ScannerBottomPanel extends StatelessWidget {
  const ScannerBottomPanel({
    super.key,
    required this.processing,
    required this.detected,
    required this.onManualEntry,
  });

  final bool processing;
  final bool detected;
  final Future<void> Function() onManualEntry;

  @override
  Widget build(BuildContext context) {
    final helperText = detected
        ? 'QR detected. Preparing sale entry...'
        : processing
            ? 'Reading QR...'
            : 'Align QR inside the frame';

    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 40),
      child: Column(
        children: [
          if (processing || detected)
            _ProcessingIndicator(detected: detected)
          else
            Text(
              helperText,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: 8),
          if (!processing && !detected)
            Text(
              'Point camera at supplier QR label on jewellery',
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: OutlinedButton.icon(
              onPressed: processing || detected
                  ? null
                  : () async {
                      await onManualEntry();
                    },
              icon: const Icon(Icons.edit_rounded, size: 18),
              label: const Text('Enter Manually'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textPrimary,
                side: BorderSide(color: AppColors.border),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ScannerDetectedOverlay extends StatelessWidget {
  const ScannerDetectedOverlay({
    super.key,
    required this.visible,
  });

  final bool visible;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      ignoring: true,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 180),
        opacity: visible ? 1 : 0,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.success.withValues(alpha: 0.12),
          ),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: AppColors.success.withValues(alpha: 0.45),
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.check_circle_rounded,
                    color: AppColors.success,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'QR detected',
                    style: TextStyle(
                      color: AppColors.success,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ProcessingIndicator extends StatelessWidget {
  const _ProcessingIndicator({required this.detected});

  final bool detected;

  @override
  Widget build(BuildContext context) {
    final color = detected ? AppColors.success : AppColors.accent;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            color: color,
          ),
        ),
        const SizedBox(width: 10),
        Text(
          detected ? 'QR detected' : 'Reading QR...',
          style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}
