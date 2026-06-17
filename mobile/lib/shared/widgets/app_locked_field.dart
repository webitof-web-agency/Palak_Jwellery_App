import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';
import 'app_badge.dart';
import 'app_card.dart';

class AppLockedField extends StatelessWidget {
  const AppLockedField({
    super.key,
    required this.label,
    required this.value,
    this.helper,
    this.locked = true,
    this.trailing,
  });

  final String label;
  final String value;
  final String? helper;
  final bool locked;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: AppTypography.labelSize,
                    fontWeight: AppTypography.labelWeight,
                    letterSpacing: 1.8,
                  ),
                ),
              ),
              AppBadge(
                label: locked ? 'Locked' : 'Editable',
                tone: locked ? AppBadgeTone.neutral : AppBadgeTone.accent,
                compact: true,
                icon: locked ? Icons.lock_rounded : Icons.edit_rounded,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            value,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: AppTypography.titleSize,
              fontWeight: AppTypography.titleWeight,
            ),
          ),
          if (helper != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              helper!,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
          ],
          if (trailing != null) ...[
            const SizedBox(height: AppSpacing.sm),
            trailing!,
          ],
        ],
      ),
    );
  }
}

