import EmptyState from "../../../components/ui/EmptyState";
import SectionCard from "../../../components/ui/SectionCard";
import TableSkeleton from "../../../components/ui/TableSkeleton";
import {
  formatCurrency,
  formatDateTime,
  formatPercentage,
  formatWeight,
} from "../../../utils/formatters";

export default function SettlementReportsTable({ rows, loading }) {
  return (
    <SectionCard className="!p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Metal</th>
              <th className="px-4 py-3">Design Code</th>
              <th className="px-5 py-3">Gross</th>
              <th className="px-4 py-3">Stone</th>
              <th className="px-4 py-3">Wastage</th>
              <th className="px-4 py-3">Net</th>
              <th className="px-4 py-3">Purity</th>
              <th className="px-4 py-3">Fine</th>
              <th className="px-4 py-3">Stone Amount</th>
              <th className="px-4 py-3 whitespace-nowrap">Recorded</th>
            </tr>
          </thead>

          {loading ? (
            <tbody>
              <tr>
                <td colSpan="12" className="px-5 py-6">
                  <TableSkeleton columns={12} rows={6} />
                </td>
              </tr>
            </tbody>
          ) : rows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan="12" className="px-5 py-6">
                  <EmptyState
                    title="No finalized settlement rows found"
                    description="Create or finalize a sale to populate this ledger. If you expected data, clear the filters or check whether the sale was saved."
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody className="divide-y divide-white/5">
              {rows.map((row) => {
                return (
                  <tr key={row.id} className="hover:bg-white/5">
                    <td className="px-4 py-3">
                      <div className="font-medium text-primary">
                        {row.supplier || "Unknown"}
                      </div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">
                        {row.display_ref || row.sequence || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {row.category || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {row.metal_type || "-"}
                    </td>
                    <td className="px-4 py-3 text-primary whitespace-nowrap font-mono text-sm">
                      {row.item_code || row.design_code || "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatWeight(row.gross_weight)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatWeight(row.stone_weight)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatPercentage(row.wastage_percent)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatWeight(row.net_weight)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatPercentage(row.purity_percent)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatWeight(row.fine_weight)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-primary">
                      {formatCurrency(row.stone_amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDateTime(row.sale_date || row.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </SectionCard>
  );
}
