import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../../../shared/theme/app_theme.dart';

String formatMoney(double value) {
  final fixed = value.toStringAsFixed(2);
  final parts = fixed.split('.');
  final whole = parts[0];

  if (whole.length <= 3) {
    return fixed;
  }

  final last3 = whole.substring(whole.length - 3);
  var rest = whole.substring(0, whole.length - 3);
  final groups = <String>[];

  while (rest.isNotEmpty) {
    final start = rest.length > 2 ? rest.length - 2 : 0;
    groups.insert(0, rest.substring(start));
    rest = rest.substring(0, start);
  }

  return '${groups.join(',')},$last3.${parts[1]}';
}

String formatDateTime(DateTime date) {
  const months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  final local = date.toLocal();
  final hour = local.hour == 0
      ? 12
      : local.hour > 12
      ? local.hour - 12
      : local.hour;
  final minute = local.minute.toString().padLeft(2, '0');
  final suffix = local.hour >= 12 ? 'PM' : 'AM';

  return '${local.day} ${months[local.month - 1]} ${local.year}, $hour:$minute $suffix';
}

// â”€â”€â”€ Sale Entry Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class SaleEntryScreen extends ConsumerStatefulWidget {
  const SaleEntryScreen({super.key, required this.parseResult});

  final ParseQrResult parseResult;

  @override
  ConsumerState<SaleEntryScreen> createState() => _SaleEntryScreenState();
}

class _SaleEntryScreenState extends ConsumerState<SaleEntryScreen> {
  final _formKey = GlobalKey<FormState>();

  // Controllers
  late final TextEditingController _categoryCtrl;
  late final TextEditingController _grossCtrl;
  late final TextEditingController _stoneCtrl;
  late final TextEditingController _netCtrl;
  late final TextEditingController _rateCtrl;

  // Selected supplier (null = not yet chosen)
  String? _supplierId;
  String? _supplierName;

  bool _debugExpanded = false;

  // Track which fields were NOT parsed (need red highlight)
  late final bool _categoryParsed;
  late final bool _grossParsed;
  late final bool _stoneParsed;
  late final bool _netParsed;

