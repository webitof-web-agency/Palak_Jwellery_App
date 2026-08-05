import 'dart:math';

class BullionSaleEntry {
  const BullionSaleEntry({
    required this.clientEntryId,
    this.customerId,
    this.customerName,
    this.customerPhone,
    required this.weightGrams,
    required this.inputUnit,
    required this.ratePerGram,
    required this.goldPurity,
    required this.transactionType,
    this.notes = '',
  });

  final String clientEntryId;
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final double weightGrams;
  final String inputUnit;
  final double ratePerGram;
  final String goldPurity;
  final String transactionType;
  final String notes;

  double get totalAmount => weightGrams * ratePerGram;

  Map<String, dynamic> toJson() {
    final payload = <String, dynamic>{
      'clientEntryId': clientEntryId,
      'weightGrams': weightGrams,
      'inputUnit': inputUnit,
      'ratePerGram': ratePerGram,
      'totalAmount': totalAmount,
      'goldPurity': goldPurity,
      'transactionType': transactionType,
      'notes': notes,
    };

    if (customerId != null && customerId!.isNotEmpty) {
      payload['customerId'] = customerId;
    }
    if (customerName != null && customerName!.isNotEmpty) {
      payload['customerName'] = customerName;
    }
    if (customerPhone != null && customerPhone!.isNotEmpty) {
      payload['customerPhone'] = customerPhone;
    }

    return payload;
  }

  BullionSaleEntry copyWith({
    String? clientEntryId,
    String? customerId,
    String? customerName,
    String? customerPhone,
    double? weightGrams,
    String? inputUnit,
    double? ratePerGram,
    String? goldPurity,
    String? transactionType,
    String? notes,
  }) {
    return BullionSaleEntry(
      clientEntryId: clientEntryId ?? this.clientEntryId,
      customerId: customerId ?? this.customerId,
      customerName: customerName ?? this.customerName,
      customerPhone: customerPhone ?? this.customerPhone,
      weightGrams: weightGrams ?? this.weightGrams,
      inputUnit: inputUnit ?? this.inputUnit,
      ratePerGram: ratePerGram ?? this.ratePerGram,
      goldPurity: goldPurity ?? this.goldPurity,
      transactionType: transactionType ?? this.transactionType,
      notes: notes ?? this.notes,
    );
  }

  static String generateClientEntryId() {
    final random = Random();
    final bytes = List<int>.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    String twoDigits(int value) => value.toRadixString(16).padLeft(2, '0');
    final hex = bytes.map(twoDigits).join();
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      hex.substring(12, 16),
      hex.substring(16, 20),
      hex.substring(20, 32),
    ].join('-');
  }
}
