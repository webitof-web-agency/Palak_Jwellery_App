import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';

enum AppBadgeTone { neutral, accent, success, warning, danger }

class AppBadge extends StatelessWidget {
  const AppBadge({
    super.key,
    required this.label,
    this.icon,
    this.tone = AppBadgeTone.neutral,
    this.compact = false,
  });

  final String label;
  final IconData? icon;
  final AppBadgeTone tone;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, border) = _colorsForTone(tone);
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 8 : 10,
        vertical: compact ? 4 : 6,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: compact ? 12 : 14, color: foreground),
            const SizedBox(width: 4),
          ],
          ConstrainedBox(
            constraints: BoxConstraints(maxWidth: compact ? 112 : 144),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              softWrap: false,
              style: TextStyle(
                color: foreground,
                fontSize: compact ? 11 : 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  (Color, Color, Color) _colorsForTone(AppBadgeTone tone) {
    return switch (tone) {
      AppBadgeTone.accent => (
          AppColors.accentSoft.withValues(alpha: 0.18),
          AppColors.accent,
          AppColors.accent.withValues(alpha: 0.35),
        ),
      AppBadgeTone.success => (
          AppColors.successSoft,
          AppColors.success,
          AppColors.success.withValues(alpha: 0.35),
        ),
      AppBadgeTone.warning => (
          AppColors.warningSoft,
          AppColors.warning,
          AppColors.warning.withValues(alpha: 0.35),
        ),
      AppBadgeTone.danger => (
          AppColors.dangerSoft,
          AppColors.danger,
          AppColors.danger.withValues(alpha: 0.35),
        ),
      AppBadgeTone.neutral => (
          AppColors.surfaceAlt,
          AppColors.textSecondary,
          AppColors.border,
        ),
    };
  }
}

class AppBadgeRow extends StatelessWidget {
  const AppBadgeRow({
    super.key,
    required this.children,
    this.spacing = AppSpacing.sm,
    this.runSpacing = AppSpacing.sm,
  });

  final List<Widget> children;
  final double spacing;
  final double runSpacing;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: spacing,
      runSpacing: runSpacing,
      children: children,
    );
  }
}



