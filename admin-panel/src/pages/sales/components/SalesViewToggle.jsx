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

export default function SalesViewToggle({ activeView, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl surface-panel-faint panel-border p-2">
      <ToggleButton
        active={activeView === 'session'}
        onClick={() => onChange('session')}
        ariaLabel="Switch to session view"
      >
        Session View
      </ToggleButton>
      <ToggleButton
        active={activeView === 'batch'}
        onClick={() => onChange('batch')}
        ariaLabel="Switch to batch view"
      >
        Batch View
      </ToggleButton>
      <ToggleButton
        active={activeView === 'item'}
        onClick={() => onChange('item')}
        ariaLabel="Switch to item view"
      >
        Item View
      </ToggleButton>
    </div>
  )
}
