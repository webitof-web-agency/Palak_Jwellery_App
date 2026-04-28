import React from 'react'
import SectionCard from '../../../components/ui/SectionCard'

export default function SupplierOverview({
  totalSuppliers,
  onAddSupplier,
}) {
  return (
    <SectionCard className="xl:col-span-4">
      <div className="space-y-6">
        <div>
          <span className="eyebrow">Supplier Setup</span>
          <h2 className="text-xl font-bold font-display text-heading">
            Create or edit supplier profiles
          </h2>
          <p className="mt-2 text-muted text-sm">
            Use the dedicated supplier form page to add a supplier, set settlement mode, and configure QR mappings without crowding the list.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase text-muted font-bold mb-1">
              Total Suppliers
            </div>
            <div className="text-2xl font-bold text-heading">
              {totalSuppliers}
            </div>
          </div>
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase text-muted font-bold mb-1">
              Settlement
            </div>
            <div className="text-2xl font-bold text-heading">
              Cash / Credit
            </div>
          </div>
        </div>

        <button
          type="button"
          className="primary-luxury-button w-full text-on-accent"
          onClick={onAddSupplier}
          aria-label="Add supplier from overview"
        >
          Add Supplier
        </button>

        <ul className="space-y-3 text-sm text-muted leading-relaxed">
          <li>• Edit suppliers from the card actions on the right.</li>
          <li>• Credit settlement is available for supplier accounts.</li>
          <li>• Legacy delimiter mappings remain supported.</li>
        </ul>
      </div>
    </SectionCard>
  )
}
