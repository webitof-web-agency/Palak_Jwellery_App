import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';
import 'app_action_button.dart';
import 'app_card.dart';

class AppDraftRecoveryBanner extends StatelessWidget {
  const AppDraftRecoveryBanner({
    super.key,
    required this.title,
    required this.message,
    this.lastUpdatedLabel,
    this.onResume,
    this.onDiscard,
  });

  final String title;
  final String message;
  final String? lastUpdatedLabel;
  final VoidCallback? onResume;
  final VoidCallback? onDiscard;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      backgroundColor: AppColors.surfaceStrong,
      borderColor: AppColors.borderStrong,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.restore_rounded, size: 20, color: AppColors.accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: AppTypography.headingWeight,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      message,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        height: 1.45,
                      ),
                    ),
                    if (lastUpdatedLabel != null) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        lastUpdatedLabel!,
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          if (onResume != null || onDiscard != null) ...[
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                if (onResume != null)
                  AppActionButton(
                    label: 'Resume draft',
                    onPressed: onResume,
                    icon: Icons.play_arrow_rounded,
                    variant: AppActionButtonVariant.primary,
                    height: 42,
                  ),
                if (onDiscard != null)
                  AppActionButton(
                    label: 'Discard',
                    onPressed: onDiscard,
                    icon: Icons.delete_outline_rounded,
                    variant: AppActionButtonVariant.secondary,
                    height: 42,
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
