part of 'finish_scan_confirmation_screen.dart';

class WarningItemsScreen extends StatefulWidget {
  const WarningItemsScreen({super.key, required this.draft});

  final ScanSessionDraft draft;

  @override
  State<WarningItemsScreen> createState() => _WarningItemsScreenState();
}

class _WarningItemsScreenState extends State<WarningItemsScreen> {
  late ScanSessionDraft _draft;
  final Set<String> _keptItemIds = <String>{};

  @override
  void initState() {
    super.initState();
    _draft = widget.draft;
  }

  void _keepItem(ScannedSessionItem item) {
    setState(() {
      _keptItemIds.add(item.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${item.itemCode} kept in the session.')),
    );
  }

  void _removeItem(ScannedSessionItem item) {
    setState(() {
      _draft = _draft.copyWith(
        scannedItems: _draft.scannedItems
            .where((current) => current.id != item.id)
            .toList(growable: false),
      );
      _keptItemIds.remove(item.id);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${item.itemCode} removed from the session.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final summary = ScanSessionSummary.fromDraft(_draft);
    final warningItems = summary.items.where((item) => item.hasAnyWarning).toList(growable: false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Warning Items'),
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(_draft),
          icon: const Icon(Icons.arrow_back_rounded),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.screenPadding,
            AppSpacing.lg,
            AppSpacing.screenPadding,
            AppSpacing.xxl,
          ),
          children: [
            AppSectionHeader(
              title: 'Review warning items',
              subtitle: '${warningItems.length} item(s) need attention before save.',
            ),
            const SizedBox(height: AppSpacing.lg),
            AppCard(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'These items are flagged for review. Keep them in the session or remove them before saving.',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  if (warningItems.isEmpty)
                    const _EmptyWarningState()
                  else
                    ...warningItems.map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: _WarningItemRow(
                          item: item,
                          isKept: _keptItemIds.contains(item.id),
                          onKeep: () => _keepItem(item),
                          onRemove: () => _removeItem(item),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppActionButton(
              label: 'Back to Confirmation',
              onPressed: () => Navigator.of(context).pop(_draft),
              expanded: true,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyWarningState extends StatelessWidget {
  const _EmptyWarningState();

  @override
  Widget build(BuildContext context) {
    return const AppBanner(
      title: 'No warning items',
      message: 'This session does not currently have any warning items to review.',
      tone: AppBannerTone.info,
    );
  }
}

class _WarningItemRow extends StatelessWidget {
  const _WarningItemRow({
    required this.item,
    required this.isKept,
    required this.onKeep,
    required this.onRemove,
  });

  final ScannedSessionItem item;
  final bool isKept;
  final VoidCallback onKeep;
  final VoidCallback onRemove;

  String _formatValue(double value) => value.toStringAsFixed(3);

  String _formatPercent(double value) => value.toStringAsFixed(2);

  String _formatAmountValue(double value) => value.toStringAsFixed(2);

  Widget _amountChip(String label, double? value) {
    if (value == null || value == 0) {
      return const SizedBox.shrink();
    }
    return _fieldChip(label, 'Rs. ${_formatAmountValue(value)}');
  }

  Widget _fieldChip(String label, String value) {
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
    ];

    final stoneAmount = item.totalStoneAmount ?? item.stoneAmount;

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      backgroundColor: AppColors.surfaceAlt,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.itemCode,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
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
            const SizedBox(height: AppSpacing.xs),
            Text(
              detailParts.join(' | '),
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _fieldChip('Gross', '${_formatValue(item.grossWeight)} g'),
              _fieldChip('Stone', '${_formatValue(item.stoneWeight)} g'),
              _fieldChip('Other', '${_formatValue(item.otherWeight)} g'),
              _fieldChip('Net', '${_formatValue(item.netWeight)} g'),
              _fieldChip('Fine', '${_formatValue(item.fineWeight)} g'),
              _fieldChip('Karat', item.karat),
              _fieldChip('Purity', '${_formatPercent(item.purityPercent)}%'),
              _fieldChip('Wastage', '${_formatPercent(item.wastagePercent)}%'),
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
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: AppActionButton(
                  label: isKept ? 'Kept' : 'Keep Item',
                  onPressed: isKept ? null : onKeep,
                  variant: AppActionButtonVariant.secondary,
                  height: 40,
                  expanded: true,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: AppActionButton(
                  label: 'Remove Item',
                  onPressed: onRemove,
                  variant: AppActionButtonVariant.danger,
                  height: 40,
                  expanded: true,
                ),
              ),
            ],
          ),
          if (isKept) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Kept in session',
              style: TextStyle(
                color: AppColors.success,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ],
      ),
    );
  }
}







