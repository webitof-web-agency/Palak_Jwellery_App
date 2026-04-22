import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../data/sale_repository.dart';
import '../../../shared/theme/app_theme.dart';
import '../../../shared/widgets/app_logo.dart';

class SaleSuccessScreen extends ConsumerWidget {
  const SaleSuccessScreen({
    super.key,
    required this.sale,
  });

  final CreatedSale sale;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(themeControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const AppLogo(size: 56),
              const SizedBox(height: 20),
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.successSoft,
                  border: Border.all(
                    color: AppColors.success.withValues(alpha: 0.6),
                    width: 2,
                  ),
                ),
                child: Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 44,
                ),
              ),
              const SizedBox(height: 28),
              Text(
                'Sale Recorded!',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.5,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Weight entry saved successfully',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                sale.ref,
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 13,
                  color: AppColors.textFaint,
                  letterSpacing: 2,
                ),
              ),
              if (sale.isDuplicate) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.warningSoft,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: AppColors.warningSoft,
                      width: 1,
                    ),
                  ),
                  child: Text(
                    'Saved as duplicate entry',
                    style: TextStyle(color: AppColors.warning, fontSize: 13),
                  ),
                ),
              ],
              const SizedBox(height: 48),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: () => context.go('/dashboard'),
                  child: const Text('Back to Dashboard'),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.go('/scanner'),
                child: const Text('Scan Another'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
