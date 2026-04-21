import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../sale_entry_provider.dart';
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

class SaleField extends StatelessWidget {
  const SaleField({
    super.key,
    required this.label,
    required this.controller,
    required this.parsed,
    this.parsedOverride = false,
    this.hint = '',
    this.numeric = false,
    this.required = false,
  });

  final String label;
  final TextEditingController controller;
  final bool parsed;
  final bool parsedOverride;
  final String hint;
  final bool numeric;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final isMissed = !parsed && !parsedOverride;
    final borderColor = isMissed
        ? AppColors.warning.withValues(alpha: 0.8)
        : AppColors.border;
    final focusBorderColor = isMissed ? AppColors.warning : AppColors.accent;

    Widget? suffixIcon;
    if (parsed && !parsedOverride) {
      suffixIcon = Icon(
        Icons.check_circle_rounded,
        color: AppColors.success,
        size: 18,
      );
    } else if (isMissed) {
      suffixIcon = Icon(
        Icons.warning_amber_rounded,
        color: AppColors.warning,
        size: 18,
      );
    }

    return TextFormField(
      controller: controller,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      inputFormatters: numeric
          ? [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))]
          : null,
      textInputAction: TextInputAction.next,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
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
      validator: required
          ? (v) {
              if (v == null || v.trim().isEmpty) return '$label is required';
              if (numeric && (double.tryParse(v) == null)) {
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
    required this.categories,
    required this.useCustomCategory,
    required this.onUseCustomChanged,
    required this.onCategorySelected,
  });

  final TextEditingController controller;
  final bool parsed;
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
        hint: 'e.g. RING, NECKLACE, BANGLE',
        required: true,
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
          decoration: InputDecoration(
            labelText: 'Category',
            hintText: 'Pick supplier category',
            helperText: 'Supplier categories are suggestions. You can still type your own.',
            filled: true,
            fillColor: AppColors.surface,
            prefixIcon: Icon(
              parsed ? Icons.check_circle_rounded : Icons.category_rounded,
              color: parsed ? AppColors.success : AppColors.accent,
              size: 18,
            ),
          ),
          dropdownColor: AppColors.surface,
          items: categories
              .map(
                (category) => DropdownMenuItem<String>(
                  value: category,
                  child: Text(
                    category,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: AppColors.textPrimary),
                  ),
                ),
              )
              .toList(),
          onChanged: useCustomCategory
              ? null
              : (value) {
                  if (value != null) {
                    onCategorySelected(value);
                  }
                },
          validator: (_) {
            if (useCustomCategory) {
              return null;
            }
            return controller.text.trim().isEmpty
                ? 'Category is required'
                : null;
          },
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
                  ? 'Use supplier category'
                  : 'Type custom category',
            ),
          ),
        ),
        if (useCustomCategory) ...[
          const SizedBox(height: 8),
          SaleField(
            label: 'Custom Category',
            controller: controller,
            parsed: parsed,
            hint: 'Type business category',
            required: true,
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

        return DropdownButtonFormField<String>(
          initialValue: currentValue,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: 'Select Supplier *',
            hintText: 'Supplier not detected - choose one',
            helperText: 'If QR detection misses the supplier, choose it here and continue.',
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
        );
      },
    );
  }
}
