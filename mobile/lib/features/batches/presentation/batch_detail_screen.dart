import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/theme/app_theme.dart';
import '../domain/batch_models.dart';
import 'batches_provider.dart';
import 'widgets/batch_ui.dart';

class BatchDetailScreen extends ConsumerStatefulWidget {
  const BatchDetailScreen({super.key, required this.batchId});

  final String batchId;

  @override
  ConsumerState<BatchDetailScreen> createState() => _BatchDetailScreenState();
}

class _BatchDetailScreenState extends ConsumerState<BatchDetailScreen> {
  Future<void> _refresh() async {
    ref.invalidate(batchDetailProvider(widget.batchId));
    await ref.read(batchDetailProvider(widget.batchId).future);
  }

  String _formatEntryMode(String? value) {
    switch ((value ?? '').toLowerCase()) {
      case 'qr_scan':
        return 'QR scan';
      case 'manual':
        return 'Manual';
      case 'qr_scan_with_manual_override':
        return 'QR scan + override';
      case 'mixed':
        return 'Mixed';
      default:
        return '—';
    }
  }

  String _statusLabel(String? value) {
    switch ((value ?? '').toLowerCase()) {
      case 'draft':
        return 'Draft';
      case 'open':
        return 'Open';
      case 'submitted':
        return 'Submitted';
      case 'finalized':
        return 'Finalized';
      case 'reopened':
        return 'Reopened';
      case 'cancelled':
        return 'Cancelled';
      default:
        return value?.trim().isNotEmpty == true ? value!.trim() : '—';
    }
  }

  bool _mapBool(Map<String, dynamic>? map, String key) {
    return map != null && map[key] == true;
  }

  bool _needsReview(BatchItemSummary item) {
    final calculation = item.calculationSnapshot;
    final parsed = item.parsedSnapshot;
    final display = parsed != null ? parsed['display'] : null;
    return _mapBool(calculation, 'requiresReview') ||
        _mapBool(_asMap(display), 'requiresReview');
  }

