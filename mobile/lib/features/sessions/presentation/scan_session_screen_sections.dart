part of 'scan_session_screen.dart';

Widget _scanSessionBuildCustomerCard(
  _ScanSessionScreenState state,
  CustomerRecord? customer,
) {
  return AppCard(
    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
    child: Row(
      children: [
        Expanded(
          child: customer == null
              ? Text(
                  'No customer selected',
                  style: TextStyle(color: AppColors.warning, fontWeight: FontWeight.w600),
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      customer.name,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      [customer.phone, customer.area].where((e) => e.trim().isNotEmpty).join(' | '),
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                    ),
                  ],
                ),
        ),
        const SizedBox(width: AppSpacing.sm),
        if (!state._draft.isLocked)
          AppActionButton(
            label: customer == null ? 'Choose' : 'Change',
            onPressed: state._changeCustomer,
            variant: AppActionButtonVariant.secondary,
            height: 36,
          )
        else
          const AppBadge(
            label: 'Locked',
            tone: AppBadgeTone.neutral,
            icon: Icons.lock_rounded,
            compact: true,
          ),
      ],
    ),
  );
}

Future<void> _scanSessionConfirmRemoveItem(_ScanSessionScreenState state, ScannedSessionItem item) async {
  final confirmed = await showDialog<bool>(
    context: state.context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Remove item?'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${item.itemCode} will be removed from this draft.'),
          const SizedBox(height: AppSpacing.sm),
          Text('Supplier: ${item.supplier}'),
          Text('Gross: ${item.grossWeight.toStringAsFixed(3)} g'),
          Text('Net: ${item.netWeight.toStringAsFixed(3)} g'),
          Text('Fine: ${item.fineWeight.toStringAsFixed(3)} g'),
          const SizedBox(height: AppSpacing.xs),
          const Text('You can review the final session before saving.'),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(false),
          child: const Text('Cancel'),
        ),
        TextButton(
          onPressed: () => Navigator.of(dialogContext).pop(true),
          style: TextButton.styleFrom(foregroundColor: AppColors.danger),
          child: const Text('Remove'),
        ),
      ],
    ),
  );
  if (confirmed == true && state.mounted) {
    _scanSessionRemoveSelectedItems(state, {item.id});
  }
}

