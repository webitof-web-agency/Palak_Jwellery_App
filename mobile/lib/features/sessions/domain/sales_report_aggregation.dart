import 'scan_session_draft.dart';
import 'scan_session_summary.dart';
import 'sales_report_mode.dart';

class SalesReportGroup {
  const SalesReportGroup({
    required this.groupLabel,
    required this.detailLabel,
    required this.items,
    required this.itemCount,
    required this.grossWeight,
    required this.stoneWeight,
    required this.otherWeight,
    required this.netWeight,
    required this.fineWeight,
    required this.stoneAmount,
    required this.otherAmount,
  });

  final String groupLabel;
  final String detailLabel;
  final List<ScannedSessionItem> items;
  final int itemCount;
  final double grossWeight;
  final double stoneWeight;
  final double otherWeight;
  final double netWeight;
  final double fineWeight;
  final double stoneAmount;
  final double otherAmount;
}

String buildSalesReportGroupLabel(ScannedSessionItem item) {
  final supplier = item.supplier.trim();
  final category = (item.category ?? '').trim();
  final jewelType = (item.jewelType ?? '').trim();

  final categoryParts = <String>[
    if (category.isNotEmpty) category,
    if (jewelType.isNotEmpty) jewelType,
  ];

  if (supplier.isNotEmpty && categoryParts.isNotEmpty) {
    return '$supplier - ${categoryParts.join(' / ')}';
  }

  if (supplier.isNotEmpty) {
    return supplier;
  }

  if (categoryParts.isNotEmpty) {
    return categoryParts.join(' / ');
  }

  return 'Uncategorized';
}

String buildSalesReportSupplierCategoryLabel(ScannedSessionItem item) {
  final supplier = item.supplier.trim();
  final category = (item.category ?? '').trim();
  final jewelType = (item.jewelType ?? '').trim();

  final categoryParts = <String>[
    if (category.isNotEmpty) category,
    if (jewelType.isNotEmpty) jewelType,
  ];

  if (supplier.isNotEmpty && categoryParts.isNotEmpty) {
    return '$supplier - ${categoryParts.join(' / ')}';
  }

  if (supplier.isNotEmpty) {
    return supplier;
  }

  return '-';
}

String buildSalesReportGroupKey(ScannedSessionItem item, SalesReportMode mode) {
  switch (mode) {
    case SalesReportMode.itemWise:
      return item.itemCode.trim().isEmpty ? 'Unknown item' : item.itemCode.trim();
    case SalesReportMode.supplierWise:
      return item.supplier.trim().isEmpty ? 'Unknown supplier' : item.supplier.trim();
    case SalesReportMode.categoryWise:
      final supplier = item.supplier.trim();
      final category = (item.category ?? '').trim();
      final jewelType = (item.jewelType ?? '').trim();

      final categoryParts = <String>[
        if (category.isNotEmpty) category,
        if (jewelType.isNotEmpty) jewelType,
      ];

      if (supplier.isNotEmpty && categoryParts.isNotEmpty) {
        return '$supplier - ${categoryParts.join(' / ')}';
      }

      if (supplier.isNotEmpty) {
        return supplier;
      }

      if (categoryParts.isNotEmpty) {
        return categoryParts.join(' / ');
      }

      return 'Uncategorized';
    case SalesReportMode.karatWise:
      return item.karat.trim().isEmpty ? 'Unknown karat' : item.karat.trim();
    case SalesReportMode.wastageWise:
      return '${item.wastagePercent.toStringAsFixed(2)}%';
  }
}

