part of 'scan_session_screen.dart';

Widget _scanSessionBuildCustomerCard(
  _ScanSessionScreenState state,
  CustomerRecord? customer,
) {
  return AppCard(
    padding: const EdgeInsets.all(AppSpacing.lg),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Selected customer',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            if (!state._draft.isLocked)
              AppActionButton(
                label: customer == null ? 'Choose Customer' : 'Change Customer',
                onPressed: state._changeCustomer,
                variant: AppActionButtonVariant.secondary,
                height: 38,
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
        const SizedBox(height: AppSpacing.sm),
        if (customer == null)
          AppBanner(
            title: 'No customer selected',
            message: 'Choose a customer before locking the session.',
            tone: AppBannerTone.warning,
          )
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                customer.name,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: AppTypography.titleSize,
                  fontWeight: AppTypography.titleWeight,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${customer.phone} | ${customer.area}',
                style: TextStyle(color: AppColors.textSecondary),
              ),
              if ((customer.email ?? '').isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  customer.email!,
                  style: TextStyle(color: AppColors.textMuted),
                ),
              ],
            ],
          ),
      ],
    ),
  );
}

Widget _scanSessionBuildUnlockedSetupCard(_ScanSessionScreenState state) {
  return Form(
    key: state._formKey,
    child: AppCard(
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const AppSectionHeader(
            title: 'Unlocked setup',
            subtitle: 'Choose supplier for this scan.',
            tight: true,
          ),
          const SizedBox(height: AppSpacing.lg),
          _PickerCard(
            label: 'Supplier',
            value: state._draft.supplier ?? 'Choose supplier',
            helper: 'Choose supplier for this scan.',
            icon: Icons.storefront_rounded,
            onTap: state._pickSupplier,
            accent: state._draft.supplier != null,
          ),
          const SizedBox(height: AppSpacing.md),
          _PickerCard(
            label: 'Category',
            value: state._draft.selectedCategory ?? 'Optional',
            helper: 'Choose category / jewel type.',
            icon: Icons.category_rounded,
            onTap: state._pickCategory,
            accent: state._draft.selectedCategory != null,
          ),
          const SizedBox(height: AppSpacing.md),
          _PickerCard(
            label: 'Karat',
            value: state._draft.karat ?? 'Choose karat',
            helper: 'Choose jewellery karat.',
            icon: Icons.diamond_rounded,
            onTap: state._pickKarat,
            accent: state._draft.karat != null,
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    helperText: 'Default purity. You can edit if required.',
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
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                width: 104,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 2),
                    AppBadge(
                      label: state._draft.puritySelected == null
                          ? 'Waiting'
                          : (state._draft.purityIsCustom ? 'Custom' : 'Default'),
                      tone: state._draft.puritySelected == null
                          ? AppBadgeTone.neutral
                          : (state._draft.purityIsCustom
                              ? AppBadgeTone.warning
                              : AppBadgeTone.neutral),
                      icon: state._draft.puritySelected == null
                          ? Icons.hourglass_empty_rounded
                          : (state._draft.purityIsCustom
                              ? Icons.tune_rounded
                              : Icons.lock_rounded),
                      compact: true,
                    ),
                    if (state._draft.purityIsCustom)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          'Original ${state._draft.originalPurity?.toStringAsFixed(2)}%',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
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
                    helperText: 'Choose wastage or enter custom value.',
                    suffixIcon: IconButton(
                      onPressed: state._pickWastage,
                      icon: const Icon(Icons.expand_more_rounded),
                      tooltip: 'Common wastage options',
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
              SizedBox(
                width: 104,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 2),
                    AppBadge(
                      label: state._draft.wastageSelected == null
                          ? 'Waiting'
                          : (state._draft.wastageIsCustom ? 'Custom' : 'Default'),
                      tone: state._draft.wastageSelected == null
                          ? AppBadgeTone.neutral
                          : (state._draft.wastageIsCustom
                              ? AppBadgeTone.warning
                              : AppBadgeTone.neutral),
                      icon: state._draft.wastageSelected == null
                          ? Icons.hourglass_empty_rounded
                          : (state._draft.wastageIsCustom
                              ? Icons.tune_rounded
                              : Icons.lock_rounded),
                      compact: true,
                    ),
                    if (state._draft.wastageIsCustom)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xs),
                        child: Text(
                          'Original ${state._draft.originalWastage?.toStringAsFixed(2)}%',
                          style: TextStyle(
                            color: AppColors.textMuted,
                            fontSize: 11,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            controller: state._notesController,
            maxLines: 3,
            textInputAction: TextInputAction.newline,
            decoration: const InputDecoration(
              alignLabelWithHint: true,
              floatingLabelBehavior: FloatingLabelBehavior.always,
              labelText: 'Notes',
              hintText: 'Optional session notes',
              prefixIcon: Icon(Icons.notes_rounded),
            ),
            onChanged: state._setNotes,
          ),
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
        purityIsCustom: state._draft.purityIsCustom,
        wastageIsCustom: state._draft.wastageIsCustom,
        onUnlock: state._unlockDetails,
        onStartScan: state._simulateScanItem,
      ),
      const SizedBox(height: AppSpacing.lg),
      AppCard(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const AppSectionHeader(
              title: 'Active scanning',
              subtitle: 'Live totals update from the scanned item list below.',
              tight: true,
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
            TextField(
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
                      child: ListView.builder(
                        controller: state._itemsScrollController,
                        itemCount: state._visibleScannedItems.length,
                        itemBuilder: (context, index) {
                          final item = state._visibleScannedItems[index];
                          final serial = state._draft.scannedItems.indexOf(item) + 1;
                          return _ScannedItemCard(
                            item: item,
                            serialNumber: serial,
                            showDivider: index != state._visibleScannedItems.length - 1,
                          );
                        },
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
                        onPressed: () => state.context.pop(),
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
          child: Text(
            '↑ Top',
            style: TextStyle(
              color: AppColors.background,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    ),
  );
}
