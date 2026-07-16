import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../customers/domain/customer_record.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../scanner/presentation/scanner_launch_args.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../services/scan_session_feedback_service.dart';
import 'scan_session_manual_entry_sheet.dart';
import '../domain/scan_session_draft.dart';
import '../domain/scan_session_summary.dart';
import 'session_item_selection_sheet.dart';

part 'scan_session_screen_actions.dart';
part 'scan_session_screen_sections.dart';
part 'scan_session_screen_widgets.dart';
part 'scan_session_screen_item_row.dart';
part 'scan_session_screen_pickers.dart';
part 'scan_session_screen_choice_sheet.dart';

const String _clearSelectionSentinel = '__clear_selection__';

class ScanSessionScreen extends ConsumerStatefulWidget {
  const ScanSessionScreen({super.key, this.selectedCustomer, this.resumeSummary});

  final CustomerRecord? selectedCustomer;
  final ScanSessionSummary? resumeSummary;

  @override
  ConsumerState<ScanSessionScreen> createState() => _ScanSessionScreenState();
}

class _ScanSessionScreenState extends ConsumerState<ScanSessionScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late ScanSessionDraft _draft;
  late TextEditingController _purityController;
  late TextEditingController _wastageController;
  late TextEditingController _stonePriceController;
  late TextEditingController _notesController;
  late TextEditingController _itemSearchController;
  late ScrollController _itemsScrollController;
  String? _localValidationMessage;
  final GlobalKey _wastageIconKey = GlobalKey();
  final GlobalKey _stonePriceIconKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _draft = widget.resumeSummary != null
        ? ScanSessionDraft.fromSummary(widget.resumeSummary!)
        : ScanSessionDraft(customer: widget.selectedCustomer);
    _purityController = TextEditingController();
    _wastageController = TextEditingController();
    _stonePriceController = TextEditingController();
    _notesController = TextEditingController();
    _itemSearchController = TextEditingController();
    _itemsScrollController = ScrollController();
    _applyDefaultsForSelection();
    _notesController.text = _draft.notes;
  }

  @override
  void dispose() {
    _purityController.dispose();
    _wastageController.dispose();
    _stonePriceController.dispose();
    _notesController.dispose();
    _itemSearchController.dispose();
    _itemsScrollController.dispose();
    super.dispose();
  }

  void _updateDraftState(VoidCallback update) => setState(update);

  void _refreshItemFilter() => setState(() {});

  void _clearItemFilter() {
    setState(() {
      _itemSearchController.clear();
    });
  }

  void _applyDefaultsForSelection() => _scanSessionApplyDefaultsForSelection(this);

  void _setPurity(String value) => _scanSessionSetPurity(this, value);

  void _setWastage(String value) => _scanSessionSetWastage(this, value);

  void _setNotes(String value) => _scanSessionSetNotes(this, value);

  void _changeCustomer() => _scanSessionChangeCustomer(this);
  void _manualEntry() => _scanSessionManualEntry(this);

  Future<void> _pickSupplier() => _scanSessionPickSupplier(this);

  Future<void> _pickCategory() => _scanSessionPickCategory(this);

  Future<void> _pickKarat() => _scanSessionPickKarat(this);

  Future<void> _pickWastage() => _scanSessionPickWastage(this);
  
  void _setStonePrice(String value) => _scanSessionSetStonePrice(this, value);
  Future<void> _pickStonePrice() => _scanSessionPickStonePrice(this);

  void _lockDetails() => _scanSessionLockDetails(this);

  void _unlockDetails() => _scanSessionUnlockDetails(this);

  Future<void> _startScanner() => _scanSessionStartScanner(this);

  Future<void> _playSuccessTone() => playScanSessionSuccessTone();

  Future<void> _confirmDiscardDraft() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard Session?'),
        content: const Text('This will clear all details, settings, and scanned items. Are you sure?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Discard'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      _scanSessionDiscardDraft(this);
      if (widget.resumeSummary != null) {
        context.go('/sales-scans/${widget.resumeSummary!.sessionId}');
      } else {
        context.pop();
      }
    }
  }

  Future<bool> _onWillPop() async {
    if (!_draft.hasScannedItems) return true;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Exit Session?'),
        content: Text('You have scanned ${_draft.scannedItems.length} items. If you exit now, your unsaved progress will be lost.\n\nAre you sure you want to go back?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Continue Scanning'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Discard & Go Back'),
          ),
        ],
      ),
    );
    return confirmed == true;
  }

  Future<void> _confirmClearItems() async {
    if (!_draft.hasScannedItems) return;
    final choice = await showSessionItemManagementSheet(
      context,
      title: 'Clear scan items',
      subtitle: 'Choose whether to clear everything or only selected items.',
      allowClearSelected: true,
    );
    if (!mounted || choice == null) {
      return;
    }
    if (choice == SessionItemManagementChoice.clearAll) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Clear all items?'),
          content: Text(
            'This will clear ${_draft.scannedItems.length} items and reset the live totals. Are you sure?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              child: const Text('Clear All'),
            ),
          ],
        ),
      );
      if (confirmed == true && mounted) {
        _scanSessionClearItems(this);
      }
      return;
    }

    final selected = await showSessionItemSelectionSheet(
      context,
      title: 'Clear selected items',
      subtitle: 'Pick the items to remove from this draft.',
      confirmLabel: 'Preview Removal',
      items: _draft.scannedItems,
      destructive: true,
    );
    if (!mounted || selected == null || selected.isEmpty) {
      return;
    }
    final selectedIds = selected.map((item) => item.id).toSet();
    final remaining = _draft.scannedItems.where((item) => !selectedIds.contains(item.id)).toList(growable: false);
    final selectedGross = selected.fold<double>(0, (sum, item) => sum + item.grossWeight);
    final selectedNet = selected.fold<double>(0, (sum, item) => sum + item.netWeight);
    final selectedFine = selected.fold<double>(0, (sum, item) => sum + item.fineWeight);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm removal'),
        content: Text(
          'Remove ${selected.length} items?\n\n'
          'Removed gross: ${selectedGross.toStringAsFixed(3)} g\n'
          'Removed net: ${selectedNet.toStringAsFixed(3)} g\n'
          'Removed fine: ${selectedFine.toStringAsFixed(3)} g\n\n'
          'Remaining items: ${remaining.length}',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      _scanSessionRemoveSelectedItems(this, selectedIds);
    }
  }

  List<ScannedSessionItem> get _visibleScannedItems =>
      _scanSessionVisibleScannedItems(this);

  Widget _buildCustomerCard(CustomerRecord? customer) =>
      _scanSessionBuildCustomerCard(this, customer);

  Widget _buildUnlockedSetupCard() => _scanSessionBuildUnlockedSetupCard(this);

  Widget _buildLockedActiveSection() => _scanSessionBuildLockedActiveSection(this);

  Widget _buildScrollToTopButton() => _scanSessionBuildScrollToTopButton(this);

  @override
  Widget build(BuildContext context) {
    final customer = _draft.customer;
    final validationMessage = _draft.validationMessage ?? _localValidationMessage;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _onWillPop();
        if (shouldPop && context.mounted) {
          context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Scan Session'),
          leading: IconButton(
            onPressed: () async {
              final shouldPop = await _onWillPop();
              if (shouldPop && context.mounted) {
                context.pop();
              }
            },
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        actions: [
          if (_draft.hasCustomer || _draft.supplier != null || _draft.hasScannedItems)
            IconButton(
              onPressed: _confirmDiscardDraft,
              icon: const Icon(Icons.delete_outline_rounded),
              tooltip: 'Discard Draft',
            ),
        ],
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
            const AppSectionHeader(
              title: 'Scan Session Setup',
              subtitle: 'Set the customer and lock the sale details before scanning starts.',
            ),
            if (validationMessage != null) ...[
              const SizedBox(height: AppSpacing.md),
              AppBanner(
                title: 'Fix required',
                message: validationMessage,
                tone: AppBannerTone.warning,
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            _buildCustomerCard(customer),
            const SizedBox(height: AppSpacing.lg),
            if (!_draft.isLocked)
              _buildUnlockedSetupCard()
            else
              _buildLockedActiveSection(),
          ],
        ),
      ),
    ),
    );
  }
}










