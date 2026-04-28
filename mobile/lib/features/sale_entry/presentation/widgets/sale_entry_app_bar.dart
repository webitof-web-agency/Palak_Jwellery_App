import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

class SaleEntryAppBar extends StatelessWidget implements PreferredSizeWidget {
  const SaleEntryAppBar({
    super.key,
    required this.isLoading,
    required this.onReset,
    required this.onSave,
    required this.onBack,
  });

  final bool isLoading;
  final VoidCallback onReset;
  final VoidCallback onSave;
  final VoidCallback onBack;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: const Text('New Sale'),
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded),
        onPressed: onBack,
      ),
      actions: [
        TextButton(
          onPressed: isLoading ? null : onReset,
          style: TextButton.styleFrom(
            foregroundColor: AppColors.accent,
            padding: EdgeInsets.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
          child: Container(
            margin: const EdgeInsets.only(right: 8, top: 2, bottom: 2),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(color: AppColors.accent, width: 1.4),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.restart_alt_rounded,
                  size: 16,
                  color: AppColors.accent,
                ),
                const SizedBox(width: 4),
                Text(
                  'Reset',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: AppColors.accent,
                  ),
                ),
              ],
            ),
          ),
        ),
        TextButton(
          onPressed: isLoading ? null : onSave,
          child: Text(
            'Save',
            style: TextStyle(
              color: AppColors.accent,
              fontWeight: FontWeight.w600,
              fontSize: 16,
            ),
          ),
        ),
      ],
    );
  }
}
