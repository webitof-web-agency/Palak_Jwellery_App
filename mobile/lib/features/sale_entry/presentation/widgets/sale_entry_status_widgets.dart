import 'package:flutter/material.dart';

import '../../data/sale_repository.dart';
import '../../../../shared/theme/app_theme.dart';
import '../utils/sale_entry_formatters.dart';

class TotalCard extends StatelessWidget {
  const TotalCard({
    super.key,
    required this.total,
  });

  final double total;

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
          Column(
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
              const SizedBox(height: 2),
              Text(
                'Net Weight x Rate',
                style: TextStyle(color: AppColors.textFaint, fontSize: 12),
              ),
            ],
          ),
          Text(
            'Rs ${formatMoney(total)}',
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
