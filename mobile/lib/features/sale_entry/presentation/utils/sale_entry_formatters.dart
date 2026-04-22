String formatWeight(double value) {
  return '${value.toStringAsFixed(3).replaceFirst(RegExp(r'\.?0+$'), '')} g';
}

String formatDateTime(DateTime date) {
  const months = <String>[
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  final local = date.toLocal();
  final hour = local.hour == 0
      ? 12
      : local.hour > 12
          ? local.hour - 12
          : local.hour;
  final minute = local.minute.toString().padLeft(2, '0');
  final suffix = local.hour >= 12 ? 'PM' : 'AM';

  return '${local.day} ${months[local.month - 1]} ${local.year}, $hour:$minute $suffix';
}