  @override
  void initState() {
    super.initState();
    final pr = widget.parseResult;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(saleEntryProvider.notifier).setParseResult(pr);
    });

    _categoryParsed = pr.category.parsed;
    _grossParsed = pr.grossWeight.parsed;
    _stoneParsed = pr.stoneWeight.parsed;
    _netParsed = pr.netWeight.parsed;

    _categoryCtrl = TextEditingController(text: pr.category.value ?? '');
    _grossCtrl = TextEditingController(
      text: pr.grossWeight.value != null ? _fmt(pr.grossWeight.value!) : '',
    );
    _stoneCtrl = TextEditingController(
      text: pr.stoneWeight.value != null ? _fmt(pr.stoneWeight.value!) : '',
    );
    _netCtrl = TextEditingController(
      text: pr.netWeight.value != null ? _fmt(pr.netWeight.value!) : '',
    );
    _rateCtrl = TextEditingController();

    if (pr.supplierDetected) {
      _supplierId = pr.supplier!.id;
      _supplierName = pr.supplier!.name;
    }
  }

  String _fmt(double v) =>
      v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

  @override
  void dispose() {
    _categoryCtrl.dispose();
    _grossCtrl.dispose();
    _stoneCtrl.dispose();
    _netCtrl.dispose();
    _rateCtrl.dispose();
    super.dispose();
  }

  double? get _net => double.tryParse(_netCtrl.text);
  double? get _rate => double.tryParse(_rateCtrl.text);

  double get _total {
    final n = _net;
    final r = _rate;
    if (n == null || r == null) return 0;
    return n * r;
  }

  void _onFieldChanged() => setState(() {});

  Future<void> _submit({bool overrideDuplicate = false}) async {
    if (_supplierId == null) {
      _showSnack('Please select a supplier', isError: true);
      return;
    }
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final gw = double.tryParse(_grossCtrl.text) ?? 0;
    final nw = double.tryParse(_netCtrl.text) ?? 0;
    final sw = double.tryParse(_stoneCtrl.text) ?? 0;

    if (gw <= 0) {
      _showSnack('Gross Weight must be greater than zero.', isError: true);
      return;
    }
    if (nw <= 0) {
      _showSnack('Net Weight must be greater than zero.', isError: true);
      return;
    }
    if (nw > gw) {
      _showSnack(
        'Net Weight cannot be greater than Gross Weight.',
        isError: true,
      );
      return;
    }
    if (sw >= gw) {
      _showSnack('Stone Weight must be less than Gross Weight.', isError: true);
      return;
    }

    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.submit(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim(),
      grossWeight: gw,
      stoneWeight: sw,
      netWeight: nw,
      ratePerGram: double.tryParse(_rateCtrl.text) ?? 0,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
      overrideDuplicate: overrideDuplicate,
    );
  }

  Future<void> _confirmDuplicate() async {
    final notifier = ref.read(saleEntryProvider.notifier);
    await notifier.confirmDuplicate(
      supplierId: _supplierId!,
      category: _categoryCtrl.text.trim(),
      grossWeight: double.tryParse(_grossCtrl.text) ?? 0,
      stoneWeight: double.tryParse(_stoneCtrl.text) ?? 0,
      netWeight: double.tryParse(_netCtrl.text) ?? 0,
      ratePerGram: double.tryParse(_rateCtrl.text) ?? 0,
      qrRaw: widget.parseResult.raw.isNotEmpty ? widget.parseResult.raw : null,
    );
  }

  void _showSnack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.danger : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final saleState = ref.watch(saleEntryProvider);
    final submitState = saleState.value ?? const SaleEntryState();
    final isLoading = submitState.status == SaleSubmitStatus.loading;

    // Navigate to success screen after save
    ref.listen(saleEntryProvider, (previous, next) {
      final s = next.value;
      final previousStatus = previous?.value?.status;
      if (previousStatus != SaleSubmitStatus.success &&
          s?.status == SaleSubmitStatus.success &&
          s?.createdSale != null) {
        context.pushReplacement('/sale-success', extra: s!.createdSale);
      }
    });

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('New Sale'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => context.pop(),
        ),
        actions: [
          TextButton(
            onPressed: isLoading ? null : () => _submit(),
            child: const Text(
              'Save',
              style: TextStyle(
                color: AppColors.accent,
                fontWeight: FontWeight.w700,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
            child: Form(
              key: _formKey,
              onChanged: _onFieldChanged,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // â”€â”€ Duplicate warning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  if (submitState.status == SaleSubmitStatus.duplicateWarning)
                    _DuplicateWarningBanner(
                      date: submitState.duplicateDate!,
                      onSaveAnyway: _confirmDuplicate,
                      onCancel: () =>
                          ref.read(saleEntryProvider.notifier).reset(),
                    ),

                  // â”€â”€ Error banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  if (submitState.status == SaleSubmitStatus.error)
                    _ErrorBanner(
                      message:
                          submitState.errorMessage ?? 'Failed to save sale',
                      retryCount: submitState.retryCount,
                      onRetry: () => _submit(),
                    ),

                  // â”€â”€ Parse status chip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  _ParseStatusChip(parseResult: widget.parseResult),
                  const SizedBox(height: 16),

                  // â”€â”€ Supplier section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  _SectionLabel('Supplier'),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: _supplierId != null && !widget.parseResult.hasErrors
                        ? _SupplierChip(
                            name: _supplierName ?? '',
                            onClear: () => setState(() {
                              _supplierId = null;
                              _supplierName = null;
                            }),
                          )
                        : _SupplierDropdown(
                            selectedId: _supplierId,
                            onSelected: (id, name) => setState(() {
                              _supplierId = id;
                              _supplierName = name;
                            }),
                          ),
                  ),
                  const SizedBox(height: 20),

                  // â”€â”€ Fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  _SectionLabel('Item Details'),
                  const SizedBox(height: 12),

                  _SaleField(
                    label: 'Category',
                    controller: _categoryCtrl,
                    parsed: _categoryParsed,
                    hint: 'e.g. RING, NECKLACE, BANGLE',
                    required: true,
                  ),
                  const SizedBox(height: 12),

                  Row(
                    children: [
                      Expanded(
                        child: _SaleField(
                          label: 'Gross Weight (g)',
                          controller: _grossCtrl,
                          parsed: _grossParsed,
                          hint: '0.0',
                          numeric: true,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _SaleField(
                          label: 'Stone Weight (g)',
                          controller: _stoneCtrl,
                          parsed: _stoneParsed,
                          hint: '0.0',
                          numeric: true,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  _SaleField(
                    label: 'Net Weight (g)',
                    controller: _netCtrl,
                    parsed: _netParsed,
                    hint: '0.0',
                    numeric: true,
                    required: true,
                  ),
                  const SizedBox(height: 12),

                  _SaleField(
                    label: 'Rate per Gram (â‚¹)',
                    controller: _rateCtrl,
                    parsed: false, // always manual â€” amber tint
                    parsedOverride: true, // but shown in "neutral" style
                    hint: 'Enter gold rate',
                    numeric: true,
                    required: true,
                  ),

                  const SizedBox(height: 24),

                  // â”€â”€ Total display â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  _TotalCard(total: _total),
                  const SizedBox(height: 24),

                  // â”€â”€ QR Debug panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                  if (widget.parseResult.raw.isNotEmpty ||
                      widget.parseResult.hasErrors)
                    _QrDebugPanel(
                      parseResult: widget.parseResult,
                      expanded: _debugExpanded,
                      onToggle: () =>
                          setState(() => _debugExpanded = !_debugExpanded),
                    ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          ),

          // â”€â”€ Sticky Save button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _SaveBar(
              isLoading: isLoading,
              total: _total,
              onSave: () => _submit(),
            ),
          ),
        ],
      ),
    );
  }
}

// â”€â”€â”€ Success Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class SaleSuccessScreen extends StatelessWidget {
  const SaleSuccessScreen({super.key, required this.sale});

  final CreatedSale sale;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.successSoft,
                  border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.6),
                    width: 2,
                  ),
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 44,
                ),
              ),
              const SizedBox(height: 28),

              const Text(
                'Sale Recorded!',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Total value',
                style: TextStyle(
                  color: AppColors.textMuted,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'â‚¹ ${formatMoney(sale.totalValue)}',
                style: TextStyle(
                  fontSize: 38,
                  fontWeight: FontWeight.w900,
                  color: AppColors.accent,
                  letterSpacing: -1,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                sale.ref,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: AppColors.textFaint,
                  letterSpacing: 2,
                ),
              ),
              if (sale.isDuplicate) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.warningSoft,
                      width: 1,
                    ),
                  ),
                  child: const Text(
                    'âš  Saved as duplicate entry',
                    style: TextStyle(color: AppColors.warning, fontSize: 13),
                  ),
                ),
              ],
              const SizedBox(height: 48),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => context.go('/dashboard'),
                  child: const Text('Back to Dashboard'),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go('/scanner'),
                child: const Text('Scan Another'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// â”€â”€â”€ Sub-widgets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      style: TextStyle(
        fontSize: 11,
        letterSpacing: 1.4,
        fontWeight: FontWeight.w700,
        color: AppColors.accent,
      ),
    );
  }
}

