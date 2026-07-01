import 'package:flutter/material.dart';

import '../domain/scan_session_draft.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

enum SessionItemManagementChoice { clearAll, clearSelected }

Future<SessionItemManagementChoice?> showSessionItemManagementSheet(
  BuildContext context, {
  required String title,
  required String subtitle,
  required bool allowClearSelected,
}) {
  return showModalBottomSheet<SessionItemManagementChoice>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      final bottomInset = MediaQuery.of(context).viewInsets.bottom;
      return Container(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
          border: Border.all(color: AppColors.border),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.screenPadding,
              AppSpacing.lg,
              AppSpacing.screenPadding,
              AppSpacing.screenPadding + bottomInset,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 5,
                    decoration: BoxDecoration(
                      color: AppColors.borderStrong,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppSectionHeader(
                  title: title,
                  subtitle: subtitle,
                  tight: true,
                ),
                const SizedBox(height: AppSpacing.md),
                AppActionButton(
                  label: 'Clear All Items',
                  onPressed: () => Navigator.of(context).pop(SessionItemManagementChoice.clearAll),
                  variant: AppActionButtonVariant.secondary,
                  expanded: true,
                ),
                if (allowClearSelected) ...[
                  const SizedBox(height: AppSpacing.sm),
                  AppActionButton(
                    label: 'Clear Selected Items',
                    onPressed: () => Navigator.of(context).pop(SessionItemManagementChoice.clearSelected),
                    expanded: true,
                  ),
                ],
                const SizedBox(height: AppSpacing.sm),
                AppActionButton(
                  label: 'Cancel',
                  onPressed: () => Navigator.of(context).pop(),
                  variant: AppActionButtonVariant.tertiary,
                  expanded: true,
                ),
              ],
            ),
          ),
        ),
      );
    },
  );
}

Future<List<ScannedSessionItem>?> showSessionItemSelectionSheet(
  BuildContext context, {
  required String title,
  required String subtitle,
  required String confirmLabel,
  required List<ScannedSessionItem> items,
  Set<String> selectedItemIds = const <String>{},
  bool destructive = false,
}) {
  return showModalBottomSheet<List<ScannedSessionItem>>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    builder: (_) {
      return _SessionItemSelectionSheet(
        title: title,
        subtitle: subtitle,
        confirmLabel: confirmLabel,
        items: items,
        selectedItemIds: selectedItemIds,
        destructive: destructive,
      );
    },
  );
}

class _SessionItemSelectionSheet extends StatefulWidget {
  const _SessionItemSelectionSheet({
    required this.title,
    required this.subtitle,
    required this.confirmLabel,
    required this.items,
    required this.selectedItemIds,
    required this.destructive,
  });

  final String title;
  final String subtitle;
  final String confirmLabel;
  final List<ScannedSessionItem> items;
  final Set<String> selectedItemIds;
  final bool destructive;

  @override
  State<_SessionItemSelectionSheet> createState() => _SessionItemSelectionSheetState();
}

class _SessionItemSelectionSheetState extends State<_SessionItemSelectionSheet> {
  late final TextEditingController _searchController;
  late final Set<String> _selectedIds;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _selectedIds = {...widget.selectedItemIds};
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatWeight(double value) => value.toStringAsFixed(3);

  List<ScannedSessionItem> get _filteredItems {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) {
      return widget.items;
    }

