import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';

class AppLogo extends ConsumerWidget {
  const AppLogo({super.key, this.size = 72, this.showRing = true});

  final double size;
  final bool showRing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final preset = ref.watch(themeControllerProvider);
    final colors = AppColors.colorsFor(preset);
    final logoPath = preset == AppThemePreset.roseLight
        ? 'assets/images/app_logo_light_clean.png'
        : 'assets/images/app_logo_dark.png';

    final image = ClipOval(
      child: Image.asset(
        logoPath,
        width: size,
        height: size,
        fit: BoxFit.cover,
      ),
    );

    if (!showRing) {
      return image;
    }

    return Container(
      width: size + 10,
      height: size + 10,
      padding: const EdgeInsets.all(1),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.surface,
        border: Border.all(
          color: colors.accent.withValues(alpha: 0.50),
          width: 1.4,
        ),
        boxShadow: [
          BoxShadow(
            color: colors.accent.withValues(alpha: 0.14),
            blurRadius: 16,
            spreadRadius: 1,
          ),
        ],
      ),
      child: image,
    );
  }
}
