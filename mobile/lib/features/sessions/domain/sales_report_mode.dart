enum SalesReportMode {
  itemWise,
  supplierWise,
  categoryWise,
  karatWise,
  wastageWise,
}

extension SalesReportModeLabel on SalesReportMode {
  String get label => switch (this) {
        SalesReportMode.itemWise => 'Item-wise',
        SalesReportMode.supplierWise => 'Supplier-wise',
        SalesReportMode.categoryWise => 'Category-wise',
        SalesReportMode.karatWise => 'Karat-wise',
        SalesReportMode.wastageWise => 'Wastage-wise',
      };

  String get shortLabel => switch (this) {
        SalesReportMode.itemWise => 'Item',
        SalesReportMode.supplierWise => 'Supplier',
        SalesReportMode.categoryWise => 'Category',
        SalesReportMode.karatWise => 'Karat',
        SalesReportMode.wastageWise => 'Wastage',
      };
}
