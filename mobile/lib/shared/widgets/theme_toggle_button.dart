import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../theme/app_theme.dart';

class ThemeToggleButton extends ConsumerWidget {
  const ThemeToggleButton({
    super.key,
    this.size = 44,
  });

  final double size;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preset = ref.watch(themeControllerProvider);
    final isDark = preset == AppThemePreset.midnightRose;
    final label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

    return Semantics(
      button: true,
      label: label,
      child: Tooltip(
        message: label,
        child: Material(
          color: AppColors.surface,
          shape: const CircleBorder(),
          elevation: 0,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => ref.read(themeControllerProvider.notifier).toggle(),
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border),
              ),
              child: Icon(
                isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                color: AppColors.accent,
                size: 20,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
