import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/theme/app_theme.dart';
import '../../data/pending_sale_queue.dart';
import '../pending_sale_queue_provider.dart';

class PendingSalesBanner extends ConsumerStatefulWidget {
  const PendingSalesBanner({
    super.key,
    this.compact = false,
  });

  final bool compact;

  @override
  ConsumerState<PendingSalesBanner> createState() => _PendingSalesBannerState();
}

class _PendingSalesBannerState extends ConsumerState<PendingSalesBanner> {
  String? _retryingId;

  String _formatTimestamp(DateTime dateTime) {
    final date = dateTime.toLocal();
    final day = date.day.toString().padLeft(2, '0');
    final month = date.month.toString().padLeft(2, '0');
    final hour = date.hour.toString().padLeft(2, '0');
    final minute = date.minute.toString().padLeft(2, '0');
    return '$day/$month $hour:$minute';
  }

  Future<void> _retryDraft(PendingSaleDraft draft) async {
    if (_retryingId == draft.id) return;

    setState(() {
      _retryingId = draft.id;
    });

    final result = await ref.read(pendingSaleQueueProvider.notifier).submitDraft(draft);
    if (!mounted) return;

    setState(() {
      _retryingId = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.message),
        backgroundColor: result.success ? AppColors.success : AppColors.danger,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final queueAsync = ref.watch(pendingSaleQueueProvider);

    return queueAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (err, stack) => const SizedBox.shrink(),
      data: (items) {
        final unresolved = items.where((item) => !item.isResolved).toList();
        if (unresolved.isEmpty) {
          return const SizedBox.shrink();
        }

        final pendingCount =
            unresolved.where((item) => item.status == PendingSaleStatus.pending).length;
        final failedCount =
            unresolved.where((item) => item.status == PendingSaleStatus.failed).length;
        final visibleItems = unresolved.take(widget.compact ? 1 : 2).toList();

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.warningSoft,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.warning.withValues(alpha: 0.25)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.sync_problem_rounded, color: AppColors.warning, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Queued sales ${unresolved.length}',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  if (pendingCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: _StatusPill(
                        label: '$pendingCount pending',
                        background: AppColors.accent.withValues(alpha: 0.12),
                        foreground: AppColors.accent,
                      ),
                    ),
                  if (failedCount > 0)
                    _StatusPill(
                      label: '$failedCount failed',
                      background: AppColors.danger.withValues(alpha: 0.12),
                      foreground: AppColors.danger,
                    ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                'These entries are saved locally until they sync.',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 12,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 10),
              ...visibleItems.map(
                (draft) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _QueuedSaleRow(
                    draft: draft,
                    isRetrying: _retryingId == draft.id,
                    onRetry: () => _retryDraft(draft),
                    formatTimestamp: _formatTimestamp,
                  ),
                ),
              ),
              if (unresolved.length > visibleItems.length)
                Text(
                  '+${unresolved.length - visibleItems.length} more queued sale(s)',
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _QueuedSaleRow extends StatelessWidget {
  const _QueuedSaleRow({
    required this.draft,
    required this.isRetrying,
    required this.onRetry,
    required this.formatTimestamp,
  });

  final PendingSaleDraft draft;
  final bool isRetrying;
  final VoidCallback onRetry;
  final String Function(DateTime) formatTimestamp;

  @override
  Widget build(BuildContext context) {
    final isFailed = draft.status == PendingSaleStatus.failed;
    final statusLabel = isFailed ? 'Failed' : 'Pending';
    final statusColor = isFailed ? AppColors.danger : AppColors.accent;
    final statusBackground = isFailed
        ? AppColors.danger.withValues(alpha: 0.12)
        : AppColors.accent.withValues(alpha: 0.12);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: statusBackground,
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(color: statusColor.withValues(alpha: 0.2)),
                ),
                child: Icon(
                  isFailed ? Icons.error_outline_rounded : Icons.schedule_rounded,
                  color: statusColor,
                  size: 18,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      draft.payload.displayTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${draft.payload.subtitle} - ${formatTimestamp(draft.updatedAt)}',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _StatusPill(
                label: statusLabel,
                background: statusBackground,
                foreground: statusColor,
              ),
            ],
          ),
          if ((draft.errorMessage ?? '').isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              draft.errorMessage!,
              style: TextStyle(
                color: statusColor,
                fontSize: 12,
              ),
            ),
          ],
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: isRetrying ? null : onRetry,
              icon: isRetrying
                  ? SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.accent,
                      ),
                    )
                  : const Icon(Icons.refresh_rounded, size: 18),
              label: Text(isRetrying ? 'Retrying...' : 'Retry now'),
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: foreground,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
