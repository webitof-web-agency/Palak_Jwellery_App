part of 'scan_session_summary_screen.dart';

Widget _summaryFieldChip(String label, String value) {
  return DecoratedBox(
    decoration: BoxDecoration(
      color: AppColors.surfaceAlt,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      border: Border.all(color: AppColors.border),
    ),
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
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

String _scanSessionDisplayWarningLabel(String label) {
  final trimmed = label.trim();
  if (trimmed.isEmpty) {
    return trimmed;
  }

  final normalized = trimmed.toLowerCase();
  if (normalized.contains('expected number') ||
      normalized.contains('not a valid number') ||
      normalized.contains('invalid number')) {
    return 'Invalid QR value';
  }
  if (normalized.contains('missing') && normalized.contains('value')) {
    return 'Missing QR value';
  }
  if (normalized.contains('supplier mismatch')) {
    return 'Supplier mismatch';
  }
  if (normalized.contains('duplicate')) {
    return 'Duplicate item';
  }
  if (normalized.contains('requires review')) {
    return 'Needs review';
  }
  if (normalized.contains('manual entry')) {
    return 'Manual entry';
  }

  final compact = trimmed.split(';').first.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (compact.length <= 28) {
    return compact;
  }

  return '${compact.substring(0, 25).trimRight()}...';
}


class _SummaryItemRow extends StatelessWidget {
  const _SummaryItemRow({
    required this.item,
    required this.serialNumber,
  });

  final ScannedSessionItem item;
  final int serialNumber;

  String _formatValue(double value) => value.toStringAsFixed(3);

  String _formatPercent(double value) => value.toStringAsFixed(2);

  String _formatAmountValue(double value) => value.toStringAsFixed(2);

  Widget _amountChip(String label, double? value) {
    if (value == null || value == 0) {
      return const SizedBox.shrink();
    }
    return _summaryFieldChip(label, 'Rs. ${_formatAmountValue(value)}');
  }

  @override
  Widget build(BuildContext context) {
    final detailParts = <String>[
      if (item.supplier.trim().isNotEmpty) item.supplier.trim(),
      if ((item.category ?? '').trim().isNotEmpty) (item.category ?? '').trim(),
      if ((item.jewelType ?? '').trim().isNotEmpty) (item.jewelType ?? '').trim(),
    ];

    final badges = <Widget>[

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
      if (item.hasPurityOverride)
        const AppBadge(
          label: 'Custom purity',
          tone: AppBadgeTone.warning,
          icon: Icons.tune_rounded,
          compact: true,
        ),
      if (item.hasWastageOverride)
        const AppBadge(
          label: 'Custom wastage',
          tone: AppBadgeTone.warning,
          icon: Icons.tune_rounded,
          compact: true,
        ),
      if (item.warningLabel != null)
        AppBadge(
          label: _scanSessionDisplayWarningLabel(item.warningLabel!),
          tone: AppBadgeTone.warning,
          icon: Icons.warning_amber_rounded,
          compact: true,
        ),
    ];

    final stoneAmount = item.totalStoneAmount ?? item.stoneAmount;

    return AppCard(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: 10),
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  '#$serialNumber - ${item.itemCode}',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (badges.isNotEmpty)
                Flexible(
                  child: Align(
                    alignment: Alignment.topRight,
                    child: AppBadgeRow(children: badges),
                  ),
                ),
            ],
          ),
          if (detailParts.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              detailParts.join(' | '),
              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
            ),
          ],
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _summaryFieldChip('Gross', '${_formatValue(item.grossWeight)} g'),
              _summaryFieldChip('Stone', '${_formatValue(item.stoneWeight)} g'),
              _summaryFieldChip('Other', '${_formatValue(item.otherWeight)} g'),
              _summaryFieldChip('Net', '${_formatValue(item.netWeight)} g'),
              _summaryFieldChip('Fine', '${_formatValue(item.fineWeight)} g'),
              _summaryFieldChip('Karat', item.karat),
              _summaryFieldChip('Purity', '${_formatPercent(item.purityPercent)}%'),
              _summaryFieldChip('Wastage', '${_formatPercent(item.wastagePercent)}%'),
              if (stoneAmount != null && stoneAmount > 0)
                _amountChip('Stone Amt', stoneAmount),
              if (item.otherAmount != null && item.otherAmount! > 0)
                _amountChip('Other Amount', item.otherAmount),
              if (item.msAmount != null && item.msAmount! > 0)
                _amountChip('MS Amt', item.msAmount),
              if (item.ssAmount != null && item.ssAmount! > 0)
                _amountChip('SS Amt', item.ssAmount),
            ].whereType<Widget>().toList(growable: false),
          ),
        ],
      ),
    );
  }
}













