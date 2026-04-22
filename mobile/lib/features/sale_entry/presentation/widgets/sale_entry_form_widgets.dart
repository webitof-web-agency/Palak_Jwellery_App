import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../sale_entry_provider.dart';
import '../../../../shared/theme/app_theme.dart';

const _customCategoryValue = '__custom_category__';
const _customMetalValue = '__custom_metal__';

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
    final isExpanded = widget.expandOnFocus && (isFocused || widget.controller.text.trim().isNotEmpty);
    final isMissed = widget.showParseState && !widget.parsed && !widget.parsedOverride;
    final borderColor = isMissed
        ? AppColors.warning.withValues(alpha: 0.8)
        : AppColors.border;
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
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: focusBorderColor, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
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

class CategorySelector extends StatelessWidget {
  const CategorySelector({
    super.key,
    required this.controller,
    required this.parsed,
    this.showParseState = true,
    required this.categories,
    required this.useCustomCategory,
    required this.onUseCustomChanged,
    required this.onCategorySelected,
  });

  final TextEditingController controller;
  final bool parsed;
  final bool showParseState;
  final List<String> categories;
  final bool useCustomCategory;
  final ValueChanged<bool> onUseCustomChanged;
  final ValueChanged<String> onCategorySelected;

  @override
  Widget build(BuildContext context) {
    if (categories.isEmpty) {
      return SaleField(
        label: 'Category',
        controller: controller,
        parsed: parsed,
        showParseState: false,
        hint: 'e.g. RING, NECKLACE, BANGLE',
        required: false,
      );
    }

    final selectedValue = categories.contains(controller.text.trim())
        ? controller.text.trim()
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: useCustomCategory ? null : selectedValue,
          isExpanded: true,
          isDense: true,
          decoration: InputDecoration(
            hintText: 'Pick supplier category',
            filled: true,
            fillColor: AppColors.surface,
            prefixIcon: Icon(
              showParseState && parsed
                  ? Icons.check_circle_rounded
                  : Icons.category_rounded,
              color: showParseState && parsed ? AppColors.success : AppColors.accent,
              size: 18,
            ),
            suffixIcon: selectedValue == null
                ? null
                : IconButton(
                    tooltip: 'Clear category',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    splashRadius: 18,
                    onPressed: () {
                      controller.clear();
                      onUseCustomChanged(false);
                    },
                    icon: Icon(
                      Icons.close_rounded,
                      color: AppColors.textFaint,
                      size: 18,
                    ),
                  ),
          ),
          dropdownColor: AppColors.surface,
          items: [
            ...categories.map(
              (category) => DropdownMenuItem<String>(
                value: category,
                child: Text(
                  category,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: AppColors.textPrimary),
                ),
              ),
            ),
            DropdownMenuItem<String>(
              value: _customCategoryValue,
              child: Row(
                children: [
                  Icon(
                    Icons.add_circle_outline_rounded,
                    color: AppColors.accent,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Add new category',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
          onChanged: useCustomCategory
              ? null
              : (value) {
                  if (value != null) {
                    if (value == _customCategoryValue) {
                      controller.clear();
                      onUseCustomChanged(true);
                      return;
                    }
                    onCategorySelected(value);
                  }
                },
          validator: (_) => null,
        ),
        const SizedBox(height: 10),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: AppColors.accent,
              padding: EdgeInsets.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            onPressed: () => onUseCustomChanged(!useCustomCategory),
            icon: Icon(
              useCustomCategory ? Icons.list_alt_rounded : Icons.edit_rounded,
              size: 16,
            ),
            label: Text(
              useCustomCategory
                  ? 'Choose from supplier categories'
                  : 'Type custom category',
            ),
          ),
        ),
        if (useCustomCategory) ...[
          const SizedBox(height: 8),
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.accent.withValues(alpha: 0.25),
              ),
              color: AppColors.warningSoft.withValues(alpha: 0.45),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: SaleField(
                label: 'New Category',
                controller: controller,
                parsed: parsed,
                parsedOverride: true,
                showParseState: false,
                hint: 'Type business category',
                required: false,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class MetalSelector extends StatelessWidget {
  const MetalSelector({
    super.key,
    required this.controller,
    required this.useCustomMetal,
    required this.onUseCustomChanged,
    this.onChanged,
  });

  final TextEditingController controller;
  final bool useCustomMetal;
  final ValueChanged<bool> onUseCustomChanged;
  final VoidCallback? onChanged;

  static const List<String> _metals = <String>[
    'Gold',
    'Silver',
    'Platinum',
    'Diamond',
  ];

  @override
  Widget build(BuildContext context) {
    final selectedValue = _metals.contains(controller.text.trim())
        ? controller.text.trim()
        : null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        DropdownButtonFormField<String>(
          initialValue: useCustomMetal ? null : selectedValue,
          isExpanded: true,
          isDense: true,
          decoration: InputDecoration(
            hintText: 'Select metal',
            filled: true,
            fillColor: AppColors.surface,
            prefixIcon: Icon(
              Icons.workspace_premium_rounded,
              color: AppColors.accent,
              size: 18,
            ),
            suffixIcon: selectedValue == null
                ? null
                : IconButton(
                    tooltip: 'Clear metal',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                    splashRadius: 18,
                    onPressed: () {
                      controller.clear();
                      onUseCustomChanged(false);
                    },
                    icon: Icon(
                      Icons.close_rounded,
                      color: AppColors.textFaint,
                      size: 18,
                    ),
                  ),
          ),
          dropdownColor: AppColors.surface,
          items: [
            ..._metals.map(
              (metal) => DropdownMenuItem<String>(
                value: metal,
                child: Text(
                  metal,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: AppColors.textPrimary),
                ),
              ),
            ),
            DropdownMenuItem<String>(
              value: _customMetalValue,
              child: Row(
                children: [
                  Icon(
                    Icons.add_circle_outline_rounded,
                    color: AppColors.accent,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Other metal',
                    style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
          onChanged: useCustomMetal
              ? null
              : (value) {
                  if (value != null) {
                    if (value == _customMetalValue) {
                      controller.clear();
                      onUseCustomChanged(true);
                      onChanged?.call();
                      return;
                    }
                    controller.text = value;
                    onUseCustomChanged(false);
                    onChanged?.call();
                  }
                },
          validator: (_) => null,
        ),
        if (useCustomMetal) ...[
          const SizedBox(height: 8),
          DecoratedBox(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.accent.withValues(alpha: 0.25),
              ),
              color: AppColors.surfaceAlt,
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: SaleField(
                label: 'Other Metal',
                controller: controller,
                parsed: false,
                showParseState: false,
                onChanged: onChanged,
                hint: 'e.g. Rose Gold, Mixed Metal',
                required: false,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class SupplierChip extends StatelessWidget {
  const SupplierChip({super.key, required this.name, required this.onClear});

  final String name;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          Icon(Icons.check_circle_rounded, color: AppColors.success, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          GestureDetector(
            onTap: onClear,
            child: Icon(
              Icons.close_rounded,
              color: AppColors.textFaint,
              size: 18,
            ),
          ),
        ],
      ),
    );
  }
}

class SupplierDropdown extends ConsumerWidget {
  const SupplierDropdown({
    super.key,
    required this.selectedId,
    required this.onSelected,
  });

  final String? selectedId;
  final void Function(String id, String name) onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliers = ref.watch(suppliersProvider);

    return suppliers.when(
      loading: () => LinearProgressIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.surfaceAlt,
      ),
      error: (e, _) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.dangerSoft),
        ),
        child: Text(
          'Could not load suppliers: $e',
          style: TextStyle(color: AppColors.danger, fontSize: 13),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.warning.withValues(alpha: 0.3),
              ),
            ),
            child: Text(
              'No active suppliers found. Ask admin to add one.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          );
        }

        final currentValue = list.any((supplier) => supplier.id == selectedId)
            ? selectedId
            : null;

        return Align(
          alignment: Alignment.center,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: DropdownButtonFormField<String>(
              initialValue: currentValue,
              isExpanded: true,
              isDense: true,
              menuMaxHeight: 320,
              decoration: InputDecoration(
                hintText: 'Choose supplier',
                filled: true,
                fillColor: AppColors.surface,
                hintStyle: const TextStyle(overflow: TextOverflow.ellipsis),
                prefixIcon: Icon(
                  Icons.storefront_rounded,
                  color: AppColors.accent,
                  size: 20,
                ),
              ),
              dropdownColor: AppColors.surface,
              items: list
                  .map(
                    (s) => DropdownMenuItem<String>(
                      value: s.id,
                      child: Text(
                        s.name,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: AppColors.textPrimary),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (id) {
                if (id == null) return;
                final name = list.firstWhere((s) => s.id == id).name;
                onSelected(id, name);
              },
              validator: (v) => v == null ? 'Supplier is required' : null,
            ),
          ),
        );
      },
    );
  }
}
