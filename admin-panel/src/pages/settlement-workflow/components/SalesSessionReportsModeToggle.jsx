const MODES = [
  { value: 'session', label: 'Session-wise', ariaLabel: 'Switch to session-wise reports' },
  { value: 'supplier', label: 'Supplier-wise', ariaLabel: 'Switch to supplier-wise reports' },
  { value: 'category', label: 'Category-wise', ariaLabel: 'Switch to category-wise reports' },
  { value: 'karat', label: 'Karat-wise', ariaLabel: 'Switch to karat-wise reports' },
  { value: 'wastage', label: 'Wastage-wise', ariaLabel: 'Switch to wastage-wise reports' },
]

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

export default function SalesSessionReportsModeToggle({ activeMode = 'session', onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-2 rounded-2xl surface-panel-faint panel-border p-2">
      {MODES.map((mode) => (
        <ToggleButton
          key={mode.value}
          active={activeMode === mode.value}
          onClick={() => onChange?.(mode.value)}
          ariaLabel={mode.ariaLabel}
        >
          {mode.label}
        </ToggleButton>
      ))}
    </div>
  )
}
