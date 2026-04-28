import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

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
