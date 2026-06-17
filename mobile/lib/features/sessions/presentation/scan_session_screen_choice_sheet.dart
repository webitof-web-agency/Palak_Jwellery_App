part of 'scan_session_screen.dart';

class _SearchChoiceSheet extends StatefulWidget {
  const _SearchChoiceSheet({
    required this.title,
    required this.searchHint,
    required this.options,
    required this.selectedValue,
    this.allowCustomValue = false,
    this.allowClearSelection = false,
    this.customValueHint,
  });

  final String title;
  final String searchHint;
  final List<String> options;
  final String? selectedValue;
  final bool allowCustomValue;
  final bool allowClearSelection;
  final String? customValueHint;

  @override
  State<_SearchChoiceSheet> createState() => _SearchChoiceSheetState();
}

class _SearchChoiceSheetState extends State<_SearchChoiceSheet> {
  late final TextEditingController _searchController;
  late final TextEditingController _customController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController();
    _customController = TextEditingController(
      text: widget.allowCustomValue ? widget.selectedValue ?? '' : '',
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    _customController.dispose();
    super.dispose();
  }

  List<String> get _filteredOptions {
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return widget.options;
    return widget.options.where((option) => option.toLowerCase().contains(query)).toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
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
                title: widget.title,
                subtitle: widget.allowCustomValue
                    ? 'Choose wastage or enter custom value.'
                    : 'Search and choose from the list.',
              ),
              if (widget.allowClearSelection && (widget.selectedValue ?? '').trim().isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context).pop(_clearSelectionSentinel),
                    icon: const Icon(Icons.clear_rounded, size: 18),
                    label: const Text('Clear selection'),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              TextField(
                controller: _searchController,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  labelText: widget.searchHint,
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
              if (widget.allowCustomValue) ...[
                const SizedBox(height: AppSpacing.md),
                TextField(
                  controller: _customController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
                  decoration: InputDecoration(
                    labelText: 'Custom value',
                    hintText: widget.customValueHint ?? 'Enter custom value',
                    prefixIcon: const Icon(Icons.edit_rounded),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                AppActionButton(
                  label: 'Use custom value',
                  onPressed: () {
                    final value = _customController.text.trim();
                    if (value.isEmpty) return;
                    Navigator.of(context).pop(value);
                  },
                  expanded: true,
                ),
                const SizedBox(height: AppSpacing.md),
              ] else
                const SizedBox(height: AppSpacing.md),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _filteredOptions.length,
                  separatorBuilder: (context, index) => const SizedBox(height: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final option = _filteredOptions[index];
                    final selected = option == widget.selectedValue;
                    return AppCard(
                      onTap: () => Navigator.of(context).pop(option),
                      padding: const EdgeInsets.all(AppSpacing.lg),
                      borderColor: selected ? AppColors.accent : AppColors.border,
                      backgroundColor: selected
                          ? AppColors.accentSoft.withValues(alpha: 0.08)
                          : AppColors.surface,
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              option,
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          if (selected)
                            const AppBadge(
                              label: 'Selected',
                              tone: AppBadgeTone.accent,
                              icon: Icons.check_rounded,
                              compact: true,
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        ),
      ),
    );
  }
}
