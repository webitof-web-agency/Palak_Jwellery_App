import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class SaleEntryAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SaleEntryAppBar({
    super.key,
    required this.isLoading,
    required this.onReset,
    required this.onBack,
    this.title = 'New Sale',
  });

  final bool isLoading;
  final VoidCallback onReset;
  final VoidCallback onBack;
  final String title;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded),
        onPressed: onBack,
      ),
      actions: [
        OutlinedButton.icon(
          onPressed: isLoading ? null : onReset,
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.accent,
            side: BorderSide(color: AppColors.accent.withValues(alpha: 0.45)),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            minimumSize: const Size(0, 40),
            tapTargetSize: MaterialTapTargetSize.padded,
          ),
          icon: Icon(
            Icons.restart_alt_rounded,
            size: 18,
            color: AppColors.accent,
          ),
          label: Text(
            'Restore scan',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: AppColors.accent,
            ),
          ),
        ),
      ],
    );
  }
}
