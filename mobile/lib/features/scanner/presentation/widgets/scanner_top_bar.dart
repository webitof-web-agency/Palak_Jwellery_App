import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class ScannerTopBar extends StatelessWidget {
  const ScannerTopBar({
    super.key,
    required this.onBack,
    required this.onToggleTorch,
    required this.torchOn,
  });

  final VoidCallback onBack;
  final Future<void> Function() onToggleTorch;
  final bool torchOn;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      child: Row(
        children: [
          IconButton(
            onPressed: onBack,
            icon: Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.textPrimary),
            tooltip: 'Back',
          ),
          const Spacer(),
          IconButton(
            onPressed: () async {
              await onToggleTorch();
            },
            icon: Icon(
              torchOn ? Icons.flash_on_rounded : Icons.flash_off_rounded,
              color: torchOn ? AppColors.accent : AppColors.textPrimary,
            ),
            tooltip: 'Toggle torch',
          ),
        ],
      ),
    );
  }
}
