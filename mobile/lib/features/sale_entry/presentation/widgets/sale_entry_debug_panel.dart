import 'package:flutter/material.dart';

import '../../data/sale_repository.dart';
import '../../../../shared/theme/app_theme.dart';
import '../utils/sale_entry_formatters.dart';

class QrDebugPanel extends StatelessWidget {
  const QrDebugPanel({
    super.key,
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
                  Icon(
                    Icons.bug_report_rounded,
                    color: AppColors.textFaint,
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Text(
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
                  Text(
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
                      parseResult.raw.isEmpty ? '(no QR scanned)' : parseResult.raw,
                      style: TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
                  if ((parseResult.itemCode.value ?? '').isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      'ITEM / DESIGN CODE',
                      style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1.2,
                        color: AppColors.textFaint,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      parseResult.itemCode.value!,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (parseResult.otherWeight.value != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      'OTHER WEIGHT',
                      style: TextStyle(
                        fontSize: 10,
                        letterSpacing: 1.2,
                        color: AppColors.textFaint,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      formatWeight(parseResult.otherWeight.value!),
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  if (parseResult.errors.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
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
                            Text(
                              '- ',
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
