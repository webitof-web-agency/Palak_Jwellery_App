class CustomerRecord {
  const CustomerRecord({
    required this.id,
    required this.name,
    required this.phone,
    required this.area,
    this.email,
    this.isRecent = false,
    this.lastSeenLabel,
    this.lastSessionAt,
  });

  final String id;
  final String name;
  final String phone;
  final String area;
  final String? email;
  final bool isRecent;
  final String? lastSeenLabel;
  final DateTime? lastSessionAt;

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'area': area,
      'email': email,
      'isRecent': isRecent,
      'lastSeenLabel': lastSeenLabel,
      'lastSessionAt': lastSessionAt?.toIso8601String(),
    };
  }

  factory CustomerRecord.fromJson(Map<String, dynamic> json) {
    DateTime? lastSessionAt;
    final rawDate = json['lastSessionAt'];
    if (rawDate != null) {
      lastSessionAt = DateTime.tryParse(rawDate.toString());
    }
    return CustomerRecord(
      id: (json['_id'] ?? json['id'])?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      email: json['email']?.toString(),
      isRecent: json['isRecent'] == true || (json['sessionCount'] != null && json['sessionCount'] > 0),
      lastSeenLabel: json['lastSeenLabel']?.toString(),
      lastSessionAt: lastSessionAt,
    );
  }
}
