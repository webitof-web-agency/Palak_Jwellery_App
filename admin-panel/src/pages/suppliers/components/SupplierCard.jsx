import React from 'react'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import { formatMappingValue, statusText } from '../suppliersPage.utils'

const IconPencil = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
    <path d="M15.5 4.5l4 4L7 21H3v-4L15.5 4.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M13 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
  </svg>
)

const IconX = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
)

const IconCreditCard = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M7 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
  </svg>
)

const IconCash = () => (
  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" aria-hidden="true">
    <rect x="2" y="7" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const MAPPING_LABELS = {
  grossWeight: 'Gross',
  stoneWeight: 'Stone',
  netWeight: 'Net',
  category: 'Category',
}

export default function SupplierCard({ supplier, onEdit, onDelete, deletingId }) {
  const isDeleting = deletingId === supplier._id
  const initial = (supplier.name || '?').charAt(0).toUpperCase()
  const isCredit = supplier.paymentMode?.toLowerCase() === 'credit'

  const mappingEntries = Object.entries(supplier.qrMapping?.fieldMap || {}).filter(
    ([key]) => key !== 'supplierCode' && MAPPING_LABELS[key],
  )

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 cursor-default
        surface-panel hover:border-gold-600/30 hover:shadow-lg
        ${supplier.isActive ? 'panel-border' : 'opacity-50 grayscale panel-border'}
      `}
    >
      {/* Left accent bar */}
      <div
        className={`absolute inset-y-0 left-0 w-[3px] rounded-l-2xl transition-all duration-200 group-hover:w-1 ${
          supplier.isActive ? 'bg-gradient-to-b from-gold-500 to-gold-700' : 'bg-white/10'
        }`}
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-5 pl-6 pr-5 py-5">

        {/* ── Avatar + Identity ── */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-600/20 to-gold-700/10 border border-gold-600/25 flex items-center justify-center shadow-inner">
              <span className="text-base font-black text-heading leading-none">{initial}</span>
            </div>
            {supplier.isActive && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--jsm-surface)]" />
            )}
          </div>

          {/* Name + meta */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="text-sm font-bold font-display text-primary">{supplier.name}</h3>
              <span
                className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border ${
                  supplier.isActive
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : 'bg-white/5 text-muted border-white/10'
                }`}
              >
                {statusText(supplier.isActive)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              {/* Code chip */}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono font-semibold text-muted">
                <span className="opacity-50">#</span>
                {supplier.code || '—'}
              </span>
              {/* Payment badge */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold uppercase border text-[9px] ${
                  isCredit
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                }`}
              >
                {isCredit ? <IconCreditCard /> : <IconCash />}
                {supplier.paymentMode || 'cash'}
              </span>
              {/* Categories */}
              {supplier.categories?.length ? (
                <span className="text-muted truncate max-w-[130px]">
                  {supplier.categories.join(', ')}
                </span>
              ) : (
                <span className="italic text-muted opacity-50">No categories</span>
              )}
            </div>
          </div>
        </div>

        {/* ── QR Mapping pills ── */}
        {mappingEntries.length > 0 ? (
          <div className="flex flex-wrap gap-2 sm:max-w-xs">
            {mappingEntries.map(([key, val]) => (
              <div
                key={key}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl
                  bg-gold-600/5 border border-gold-600/15 text-[9px]"
              >
                <span className="font-bold text-muted uppercase tracking-wider">
                  {MAPPING_LABELS[key]}
                </span>
                <span className="w-px h-3 bg-white/10 rounded-full" />
                <span className="font-bold text-gold-500">{formatMappingValue(val)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="hidden sm:flex items-center px-3 py-2 rounded-xl bg-white/3 border border-dashed border-white/10 text-[10px] text-muted italic sm:max-w-xs">
            No QR mapping
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-auto sm:ml-0">
          <button
            type="button"
            onClick={() => onEdit(supplier)}
            aria-label={`Edit ${supplier.name}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold
              bg-gold-600/10 border border-gold-600/20 text-heading
              hover:bg-gold-600/20 hover:border-gold-600/35 transition-all duration-150"
          >
            <IconPencil /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(supplier)}
            disabled={isDeleting}
            aria-label={`Delete ${supplier.name}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
              text-red-500 border border-transparent
              hover:bg-red-500/10 hover:border-red-500/20 transition-all duration-150
              disabled:opacity-50 disabled:pointer-events-none"
          >
            {isDeleting ? (
              <>  
              <LoadingSpinner />
              <span>Deleting…</span>
            </>
          ) : (
            <><IconX /> Delete</>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}
