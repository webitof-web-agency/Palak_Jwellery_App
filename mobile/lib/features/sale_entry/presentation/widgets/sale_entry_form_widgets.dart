import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../shared/theme/app_theme.dart';

class SaleField extends StatefulWidget {
  const SaleField({
    super.key,
    required this.label,
    required this.controller,
    required this.parsed,
    this.parsedOverride = false,
    this.showParseState = true,
    this.showClearButton = true,
    this.onChanged,
    this.hint = '',
    this.numeric = false,
    this.required = false,
    this.expandOnFocus = false,
    this.maxLines = 1,
  });

  final String label;
  final TextEditingController controller;
  final bool parsed;
  final bool parsedOverride;
  final bool showParseState;
  final bool showClearButton;
  final VoidCallback? onChanged;
  final String hint;
  final bool numeric;
  final bool required;
  final bool expandOnFocus;
  final int maxLines;

  @override
  State<SaleField> createState() => _SaleFieldState();
}

class _SaleFieldState extends State<SaleField> {
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode();
    _focusNode.addListener(_handleFocusChange);
    widget.controller.addListener(_handleControllerChange);
  }

  @override
  void didUpdateWidget(covariant SaleField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_handleControllerChange);
      widget.controller.addListener(_handleControllerChange);
    }
  }

  void _handleFocusChange() {
    if (mounted) setState(() {});
  }

  void _handleControllerChange() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller.removeListener(_handleControllerChange);
    _focusNode
      ..removeListener(_handleFocusChange)
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isFocused = _focusNode.hasFocus;
    final isExpanded = widget.expandOnFocus &&
        (isFocused || widget.controller.text.trim().isNotEmpty);
    final isMissed = widget.showParseState && !widget.parsed && !widget.parsedOverride;
    final borderColor = isMissed ? AppColors.warning.withValues(alpha: 0.8) : AppColors.border;
    final focusBorderColor = isMissed ? AppColors.warning : AppColors.accent;

    Widget? statusIcon;
    if (widget.parsed && !widget.parsedOverride) {
      statusIcon = Icon(
        Icons.check_circle_rounded,
        color: AppColors.success,
        size: 18,
      );
    } else if (isMissed) {
      statusIcon = Icon(
        Icons.warning_amber_rounded,
        color: AppColors.warning,
        size: 18,
      );
    }

    Widget? clearIcon;
    final hasText = widget.controller.text.trim().isNotEmpty;
    if (widget.showClearButton && hasText) {
      clearIcon = IconButton(
        tooltip: 'Clear ${widget.label}',
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
        splashRadius: 18,
        onPressed: () {
          widget.controller.clear();
          widget.onChanged?.call();
          setState(() {});
        },
        icon: Icon(
          Icons.close_rounded,
          color: AppColors.textFaint,
          size: 18,
        ),
      );
    }

    Widget? suffixIcon;
    if (clearIcon != null || statusIcon != null) {
      final icons = <Widget>[];
      if (clearIcon != null) icons.add(clearIcon);
      if (statusIcon != null) icons.add(statusIcon);
      icons.add(const SizedBox(width: 8));
      suffixIcon = Row(mainAxisSize: MainAxisSize.min, children: icons);
    }

    final maxLines = widget.expandOnFocus ? (isExpanded ? widget.maxLines : 1) : widget.maxLines;

    return TextFormField(
      focusNode: _focusNode,
      controller: widget.controller,
      maxLines: maxLines,
      minLines: widget.expandOnFocus ? 1 : null,
      keyboardType: widget.numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : (maxLines > 1 ? TextInputType.multiline : TextInputType.text),
      inputFormatters: widget.numeric
          ? [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))]
          : null,
      textInputAction: maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
      decoration: InputDecoration(
        labelText: widget.label,
        hintText: widget.hint,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: focusBorderColor, width: 1.4),
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
      validator: widget.required
          ? (v) {
              if (v == null || v.trim().isEmpty) return '${widget.label} is required';
              if (widget.numeric && (double.tryParse(v) == null)) {
                return 'Enter a valid number';
              }
              return null;
            }
          : null,
    );
  }
}
