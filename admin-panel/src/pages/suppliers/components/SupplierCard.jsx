import React from 'react'
import { formatMappingValue, statusText } from '../suppliersPage.utils'

const mappingTitle = (key) => {
  if (key === 'supplierCode') return 'Supplier code'
  if (key === 'grossWeight') return 'Gross weight'
  if (key === 'stoneWeight') return 'Stone weight'
  if (key === 'netWeight') return 'Net weight'
  if (key === 'category') return 'Category'
  return key
}

export default function SupplierCard({
  supplier,
  onEdit,
  onDelete,
  deletingId,
}) {
  return (
    <article
      className={`p-6 surface-panel panel-border rounded-2xl premium-shadow hover:border-gold-600/30 transition-all group ${
        supplier.isActive ? '' : 'opacity-60 grayscale'
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="eyebrow">Supplier</span>
          <h3 className="text-xl font-bold font-display text-heading">
            {supplier.name}
          </h3>
        </div>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
            supplier.isActive
              ? 'bg-green-500/10 text-green-500'
              : 'bg-white/5 text-muted'
          }`}
        >
          {statusText(supplier.isActive)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="surface-panel-soft p-3 rounded-xl panel-border">
          <div className="text-[10px] uppercase text-muted font-bold mb-1">
            Code
          </div>
          <div className="text-primary font-mono">{supplier.code || '-'}</div>
        </div>
        <div className="surface-panel-soft p-3 rounded-xl panel-border">
          <div className="text-[10px] uppercase text-muted font-bold mb-1">
            Payment
          </div>
          <div className="text-primary font-mono capitalize">
            {supplier.paymentMode || 'cash'}
          </div>
        </div>
      </div>

      <div className="space-y-4 mb-8">
        <div>
          <div className="text-[10px] uppercase text-muted font-bold mb-1">
            Categories
          </div>
          <div className="text-xs text-muted line-clamp-2 italic">
            {supplier.categories?.length
              ? supplier.categories.join(', ')
              : 'None configured'}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 pt-4 border-t panel-border">
          {Object.entries(supplier.qrMapping?.fieldMap || {})
            .filter(([key]) => key !== 'supplierCode')
            .map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-[8px] uppercase text-muted font-bold mb-1">
                  {mappingTitle(key)}
                </div>
                <div className="text-xs font-bold text-gold-500">
                  {formatMappingValue(val)}
                </div>
              </div>
            ))}
        </div>
      </div>

      <div className="flex gap-2 pt-4 border-t panel-border">
        <button
          type="button"
          className="flex-1 py-2 text-xs font-bold rounded-xl transition-all border border-gold-500/20 bg-gold-500/10 text-heading hover:bg-gold-500/15"
          onClick={() => onEdit(supplier)}
          aria-label={`Edit supplier ${supplier.name}`}
        >
          Edit profile
        </button>
        <button
          type="button"
          className="px-4 py-2 text-xs font-bold text-red-500 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
          onClick={() => onDelete(supplier)}
          disabled={deletingId === supplier._id}
          aria-label={`Delete supplier ${supplier.name}`}
        >
          {deletingId === supplier._id ? '...' : 'Delete'}
        </button>
      </div>
    </article>
  )
}
