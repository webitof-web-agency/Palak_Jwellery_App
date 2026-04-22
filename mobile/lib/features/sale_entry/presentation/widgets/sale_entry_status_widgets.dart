import 'package:flutter/material.dart';

import '../../data/sale_repository.dart';
import '../../../../shared/theme/app_theme.dart';
import '../utils/sale_entry_formatters.dart';

class WeightSummaryCard extends StatelessWidget {
  const WeightSummaryCard({
    super.key,
    required this.grossWeight,
    required this.stoneWeight,
    required this.netWeight,
  });

  final double? grossWeight;
  final double? stoneWeight;
  final double? netWeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
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
          _WeightMetric(
            label: 'Gross',
            value: grossWeight,
          ),
          _WeightMetric(
            label: 'Stone',
            value: stoneWeight,
          ),
          _WeightMetric(
            label: 'Net',
            value: netWeight,
          ),
        ],
      ),
    );
  }
}

class _WeightMetric extends StatelessWidget {
  const _WeightMetric({
    required this.label,
    required this.value,
  });

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(
            fontSize: 10,
            letterSpacing: 1.1,
            color: AppColors.accent,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value == null ? '-' : formatWeight(value!),
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w900,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}

class ParseStatusChip extends StatelessWidget {
  const ParseStatusChip({
    super.key,
    required this.parseResult,
  });

  final ParseQrResult parseResult;

  @override
  Widget build(BuildContext context) {
    if (parseResult.raw.isEmpty) {
      return _chip(
        icon: Icons.edit_note_rounded,
        label: 'Manual entry - no QR scanned',
        color: AppColors.textFaint,
        bg: AppColors.surfaceAlt,
      );
    }

    if (!parseResult.supplierDetected) {
      return _chip(
        icon: Icons.help_outline_rounded,
        label: 'Unknown supplier - complete fields manually and continue',
        color: AppColors.warning,
        bg: AppColors.warningSoft,
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
        label: 'QR partial - ${parseResult.errors.length} field(s) need manual input',
        color: AppColors.warning,
        bg: AppColors.warningSoft,
      );
    }

    return _chip(
      icon: Icons.error_outline_rounded,
      label: 'QR could not be parsed - fill in manually',
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
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: color,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