    return widget.items.where((item) {
      final searchable = <String>[
        item.itemCode,
        item.supplier,
        item.category ?? '',
        item.jewelType ?? '',
        item.karat,
      ].join(' ').toLowerCase();
      return searchable.contains(query);
    }).toList(growable: false);
  }

  double _selectedTotal(List<ScannedSessionItem> items, double Function(ScannedSessionItem item) pick) {
    return items.fold(0, (sum, item) => sum + pick(item));
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final filtered = _filteredItems;
    final selectedItems = widget.items.where((item) => _selectedIds.contains(item.id)).toList(growable: false);
    final selectedGross = _selectedTotal(selectedItems, (item) => item.grossWeight);
    final selectedNet = _selectedTotal(selectedItems, (item) => item.netWeight);
    final selectedFine = _selectedTotal(selectedItems, (item) => item.fineWeight);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadius.xl)),
        border: Border.all(color: AppColors.border),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.screenPadding,
            AppSpacing.lg,
            AppSpacing.screenPadding,
            AppSpacing.screenPadding + bottomInset,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: AppColors.borderStrong,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppSectionHeader(
                title: widget.title,
                subtitle: widget.subtitle,
                tight: true,
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: 'Search item code',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _searchController.text.trim().isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            setState(() {
                              _searchController.clear();
                            });
                          },
                          icon: const Icon(Icons.clear_rounded),
                        ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppBadge(
                label: 'Selected ${selectedItems.length}',
                tone: widget.destructive ? AppBadgeTone.warning : AppBadgeTone.neutral,
                icon: Icons.check_rounded,
                compact: true,
              ),
              const SizedBox(height: AppSpacing.sm),
              if (selectedItems.isNotEmpty)
                AppBanner(
                  title: 'Selected preview',
                  message:
                      'Gross ${_formatWeight(selectedGross)} g | Net ${_formatWeight(selectedNet)} g | Fine ${_formatWeight(selectedFine)} g',
                  tone: widget.destructive ? AppBannerTone.warning : AppBannerTone.info,
                ),
              const SizedBox(height: AppSpacing.md),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: filtered.isEmpty
                    ? const AppBanner(
                        title: 'No items found',
                        message: 'Try a different item code or supplier.',
                        tone: AppBannerTone.info,
                      )
                    : ListView.separated(
                        shrinkWrap: true,
                        itemCount: filtered.length,
                        separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm),
                        itemBuilder: (context, index) {
                          final item = filtered[index];
                          final selected = _selectedIds.contains(item.id);
                          final detailParts = <String>[
                            if (item.supplier.trim().isNotEmpty) item.supplier.trim(),
                            if ((item.category ?? '').trim().isNotEmpty) item.category!.trim(),
                            if ((item.jewelType ?? '').trim().isNotEmpty) item.jewelType!.trim(),
                          ];
                          return AppCard(
                            onTap: () {
                              setState(() {
                                if (selected) {
                                  _selectedIds.remove(item.id);
                                } else {
                                  _selectedIds.add(item.id);
                                }
                              });
                            },
                            padding: const EdgeInsets.all(AppSpacing.md),
                            backgroundColor: selected
                                ? AppColors.accentSoft.withValues(alpha: 0.08)
                                : AppColors.surface,
                            borderColor: selected ? AppColors.accent : AppColors.border,
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Checkbox(
                                  value: selected,
                                  onChanged: (value) {
                                    setState(() {
                                      if (value == true) {
                                        _selectedIds.add(item.id);
                                      } else {
                                        _selectedIds.remove(item.id);
                                      }
                                    });
                                  },
                                ),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item.itemCode,
                                        style: TextStyle(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      if (detailParts.isNotEmpty) ...[
                                        const SizedBox(height: 2),
                                        Text(
                                          detailParts.join(' | '),
                                          style: TextStyle(
                                            color: AppColors.textSecondary,
                                            fontSize: 11,
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: AppSpacing.xs),
                                      Wrap(
                                        spacing: AppSpacing.xs,
                                        runSpacing: AppSpacing.xs,
                                        children: [
                                          _miniChip('Gross', '${_formatWeight(item.grossWeight)} g'),
                                          _miniChip('Net', '${_formatWeight(item.netWeight)} g'),
                                          _miniChip('Fine', '${_formatWeight(item.fineWeight)} g'),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: AppActionButton(
                      label: 'Cancel',
                      onPressed: () => Navigator.of(context).pop(),
                      variant: AppActionButtonVariant.tertiary,
                      expanded: true,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: AppActionButton(
                      label: widget.confirmLabel,
                      onPressed: _selectedIds.isEmpty
                          ? null
                          : () {
                              final selected = widget.items
                                  .where((item) => _selectedIds.contains(item.id))
                                  .toList(growable: false);
                              Navigator.of(context).pop(selected);
                            },
                      variant: widget.destructive
                          ? AppActionButtonVariant.secondary
                          : AppActionButtonVariant.primary,
                      expanded: true,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _miniChip(String label, String value) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 5),
        child: Text(
          '$label: $value',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

