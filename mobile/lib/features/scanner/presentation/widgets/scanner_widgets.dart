import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class ScannerTopBar extends StatelessWidget {
  const ScannerTopBar({
    super.key,
    required this.onBack,
    required this.onToggleTorch,
    required this.torchOn,
  });

  final VoidCallback onBack;
  final Future<void> Function() onToggleTorch;
  final bool torchOn;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary),
            tooltip: 'Back',
          ),
          const Spacer(),
          IconButton(
            onPressed: () async {
              await onToggleTorch();
            },
            icon: Icon(
              torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
              color: torchOn ? AppColors.accent : AppColors.textPrimary,
            ),
            tooltip: 'Toggle torch',
          ),
        ],
      ),
    );
  }
}

class ScannerFrame extends StatelessWidget {
  const ScannerFrame({
    super.key,
    required this.progress,
    required this.pulseScale,
    required this.active,
    required this.detected,
  });

  final double progress;
  final double pulseScale;
  final bool active;
  final bool detected;

  @override
  Widget build(BuildContext context) {
    const size = 248.0;
    const cornerLen = 30.0;
    const cornerThick = 3.5;
    final frameColor = detected
        ? AppColors.success
        : active
            ? AppColors.accent
            : AppColors.textFaint;

    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        children: [
          Positioned.fill(
            child: Transform.scale(
              scale: pulseScale,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: frameColor.withValues(alpha: detected ? 0.55 : 0.28),
                    width: detected ? 2.4 : 1.3,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: frameColor.withValues(alpha: detected ? 0.35 : 0.15),
                      blurRadius: detected ? 30 : 18,
                      spreadRadius: detected ? 6 : 1,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            left: 18,
            right: 18,
            top: 22 + (size - 44) * progress,
            child: Container(
              height: 3,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: LinearGradient(
                  colors: [
                    frameColor.withValues(alpha: 0.0),
                    frameColor.withValues(alpha: 0.85),
                    frameColor.withValues(alpha: 0.0),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: frameColor.withValues(alpha: 0.35),
                    blurRadius: 16,
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: 0,
            left: 0,
            child: _Corner(
              color: frameColor,
              length: cornerLen,
              thick: cornerThick,
              top: true,
              left: true,
            ),
          ),
          Positioned(
            top: 0,
            right: 0,
            child: _Corner(
              color: frameColor,
              length: cornerLen,
              thick: cornerThick,
              top: true,
              left: false,
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            child: _Corner(
              color: frameColor,
              length: cornerLen,
              thick: cornerThick,
              top: false,
              left: true,
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: _Corner(
              color: frameColor,
              length: cornerLen,
              thick: cornerThick,
              top: false,
              left: false,
            ),
          ),
        ],
      ),
    );
  }
}

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

class _Corner extends StatelessWidget {
  const _Corner({
    required this.color,
    required this.length,
    required this.thick,
    required this.top,
    required this.left,
  });

  final Color color;
  final double length;
  final double thick;
  final bool top;
  final bool left;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: length,
      height: length,
      child: CustomPaint(
        painter: _CornerPainter(
          color: color,
          thick: thick,
          top: top,
          left: left,
        ),
      ),
    );
  }
}

class _CornerPainter extends CustomPainter {
  _CornerPainter({
    required this.color,
    required this.thick,
    required this.top,
    required this.left,
  });

  final Color color;
  final double thick;
  final bool top;
  final bool left;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = thick
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path();

    if (top && left) {
      path.moveTo(0, size.height);
      path.lineTo(0, 0);
      path.lineTo(size.width, 0);
    } else if (top && !left) {
      path.moveTo(0, 0);
      path.lineTo(size.width, 0);
      path.lineTo(size.width, size.height);
    } else if (!top && left) {
      path.moveTo(0, 0);
      path.lineTo(0, size.height);
      path.lineTo(size.width, size.height);
    } else {
      path.moveTo(0, size.height);
      path.lineTo(size.width, size.height);
      path.lineTo(size.width, 0);
    }

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_CornerPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.thick != thick ||
        oldDelegate.top != top ||
        oldDelegate.left != left;
  }
}
