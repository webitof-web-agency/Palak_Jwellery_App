part of 'scan_session_screen.dart';

class _PickerCard extends StatelessWidget {
  const _PickerCard({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.onTap,
    required this.accent,
  });

  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      borderColor: accent ? AppColors.accent : AppColors.border,
      backgroundColor: accent ? AppColors.accentSoft.withValues(alpha: 0.08) : AppColors.surface,
      child: Row(
        children: [
          Icon(
            icon,
            color: accent ? AppColors.accent : AppColors.textSecondary,
            size: 20,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label.toUpperCase(),
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  value,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: AppTypography.bodySize,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          Icon(Icons.expand_more_rounded, color: AppColors.textMuted, size: 20),
        ],
      ),
    );
  }
}

class _ScanTotalsGrid extends StatelessWidget {
  const _ScanTotalsGrid({required this.draft});

  final ScanSessionDraft draft;

  String _formatDouble(double value) => value.toStringAsFixed(3);

  bool get _showAmountRow => draft.totalStoneAmount > 0 || draft.totalOtherAmount > 0;

  Widget _metricTile({
    required String label,
    required String value,
    required String helper,
  }) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label.toUpperCase(),
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                height: 1.0,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              helper,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 10,
                height: 1.1,
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _metricTile(
                label: 'Items',
                value: draft.totalItems.toString(),
                helper: draft.hasScannedItems ? 'Scanned' : 'Empty',
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _metricTile(
                label: 'Gross',
                value: '${_formatDouble(draft.totalGrossWeight)} g',
                helper: 'All items',
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _metricTile(
                label: 'Net',
                value: '${_formatDouble(draft.totalNetWeight)} g',
                helper: 'Gross - deductions',
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: _metricTile(
                label: 'Stone',
                value: '${_formatDouble(draft.totalStoneWeight)} g',
                helper: 'Stone total',
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _metricTile(
                label: 'Other',
                value: '${_formatDouble(draft.totalOtherWeight)} g',
                helper: 'Other total',
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Expanded(
              child: _metricTile(
                label: 'Fine',
                value: '${_formatDouble(draft.totalFineWeight)} g',
                helper: 'Net x formula',
              ),
            ),
          ],
        ),
        if (_showAmountRow) ...[
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              if (draft.totalStoneAmount > 0)
                Expanded(
                  child: _metricTile(
                    label: 'Stone Amt',
                    value: 'Rs. ${draft.totalStoneAmount.toStringAsFixed(2)}',
                    helper: 'Available',
                  ),
                ),
              if (draft.totalStoneAmount > 0 && draft.totalOtherAmount > 0)
                const SizedBox(width: AppSpacing.xs),
              if (draft.totalOtherAmount > 0)
                Expanded(
                  child: _metricTile(
                    label: 'Other Amount',
                    value: 'Rs. ${draft.totalOtherAmount.toStringAsFixed(2)}',
                    helper: 'Available',
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _EmptyScanState extends StatelessWidget {
  const _EmptyScanState();

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'No scanned items yet',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Scan your first item to preview the active list.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _LockedScanSettingsCard extends StatelessWidget {
  const _LockedScanSettingsCard({
    required this.supplier,
    required this.category,
    required this.karat,
    required this.purity,
    required this.wastage,
    required this.stonePrice,
    required this.purityIsCustom,
    required this.wastageIsCustom,
    required this.stonePriceIsCustom,
    required this.continuousScan,
    required this.onToggleContinuousScan,
    required this.onUnlock,
    required this.onStartScan,
  });

  final String? supplier;
  final String? category;
  final String? karat;
  final double? purity;
  final double? wastage;
  final double? stonePrice;
  final bool purityIsCustom;
  final bool wastageIsCustom;
  final bool stonePriceIsCustom;
  final bool continuousScan;
  final ValueChanged<bool> onToggleContinuousScan;
  final VoidCallback onUnlock;
  final VoidCallback onStartScan;

  String _displayPercent(double? value) => value == null ? '-' : '${value.toStringAsFixed(2)}%';

  Widget _valueChip(String label, String value, {bool muted = false}) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
        child: Text(
          '$label: $value',
          style: TextStyle(
            color: muted ? AppColors.textMuted : AppColors.textPrimary,
            fontSize: 10,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final categoryText = (category ?? '').trim().isEmpty ? 'Category pending' : category!;
    final categoryMuted = (category ?? '').trim().isEmpty;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Locked scan settings',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
              ),
              const AppBadge(
                label: 'Locked',
                tone: AppBadgeTone.neutral,
                icon: Icons.lock_rounded,
                compact: true,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _valueChip('Supplier', supplier?.trim().isNotEmpty == true ? supplier! : '-'),
              _valueChip('Category', categoryText, muted: categoryMuted),
              _valueChip('Karat', karat?.trim().isNotEmpty == true ? karat! : '-'),
              _valueChip('Purity', _displayPercent(purity)),
              _valueChip('Wastage', _displayPercent(wastage)),
              if (stonePrice != null)
                _valueChip('Stone Price', 'Rs. ${stonePrice!.toStringAsFixed(2)}'),
              if (purityIsCustom)
                const AppBadge(
                  label: 'Custom Purity',
                  tone: AppBadgeTone.warning,
                  icon: Icons.tune_rounded,
                  compact: true,
                ),
              if (wastageIsCustom)
                const AppBadge(
                  label: 'Custom Wastage',
                  tone: AppBadgeTone.warning,
                  icon: Icons.tune_rounded,
                  compact: true,
                ),
              if (stonePriceIsCustom)
                const AppBadge(
                  label: 'Custom Stone Price',
                  tone: AppBadgeTone.warning,
                  icon: Icons.tune_rounded,
                  compact: true,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Continuous Scanning',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              Switch(
                value: continuousScan,
                onChanged: onToggleContinuousScan,
                activeTrackColor: AppColors.accent.withValues(alpha: 0.5),
                activeThumbColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AppActionButton(
                  label: 'Unlock / Change',
                  onPressed: onUnlock,
                  variant: AppActionButtonVariant.secondary,
                  expanded: true,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppActionButton(
                  label: 'Scan Item',
                  onPressed: onStartScan,
                  expanded: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PickerStateCard extends StatelessWidget {
  const _PickerStateCard({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.accent),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: AppSpacing.md),
            AppActionButton(
              label: actionLabel!,
              onPressed: onAction,
              variant: AppActionButtonVariant.secondary,
              expanded: true,
            ),
          ],
        ],
      ),
    );
  }
}