class _SaleField extends StatelessWidget {
  const _SaleField({
    required this.label,
    required this.controller,
    required this.parsed,
    this.parsedOverride = false,
    this.hint = '',
    this.numeric = false,
    this.required = false,
  });

  final String label;
  final TextEditingController controller;
  final bool parsed; // true = green tick, false = amber/red
  final bool parsedOverride; // if true, don't apply miss-parse styling
  final String hint;
  final bool numeric;
  final bool required;

  @override
  Widget build(BuildContext context) {
    final isMissed = !parsed && !parsedOverride;
    final borderColor = isMissed
        ? AppColors.warning.withValues(alpha: 0.8)
        : const Color(0x22FFFFFF);
    final focusBorderColor = isMissed
        ? AppColors.warning
        : AppColors.accent;

    Widget? suffixIcon;
    if (parsed && !parsedOverride) {
      suffixIcon = const Icon(
        Icons.check_circle_rounded,
        color: AppColors.success,
        size: 18,
      );
    } else if (isMissed) {
      suffixIcon = const Icon(
        Icons.warning_amber_rounded,
        color: AppColors.warning,
        size: 18,
      );
    }

    return TextFormField(
      controller: controller,
      keyboardType: numeric
          ? const TextInputType.numberWithOptions(decimal: true)
          : TextInputType.text,
      inputFormatters: numeric
          ? [FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*'))]
          : null,
      textInputAction: TextInputAction.next,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.surfaceAlt,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: focusBorderColor, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.danger),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
      ),
      validator: required
          ? (v) {
              if (v == null || v.trim().isEmpty) return '$label is required';
              if (numeric && (double.tryParse(v) == null)) {
                return 'Enter a valid number';
              }
              return null;
            }
          : null,
    );
  }
}

