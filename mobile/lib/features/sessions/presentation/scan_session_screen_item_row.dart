part of 'scan_session_screen.dart';

class _ScannedItemCard extends StatelessWidget {
  const _ScannedItemCard({
    required this.item,
    required this.serialNumber,
    this.showDivider = true,
  });

  final ScannedSessionItem item;
  final int serialNumber;
  final bool showDivider;

  String _formatValue(double value) => value.toStringAsFixed(2);

  String? _formatAmount(double? value) {
    if (value == null || value == 0) {
      return null;
    }
    return 'Rs. ${_formatValue(value)}';
  }

  Widget _chip(String label, String value) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.surface,
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

  @override
  Widget build(BuildContext context) {
    final categoryLabel = (item.category ?? '').trim();
    final jewelTypeLabel = (item.jewelType ?? '').trim();
    final detailParts = <String>[
      item.supplier,
      if (categoryLabel.isNotEmpty) categoryLabel,
      if (jewelTypeLabel.isNotEmpty) jewelTypeLabel,
    ];
    final supplierCategoryLine = detailParts.isEmpty
        ? 'Category pending'
        : detailParts.join(' | ');
    final hasCategoryOrType = categoryLabel.isNotEmpty || jewelTypeLabel.isNotEmpty;
    final topBadges = <Widget>[
      if (item.warningLabel != null)
        AppBadge(
          label: item.warningLabel!,
          tone: AppBadgeTone.warning,
          icon: Icons.warning_amber_rounded,
          compact: true,
        ),
      if (item.hasPurityOverride)
        const AppBadge(
          label: 'Custom Purity',
          tone: AppBadgeTone.warning,
          icon: Icons.tune_rounded,
          compact: true,
        ),
      if (item.hasWastageOverride)
        const AppBadge(
          label: 'Custom Wastage',
          tone: AppBadgeTone.warning,
          icon: Icons.tune_rounded,
          compact: true,
        ),
    ];

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(
          bottom: showDivider
              ? BorderSide(color: AppColors.border)
              : BorderSide.none,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '#$serialNumber • ${item.itemCode}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      supplierCategoryLine,
                      style: TextStyle(
                        color: hasCategoryOrType
                            ? AppColors.textSecondary
                            : AppColors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (topBadges.isNotEmpty) AppBadgeRow(children: topBadges),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _chip('Gross', '${_formatValue(item.grossWeight)} g'),
              _chip('Stone', '${_formatValue(item.stoneWeight)} g'),
              _chip('Other', '${_formatValue(item.otherWeight)} g'),
              _chip('Net', '${_formatValue(item.netWeight)} g'),
              _chip('Fine', '${_formatValue(item.fineWeight)} g'),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _chip('Karat', item.karat),
              _chip('Purity', '${_formatValue(item.purityPercent)}%'),
              _chip('Wastage', '${_formatValue(item.wastagePercent)}%'),
              if (_formatAmount(item.totalStoneAmount ?? item.stoneAmount) != null)
                _chip('Stone Amt', _formatAmount(item.totalStoneAmount ?? item.stoneAmount)!),
              if (_formatAmount(item.otherAmount) != null)
                _chip('Other Amt', _formatAmount(item.otherAmount)!),
              if (_formatAmount(item.msAmount) != null)
                _chip('MS Amt', _formatAmount(item.msAmount)!),
              if (_formatAmount(item.ssAmount) != null)
                _chip('SS Amt', _formatAmount(item.ssAmount)!),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
        ],
      ),
    );
  }
}
