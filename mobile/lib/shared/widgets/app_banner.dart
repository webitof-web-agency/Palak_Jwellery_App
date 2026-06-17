import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';
import 'app_action_button.dart';

enum AppBannerTone { info, success, warning, danger }

class AppBanner extends StatelessWidget {
  const AppBanner({
    super.key,
    required this.message,
    this.title,
    this.tone = AppBannerTone.info,
    this.actionLabel,
    this.onAction,
    this.icon,
  });

  final String message;
  final String? title;
  final AppBannerTone tone;
  final String? actionLabel;
  final VoidCallback? onAction;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final (background, foreground, border, resolvedIcon) = _colorsForTone(tone);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(resolvedIcon, color: foreground, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null) ...[
                  Text(
                    title!,
                    style: TextStyle(
                      color: foreground,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                ],
                Text(
                  message,
                  style: TextStyle(
                    color: foreground.withValues(alpha: 0.92),
                    height: 1.45,
                  ),
                ),
                if (actionLabel != null && onAction != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  AppActionButton(
                    label: actionLabel!,
                    onPressed: onAction,
                    variant: AppActionButtonVariant.tertiary,
                    height: 40,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  (Color, Color, Color, IconData) _colorsForTone(AppBannerTone tone) {
    return switch (tone) {
      AppBannerTone.success => (
          AppColors.successSoft.withValues(alpha: 0.35),
          AppColors.success,
          AppColors.success.withValues(alpha: 0.35),
          Icons.check_circle_rounded,
        ),
      AppBannerTone.warning => (
          AppColors.warningSoft.withValues(alpha: 0.30),
          AppColors.warning,
          AppColors.warning.withValues(alpha: 0.35),
          Icons.warning_rounded,
        ),
      AppBannerTone.danger => (
          AppColors.dangerSoft.withValues(alpha: 0.28),
          AppColors.danger,
          AppColors.danger.withValues(alpha: 0.35),
          Icons.error_rounded,
        ),
      AppBannerTone.info => (
          AppColors.surfaceAlt,
          AppColors.textPrimary,
          AppColors.border,
          Icons.info_rounded,
        ),
    };
  }
}