Widget _scanSessionBuildUnlockedSetupCard(_ScanSessionScreenState state) {
  return Form(
    key: state._formKey,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Unlocked setup',
            subtitle: 'Loaded from live admin supplier settings.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _PickerCard(
                  key: state._supplierKey,
                  label: 'Supplier',
                  value: state._draft.supplier ?? 'Choose supplier',
                  icon: Icons.storefront_rounded,
                  onTap: state._pickSupplier,
                  accent: state._draft.supplier != null,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _PickerCard(
                  key: state._categoryKey,
                  label: 'Category',
                  value: state._draft.selectedCategory ?? 'Optional',
                  icon: Icons.category_rounded,
                  onTap: state._pickCategory,
                  accent: state._draft.selectedCategory != null,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Container(
                  key: state._karatKey,
                  child: TextFormField(
                    key: ValueKey(state._draft.karat),
                    initialValue: state._draft.karat,
                    readOnly: true,
                    onTap: state._pickKarat,
                  decoration: const InputDecoration(
                    labelText: 'Karat',
                    hintText: 'Choose karat',
                    prefixIcon: Icon(Icons.diamond_outlined),
                    suffixIcon: Icon(Icons.expand_more_rounded),
                    helperText: 'Tap to select',
                  ),
                ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: TextFormField(
                  controller: state._purityController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Purity %',
                    prefixIcon: const Icon(Icons.percent_rounded),
                    helperText: state._draft.puritySelected == null
                        ? 'Waiting for Karat'
                        : (state._draft.purityIsCustom
                            ? 'Custom (Orig ${state._draft.originalPurity?.toStringAsFixed(2)}%)'
                            : 'Default purity'),
                  ),
                  onChanged: state._setPurity,
                  validator: (value) {
                    final parsed = double.tryParse((value ?? '').trim());
                    if (parsed == null) {
                      return 'Enter purity';
                    }
                    return null;
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextFormField(
                  controller: state._wastageController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Wastage %',
                    prefixIcon: const Icon(Icons.water_drop_outlined),
                    helperText: 'Loaded from live admin settings.',
                    suffixIcon: IconButton(
                      key: state._wastageIconKey,
                      onPressed: state._pickWastage,
                      icon: const Icon(Icons.expand_more_rounded),
                      tooltip: 'Common options',
                    ),
                  ),
                  onChanged: state._setWastage,
                  validator: (value) {
                    final parsed = double.tryParse((value ?? '').trim());
                    if (parsed == null) {
                      return 'Enter wastage';
                    }
                    return null;
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: TextFormField(
                  controller: state._stonePriceController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: 'Stone Price (Rs/gm)',
                    prefixIcon: const Icon(Icons.currency_rupee_rounded),
                    helperText: 'Optional stone price',
                    suffixIcon: IconButton(
                      key: state._stonePriceIconKey,
                      onPressed: state._pickStonePrice,
                      icon: const Icon(Icons.expand_more_rounded),
                      tooltip: 'Common options',
                    ),
                  ),
                  onChanged: state._setStonePrice,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          InkWell(
            onTap: state._toggleNotes,
            borderRadius: BorderRadius.circular(AppRadius.sm),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Icon(
                    state._isNotesExpanded ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    'Session Notes (Optional)',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (state._draft.notes.trim().isNotEmpty && !state._isNotesExpanded) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        state._draft.notes.trim(),
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          if (state._isNotesExpanded) ...[
            const SizedBox(height: AppSpacing.sm),
            TextFormField(
              controller: state._notesController,
              maxLines: 3,
              textInputAction: TextInputAction.newline,
              decoration: const InputDecoration(
                alignLabelWithHint: true,
                floatingLabelBehavior: FloatingLabelBehavior.always,
                labelText: 'Notes',
                hintText: 'Enter session notes',
                prefixIcon: Icon(Icons.notes_rounded),
              ),
              onChanged: state._setNotes,
            ),
          ],
          const SizedBox(height: AppSpacing.lg),
          AppActionButton(
            label: 'Lock Details',
            onPressed: state._lockDetails,
            icon: Icons.lock_rounded,
            expanded: true,
          ),
          const SizedBox(height: AppSpacing.sm),
          AppBanner(
            title: 'Setup reminder',
            message: 'Purity and wastage can stay on the default values or be edited before locking.',
            tone: AppBannerTone.info,
          ),
        ],
      ),
    ),
  );
}

Widget _scanSessionBuildLockedActiveSection(_ScanSessionScreenState state) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _LockedScanSettingsCard(
        supplier: state._draft.supplier,
        category: state._draft.selectedCategory,
        karat: state._draft.karat,
        purity: state._draft.selectedPurity,
        wastage: state._draft.selectedWastage,
        stonePrice: state._draft.selectedStonePrice,
        purityIsCustom: state._draft.purityIsCustom,
        wastageIsCustom: state._draft.wastageIsCustom,
        stonePriceIsCustom: state._draft.stonePriceIsCustom,
        continuousScan: state._draft.continuousScan,
        onToggleContinuousScan: (val) {
          state._updateDraftState(() {
            state._draft = state._draft.copyWith(continuousScan: val);
          });
        },
        onUnlock: state._unlockDetails,
        onStartScan: state._startScanner,
      ),
      const SizedBox(height: AppSpacing.lg),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: AppSectionHeader(
                    title: 'Active scanning',
                    subtitle: 'Live totals update from the scanned item list below.',
                    tight: true,
                  ),
                ),
                if (state._draft.hasScannedItems)
                  IconButton(
                    onPressed: state._confirmClearItems,
                    icon: const Icon(Icons.playlist_remove_rounded),
                    color: AppColors.danger,
                    tooltip: 'Clear Scanned Items',
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _ScanTotalsGrid(draft: state._draft),
            const SizedBox(height: AppSpacing.md),
            if (state._draft.supplierCounts.isNotEmpty) ...[
              const Text(
                'Supplier-wise counts',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              AppBadgeRow(
                children: state._draft.supplierCounts.entries
                    .map(
                      (entry) => AppBadge(
                        label: '${entry.key} x${entry.value}',
                        tone: AppBadgeTone.neutral,
                        icon: Icons.storefront_rounded,
                        compact: true,
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: state._itemSearchController,
                    onChanged: (_) => state._refreshItemFilter(),
                    decoration: InputDecoration(
                      labelText: 'Filter item code',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: state._itemSearchController.text.trim().isEmpty
                          ? null
                          : IconButton(
                              onPressed: state._clearItemFilter,
                              icon: const Icon(Icons.clear_rounded),
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                SizedBox(
                  height: 56, // matches textfield height approximately
                  child: AppActionButton(
                    label: 'Manual',
                    onPressed: state._manualEntry,
                    variant: AppActionButtonVariant.secondary,
                    icon: Icons.edit_note_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            if (!state._draft.hasScannedItems)
              const _EmptyScanState()
            else if (state._visibleScannedItems.isEmpty)
              const _PickerStateCard(
                icon: Icons.search_off_rounded,
                title: 'No items matched',
                message: 'Clear the filter to see scanned items again.',
              )
            else
              SizedBox(
                height: 460,
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 72),
                      child: Scrollbar(
                        controller: state._itemsScrollController,
                        thumbVisibility: true,
                        thickness: 6,
                        radius: const Radius.circular(AppRadius.pill),
                        child: ListView.builder(
                          controller: state._itemsScrollController,
                          physics: const BouncingScrollPhysics(
                            parent: AlwaysScrollableScrollPhysics(),
                          ),
                          itemCount: state._visibleScannedItems.length,
                          itemBuilder: (context, index) {
                            final item = state._visibleScannedItems[index];
                            final serial = state._draft.scannedItems.indexOf(item) + 1;
                            return _ScannedItemCard(
                              item: item,
                              serialNumber: serial,
                              showDivider: index != state._visibleScannedItems.length - 1,
                              onDelete: () => _scanSessionConfirmRemoveItem(state, item),
                            );
                          },
                        ),
                      ),
                    ),
                    if (state._visibleScannedItems.length > 3)
                    Positioned(
                      right: 0,
                      bottom: 80,
                      child: state._buildScrollToTopButton(),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 0,
                      child: AppActionButton(
                        label: 'Finish Scan (${state._draft.scannedItems.length} items)',
                        onPressed: () => state.context.push(
                          '/scan-session/finish',
                          extra: state._draft,
                        ),
                        expanded: true,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    ],
  );
}

Widget _scanSessionBuildScrollToTopButton(_ScanSessionScreenState state) {
  return AnimatedBuilder(
    animation: state._itemsScrollController,
    builder: (context, child) {
      if (!state._itemsScrollController.hasClients || state._itemsScrollController.offset < 100) {
        return const SizedBox.shrink();
      }
      return child!;
    },
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          state._itemsScrollController.animateTo(
            0,
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOut,
          );
        },
        borderRadius: BorderRadius.circular(AppRadius.pill),
        child: Ink(
          decoration: BoxDecoration(
            color: AppColors.accent,
            borderRadius: BorderRadius.circular(AppRadius.pill),
          ),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.arrow_upward_rounded,
                color: AppColors.background,
                size: 14,
              ),
              const SizedBox(width: 4),
              Text(
                'Top',
                style: TextStyle(
                  color: AppColors.background,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

