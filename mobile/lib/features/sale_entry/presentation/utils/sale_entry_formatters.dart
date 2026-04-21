String formatMoney(double value) {
  final fixed = value.toStringAsFixed(2);
  final parts = fixed.split('.');
  final whole = parts[0];

  if (whole.length <= 3) {
    return fixed;
  }

  final last3 = whole.substring(whole.length - 3);
  var rest = whole.substring(0, whole.length - 3);
  final groups = <String>[];

  while (rest.isNotEmpty) {
    final start = rest.length > 2 ? rest.length - 2 : 0;
    groups.insert(0, rest.substring(start));
    rest = rest.substring(0, start);
  }

  return '${groups.join(',')},$last3.${parts[1]}';
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
