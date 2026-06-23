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

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'area': area,
      'email': email,
      'isRecent': isRecent,
      'lastSeenLabel': lastSeenLabel,
    };
  }

  factory CustomerRecord.fromJson(Map<String, dynamic> json) {
    return CustomerRecord(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      phone: json['phone']?.toString() ?? '',
      area: json['area']?.toString() ?? '',
      email: json['email']?.toString(),
      isRecent: json['isRecent'] == true,
      lastSeenLabel: json['lastSeenLabel']?.toString(),
    );
  }
}
