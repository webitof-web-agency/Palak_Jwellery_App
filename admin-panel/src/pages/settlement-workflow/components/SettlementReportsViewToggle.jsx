const ToggleButton = ({ active, children, onClick, ariaLabel }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    aria-label={ariaLabel}
    className={`inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] ${
      active
        ? 'surface-panel-soft panel-border text-heading shadow-sm'
        : 'border border-transparent bg-transparent text-muted hover:text-heading hover:bg-gold-500/10'
    }`}
  >
    {children}
  </button>
)

export default function SettlementReportsViewToggle({ activeScope, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl surface-panel-faint panel-border p-2">
      <ToggleButton
        active={activeScope === 'session'}
        onClick={() => onChange('session')}
        ariaLabel="Switch to session reports"
      >
        Session Reports
      </ToggleButton>
      <ToggleButton
        active={activeScope === 'supplier-section'}
        onClick={() => onChange('supplier-section')}
        ariaLabel="Switch to supplier section reports"
      >
        Supplier Section Reports
      </ToggleButton>
      <ToggleButton
        active={activeScope === 'item-ledger'}
        onClick={() => onChange('item-ledger')}
        ariaLabel="Switch to item ledger"
      >
        Item Ledger
      </ToggleButton>
    </div>
  )
}
