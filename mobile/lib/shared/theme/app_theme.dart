import 'package:flutter/material.dart';

enum AppThemePreset { roseLight, midnightRose }

const AppThemePreset activePreset = AppThemePreset.roseLight;

class AppColorPalette {
  const AppColorPalette({
    required this.background,
    required this.surface,
    required this.surfaceAlt,
    required this.surfaceStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textFaint,
    required this.border,
    required this.borderStrong,
    required this.accent,
    required this.accentSoft,
    required this.accentOn,
    required this.success,
    required this.successSoft,
    required this.warning,
    required this.warningSoft,
    required this.danger,
    required this.dangerSoft,
  });

  final Color background;
  final Color surface;
  final Color surfaceAlt;
  final Color surfaceStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textFaint;
  final Color border;
  final Color borderStrong;
  final Color accent;
  final Color accentSoft;
  final Color accentOn;
  final Color success;
  final Color successSoft;
  final Color warning;
  final Color warningSoft;
  final Color danger;
  final Color dangerSoft;
}

class AppColors {
  const AppColors._();


  static const AppColorPalette roseLight = AppColorPalette(
    background: Color(0xFFFBF6F0),
    surface: Color(0xFFFFFAF5),
    surfaceAlt: Color(0xFFF5EBDD),
    surfaceStrong: Color(0xFFE9D6C4),
    textPrimary: Color(0xFF261C18),
    textSecondary: Color(0xFF5A463D),
    textMuted: Color(0xFF806A5F),
    textFaint: Color(0xFFA18E84),
    border: Color(0x2A7B6254),
    borderStrong: Color(0x3A7B6254),
    accent: Color(0xFFC87368),
    accentSoft: Color(0xFFE9B7AC),
    accentOn: Color(0xFF261C18),
    success: Color(0xFF2F8A64),
    successSoft: Color(0xFFDCEFE6),
    warning: Color(0xFFB97A3A),
    warningSoft: Color(0xFFF8E5C8),
    danger: Color(0xFFB34949),
    dangerSoft: Color(0xFFF6DADA),
  );

  static const AppColorPalette midnightRose = AppColorPalette(
    background: Color(0xFF030811),
    surface: Color(0xFF07111F),
    surfaceAlt: Color(0xFF0B1524),
    surfaceStrong: Color(0xFF0E1828),
    textPrimary: Color(0xFFF4F0EA),
    textSecondary: Color(0xFFD8D1C7),
    textMuted: Color(0xFFB9B1A7),
    textFaint: Color(0xFF958B81),
    border: Color(0x22FFFFFF),
    borderStrong: Color(0x33FFFFFF),
    accent: Color(0xFFD6A24F),
    accentSoft: Color(0xFFF7D89B),
    accentOn: Colors.black,
    success: Color(0xFF27AE60),
    successSoft: Color(0xFF0E2A1A),
    warning: Color(0xFFE57C1A),
    warningSoft: Color(0xFF1A1000),
    danger: Color(0xFFC0392B),
    dangerSoft: Color(0xFF2A0A0A),
  );

  static const Color background = activePreset == AppThemePreset.midnightRose ? Color(0xFF030811) : Color(0xFFFBF6F0);
  static const Color surface = activePreset == AppThemePreset.midnightRose ? Color(0xFF07111F) : Color(0xFFFFFAF5);
  static const Color surfaceAlt = activePreset == AppThemePreset.midnightRose ? Color(0xFF0B1524) : Color(0xFFF5EBDD);
  static const Color surfaceStrong = activePreset == AppThemePreset.midnightRose ? Color(0xFF0E1828) : Color(0xFFE9D6C4);
  static const Color textPrimary = activePreset == AppThemePreset.midnightRose ? Color(0xFFF4F0EA) : Color(0xFF261C18);
  static const Color textSecondary = activePreset == AppThemePreset.midnightRose ? Color(0xFFD8D1C7) : Color(0xFF5A463D);
  static const Color textMuted = activePreset == AppThemePreset.midnightRose ? Color(0xFFB9B1A7) : Color(0xFF806A5F);
  static const Color textFaint = activePreset == AppThemePreset.midnightRose ? Color(0xFF958B81) : Color(0xFFA18E84);
  static const Color border = activePreset == AppThemePreset.midnightRose ? Color(0x22FFFFFF) : Color(0x2A7B6254);
  static const Color borderStrong = activePreset == AppThemePreset.midnightRose ? Color(0x33FFFFFF) : Color(0x3A7B6254);
  static const Color accent = activePreset == AppThemePreset.midnightRose ? Color(0xFFD6A24F) : Color(0xFFC87368);
  static const Color accentSoft = activePreset == AppThemePreset.midnightRose ? Color(0xFFF7D89B) : Color(0xFFE9B7AC);
  static const Color accentOn = activePreset == AppThemePreset.midnightRose ? Colors.black : Color(0xFF261C18);
  static const Color success = activePreset == AppThemePreset.midnightRose ? Color(0xFF27AE60) : Color(0xFF2F8A64);
  static const Color successSoft = activePreset == AppThemePreset.midnightRose ? Color(0xFF0E2A1A) : Color(0xFFDCEFE6);
  static const Color warning = activePreset == AppThemePreset.midnightRose ? Color(0xFFE57C1A) : Color(0xFFB97A3A);
  static const Color warningSoft = activePreset == AppThemePreset.midnightRose ? Color(0xFF1A1000) : Color(0xFFF8E5C8);
  static const Color danger = activePreset == AppThemePreset.midnightRose ? Color(0xFFC0392B) : Color(0xFFB34949);
  static const Color dangerSoft = activePreset == AppThemePreset.midnightRose ? Color(0xFF2A0A0A) : Color(0xFFF6DADA);
}

class AppTheme {
  const AppTheme._();

  static ThemeData theme() {
    final colors = activePreset == AppThemePreset.midnightRose
        ? AppColors.midnightRose
        : AppColors.roseLight;
    final isDark = activePreset == AppThemePreset.midnightRose;

    final colorScheme = ColorScheme.fromSeed(
      seedColor: colors.accent,
      brightness: isDark ? Brightness.dark : Brightness.light,
    ).copyWith(
      primary: colors.accent,
      onPrimary: colors.accentOn,
      secondary: colors.accentSoft,
      onSecondary: colors.textPrimary,
      error: colors.danger,
      onError: colors.accentOn,
      surface: colors.surface,
      onSurface: colors.textPrimary,
      surfaceContainerHighest: colors.surfaceAlt,
      outline: colors.border,
      outlineVariant: colors.borderStrong,
      surfaceTint: colors.accent,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: colorScheme.brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colors.background,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        backgroundColor: colors.background,
        foregroundColor: colors.textPrimary,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.accent,
          foregroundColor: colors.accentOn,
          disabledBackgroundColor: colors.accent.withValues(alpha: 0.5),
          disabledForegroundColor: colors.accentOn.withValues(alpha: 0.7),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.textPrimary,
          side: BorderSide(color: colors.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: colors.border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.accent, width: 1.3),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: colors.danger, width: 1.3),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      ),
      dividerTheme: DividerThemeData(
        color: colors.border,
        thickness: 1,
      ),
    );
  }
}
