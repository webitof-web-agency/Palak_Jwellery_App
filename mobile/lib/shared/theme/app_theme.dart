import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppThemePreset { roseLight, midnightRose }

AppThemePreset activePreset = AppThemePreset.roseLight;

AppThemePreset toggleThemePreset(AppThemePreset preset) {
  return preset == AppThemePreset.midnightRose
      ? AppThemePreset.roseLight
      : AppThemePreset.midnightRose;
}

class ThemeController extends Notifier<AppThemePreset> {
  @override
  AppThemePreset build() => activePreset;

  void toggle() {
    state = toggleThemePreset(state);
    activePreset = state;
  }
}

final themeControllerProvider =
    NotifierProvider<ThemeController, AppThemePreset>(ThemeController.new);

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
    accentOn: Color(0xFFFFFAF5),
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

  static AppColorPalette colorsFor(AppThemePreset preset) {
    return preset == AppThemePreset.midnightRose ? midnightRose : roseLight;
  }

  static Color get background => colorsFor(activePreset).background;
  static Color get surface => colorsFor(activePreset).surface;
  static Color get surfaceAlt => colorsFor(activePreset).surfaceAlt;
  static Color get surfaceStrong => colorsFor(activePreset).surfaceStrong;
  static Color get textPrimary => colorsFor(activePreset).textPrimary;
  static Color get textSecondary => colorsFor(activePreset).textSecondary;
  static Color get textMuted => colorsFor(activePreset).textMuted;
  static Color get textFaint => colorsFor(activePreset).textFaint;
  static Color get border => colorsFor(activePreset).border;
  static Color get borderStrong => colorsFor(activePreset).borderStrong;
  static Color get accent => colorsFor(activePreset).accent;
  static Color get accentSoft => colorsFor(activePreset).accentSoft;
  static Color get accentOn => colorsFor(activePreset).accentOn;
  static Color get success => colorsFor(activePreset).success;
  static Color get successSoft => colorsFor(activePreset).successSoft;
  static Color get warning => colorsFor(activePreset).warning;
  static Color get warningSoft => colorsFor(activePreset).warningSoft;
  static Color get danger => colorsFor(activePreset).danger;
  static Color get dangerSoft => colorsFor(activePreset).dangerSoft;
}

class AppTheme {
  const AppTheme._();

  static ThemeData theme([AppThemePreset? preset]) {
    final selectedPreset = preset ?? activePreset;
    final colors = AppColors.colorsFor(selectedPreset);
    final isDark = selectedPreset == AppThemePreset.midnightRose;

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

    final baseTextTheme = (isDark ? ThemeData.dark() : ThemeData.light()).textTheme;
    final textTheme = baseTextTheme.apply(
      bodyColor: colors.textPrimary,
      displayColor: colors.textPrimary,
    ).copyWith(
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(color: colors.textSecondary),
      bodySmall: baseTextTheme.bodySmall?.copyWith(color: colors.textMuted),
      titleMedium: baseTextTheme.titleMedium?.copyWith(color: colors.textPrimary),
      titleSmall: baseTextTheme.titleSmall?.copyWith(color: colors.textSecondary),
      labelMedium: baseTextTheme.labelMedium?.copyWith(
        color: colors.textSecondary,
        fontWeight: FontWeight.w600,
      ),
    );

    return ThemeData(
      useMaterial3: true,
      brightness: colorScheme.brightness,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: colors.background,
      canvasColor: colors.surface,
      cardColor: colors.surface,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      iconTheme: IconThemeData(color: colors.textPrimary),
      primaryIconTheme: IconThemeData(color: colors.textPrimary),
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
        labelStyle: TextStyle(color: colors.textSecondary),
        hintStyle: TextStyle(color: colors.textFaint),
        helperStyle: TextStyle(color: colors.textFaint),
        errorStyle: TextStyle(color: colors.danger),
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
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: colors.accent,
        circularTrackColor: colors.surfaceStrong,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colors.surfaceStrong,
        contentTextStyle: TextStyle(color: colors.textPrimary),
        actionTextColor: colors.accent,
      ),
      popupMenuTheme: PopupMenuThemeData(
        color: colors.surface,
        textStyle: TextStyle(color: colors.textPrimary),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: colors.border),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: BorderSide(color: colors.border),
        ),
      ),
    );
  }
}
