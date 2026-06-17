class CustomerRecord {
  const CustomerRecord({
    required this.id,
    required this.name,
    required this.phone,
    required this.area,
    this.email,
    this.isRecent = false,
    this.lastSeenLabel,
  });

  final String id;
  final String name;
  final String phone;
  final String area;
  final String? email;
  final bool isRecent;
  final String? lastSeenLabel;
}
