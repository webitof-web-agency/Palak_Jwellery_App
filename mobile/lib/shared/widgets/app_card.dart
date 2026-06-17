import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.onTap,
    this.backgroundColor,
    this.borderColor,
    this.borderRadius,
    this.elevation = 0,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? borderColor;
  final BorderRadius? borderRadius;
  final double elevation;

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(AppRadius.lg);
    final cardColor = backgroundColor ?? AppColors.surface;
    final resolvedBorderColor = borderColor ?? AppColors.border;

    final content = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: radius,
        border: Border.all(color: resolvedBorderColor),
        boxShadow: elevation <= 0
            ? null
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: elevation * 2,
                  offset: Offset(0, elevation / 2),
                ),
              ],
      ),
      child: child,
    );

    final wrapped = onTap == null
        ? content
        : Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: radius,
              onTap: onTap,
              child: content,
            ),
          );

    if (margin == null) {
      return wrapped;
    }

    return Padding(
      padding: margin!,
      child: wrapped,
    );
  }
}