  Map<String, dynamic>? _asMap(dynamic value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, val) => MapEntry(key.toString(), val));
    }
    return null;
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(
              label.toUpperCase(),
              style: TextStyle(
                color: AppColors.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _itemCard(BatchItemSummary item) {
    final flags = <Widget>[];
    if (item.isDuplicate) {
      flags.add(const _FlagChip(label: 'Duplicate', icon: Icons.copy_rounded));
    }
    if (_needsReview(item)) {
      flags.add(
        const _FlagChip(label: 'Review', icon: Icons.warning_amber_rounded),
      );
    }
    if (item.wasManuallyEdited) {
      flags.add(
        const _FlagChip(label: 'Manual override', icon: Icons.edit_rounded),
      );
    }

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
                      item.ref.isEmpty ? '—' : item.ref,
                      style: TextStyle(
                        color: AppColors.accent,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.itemCode?.trim().isNotEmpty == true
                          ? item.itemCode!
                          : 'No item code',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${_formatEntryMode(item.entryMode)}'
                      '${item.revisionAdded != null ? ' • Rev ${item.revisionAdded}' : ''}'
                      '${item.addedAt != null ? ' • ${formatBatchDateTime(item.addedAt)}' : ''}',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [if (flags.isNotEmpty) ...flags],
              ),
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final isCompact = constraints.maxWidth < 360;
              final metrics = [
                BatchMetricCard(
                  label: 'Gross',
                  value: formatBatchWeight(item.grossWeight),
                ),
                BatchMetricCard(
                  label: 'Stone',
                  value: formatBatchWeight(item.stoneWeight),
                ),
                BatchMetricCard(
                  label: 'Other',
                  value: formatBatchWeight(item.otherWeight),
                ),
                BatchMetricCard(
                  label: 'Net',
                  value: formatBatchWeight(item.netWeight),
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
          ),
        ],
      ),
    );
  }

  Widget _revisionCard(BatchRevisionSummary revision) {
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
                child: Text(
                  'Revision ${revision.revision}',
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ),
              BatchStatusPill(status: revision.status),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              BatchMetricCard(label: 'Items', value: '${revision.itemCount}'),
              BatchMetricCard(
                label: 'Net',
                value: formatBatchWeight(revision.totals.netWeight),
              ),
              BatchMetricCard(
                label: 'Fine',
                value: formatBatchWeight(revision.totals.fineWeight),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Builder(
            builder: (context) {
              final note = [
                if (revision.finalizedAt != null)
                  'Finalized ${formatBatchDateTime(revision.finalizedAt)}',
                if (revision.reopenedAt != null)
                  'Reopened ${formatBatchDateTime(revision.reopenedAt)}',
                if (revision.reopenReason?.trim().isNotEmpty == true)
                  revision.reopenReason!.trim(),
              ].join(' • ');

              if (note.isEmpty) {
                return const SizedBox.shrink();
              }

              return Text(
                note,
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  height: 1.4,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(themeControllerProvider);
    final detailAsync = ref.watch(batchDetailProvider(widget.batchId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Batch detail'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: detailAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stackTrace) => Padding(
            padding: const EdgeInsets.all(20),
            child: BatchEmptyState(
              icon: Icons.error_outline_rounded,
              title: 'Could not load batch',
              message: error.toString(),
              action: OutlinedButton(
                onPressed: _refresh,
                child: const Text('Try again'),
              ),
            ),
          ),
          data: (detail) {
            final totals = detail.totals;
            final currentRevision = detail.currentRevision;
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
                                    detail.batchRef,
                                    style: TextStyle(
                                      color: AppColors.accent,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    'Supplier: ${formatBatchText(detail.supplier?.name ?? detail.supplierCode)}',
                                    style: TextStyle(
                                      color: AppColors.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Assigned to: ${formatBatchText(detail.assignedSalesman?.name)}',
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      height: 1.4,
                                    ),
                                  ),
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
                                  'Revision ${detail.revision}',
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
                        Text(
                          'Read only in M1. Item capture will be added in the next mobile phase.',
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Batch info',
                    subtitle: 'Key batch metadata and assignment details.',
                    child: Column(
                      children: [
                        _infoRow('Status', _statusLabel(detail.status)),
                        _infoRow(
                          'Supplier',
                          formatBatchText(
                            detail.supplier?.name ?? detail.supplierCode,
                          ),
                        ),
                        _infoRow(
                          'Assigned salesman',
                          formatBatchText(detail.assignedSalesman?.name),
                        ),
                        _infoRow(
                          'Customer',
                          formatBatchText(detail.customerName),
                        ),
                        _infoRow(
                          'Phone',
                          formatBatchText(detail.customerPhone),
                        ),
                        _infoRow(
                          'Reference note',
                          formatBatchText(detail.referenceNote),
                        ),
                        _infoRow(
                          'Created by',
                          formatBatchText(detail.createdBy?.name),
                        ),
                        _infoRow(
                          'Created at',
                          formatBatchDateTime(detail.createdAt),
                        ),
                        _infoRow(
                          'Updated at',
                          formatBatchDateTime(detail.updatedAt),
                        ),
                        _infoRow(
                          'Current mode',
                          _formatEntryMode(
                            currentRevision?.entryMode ?? detail.entryMode,
                          ),
                        ),
                        _infoRow(
                          'Submitted at',
                          formatBatchDateTime(detail.submittedAt),
                        ),
                        _infoRow(
                          'Finalized at',
                          formatBatchDateTime(detail.finalizedAt),
                        ),
                        _infoRow(
                          'Reopened at',
                          formatBatchDateTime(detail.reopenedAt),
                        ),
                        _infoRow(
                          'Reopen reason',
                          formatBatchText(detail.reopenReason),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Totals',
                    subtitle: 'Live totals from the batch record.',
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final isCompact = constraints.maxWidth < 420;
                        final metrics = [
                          BatchMetricCard(
                            label: 'Items',
                            value: '${detail.itemCount}',
                          ),
                          BatchMetricCard(
                            label: 'Gross',
                            value: formatBatchWeight(totals.grossWeight),
                          ),
                          BatchMetricCard(
                            label: 'Stone',
                            value: formatBatchWeight(totals.stoneWeight),
                          ),
                          BatchMetricCard(
                            label: 'Other',
                            value: formatBatchWeight(totals.otherWeight),
                          ),
                          BatchMetricCard(
                            label: 'Net',
                            value: formatBatchWeight(totals.netWeight),
                          ),
                          BatchMetricCard(
                            label: 'Fine',
                            value: formatBatchWeight(totals.fineWeight),
                          ),
                          BatchMetricCard(
                            label: 'Stone amt',
                            value: formatBatchAmount(totals.stoneAmount),
                          ),
                        ];

                        if (isCompact) {
                          return Column(
                            children: [
                              for (var i = 0; i < metrics.length; i++) ...[
                                metrics[i],
                                if (i != metrics.length - 1)
                                  const SizedBox(height: 10),
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
                    ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Flags',
                    subtitle: 'Review and audit counts for this batch.',
                    child: LayoutBuilder(
                      builder: (context, constraints) {
                        final isCompact = constraints.maxWidth < 420;
                        final metrics = [
                          BatchMetricCard(
                            label: 'Warnings',
                            value: '${detail.warningsCount}',
                          ),
                          BatchMetricCard(
                            label: 'Review',
                            value: '${detail.reviewCount}',
                          ),
                          BatchMetricCard(
                            label: 'Duplicate',
                            value: '${detail.duplicateCount}',
                          ),
                          BatchMetricCard(
                            label: 'Manual',
                            value: '${detail.manualOverrideCount}',
                          ),
                        ];

                        if (isCompact) {
                          return Column(
                            children: [
                              for (var i = 0; i < metrics.length; i++) ...[
                                metrics[i],
                                if (i != metrics.length - 1)
                                  const SizedBox(height: 10),
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
                    ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Items',
                    subtitle: 'Child jewellery items linked to this batch.',
                    child: detail.items.isEmpty
                        ? BatchEmptyState(
                            icon: Icons.inbox_rounded,
                            title: 'No items yet',
                            message:
                                'This batch is ready for mobile item capture in the next phase.',
                          )
                        : Column(
                            children: [
                              for (var i = 0; i < detail.items.length; i++) ...[
                                _itemCard(detail.items[i]),
                                if (i != detail.items.length - 1)
                                  const SizedBox(height: 12),
                              ],
                            ],
                          ),
                  ),
                  const SizedBox(height: 16),
                  BatchSectionCard(
                    title: 'Revision history',
                    subtitle: 'Previous finalized or reopened batch snapshots.',
                    child: detail.revisionHistory.isEmpty
                        ? BatchEmptyState(
                            icon: Icons.history_rounded,
                            title: 'No revisions yet',
                            message:
                                'Revision history will appear after the batch is finalized and reopened.',
                          )
                        : Column(
                            children: [
                              for (
                                var i = 0;
                                i < detail.revisionHistory.length;
                                i++
                              ) ...[
                                _revisionCard(detail.revisionHistory[i]),
                                if (i != detail.revisionHistory.length - 1)
                                  const SizedBox(height: 12),
                              ],
                            ],
                          ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _FlagChip extends StatelessWidget {
  const _FlagChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.accent),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: AppColors.textSecondary,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
