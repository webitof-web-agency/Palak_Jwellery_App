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

  String _formatValue(double value) => value.toStringAsFixed(3);

  String _formatPercent(double value) => value.toStringAsFixed(2);

  String _formatAmountValue(double value) => value.toStringAsFixed(2);

  String? _formatAmount(double? value) {
    if (value == null || value == 0) {
      return null;
    }
    return 'Rs. ${_formatAmountValue(value)}';
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
    final lineParts = <String>[
      if (item.supplier.trim().isNotEmpty) item.supplier.trim(),
      if (categoryLabel.isNotEmpty) categoryLabel,
      if (jewelTypeLabel.isNotEmpty) jewelTypeLabel,
    ];
    final detailLine = lineParts.join(' | ');

    final topBadges = <Widget>[
      if (item.isDuplicate)
        const AppBadge(
          label: 'Duplicate',
          tone: AppBadgeTone.warning,
          icon: Icons.copy_rounded,
          compact: true,
        ),
      if (item.hasSupplierMismatch)
        const AppBadge(
          label: 'Supplier mismatch',
          tone: AppBadgeTone.warning,
          icon: Icons.swap_horiz_rounded,
          compact: true,
        ),
      if (item.requiresReview)
        const AppBadge(
          label: 'Needs review',
          tone: AppBadgeTone.warning,
          icon: Icons.rule_rounded,
          compact: true,
        ),
      if (item.hasKaratMismatch)
        const AppBadge(
          label: 'QR Karat Mismatch',
          tone: AppBadgeTone.warning,
          icon: Icons.swap_vert_rounded,
          compact: true,
        ),
      if (item.hasWeightMismatch)
        const AppBadge(
          label: 'Weight mismatch',
          tone: AppBadgeTone.warning,
          icon: Icons.scale_rounded,
          compact: true,
        ),
      if (item.warningLabel != null)
        AppBadge(
          label: _scanSessionDisplayWarningLabel(item.warningLabel!),
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
      child: Padding(
        padding: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '#$serialNumber - ${item.itemCode}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (detailLine.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          detailLine,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (topBadges.isNotEmpty)
                  Flexible(
                    child: Align(
                      alignment: Alignment.topRight,
                      child: AppBadgeRow(children: topBadges),
                    ),
                  ),
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
                _chip('Purity', '${_formatPercent(item.purityPercent)}%'),
                _chip('Wastage', '${_formatPercent(item.wastagePercent)}%'),
                if (_formatAmount(item.totalStoneAmount ?? item.stoneAmount) != null)
                  _chip('Stone Amt', _formatAmount(item.totalStoneAmount ?? item.stoneAmount)!),
                if (_formatAmount(item.otherAmount) != null)
                  _chip('Other Amount', _formatAmount(item.otherAmount)!),
                if (_formatAmount(item.msAmount) != null)
                  _chip('MS Amt', _formatAmount(item.msAmount)!),
                if (_formatAmount(item.ssAmount) != null)
                  _chip('SS Amt', _formatAmount(item.ssAmount)!),
              ],
            ),
            if (item.rawQr?.isNotEmpty == true) ...[
              const SizedBox(height: AppSpacing.xs),
              _RawQrExpandable(rawQr: item.rawQr!),
            ],
          ],
        ),
      ),
    );
  }
}

class _RawQrExpandable extends StatefulWidget {
  const _RawQrExpandable({required this.rawQr});
  final String rawQr;

  @override
  State<_RawQrExpandable> createState() => _RawQrExpandableState();
}

class _RawQrExpandableState extends State<_RawQrExpandable> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: BorderRadius.circular(4),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'View Raw QR',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Icon(
                  _expanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                  size: 14,
                  color: AppColors.textSecondary,
                ),
              ],
            ),
          ),
        ),
        if (_expanded)
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 4),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.backgroundHover,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: SelectableText(
                      widget.rawQr,
                      style: const TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 10,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () {
                      Clipboard.setData(ClipboardData(text: widget.rawQr));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Raw QR copied'),
                          behavior: SnackBarBehavior.floating,
                          duration: Duration(seconds: 1),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(4),
                    child: const Padding(
                      padding: EdgeInsets.all(4.0),
                      child: Icon(
                        Icons.copy,
                        size: 14,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}









