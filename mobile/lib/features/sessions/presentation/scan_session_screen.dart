import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../customers/domain/customer_record.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_badge.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_metric_card.dart';
import '../../../shared/widgets/app_section_header.dart';
import '../domain/scan_session_draft.dart';

part 'scan_session_screen_actions.dart';
part 'scan_session_screen_sections.dart';
part 'scan_session_screen_widgets.dart';
part 'scan_session_screen_item_row.dart';
part 'scan_session_screen_pickers.dart';
part 'scan_session_screen_choice_sheet.dart';

const String _clearSelectionSentinel = '__clear_selection__';

class ScanSessionScreen extends ConsumerStatefulWidget {
  const ScanSessionScreen({super.key, this.selectedCustomer});

  final CustomerRecord? selectedCustomer;

  @override
  ConsumerState<ScanSessionScreen> createState() => _ScanSessionScreenState();
}

class _ScanSessionScreenState extends ConsumerState<ScanSessionScreen> {
  static const List<String> _categoryOptions = <String>[
    'RING',
    'PENDANT',
    'NECKLACE',
    'BRACELET',
    'BANGLE',
    'EARRING',
    'TOPS',
  ];

  // Placeholder until admin-defined category defaults are wired from backend settings.
  static const Map<String, double> _categoryWastageDefaults = <String, double>{
    'RING': 10.0,
    'PENDANT': 9.5,
    'NECKLACE': 9.5,
    'BRACELET': 10.0,
    'BANGLE': 10.0,
    'EARRING': 9.0,
    'TOPS': 9.0,
  };

  static const List<String> _wastageOptions = <String>[
    '6.00',
    '7.00',
    '8.00',
    '9.00',
    '10.00',
    '11.00',
    '12.00',
  ];

  static const List<String> _karatOrder = <String>[
    '9K',
    '14K',
    '18K',
    '20K',
    '22K',
    '24K',
  ];

  static const Map<String, Map<String, ({double purity, double wastage})>>
  _defaultMatrix = {
    'YUG': {
      '9K': (purity: 37.50, wastage: 14.0),
      '14K': (purity: 58.40, wastage: 12.5),
      '18K': (purity: 75.15, wastage: 10.0),
      '20K': (purity: 83.30, wastage: 9.0),
      '22K': (purity: 91.60, wastage: 8.0),
      '24K': (purity: 99.90, wastage: 6.0),
    },
    'Aadinath': {
      '9K': (purity: 37.50, wastage: 14.0),
      '14K': (purity: 58.50, wastage: 12.0),
      '18K': (purity: 75.15, wastage: 10.0),
      '20K': (purity: 83.30, wastage: 9.0),
      '22K': (purity: 91.60, wastage: 8.0),
      '24K': (purity: 99.90, wastage: 6.0),
    },
    'Venzora Trading': {
      '9K': (purity: 37.60, wastage: 14.0),
      '14K': (purity: 58.60, wastage: 11.5),
      '18K': (purity: 75.20, wastage: 9.5),
      '20K': (purity: 83.30, wastage: 8.5),
      '22K': (purity: 91.55, wastage: 8.0),
      '24K': (purity: 99.90, wastage: 6.0),
    },
    'Palak Jewellery': {
      '9K': (purity: 37.50, wastage: 14.0),
      '14K': (purity: 58.50, wastage: 12.0),
      '18K': (purity: 75.15, wastage: 10.0),
      '20K': (purity: 83.30, wastage: 9.0),
      '22K': (purity: 91.60, wastage: 8.0),
      '24K': (purity: 99.90, wastage: 6.0),
    },
  };

  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  late ScanSessionDraft _draft;
  late TextEditingController _purityController;
  late TextEditingController _wastageController;
  late TextEditingController _notesController;
  late TextEditingController _itemSearchController;
  late ScrollController _itemsScrollController;
  String? _localValidationMessage;

  @override
  void initState() {
    super.initState();
    _draft = ScanSessionDraft(customer: widget.selectedCustomer);
    _purityController = TextEditingController();
    _wastageController = TextEditingController();
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

  Future<void> _pickSupplier() => _scanSessionPickSupplier(this);

  Future<void> _pickCategory() => _scanSessionPickCategory(this);

  Future<void> _pickKarat() => _scanSessionPickKarat(this);

  Future<void> _pickWastage() => _scanSessionPickWastage(this);

  void _lockDetails() => _scanSessionLockDetails(this);

  void _unlockDetails() => _scanSessionUnlockDetails(this);

  void _simulateScanItem() => _scanSessionSimulateScanItem(this);

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan Session'),
        leading: IconButton(
          onPressed: () => context.pop(),
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
    );
  }
}

