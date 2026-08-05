class BullionSale {
  const BullionSale({
    required this.id,
    required this.ref,
    required this.customerId,
    required this.customerName,
    required this.customerPhone,
    required this.customerArea,
    required this.salesmanId,
    required this.salesmanName,
    required this.weightGrams,
    required this.ratePerGram,
    required this.totalAmount,
    required this.transactionType,
    required this.goldPurity,
    required this.notes,
    required this.createdAt,
  });

  final String id;
  final String ref;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerArea;
  final String salesmanId;
  final String salesmanName;
  final double weightGrams;
  final double ratePerGram;
  final double totalAmount;
  final String transactionType;
  final String goldPurity;
  final String? notes;
  final DateTime createdAt;

  bool get isSale => transactionType == 'sale';
  bool get isReturn => transactionType == 'return';

  factory BullionSale.fromJson(Map<String, dynamic> json) {
    final customerObj = json['customer'];
    String customerId = '';
    String customerName = '';
    String customerPhone = '';
    String customerArea = '';

    if (customerObj is Map<String, dynamic>) {
      customerId = customerObj['id']?.toString() ?? customerObj['_id']?.toString() ?? '';
      customerName = customerObj['name']?.toString() ?? '';
      customerPhone = customerObj['phone']?.toString() ?? '';
      customerArea = customerObj['area']?.toString() ?? '';
    } else {
      customerId = json['customerId']?.toString() ?? '';
      customerName = json['customerName']?.toString() ?? '';
      customerPhone = json['customerPhone']?.toString() ?? '';
      customerArea = json['customerArea']?.toString() ?? '';
    }

    final salesmanObj = json['salesman'];
    String salesmanId = '';
    String salesmanName = '';
    if (salesmanObj is Map<String, dynamic>) {
      salesmanId = salesmanObj['id']?.toString() ?? salesmanObj['_id']?.toString() ?? '';
      salesmanName = salesmanObj['name']?.toString() ?? '';
    } else {
      salesmanId = json['salesmanId']?.toString() ?? '';
      salesmanName = json['salesmanName']?.toString() ?? '';
    }

    return BullionSale(
      id: json['id']?.toString() ?? json['_id']?.toString() ?? '',
      ref: json['ref']?.toString() ?? '',
      customerId: customerId,
      customerName: customerName,
      customerPhone: customerPhone,
      customerArea: customerArea,
      salesmanId: salesmanId,
      salesmanName: salesmanName,
      weightGrams: (json['weightGrams'] as num?)?.toDouble() ?? 0.0,
      ratePerGram: (json['ratePerGram'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      transactionType: json['transactionType']?.toString() ?? 'sale',
      goldPurity: json['goldPurity']?.toString() ?? '',
      notes: json['notes']?.toString(),
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
    );
  }
}

class BullionSalesPage {
  const BullionSalesPage({
    required this.sales,
    required this.total,
    required this.page,
    required this.pages,
  });

  final List<BullionSale> sales;
  final int total;
  final int page;
  final int pages;

  factory BullionSalesPage.fromJson(Map<String, dynamic> json) {
    final dynamic listData = json['sales'];
    final List<dynamic> rawList = listData is List ? listData : [];
    return BullionSalesPage(
      sales: rawList
          .whereType<Map<String, dynamic>>()
          .map(BullionSale.fromJson)
          .toList(growable: false),
      total: (json['total'] as num?)?.toInt() ?? 0,
      page: (json['page'] as num?)?.toInt() ?? 1,
      pages: (json['pages'] as num?)?.toInt() ?? 1,
    );
  }
}
