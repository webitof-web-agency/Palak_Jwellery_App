import 'package:flutter/material.dart';

import '../../../../shared/theme/app_theme.dart';

String formatBatchDate(DateTime? value) {
  if (value == null) {
    return '—';
  }

  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final year = date.year.toString();
  return '$day/$month/$year';
}

String formatBatchDateTime(DateTime? value) {
  if (value == null) {
    return '—';
  }

  final date = value.toLocal();
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  final year = date.year.toString();
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '$day/$month/$year $hour:$minute';
}

String formatBatchWeight(num? value) {
  if (value == null) {
    return '—';
  }

  return '${value.toDouble().toStringAsFixed(3)} g';
}

String formatBatchAmount(num? value) {
  if (value == null) {
    return '—';
  }

  return '₹${value.toDouble().toStringAsFixed(2)}';
}

String formatBatchText(String? value, {String fallback = '—'}) {
  final text = value?.trim();
  return (text == null || text.isEmpty) ? fallback : text;
}

class BatchSectionCard extends StatelessWidget {
  const BatchSectionCard({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.trailing,
    this.padding = const EdgeInsets.all(16),
  });

  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final isCompact = trailing != null && constraints.maxWidth < 420;
              final heading = Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title.toUpperCase(),
                    style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                    ),
                  ),
                  if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      subtitle!,
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ],
              );

              if (trailing == null) {
                return heading;
              }

              if (isCompact) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    heading,
                    const SizedBox(height: 12),
                    Align(alignment: Alignment.centerLeft, child: trailing!),
                  ],
                );
              }

              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: heading),
                  const SizedBox(width: 12),
                  trailing!,
                ],
              );
            },
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class BatchMetricCard extends StatelessWidget {
  const BatchMetricCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
  });

  final String label;
  final String value;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
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
            children: [
              if (icon != null) ...[
                Icon(icon, size: 16, color: AppColors.accent),
                const SizedBox(width: 6),
              ],
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class BatchStatusPill extends StatelessWidget {
  const BatchStatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toLowerCase();
    final config = switch (normalized) {
      'draft' => (
        background: AppColors.surfaceAlt,
        foreground: AppColors.textSecondary,
        label: 'Draft',
      ),
      'open' => (
        background: AppColors.accent.withValues(alpha: 0.12),
        foreground: AppColors.accent,
        label: 'Open',
      ),
      'submitted' => (
        background: AppColors.warningSoft,
        foreground: AppColors.warning,
        label: 'Submitted',
      ),
      'finalized' => (
        background: AppColors.successSoft,
        foreground: AppColors.success,
        label: 'Finalized',
      ),
      'reopened' => (
        background: AppColors.accentSoft.withValues(alpha: 0.5),
        foreground: AppColors.accent,
        label: 'Reopened',
      ),
      'cancelled' => (
        background: AppColors.dangerSoft,
        foreground: AppColors.danger,
        label: 'Cancelled',
      ),
      _ => (
        background: AppColors.surfaceAlt,
        foreground: AppColors.textSecondary,
        label: status.isEmpty ? 'Unknown' : status,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: config.background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: config.foreground.withValues(alpha: 0.2)),
      ),
      child: Text(
        config.label,
        style: TextStyle(
          color: config.foreground,
          fontSize: 11,
          fontWeight: FontWeight.w800,
          letterSpacing: 0.7,
        ),
      ),
    );
  }
}

class BatchEmptyState extends StatelessWidget {
  const BatchEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });

  final IconData icon;
  final String title;
  final String message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppColors.border),
            ),
            child: Icon(icon, color: AppColors.accent, size: 26),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary, height: 1.5),
          ),
          if (action != null) ...[const SizedBox(height: 14), action!],
        ],
      ),
    );
  }
}