class _SupplierChip extends StatelessWidget {
  const _SupplierChip({required this.name, required this.onClear});
  final String name;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppColors.success.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: AppColors.success,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          GestureDetector(
            onTap: onClear,
            child: const Icon(
              Icons.close_rounded,
              color: AppColors.textFaint,
              size: 18,
            ),
          ),
        ],
      ),
    );
  }
}

class _SupplierDropdown extends ConsumerWidget {
  const _SupplierDropdown({required this.selectedId, required this.onSelected});

  final String? selectedId;
  final void Function(String id, String name) onSelected;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suppliers = ref.watch(suppliersProvider);

    return suppliers.when(
      loading: () => const LinearProgressIndicator(
        color: AppColors.accent,
        backgroundColor: AppColors.surfaceAlt,
      ),
      error: (e, _) => Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.dangerSoft),
        ),
        child: Text(
          'Could not load suppliers: $e',
          style: TextStyle(color: AppColors.danger, fontSize: 13),
        ),
      ),
      data: (list) {
        if (list.isEmpty) {
          return Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.warning.withValues(alpha: 0.3)),
            ),
            child: const Text(
              'No active suppliers found. Ask admin to add one.',
              style: TextStyle(color: AppColors.warning, fontSize: 13),
            ),
          );
        }

        return DropdownButtonFormField<String>(
          initialValue: selectedId,
          isExpanded: true,
          decoration: InputDecoration(
            labelText: 'Select Supplier *',
            hintText: 'Supplier not detected â€” choose one',
            filled: true,
            fillColor: AppColors.surfaceAlt,
            hintStyle: TextStyle(overflow: TextOverflow.ellipsis),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: AppColors.warning),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: AppColors.warning.withValues(alpha: 0.8),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: AppColors.accent,
                width: 1.4,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
            prefixIcon: const Icon(
              Icons.warning_amber_rounded,
              color: AppColors.warning,
              size: 20,
            ),
          ),
          dropdownColor: AppColors.surfaceAlt,
          items: list
              .map(
                (s) => DropdownMenuItem(
                  value: s.id,
                  child: Text(
                    s.name,
                    style: TextStyle(color: AppColors.textPrimary),
                  ),
                ),
              )
              .toList(),
          onChanged: (id) {
            if (id == null) return;
            final name = list.firstWhere((s) => s.id == id).name;
            onSelected(id, name);
          },
          validator: (v) => v == null ? 'Supplier is required' : null,
        );
      },
    );
  }
}

class _TotalCard extends StatelessWidget {
  const _TotalCard({required this.total});
  final double total;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.warningSoft, AppColors.surfaceAlt],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.accent.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ESTIMATED TOTAL',
                style: TextStyle(
                  fontSize: 11,
                  letterSpacing: 1.2,
                  color: AppColors.accent,
                  fontWeight: FontWeight.w700,
                ),
              ),
              SizedBox(height: 2),
              Text(
                'Net Weight Ã— Rate',
                style: TextStyle(color: AppColors.textFaint, fontSize: 12),
              ),
            ],
          ),
          Text(
            'â‚¹ ${formatMoney(total)}',
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w900,
              color: AppColors.accent,
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }
}

class _ParseStatusChip extends StatelessWidget {
  const _ParseStatusChip({required this.parseResult});
  final ParseQrResult parseResult;

  @override
  Widget build(BuildContext context) {
    if (parseResult.raw.isEmpty) {
      return _chip(
        icon: Icons.edit_note_rounded,
        label: 'Manual entry â€” no QR scanned',
        color: AppColors.textFaint,
        bg: AppColors.surfaceAlt,
      );
    }

    if (parseResult.success && parseResult.errors.isEmpty) {
      return _chip(
        icon: Icons.qr_code_scanner_rounded,
        label: 'QR parsed fully',
        color: AppColors.success,
        bg: AppColors.successSoft,
      );
    }

    if (parseResult.errors.isNotEmpty) {
      return _chip(
        icon: Icons.qr_code_scanner_rounded,
        label:
            'QR partial â€” ${parseResult.errors.length} field(s) need manual input',
        color: AppColors.warning,
        bg: AppColors.warningSoft,
      );
    }

    return _chip(
      icon: Icons.error_outline_rounded,
      label: 'QR could not be parsed â€” fill in manually',
      color: AppColors.warning,
      bg: AppColors.warningSoft,
    );
  }

