import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class BrandDoodleBackground extends StatelessWidget {
  const BrandDoodleBackground({
    super.key,
    this.showCircles = true,
    this.opacity = 1,
  });

  final bool showCircles;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Opacity(
        opacity: opacity,
        child: CustomPaint(
          painter: _BrandDoodlePainter(
            colors: AppColors.colorsFor(activePreset),
            showCircles: showCircles,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _BrandDoodlePainter extends CustomPainter {
  const _BrandDoodlePainter({
    required this.colors,
    required this.showCircles,
  });

  final AppColorPalette colors;
  final bool showCircles;

  @override
  void paint(Canvas canvas, Size size) {
    final isDark = activePreset == AppThemePreset.midnightRose;
    final mainStroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = isDark ? 1.55 : 1.15
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = colors.accent.withValues(alpha: isDark ? 0.42 : 0.24);

    final softStroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = isDark ? 1.15 : 0.95
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = colors.accentSoft.withValues(alpha: isDark ? 0.28 : 0.18);

    final goldFill = isDark
        ? colors.accent.withValues(alpha: 0.05)
        : colors.surface.withValues(alpha: 0.16);
    final softFill = isDark
        ? colors.accentSoft.withValues(alpha: 0.04)
        : colors.surfaceAlt.withValues(alpha: 0.12);
    final budFill = isDark
        ? colors.warning.withValues(alpha: 0.04)
        : colors.warningSoft.withValues(alpha: 0.08);

    if (showCircles) {
      final glowPaint = Paint()..style = PaintingStyle.fill;
      glowPaint.color = isDark
          ? colors.accentSoft.withValues(alpha: 0.025)
          : colors.surfaceAlt.withValues(alpha: 0.05);
      canvas.drawCircle(
        Offset(size.width * 0.14, size.height * 0.18),
        size.shortestSide * 0.09,
        glowPaint,
      );
      glowPaint.color = isDark
          ? colors.accent.withValues(alpha: 0.02)
          : colors.warningSoft.withValues(alpha: 0.03);
      canvas.drawCircle(
        Offset(size.width * 0.84, size.height * 0.82),
        size.shortestSide * 0.07,
        glowPaint,
      );
    }

    final motifs = <_LotusMotif>[
      _LotusMotif(
        center: Offset(size.width * 0.50, size.height * 0.16),
        radius: size.shortestSide * 0.124,
        petals: 7,
        rotation: -math.pi / 9,
        style: _LotusStyle.full,
      ),
      _LotusMotif(
        center: Offset(size.width * 0.50, size.height * 0.82),
        radius: size.shortestSide * 0.070,
        petals: 4,
        rotation: math.pi / 12,
        style: _LotusStyle.bud,
      ),
    ];

    for (final motif in motifs) {
      _drawLotus(canvas, motif, mainStroke, softStroke, goldFill, softFill, budFill);
    }
  }

  void _drawLotus(
    Canvas canvas,
    _LotusMotif motif,
    Paint mainStroke,
    Paint softStroke,
    Color goldFill,
    Color softFill,
    Color budFill,
  ) {
    switch (motif.style) {
      case _LotusStyle.full:
        _drawPetalLotus(
          canvas,
          center: motif.center,
          radius: motif.radius,
          petals: motif.petals,
          rotation: motif.rotation,
          outerStroke: mainStroke,
          innerStroke: softStroke,
          petalFill: goldFill,
          coreFill: goldFill.withValues(alpha: 0.28),
        );
        break;
      case _LotusStyle.open:
        _drawPetalLotus(
          canvas,
          center: motif.center,
          radius: motif.radius,
          petals: motif.petals,
          rotation: motif.rotation,
          outerStroke: softStroke,
          innerStroke: mainStroke,
          petalFill: softFill,
          coreFill: goldFill.withValues(alpha: 0.20),
        );
        break;
      case _LotusStyle.ring:
        _drawRingLotus(
          canvas,
          center: motif.center,
          radius: motif.radius,
          petals: motif.petals,
          rotation: motif.rotation,
          outerStroke: mainStroke,
          innerStroke: softStroke,
          fill: goldFill,
        );
        break;
      case _LotusStyle.bud:
        _drawBud(canvas, motif.center, motif.radius, mainStroke, softStroke, budFill);
        break;
    }
  }

  void _drawPetalLotus(
    Canvas canvas, {
    required Offset center,
    required double radius,
    required int petals,
    required double rotation,
    required Paint outerStroke,
    required Paint innerStroke,
    required Color petalFill,
    required Color coreFill,
  }) {
    canvas.drawCircle(center, radius * 0.14, Paint()..color = coreFill);
    canvas.drawCircle(
      center,
      radius * 0.24,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = outerStroke.strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = outerStroke.color,
    );

    for (var index = 0; index < petals; index += 1) {
      final angle = rotation + (math.pi * 2 * index / petals);
      final petalCenter = Offset(
        center.dx + math.cos(angle) * radius * 0.58,
        center.dy + math.sin(angle) * radius * 0.58,
      );

      canvas.save();
      canvas.translate(petalCenter.dx, petalCenter.dy);
      canvas.rotate(angle + math.pi / 2);
      final petalRect = Rect.fromCenter(
        center: Offset.zero,
        width: radius * 0.42,
        height: radius * 0.98,
      );
      canvas.drawOval(
        petalRect,
        Paint()..style = PaintingStyle.fill..color = petalFill,
      );
      canvas.drawOval(
        petalRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = innerStroke.strokeWidth
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = innerStroke.color,
      );
      canvas.restore();
    }
  }

  void _drawRingLotus(
    Canvas canvas, {
    required Offset center,
    required double radius,
    required int petals,
    required double rotation,
    required Paint outerStroke,
    required Paint innerStroke,
    required Color fill,
  }) {
    canvas.drawCircle(
      center,
      radius * 0.12,
      Paint()..color = fill.withValues(alpha: 0.32),
    );
    canvas.drawCircle(
      center,
      radius * 0.72,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = outerStroke.strokeWidth
        ..color = outerStroke.color,
    );
    for (var index = 0; index < petals; index += 1) {
      final angle = rotation + (math.pi * 2 * index / petals);
      final petalCenter = Offset(
        center.dx + math.cos(angle) * radius * 0.60,
        center.dy + math.sin(angle) * radius * 0.60,
      );
      canvas.save();
      canvas.translate(petalCenter.dx, petalCenter.dy);
      canvas.rotate(angle + math.pi / 2);
      final petalRect = Rect.fromCenter(
        center: Offset.zero,
        width: radius * 0.36,
        height: radius * 0.86,
      );
      canvas.drawOval(
        petalRect,
        Paint()..style = PaintingStyle.fill..color = fill.withValues(alpha: 0.20),
      );
      canvas.drawOval(
        petalRect,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = innerStroke.strokeWidth
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = innerStroke.color,
      );
      canvas.restore();
    }
  }

  void _drawBud(
    Canvas canvas,
    Offset center,
    double radius,
    Paint outerStroke,
    Paint innerStroke,
    Color fill,
  ) {
    final budStroke = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = outerStroke.strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..color = outerStroke.color;

    canvas.drawPath(
      Path()
        ..moveTo(center.dx, center.dy - radius * 0.60)
        ..quadraticBezierTo(center.dx + radius * 0.10, center.dy - radius * 0.18, center.dx, center.dy + radius * 0.40)
        ..quadraticBezierTo(center.dx - radius * 0.10, center.dy - radius * 0.18, center.dx, center.dy - radius * 0.60),
      Paint()..style = PaintingStyle.fill..color = fill,
    );

    canvas.drawPath(
      Path()
        ..moveTo(center.dx, center.dy - radius * 0.60)
        ..quadraticBezierTo(center.dx + radius * 0.10, center.dy - radius * 0.18, center.dx, center.dy + radius * 0.40)
        ..quadraticBezierTo(center.dx - radius * 0.10, center.dy - radius * 0.18, center.dx, center.dy - radius * 0.60),
      budStroke,
    );

    canvas.drawPath(
      Path()
        ..moveTo(center.dx - radius * 0.22, center.dy - radius * 0.08)
        ..quadraticBezierTo(center.dx - radius * 0.05, center.dy - radius * 0.34, center.dx, center.dy + radius * 0.22),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = innerStroke.strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = innerStroke.color,
    );
    canvas.drawPath(
      Path()
        ..moveTo(center.dx + radius * 0.22, center.dy - radius * 0.08)
        ..quadraticBezierTo(center.dx + radius * 0.05, center.dy - radius * 0.34, center.dx, center.dy + radius * 0.22),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = innerStroke.strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round
        ..color = innerStroke.color,
    );
  }

  @override
  bool shouldRepaint(covariant _BrandDoodlePainter oldDelegate) {
    return oldDelegate.colors != colors || oldDelegate.showCircles != showCircles;
  }
}

enum _LotusStyle { full, open, ring, bud }

class _LotusMotif {
  const _LotusMotif({
    required this.center,
    required this.radius,
    required this.petals,
    required this.rotation,
    required this.style,
  });

  final Offset center;
  final double radius;
  final int petals;
  final double rotation;
  final _LotusStyle style;
}
