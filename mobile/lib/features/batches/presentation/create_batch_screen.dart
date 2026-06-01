import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_theme.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../data/batch_repository.dart';
import 'widgets/batch_ui.dart';

class CreateBatchScreen extends ConsumerStatefulWidget {
  const CreateBatchScreen({super.key});

  @override
  ConsumerState<CreateBatchScreen> createState() => _CreateBatchScreenState();
}

class _CreateBatchScreenState extends ConsumerState<CreateBatchScreen> {
  final _formKey = GlobalKey<FormState>();
  final _customerNameController = TextEditingController();
  final _customerPhoneController = TextEditingController();
  final _referenceNoteController = TextEditingController();

  String? _selectedSupplierId;
  bool _saving = false;

  @override
  void dispose() {
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    _referenceNoteController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_saving) {
      return;
    }

    final valid = _formKey.currentState?.validate() ?? false;
    if (!valid) {
      return;
    }

    final supplierId = _selectedSupplierId;
    if (supplierId == null || supplierId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a supplier.')),
      );
      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final createdBatch = await ref
          .read(batchRepositoryProvider)
          .createBatch(
            supplierId: supplierId,
            customerName: _customerNameController.text,
            customerPhone: _customerPhoneController.text,
            referenceNote: _referenceNoteController.text,
          );

      final batchId = createdBatch.id;
      if (!mounted) {
        return;
      }

      if (batchId == null || batchId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Batch created, but no batch id was returned.'),
          ),
        );
        return;
      }

      Navigator.of(context).pop(batchId);
    } on BatchApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  void _maybeAutoPickSingleSupplier(List<SupplierModel> suppliers) {
    if (_selectedSupplierId != null || suppliers.length != 1) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _selectedSupplierId != null || suppliers.length != 1) {
        return;
      }
      setState(() {
        _selectedSupplierId = suppliers.first.id;
      });
    });
  }

  InputDecoration _fieldDecoration({
    required String label,
    required String hint,
    IconData? icon,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      prefixIcon: icon == null ? null : Icon(icon),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final suppliersAsync = ref.watch(suppliersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Create Batch')),
      body: SafeArea(
        child: suppliersAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => Padding(
            padding: const EdgeInsets.all(20),
            child: BatchEmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Could not load suppliers',
              message: error.toString(),
              action: OutlinedButton(
                onPressed: () => ref.invalidate(suppliersProvider),
                child: const Text('Retry'),
              ),
            ),
          ),
          data: (suppliers) {
            _maybeAutoPickSingleSupplier(suppliers);
            final hasSelectedSupplier =
                _selectedSupplierId != null &&
                suppliers.any((supplier) => supplier.id == _selectedSupplierId);
            final effectiveSelectedSupplierId = hasSelectedSupplier
                ? _selectedSupplierId
                : null;

            if (suppliers.isEmpty) {
              return Padding(
                padding: const EdgeInsets.all(20),
                child: BatchEmptyState(
                  icon: Icons.store_mall_directory_rounded,
                  title: 'No active suppliers',
                  message:
                      'You need at least one active supplier before creating a batch.',
                  action: OutlinedButton(
                    onPressed: () => ref.invalidate(suppliersProvider),
                    child: const Text('Refresh'),
                  ),
                ),
              );
            }

            return SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.warningSoft,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: AppColors.warning.withValues(alpha: 0.22),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.info_outline_rounded,
                            color: AppColors.warning,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'The batch will be assigned to you automatically. Customer details are optional and can be filled later.',
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                height: 1.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    BatchSectionCard(
                      title: 'Batch details',
                      subtitle:
                          'Choose a supplier and add optional customer notes for this batch.',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          DropdownButtonFormField<String>(
                            initialValue: effectiveSelectedSupplierId,
                            isExpanded: true,
                            decoration: _fieldDecoration(
                              label: 'Supplier',
                              hint: 'Select supplier',
                              icon: Icons.store_rounded,
                            ),
                            items: suppliers
                                .map(
                                  (supplier) => DropdownMenuItem<String>(
                                    value: supplier.id,
                                    child: Text(
                                      supplier.code.trim().isEmpty
                                          ? supplier.name
                                          : '${supplier.name} (${supplier.code})',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(growable: false),
                            onChanged: (value) {
                              setState(() {
                                _selectedSupplierId = value;
                              });
                            },
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return 'Supplier is required';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _customerNameController,
                            textInputAction: TextInputAction.next,
                            decoration: _fieldDecoration(
                              label: 'Customer name',
                              hint: 'Optional',
                              icon: Icons.person_rounded,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _customerPhoneController,
                            textInputAction: TextInputAction.next,
                            keyboardType: TextInputType.phone,
                            decoration: _fieldDecoration(
                              label: 'Customer phone',
                              hint: 'Optional',
                              icon: Icons.phone_rounded,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _referenceNoteController,
                            textInputAction: TextInputAction.newline,
                            maxLines: 3,
                            decoration: _fieldDecoration(
                              label: 'Reference note',
                              hint: 'Optional note for this batch',
                              icon: Icons.note_alt_rounded,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _saving ? null : _submit,
                        icon: _saving
                            ? SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: AppColors.accentOn,
                                ),
                              )
                            : const Icon(Icons.check_circle_outline_rounded),
                        label: Text(_saving ? 'Creating...' : 'Create Batch'),
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      'After creation, open the batch to review its details. QR scanning and item capture will come in the next mobile phase.',
                      style: TextStyle(color: AppColors.textMuted, height: 1.5),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