  Widget _chip({
    required IconData icon,
    required String label,
    required Color color,
    required Color bg,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, style: TextStyle(color: color, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

class _QrDebugPanel extends StatelessWidget {
  const _QrDebugPanel({
    required this.parseResult,
    required this.expanded,
    required this.onToggle,
  });

  final ParseQrResult parseResult;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Row(
                children: [
                  const Icon(
                    Icons.bug_report_rounded,
                    color: AppColors.textFaint,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'QR Debug',
                    style: TextStyle(
                      color: AppColors.textFaint,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const Spacer(),
                  Icon(
                    expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    color: AppColors.textFaint,
                    size: 18,
                  ),
                ],
              ),
            ),
          ),
          if (expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Divider(color: AppColors.border),
                  const Text(
                    'RAW QR STRING',
                    style: TextStyle(
                      fontSize: 10,
                      letterSpacing: 1.2,
                      color: AppColors.textFaint,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.textFaint,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: SelectableText(
                      parseResult.raw.isEmpty
                          ? '(no QR scanned)'
                          : parseResult.raw,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  if (parseResult.errors.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    const Text(
                      'PARSE ERRORS',
                      style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1.2,
                        color: AppColors.textFaint,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    ...parseResult.errors.map(
                      (e) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'â€¢ ',
                              style: TextStyle(color: AppColors.warning),
                            ),
                            Expanded(
                              child: Text(
                                '${e.field}: ${e.reason}',
                                style: TextStyle(
                                  color: AppColors.warning,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _DuplicateWarningBanner extends StatelessWidget {
  const _DuplicateWarningBanner({
    required this.date,
    required this.onSaveAnyway,
    required this.onCancel,
  });

  final DateTime date;
  final VoidCallback onSaveAnyway;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final formatted = formatDateTime(date);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warningSoft),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.warning_amber_rounded,
                color: AppColors.warning,
                size: 18,
              ),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Duplicate QR Detected',
                  style: TextStyle(
                    color: AppColors.warning,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'This QR was scanned on $formatted. Save anyway?',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onCancel,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textMuted,
                    side: BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: onSaveAnyway,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.warning,
                    foregroundColor: AppColors.accentOn,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  child: const Text(
                    'Yes, Save',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
    required this.retryCount,
    required this.onRetry,
  });

  final String message;
  final int retryCount;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.dangerSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: AppColors.danger.withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.danger,
            size: 18,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message,
                  style: TextStyle(
                    color: AppColors.danger,
                    fontSize: 13,
                  ),
                ),
                if (retryCount > 0)
                  Text(
                    'Attempt $retryCount of 3',
                    style: TextStyle(color: AppColors.textFaint, fontSize: 11),
                  ),
              ],
            ),
          ),
          if (retryCount < 3)
            TextButton(
              onPressed: onRetry,
              child: const Text(
                'Retry',
                style: TextStyle(color: AppColors.accent),
              ),
            ),
        ],
      ),
    );
  }
}

class _SaveBar extends StatelessWidget {
  const _SaveBar({
    required this.isLoading,
    required this.total,
    required this.onSave,
  });

  final bool isLoading;
  final double total;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        12 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: AppColors.background,
        border: const Border(top: BorderSide(color: AppColors.border)),
        boxShadow: [
          BoxShadow(
            color: AppColors.background.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: Row(
        children: [
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Total',
                style: TextStyle(color: AppColors.textFaint, fontSize: 12),
              ),
              Text(
                'â‚¹ ${formatMoney(total)}',
                style: TextStyle(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w800,
                  fontSize: 18,
                ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: SizedBox(
              height: 50,
              child: ElevatedButton(
                onPressed: isLoading ? null : onSave,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.accent,
                  foregroundColor: AppColors.accentOn,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
                child: isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textMuted,
                        ),
                      )
                    : const Text(
                        'Save Sale',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: 16,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}




