import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AppLogo extends StatelessWidget {
  const AppLogo({
    super.key,
    this.size = 72,
  });

  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipOval(
      child: Image.asset(
        activePreset == AppThemePreset.roseLight
            ? 'assets/images/app_logo_light_clean.png'
            : 'assets/images/app_logo_dark.png',
        width: size,
        height: size,
        fit: BoxFit.cover,
      ),
    );
  }
}
