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

/// These three providers fetch once and cache for the app's lifetime, so an
/// admin-panel change to suppliers (incl. their karat/wastage overrides) or
/// to global Business Settings never reaches an already-running app on its
/// own. Call this wherever the app already does a sync/refresh pass so
/// business config rides along on the same cadence.
void refreshBusinessConfig(WidgetRef ref) {
  ref.invalidate(suppliersProvider);
  ref.invalidate(businessOverviewProvider);
  ref.invalidate(karatOptionsProvider);
}
