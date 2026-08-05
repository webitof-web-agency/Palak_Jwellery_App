import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../customers/domain/customer_record.dart';
import '../data/bullion_sale_repository.dart';
import '../domain/bullion_sale_entry.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/theme/app_tokens.dart';
import '../../../shared/widgets/app_action_button.dart';
import '../../../shared/widgets/app_banner.dart';
import '../../../shared/widgets/app_card.dart';
import '../../../shared/widgets/app_section_header.dart';

class BullionEntryScreen extends ConsumerStatefulWidget {
  const BullionEntryScreen({super.key, this.customer});

  final CustomerRecord? customer;

  @override
  ConsumerState<BullionEntryScreen> createState() => _BullionEntryScreenState();
}

class _BullionEntryScreenState extends ConsumerState<BullionEntryScreen> {
  final _formKey = GlobalKey<FormState>();
  final _weightController = TextEditingController();
  final _rateController = TextEditingController();
  final _notesController = TextEditingController();

  String _rateUnit = 'per_gram';
  String _goldPurity = '24K';
  String _transactionType = 'sale';
  bool _isSaving = false;
  bool _showNotes = false;

  Future<bool> _confirmDiscard() async {
    final weight = _weightController.text.trim();
    final rate = _rateController.text.trim();
    if (weight.isEmpty && rate.isEmpty) return true; // No data to lose

    final shouldPop = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Discard entry?'),
        content: const Text('Are you sure you want to go back? Any entered details will be lost.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Discard', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    return shouldPop ?? false;
  }


  @override
  void dispose() {
    _weightController.dispose();
    _rateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  double? _parseNumber(String text) {
    final cleaned = text.trim().replaceAll(',', '');
    if (cleaned.isEmpty) return null;
    return double.tryParse(cleaned);
  }

  double? get _weightGrams => _parseNumber(_weightController.text);

  double? get _enteredRate => _parseNumber(_rateController.text);

  double? get _ratePerGram {
    final entered = _enteredRate;
    if (entered == null) return null;
    return _rateUnit == 'per_kg' ? entered / 1000 : entered;
  }

  double? get _totalAmount {
    final weight = _weightGrams;
    final rate = _ratePerGram;
    if (weight == null || rate == null) return null;
    return weight * rate;
  }

  String _formatMoney(double value) {
    final fixed = value.toStringAsFixed(2);
    final parts = fixed.split('.');
    final whole = parts.first;
    final fraction = parts.length > 1 ? parts[1] : '00';
    final reversed = whole.split('').reversed.join();
    final buffer = StringBuffer();

    for (var index = 0; index < reversed.length; index++) {
      if (index > 0 && index % 3 == 0) {
        buffer.write(',');
      }
      buffer.write(reversed[index]);
    }

    final grouped = buffer.toString().split('').reversed.join();
    return '$grouped.$fraction';
  }

  String _customerHeading(CustomerRecord? customer) {
    if (customer == null) return 'Walk-in Customer';
    return customer.name;
  }

  void _changeCustomer() {
    context.go('/bullion-sale');
  }

  Future<void> _saveSale() async {
    if (_isSaving) return;

    FocusScope.of(context).unfocus();
    final form = _formKey.currentState;
    if (form == null || !form.validate()) return;

    final weight = _weightGrams;
    final rate = _ratePerGram;
    if (weight == null || rate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter valid weight and rate.')),
      );
      return;
    }

    final total = _totalAmount;

    final shouldSave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Bullion Sale'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Weight: $weight g'),
            Text('Rate: Rs. ${_formatMoney(rate)}/g'),
            Text('Gold Purity: $_goldPurity'),
            Text('Type: ${_transactionType == "sale" ? "Sale" : "Return"}'),
            const SizedBox(height: 8),
            Text('Total Amount: Rs. ${_formatMoney(total!)}', style: const TextStyle(fontWeight: FontWeight.bold)),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Review'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );

    if (shouldSave != true) return;

    final entry = BullionSaleEntry(
      clientEntryId: BullionSaleEntry.generateClientEntryId(),
      customerId: widget.customer?.id,
      customerName: widget.customer?.name,
      customerPhone: widget.customer?.phone,
      weightGrams: weight,
      inputUnit: _rateUnit,
      ratePerGram: rate,
      goldPurity: _goldPurity,
      transactionType: _transactionType,
      notes: _notesController.text.trim(),
    );

    setState(() => _isSaving = true);
    try {
      await ref.read(bullionSaleRepositoryProvider).createBullionSale(entry);
      if (!mounted) return;
      ref.invalidate(bullionSalesHistoryProvider);
      ref.invalidate(todayBullionCustomersProvider);
      ref.invalidate(bullionSalesByCustomerProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Bullion sale saved')),
      );
      context.go('/dashboard');
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  InputDecoration _fieldDecoration(String label, {String? hint, Widget? suffixIcon}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      suffixIcon: suffixIcon,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selectedCustomer = widget.customer;
    final totalAmount = _totalAmount;
    final isKg = _rateUnit == 'per_kg';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final shouldPop = await _confirmDiscard();
        if (shouldPop && context.mounted) {
          context.pop();
        }
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('New Bullion Sale'),
          leading: IconButton(
            onPressed: () async {
              final shouldPop = await _confirmDiscard();
              if (shouldPop && context.mounted) {
                context.pop();
              }
            },
            icon: const Icon(Icons.arrow_back_rounded),
          ),
        ),
        body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screenPadding,
              AppSpacing.lg,
              AppSpacing.screenPadding,
              AppSpacing.xxl,
            ),
            children: [
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: AppColors.accentSoft.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        color: AppColors.accent,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _customerHeading(selectedCustomer),
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: AppTypography.titleSize,
                              fontWeight: AppTypography.titleWeight,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            selectedCustomer == null
                                ? 'No customer selected yet'
                                : [
                                    if (selectedCustomer.phone.trim().isNotEmpty) selectedCustomer.phone.trim(),
                                    if (selectedCustomer.area.trim().isNotEmpty) selectedCustomer.area.trim(),
                                  ].join(' | '),
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    AppActionButton(
                      label: selectedCustomer == null ? 'Select' : 'Change',
                      onPressed: _changeCustomer,
                      variant: AppActionButtonVariant.secondary,
                      height: 40,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              const AppSectionHeader(
                title: 'Bullion entry',
                subtitle: 'Enter weight and rate to calculate the total amount in real time.',
              ),
              const SizedBox(height: AppSpacing.md),
              // Row 1: Weight & Purity
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 5,
                    child: TextFormField(
                      controller: _weightController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      textInputAction: TextInputAction.next,
                      onChanged: (_) => setState(() {}),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                      ],
                      decoration: _fieldDecoration(
                        'Weight (grams)',
                        hint: 'Weight',
                        suffixIcon: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
                          child: Text('g'),
                        ),
                      ),
                      validator: (value) {
                        final parsed = _parseNumber(value ?? '');
                        if (parsed == null || parsed <= 0) {
                          return 'Required';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    flex: 4,
                    child: DropdownButtonFormField<String>(
                      initialValue: _goldPurity,
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _goldPurity = value);
                        }
                      },
                      decoration: InputDecoration(
                        labelText: 'Purity',
                        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.md),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          borderSide: BorderSide(color: AppColors.border),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          borderSide: BorderSide(color: AppColors.border),
                        ),
                        filled: true,
                        fillColor: AppColors.surfaceAlt,
                      ),
                      items: const [
                        DropdownMenuItem(value: '24K', child: Text('24K')),
                        DropdownMenuItem(value: '22K', child: Text('22K')),
                        DropdownMenuItem(value: '999 Fine', child: Text('999 Fine')),
                        DropdownMenuItem(value: 'Other', child: Text('Other')),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),

