import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../features/sale_entry/data/sale_repository.dart';
import '../../../../shared/theme/app_theme.dart';
import '../sale_entry_provider.dart';
import 'sale_entry_form_widgets.dart';
import 'sale_entry_picker_sheet.dart';

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

    final currentValue = controller.text.trim();
    final selectedValue = useCustomCategory
        ? currentValue
        : (categories.contains(currentValue) ? currentValue : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildPickerField(
          hint: 'Pick supplier category',
          value: selectedValue,
          prefixIcon: showParseState && parsed
              ? Icons.check_circle_rounded
              : Icons.category_rounded,
          prefixColor:
              showParseState && parsed ? AppColors.success : AppColors.accent,
          onTap: () async {
            final choice = await showPickerSheet<String>(
              context: context,
              title: 'Supplier categories',
              choices: categories
                  .map(
                    (category) => PickerChoice<String>(
                      value: category,
                      label: category,
                      leading: Icon(
                        Icons.label_rounded,
                        color: AppColors.accent,
                        size: 18,
                      ),
                    ),
                  )
                  .toList(growable: false),
              customActionLabel: 'Add new category',
              onCustomAction: () {
                controller.clear();
                onUseCustomChanged(true);
              },
            );

            if (!context.mounted || choice == null) return;
            controller.text = choice;
            onUseCustomChanged(false);
            onCategorySelected(choice);
          },
          onClear: selectedValue == null
              ? null
              : () {
                  controller.clear();
                  onUseCustomChanged(false);
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

  // Material-accurate color swatches for each metal
  static const Map<String, Color> _metalColors = {
    'Gold': Color(0xFFD4A44C),
    'Silver': Color(0xFFA8B0BB),
    'Platinum': Color(0xFFD0D8E4),
    'Diamond': Color(0xFFA8D8EA),
  };

  static Widget _metalSwatch(String metal) {
    final color = _metalColors[metal] ?? const Color(0xFFCCCCCC);
    return Container(
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        border: Border.all(
          color: Colors.black.withValues(alpha: 0.08),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.45),
            blurRadius: 4,
            spreadRadius: 0,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final currentValue = controller.text.trim();
    final selectedValue = useCustomMetal
        ? currentValue
        : (_metals.contains(currentValue) ? currentValue : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildPickerField(
          hint: 'Select metal',
          value: selectedValue,
          prefixIcon: Icons.workspace_premium_rounded,
          onTap: () async {
            final choice = await showPickerSheet<String>(
              context: context,
              title: 'Metal type',
              choices: _metals
                  .map(
                    (metal) => PickerChoice<String>(
                      value: metal,
                      label: metal,
                      leading: _metalSwatch(metal),
                    ),
                  )
                  .toList(growable: false),
              customActionLabel: 'Other metal',
              customActionIcon: Icons.auto_awesome_rounded,
              onCustomAction: () {
                controller.clear();
                onUseCustomChanged(true);
                onChanged?.call();
              },
            );

            if (!context.mounted || choice == null) return;
            controller.text = choice;
            onUseCustomChanged(false);
            onChanged?.call();
          },
          onClear: selectedValue == null
              ? null
              : () {
                  controller.clear();
                  onUseCustomChanged(false);
                  onChanged?.call();
                },
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
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: AppColors.accent,
                padding: EdgeInsets.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () {
                controller.clear();
                onUseCustomChanged(false);
                onChanged?.call();
              },
              icon: const Icon(Icons.list_alt_rounded, size: 16),
              label: const Text('Choose from preset metals'),
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

        SupplierModel? selectedSupplier;
        if (currentValue != null) {
          for (final supplier in list) {
            if (supplier.id == currentValue) {
              selectedSupplier = supplier;
              break;
            }
          }
        }

        return FormField<String>(
          initialValue: currentValue,
          validator: (value) =>
              value == null ? 'Supplier is required' : null,
          builder: (field) {
            return buildPickerField(
              hint: 'Choose supplier',
              value: selectedSupplier?.name,
              prefixIcon: Icons.storefront_rounded,
              onTap: () async {
                final picked = await showPickerSheet<SupplierModel>(
                  context: context,
                  title: 'Choose supplier',
                  choices: list
                      .map(
                        (supplier) => PickerChoice<SupplierModel>(
                          value: supplier,
                          label: supplier.name,
                          subtitle: supplier.code.isNotEmpty
                              ? 'Code: ${supplier.code}'
                              : null,
                          leading: Icon(
                            Icons.storefront_rounded,
                            color: AppColors.accent,
                            size: 18,
                          ),
                        ),
                      )
                      .toList(growable: false),
                );

                if (!context.mounted || picked == null) return;
                field.didChange(picked.id);
                onSelected(picked.id, picked.name);
              },
              errorText: field.errorText,
            );
          },
        );
      },
    );
  }
}
