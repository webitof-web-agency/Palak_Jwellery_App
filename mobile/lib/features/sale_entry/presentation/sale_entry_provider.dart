import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/sale_repository.dart';

final suppliersProvider = FutureProvider<List<SupplierModel>>((ref) {
  return ref.watch(saleRepositoryProvider).getSuppliers();
});

final businessOverviewProvider = FutureProvider<BusinessOverview>((ref) {
  return ref.watch(saleRepositoryProvider).getBusinessOverview();
});

final karatOptionsProvider = FutureProvider<List<KaratOption>>((ref) {
  return ref.watch(saleRepositoryProvider).getKaratOptions();
});