String buildSalesReportGroupDetail(
  SalesReportGroup group,
  SalesReportMode mode,
) {
  final first = group.items.first;
  switch (mode) {
    case SalesReportMode.itemWise:
      final parts = <String>[
        if (first.supplier.trim().isNotEmpty) first.supplier.trim(),
        if ((first.category ?? '').trim().isNotEmpty) first.category!.trim(),
        if ((first.jewelType ?? '').trim().isNotEmpty) first.jewelType!.trim(),
      ];
      return parts.isEmpty ? first.itemCode : parts.join(' | ');
    case SalesReportMode.supplierWise:
      return group.itemCount == 1
          ? first.itemCode
          : '${first.itemCode} + ${group.itemCount - 1} more';
    case SalesReportMode.categoryWise:
      final codes = group.items.take(2).map((item) => item.itemCode).toList(growable: false);
      return codes.isEmpty ? group.groupLabel : codes.join(', ');
    case SalesReportMode.karatWise:
    case SalesReportMode.wastageWise:
      return group.itemCount == 1 ? first.itemCode : '${group.itemCount} items';
  }
}

List<SalesReportGroup> buildSalesReportGroups(
  ScanSessionSummary summary,
  SalesReportMode mode,
) {
  final items = summary.items;

  if (mode == SalesReportMode.itemWise) {
    return items.asMap().entries.map((entry) {
      final index = entry.key;
      final item = entry.value;
      return SalesReportGroup(
        groupLabel: '#${index + 1}',
        detailLabel: buildSalesReportGroupLabel(item),
        items: <ScannedSessionItem>[item],
        itemCount: 1,
        grossWeight: item.grossWeight,
        stoneWeight: item.stoneWeight,
        otherWeight: item.otherWeight,
        netWeight: item.netWeight,
        fineWeight: item.fineWeight,
        stoneAmount: item.totalStoneAmount ?? item.stoneAmount ?? 0,
        otherAmount: item.otherAmount ?? 0,
      );
    }).toList(growable: false);
  }

  String groupKeyForItem(ScannedSessionItem item) {
    return buildSalesReportGroupKey(item, mode);
  }

  String detailForGroup(String key, List<ScannedSessionItem> groupItems) {
    final first = groupItems.first;
    final group = SalesReportGroup(
      groupLabel: key,
      detailLabel: '',
      items: groupItems,
      itemCount: groupItems.length,
      grossWeight: first.grossWeight,
      stoneWeight: first.stoneWeight,
      otherWeight: first.otherWeight,
      netWeight: first.netWeight,
      fineWeight: first.fineWeight,
      stoneAmount: first.totalStoneAmount ?? first.stoneAmount ?? 0,
      otherAmount: first.otherAmount ?? 0,
    );
    return buildSalesReportGroupDetail(group, mode);
  }

  final grouped = <String, List<ScannedSessionItem>>{};
  for (final item in items) {
    grouped.putIfAbsent(groupKeyForItem(item), () => <ScannedSessionItem>[]).add(item);
  }

  final entries = grouped.entries.toList(growable: false)
    ..sort((a, b) => a.key.toLowerCase().compareTo(b.key.toLowerCase()));

  return entries.map((entry) {
    final groupItems = List<ScannedSessionItem>.unmodifiable(entry.value);
    return SalesReportGroup(
      groupLabel: entry.key,
      detailLabel: detailForGroup(entry.key, groupItems),
      items: groupItems,
      itemCount: groupItems.length,
      grossWeight: groupItems.fold(0.0, (sum, item) => sum + item.grossWeight),
      stoneWeight: groupItems.fold(0.0, (sum, item) => sum + item.stoneWeight),
      otherWeight: groupItems.fold(0.0, (sum, item) => sum + item.otherWeight),
      netWeight: groupItems.fold(0.0, (sum, item) => sum + item.netWeight),
      fineWeight: groupItems.fold(0.0, (sum, item) => sum + item.fineWeight),
      stoneAmount: groupItems.fold(
        0.0,
        (sum, item) => sum + (item.totalStoneAmount ?? item.stoneAmount ?? 0),
      ),
      otherAmount: groupItems.fold(0.0, (sum, item) => sum + (item.otherAmount ?? 0)),
    );
  }).toList(growable: false);
}
