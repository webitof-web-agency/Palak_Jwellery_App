import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/theme/app_theme.dart';
import '../../batches/presentation/widgets/batch_ui.dart';
import '../../sale_entry/data/sale_repository.dart';
import '../../sale_entry/presentation/sale_entry_provider.dart';
import '../data/capture_session_repository.dart';
import '../domain/capture_session_models.dart';
import 'capture_sessions_provider.dart';

class SessionDetailScreen extends ConsumerStatefulWidget {
  const SessionDetailScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  ConsumerState<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends ConsumerState<SessionDetailScreen> {
  Future<void> _refresh() async {
    ref.invalidate(captureSessionDetailProvider(widget.sessionId));
    await ref.read(captureSessionDetailProvider(widget.sessionId).future);
  }

  String _noticeText(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'draft':
      case 'open':
        return 'Assigned salesman can add items from the mobile app.';
      case 'submitted':
        return 'Submitted for admin review.';
      case 'finalized':
        return 'This session is finalized and read-only.';
      case 'cancelled':
        return 'This session is cancelled and read-only.';
      default:
        return 'Session capture follows the current session status.';
    }
  }

  bool _canAddSupplierBatch(String? status) {
    switch ((status ?? '').toLowerCase()) {
      case 'draft':
      case 'open':
        return true;
      default:
        return false;
    }
  }

  bool _hasActiveChildBatch(CaptureSessionDetail detail) {
    return detail.batches.any((batch) {
      switch (batch.status.toLowerCase()) {
        case 'draft':
        case 'open':
        case 'reopened':
          return true;
        default:
          return false;
      }
    });
  }

  bool _canSubmitSession(CaptureSessionDetail detail) {
    final status = detail.status.toLowerCase();
    if (!['draft', 'open'].contains(status)) {
      return false;
    }
    if (detail.batches.isEmpty) {
      return false;
    }
    return !_hasActiveChildBatch(detail);
  }

  Future<void> _openBatch(String? batchId) async {
    if (batchId == null || batchId.isEmpty) {
      return;
    }
    await context.push('/batches/$batchId');
  }

