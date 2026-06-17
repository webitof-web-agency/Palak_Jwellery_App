import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../theme/app_tokens.dart';

enum AppActionButtonVariant { primary, secondary, tertiary, danger }

class AppActionButton extends StatelessWidget {
  const AppActionButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.variant = AppActionButtonVariant.primary,
    this.expanded = false,
    this.height = 52,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final AppActionButtonVariant variant;
  final bool expanded;
  final double height;

  @override
  Widget build(BuildContext context) {
    final child = switch (variant) {
      AppActionButtonVariant.primary => ElevatedButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
          label: Text(label),
          style: ElevatedButton.styleFrom(
            minimumSize: Size(expanded ? double.infinity : 0, height),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
          ),
        ),
      AppActionButtonVariant.secondary => OutlinedButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
          label: Text(label),
          style: OutlinedButton.styleFrom(
            minimumSize: Size(expanded ? double.infinity : 0, height),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
          ),
        ),
      AppActionButtonVariant.tertiary => TextButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
          label: Text(label),
        ),
      AppActionButtonVariant.danger => FilledButton.icon(
          onPressed: onPressed,
          icon: icon == null ? const SizedBox.shrink() : Icon(icon, size: 18),
          label: Text(label),
          style: FilledButton.styleFrom(
            backgroundColor: AppColors.danger,
            foregroundColor: AppColors.accentOn,
            minimumSize: Size(expanded ? double.infinity : 0, height),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
          ),
        ),
    };

    return SizedBox(
      width: expanded ? double.infinity : null,
      child: child,
    );
  }
}

