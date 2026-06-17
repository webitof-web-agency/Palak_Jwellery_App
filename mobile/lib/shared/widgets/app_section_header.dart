import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';

class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
    this.tight = false,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;
  final bool tight;

  @override
  Widget build(BuildContext context) {
    final titleStyle = TextStyle(
      color: AppColors.textPrimary,
      fontSize: AppTypography.titleSize,
      fontWeight: AppTypography.titleWeight,
      letterSpacing: 0.2,
    );

    final subtitleStyle = TextStyle(
      color: AppColors.textSecondary,
      fontSize: 13,
      height: 1.45,
    );

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: titleStyle),
              if (subtitle != null) ...[
                SizedBox(height: tight ? AppSpacing.xs : AppSpacing.sm),
                Text(subtitle!, style: subtitleStyle),
              ],
            ],
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: AppSpacing.sm),
          trailing!,
        ],
      ],
    );
  }
}