  Future<void> _openAddSupplierBatchSheet(CaptureSessionDetail detail) async {
    final batchId = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return _AddSupplierBatchSheet(
          sessionId: widget.sessionId,
          existingSupplierIds: detail.batches
              .map((batch) => batch.supplier?.id ?? '')
              .where((id) => id.isNotEmpty)
              .toSet()
              .toList(growable: false),
        );
      },
    );

    if (!mounted || batchId == null || batchId.isEmpty) {
      return;
    }

    await _refresh();
    if (!mounted) return;
    await context.push('/batches/$batchId');
  }

  Future<void> _submitSession(CaptureSessionDetail detail) async {
    final shouldSubmit = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Submit Session?'),
          content: Text(
            'All supplier batches must already be submitted or finalized.',
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Submit Session'),
            ),
          ],
        );
      },
    );

    if (shouldSubmit != true) {
      return;
    }

    try {
      await ref.read(captureSessionRepositoryProvider).submitSession(widget.sessionId);
      await _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Session submitted for admin review.')),
      );
    } on CaptureSessionApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString())),
      );
    }
  }

  Widget _metricGrid(CaptureSessionDetail detail) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isCompact = constraints.maxWidth < 420;
        final metrics = [
          BatchMetricCard(
            label: 'Suppliers',
            value: '${detail.supplierCount}',
            icon: Icons.store_rounded,
          ),
          BatchMetricCard(
            label: 'Items',
            value: '${detail.itemCount}',
            icon: Icons.format_list_bulleted_rounded,
          ),
          BatchMetricCard(
            label: 'Gross',
            value: formatBatchWeight(detail.totals.grossWeight),
            icon: Icons.balance_rounded,
          ),
          BatchMetricCard(
            label: 'Stone',
            value: formatBatchWeight(detail.totals.stoneWeight),
            icon: Icons.diamond_rounded,
          ),
          BatchMetricCard(
            label: 'Net',
            value: formatBatchWeight(detail.totals.netWeight),
            icon: Icons.filter_2_rounded,
          ),
          BatchMetricCard(
            label: 'Fine',
            value: formatBatchWeight(detail.totals.fineWeight),
            icon: Icons.workspace_premium_rounded,
          ),
        ];

        if (isCompact) {
          return Column(
            children: [
              for (var i = 0; i < metrics.length; i++) ...[
                metrics[i],
                if (i != metrics.length - 1) const SizedBox(height: 10),
              ],
            ],
          );
        }

        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            for (final metric in metrics)
              SizedBox(
                width: (constraints.maxWidth - 10) / 2,
                child: metric,
              ),
          ],
        );
      },
    );
  }

  Widget _batchCard(CaptureSessionDetail detail, CaptureSessionBatchSummary batch) {
    final supplierName = formatBatchText(batch.supplier?.name ?? batch.supplier?.code);
    final actionLabel = ['draft', 'open', 'reopened'].contains(batch.status.toLowerCase())
        ? 'Open Batch'
        : 'View Batch';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
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
                      supplierName,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      batch.batchRef.isEmpty ? 'Batch —' : batch.batchRef,
                      style: TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  BatchStatusPill(status: batch.status),
                  const SizedBox(height: 8),
                  Text(
                    '${batch.itemCount} item${batch.itemCount == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              BatchMetricCard(
                label: 'Net',
                value: formatBatchWeight(batch.totals.netWeight),
              ),
              BatchMetricCard(
                label: 'Fine',
                value: formatBatchWeight(batch.totals.fineWeight),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: batch.id.isEmpty ? null : () => _openBatch(batch.id),
              icon: const Icon(Icons.open_in_new_rounded),
              label: Text(actionLabel),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBatchSection(CaptureSessionDetail detail) {
    if (detail.batches.isEmpty) {
      return BatchEmptyState(
        icon: Icons.inventory_2_rounded,
        title: 'No supplier batches yet',
        message: _canAddSupplierBatch(detail.status)
            ? 'Add the first supplier batch to start capture.'
            : 'This session is read-only.',
        action: _canAddSupplierBatch(detail.status)
            ? SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _openAddSupplierBatchSheet(detail),
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add Supplier Batch'),
                ),
              )
            : null,
      );
    }

    return Column(
      children: [
        for (var i = 0; i < detail.batches.length; i++) ...[
          _batchCard(detail, detail.batches[i]),
          if (i != detail.batches.length - 1) const SizedBox(height: 12),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final detailAsync = ref.watch(captureSessionDetailProvider(widget.sessionId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Session detail'),
      ),
      body: SafeArea(
        child: detailAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => Padding(
            padding: const EdgeInsets.all(20),
            child: BatchEmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Could not load session',
              message: error.toString(),
              action: OutlinedButton(
                onPressed: _refresh,
                child: const Text('Try again'),
              ),
            ),
          ),
          data: (detail) {
            final canAddSupplierBatch = _canAddSupplierBatch(detail.status);
            final canSubmit = _canSubmitSession(detail);
            final hasActiveBatches = _hasActiveChildBatch(detail);

            return RefreshIndicator(
              onRefresh: _refresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppColors.border),
                    ),
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
                                    detail.sessionRef,
                                    style: TextStyle(
                                      color: AppColors.accent,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    formatBatchText(detail.customerName, fallback: 'No customer name'),
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  if (detail.referenceNote.trim().isNotEmpty) ...[
                                    const SizedBox(height: 4),
                                    Text(
                                      detail.referenceNote.trim(),
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        height: 1.4,
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                BatchStatusPill(status: detail.status),
                                const SizedBox(height: 8),
                                Text(
                                  'Updated ${formatBatchDateTime(detail.updatedAt)}',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceAlt,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                Icons.phone_iphone_rounded,
                                color: AppColors.accent,
                                size: 18,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _noticeText(detail.status),
                                  style: TextStyle(
                                    color: AppColors.textSecondary,
                                    height: 1.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Totals',
                    subtitle: 'Values come from the backend capture-session summary.',
                    child: _metricGrid(detail),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Supplier batches',
                    subtitle: 'Each supplier gets one batch in this session.',
                    trailing: canAddSupplierBatch
                        ? SizedBox(
                            height: 44,
                            child: ElevatedButton.icon(
                              onPressed: () => _openAddSupplierBatchSheet(detail),
                              icon: const Icon(Icons.add_rounded),
                              label: const Text('Add Supplier Batch'),
                            ),
                          )
                        : null,
                    child: _buildBatchSection(detail),
                  ),
                  const SizedBox(height: 16),
                  if (detail.status.toLowerCase() == 'submitted')
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.successSoft,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.success.withValues(alpha: 0.18)),
                      ),
                      child: Text(
                        'Submitted for admin review.',
                        style: TextStyle(
                          color: AppColors.success,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                  else if (detail.status.toLowerCase() == 'finalized')
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceAlt,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Text(
                        'This session is finalized and read-only.',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                  else if (detail.status.toLowerCase() == 'cancelled')
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.dangerSoft,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.danger.withValues(alpha: 0.18)),
                      ),
                      child: Text(
                        'This session is cancelled and read-only.',
                        style: TextStyle(
                          color: AppColors.danger,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    )
                  else ...[
                    BatchSectionCard(
                      title: 'Submit session',
                      subtitle: canSubmit
                          ? 'All supplier batches are ready to move to admin review.'
                          : hasActiveBatches
                              ? 'Submit the open supplier batches first.'
                              : 'Add at least one supplier batch before submitting.',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: double.infinity,
                            height: 52,
                            child: ElevatedButton.icon(
                              onPressed: canSubmit ? () => _submitSession(detail) : null,
                              icon: const Icon(Icons.send_rounded),
                              label: const Text('Submit Session'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _AddSupplierBatchSheet extends ConsumerStatefulWidget {
  const _AddSupplierBatchSheet({
    required this.sessionId,
    required this.existingSupplierIds,
  });

  final String sessionId;
  final List<String> existingSupplierIds;

  @override
  ConsumerState<_AddSupplierBatchSheet> createState() => _AddSupplierBatchSheetState();
}

class _AddSupplierBatchSheetState extends ConsumerState<_AddSupplierBatchSheet> {
  String? _selectedSupplierId;
  bool _saving = false;

  Future<void> _createSupplierBatch(SupplierModel supplier) async {
    if (_saving) return;

    setState(() {
      _selectedSupplierId = supplier.id;
      _saving = true;
    });

    try {
      final response = await ref.read(captureSessionRepositoryProvider).createSupplierBatch(
            sessionId: widget.sessionId,
            supplierId: supplier.id,
          );

      if (!mounted) return;
      Navigator.of(context).pop(response.batch.id);
    } on CaptureSessionApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final suppliersAsync = ref.watch(suppliersProvider);

    return SafeArea(
      child: Container(
        margin: const EdgeInsets.only(top: 24),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Add Supplier Batch',
              style: TextStyle(
                color: AppColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Select a supplier to create a new batch inside this session.',
              style: TextStyle(color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 16),
            suppliersAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.all(24),
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (error, stackTrace) => BatchEmptyState(
                icon: Icons.error_outline_rounded,
                title: 'Could not load suppliers',
                message: error.toString(),
                action: OutlinedButton(
                  onPressed: () => ref.invalidate(suppliersProvider),
                  child: const Text('Retry'),
                ),
              ),
              data: (suppliers) {
                final availableSuppliers = suppliers
                    .where((supplier) => !widget.existingSupplierIds.contains(supplier.id))
                    .toList(growable: false);

                if (availableSuppliers.isEmpty) {
                  return const BatchEmptyState(
                    icon: Icons.store_mall_directory_rounded,
                    title: 'No suppliers available',
                    message: 'All available suppliers already have a batch in this session.',
                  );
                }

                return ConstrainedBox(
                  constraints: BoxConstraints(
                    maxHeight: MediaQuery.of(context).size.height * 0.65,
                  ),
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: availableSuppliers.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final supplier = availableSuppliers[index];
                      final isSelected = _selectedSupplierId == supplier.id;
                      return InkWell(
                        borderRadius: BorderRadius.circular(16),
                        onTap: _saving ? null : () => _createSupplierBatch(supplier),
                        child: Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceAlt,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppColors.border),
                                ),
                                child: Icon(
                                  Icons.store_rounded,
                                  color: AppColors.accent,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      supplier.name,
                                      style: TextStyle(
                                        color: AppColors.textPrimary,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      supplier.code.trim().isEmpty
                                          ? 'Supplier code not set'
                                          : supplier.code,
                                      style: TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (isSelected)
                                SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.accent,
                                  ),
                                )
                              else
                                Icon(
                                  Icons.chevron_right_rounded,
                                  color: AppColors.textMuted,
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
