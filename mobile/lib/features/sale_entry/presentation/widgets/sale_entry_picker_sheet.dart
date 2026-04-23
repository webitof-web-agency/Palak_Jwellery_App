import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class SectionLabel extends StatelessWidget {
  const SectionLabel(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        letterSpacing: 1.4,
        fontWeight: FontWeight.w700,
        color: AppColors.accent,
      ),
    );
  }
}

class PickerChoice<T> {
  const PickerChoice({
    required this.value,
    required this.label,
    this.subtitle,
    this.leading,
  });

  final T value;
  final String label;
  final String? subtitle;
  final Widget? leading;
}

Widget buildPickerField({
  required String hint,
  required String? value,
  required IconData prefixIcon,
  required VoidCallback onTap,
  String? errorText,
  Color? prefixColor,
  VoidCallback? onClear,
  bool showChevron = true,
}) {
  final displayValue = value?.trim() ?? '';
  final hasValue = displayValue.isNotEmpty;

  return Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: InputDecorator(
        isEmpty: !hasValue,
        decoration: InputDecoration(
          hintText: hint,
          errorText: errorText,
          filled: true,
          fillColor: AppColors.surfaceAlt,
          prefixIcon: Icon(
            prefixIcon,
            color: prefixColor ?? AppColors.accent,
            size: 18,
          ),
          suffixIcon: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (hasValue && onClear != null)
                IconButton(
                  tooltip: 'Clear selection',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  splashRadius: 18,
                  onPressed: onClear,
                  icon: Icon(
                    Icons.close_rounded,
                    color: AppColors.textFaint,
                    size: 18,
                  ),
                ),
              if (showChevron)
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: AppColors.textFaint,
                  size: 22,
                ),
            ],
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: AppColors.accent, width: 1.4),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide(color: AppColors.danger),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
        child: Text(
          displayValue,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ),
  );
}

Future<T?> showPickerSheet<T>({
  required BuildContext context,
  required String title,
  required List<PickerChoice<T>> choices,
  String? customActionLabel,
  IconData customActionIcon = Icons.add_circle_outline_rounded,
  VoidCallback? onCustomAction,
}) {
  return showModalBottomSheet<T>(
    context: context,
    useSafeArea: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      final height = MediaQuery.sizeOf(sheetContext).height * 0.72;
      return FractionallySizedBox(
        heightFactor: 0.72,
        child: Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
            border: Border(
              top: BorderSide(color: AppColors.borderStrong),
              left: BorderSide(color: AppColors.borderStrong),
              right: BorderSide(color: AppColors.borderStrong),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
          ),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: height,
              child: Column(
                children: [
                  const SizedBox(height: 10),
                  Container(
                    width: 42,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.borderStrong,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        IconButton(
                          onPressed: () => Navigator.of(sheetContext).pop(),
                          icon: Icon(
                            Icons.close_rounded,
                            color: AppColors.textFaint,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
                      itemCount:
                          choices.length + (customActionLabel != null ? 1 : 0),
                      separatorBuilder: (context, index) =>
                          const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        if (customActionLabel != null &&
                            index == choices.length) {
                          return InkWell(
                            onTap: () {
                              Navigator.of(sheetContext).pop();
                              onCustomAction?.call();
                            },
                            borderRadius: BorderRadius.circular(18),
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: AppColors.warningSoft.withValues(
                                  alpha: 0.5,
                                ),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: AppColors.accent.withValues(
                                    alpha: 0.2,
                                  ),
                                ),
                              ),
                              child: Row(
                                children: [
                                  Icon(
                                    customActionIcon,
                                    color: AppColors.accent,
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      customActionLabel,
                                      style: TextStyle(
                                        color: AppColors.accent,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        }

                        final choice = choices[index];
                        return InkWell(
                          onTap: () =>
                              Navigator.of(sheetContext).pop(choice.value),
                          borderRadius: BorderRadius.circular(18),
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceAlt,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: AppColors.border),
                            ),
                            child: Row(
                              children: [
                                if (choice.leading != null) ...[
                                  choice.leading!,
                                  const SizedBox(width: 12),
                                ],
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        choice.label,
                                        style: TextStyle(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      if (choice.subtitle != null) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          choice.subtitle!,
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
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    },
  );
}