              // Row 2: Rate & Rate Unit
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _rateController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      textInputAction: TextInputAction.done,
                      onChanged: (_) => setState(() {}),
                      inputFormatters: [
                        FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                      ],
                      decoration: _fieldDecoration(
                        isKg ? 'Rate (Rs/kg)' : 'Rate (Rs/gm)',
                        hint: 'Enter rate',
                      ),
                      validator: (value) {
                        final parsed = _parseNumber(value ?? '');
                        if (parsed == null || parsed <= 0) {
                          return 'Rate must be > 0';
                        }
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  SizedBox(
                    height: 56,
                    child: ToggleButtons(
                      isSelected: [!isKg, isKg],
                      onPressed: (index) {
                        final nextUnit = index == 0 ? 'per_gram' : 'per_kg';
                        if (nextUnit == _rateUnit) return;
                        setState(() {
                          _rateUnit = nextUnit;
                          _rateController.clear();
                        });
                      },
                      borderColor: AppColors.border,
                      selectedBorderColor: AppColors.border,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      selectedColor: AppColors.accentOn,
                      fillColor: AppColors.accent,
                      color: AppColors.textSecondary,
                      constraints: const BoxConstraints(minHeight: 54, minWidth: 64),
                      children: const [
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                          child: Text('Rs/gm', style: TextStyle(fontSize: 12)),
                        ),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                          child: Text('Rs/kg', style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),

              // Row 3: Total Amount & Transaction Type
              AppCard(
                padding: const EdgeInsets.all(AppSpacing.md),
                backgroundColor: AppColors.accentSoft.withValues(alpha: 0.08),
                borderColor: AppColors.accent.withValues(alpha: 0.35),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Total amount',
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: AppTypography.labelWeight,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            totalAmount == null ? 'Rs. 0.00' : 'Rs. ${_formatMoney(totalAmount)}',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: AppTypography.headingSize,
                              fontWeight: AppTypography.headingWeight,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        ToggleButtons(
                          isSelected: [_transactionType == 'sale', _transactionType == 'return'],
                          onPressed: (index) {
                            setState(() {
                              _transactionType = index == 0 ? 'sale' : 'return';
                            });
                          },
                          borderRadius: BorderRadius.circular(AppRadius.md),
                          selectedColor: AppColors.accentOn,
                          fillColor: AppColors.accent,
                          color: AppColors.textSecondary,
                          constraints: const BoxConstraints(minHeight: 36, minWidth: 60),
                          children: const [
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                              child: Text('Sale', style: TextStyle(fontSize: 12)),
                            ),
                            Padding(
                              padding: EdgeInsets.symmetric(horizontal: AppSpacing.xs),
                              child: Text('Return', style: TextStyle(fontSize: 12)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),

              // Collapsible Notes
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => _showNotes = !_showNotes),
                  icon: Icon(
                    _showNotes ? Icons.keyboard_arrow_up_rounded : Icons.add_comment_rounded,
                    size: 18,
                    color: AppColors.textSecondary,
                  ),
                  label: Text(
                    _showNotes ? 'Hide notes' : 'Add notes',
                    style: TextStyle(color: AppColors.textSecondary),
                  ),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ),
              if (_showNotes) ...[
                const SizedBox(height: AppSpacing.sm),
                TextFormField(
                  controller: _notesController,
                  maxLines: 3,
                  textInputAction: TextInputAction.newline,
                  decoration: const InputDecoration(
                    labelText: 'Notes',
                    hintText: 'Optional notes for this bullion sale',
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              AppActionButton(
                label: _isSaving ? 'Saving...' : 'Save Bullion Sale',
                onPressed: _isSaving ? null : _saveSale,
                expanded: true,
                height: 54,
              ),
              const SizedBox(height: AppSpacing.md),
              AppBanner(
                title: 'Conversion note',
                message: _rateUnit == 'per_kg'
                    ? 'Entered rate is converted to per gram before saving.'
                    : 'Rate is stored directly as per gram for backend submission.',
                tone: AppBannerTone.info,
              ),
            ],
          ),
        ),
      ),
      ),
    );
  }
}
