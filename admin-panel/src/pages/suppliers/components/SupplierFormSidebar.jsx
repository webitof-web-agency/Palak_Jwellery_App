import SectionCard from '../../../components/ui/SectionCard'

const isDefined = (value) => value !== null && value !== undefined && value !== ''

const matchesDefaultFieldMap = (fieldMap = {}, defaults = {}) =>
  Object.keys(defaults).every((key) => String(fieldMap?.[key] ?? '') === String(defaults[key]))

const StatPill = ({ label, value }) => (
  <div className="rounded-2xl surface-panel-soft panel-border px-4 py-3">
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">{label}</div>
    <div className="mt-1 text-sm font-semibold text-heading break-words">{value}</div>
  </div>
)

const ChecklistItem = ({ done, label }) => (
  <div
    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors ${
      done
        ? 'border-gold-500/30 bg-gold-500/10 text-heading'
        : 'surface-panel-soft panel-border text-muted'
    }`}
  >
    {done ? '✓' : '•'} {label}
  </div>
)

export default function SupplierFormSidebar({ form, defaultFieldMap }) {
  const structuredCategories = Array.isArray(form.businessSettings?.categories)
    ? form.businessSettings.categories.filter((item) => isDefined(item?.name))
    : []
  const purityOverrides = Array.isArray(form.businessSettings?.purityOverrides)
    ? form.businessSettings.purityOverrides.filter((item) => isDefined(item?.karat))
    : []
  const hasQrProfile = Boolean(
    isDefined(form.qrProfile?.profileKey) ||
      isDefined(form.qrProfile?.version) ||
      isDefined(form.qrProfile?.description),
  )
  const hasAdvancedSettings =
    form.strategy !== 'delimiter' ||
    form.detectionType !== 'contains' ||
    isDefined(form.detectionPattern) ||
    form.delimiter !== '|' ||
    !matchesDefaultFieldMap(form.fieldMap, defaultFieldMap)

  const checklist = [
    {
      label: 'Basic info complete',
      done: isDefined(form.name) && isDefined(form.code),
    },
    {
      label: 'Categories & wastage set',
      done:
        structuredCategories.length > 0 ||
        isDefined(form.businessSettings?.defaultWastagePercent) ||
        (Array.isArray(form.categories) && form.categories.length > 0),
    },
    {
      label: 'Karat & purity set',
      done: purityOverrides.length > 0,
    },
    {
      label: 'QR profile ready',
      done: hasQrProfile,
    },
    {
      label: 'Advanced parser settings',
      done: hasAdvancedSettings,
    },
  ]

  return (
    <SectionCard eyebrow="Snapshot" title="Supplier summary" className="!mb-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <StatPill label="Mode" value={form.paymentMode || 'cash'} />
        <StatPill label="Active" value={form.isActive ? 'Yes' : 'No'} />
        <StatPill label="QR preset" value={String(form.strategy || 'delimiter').replace('_', ' ')} />
        <StatPill
          label="Structured categories"
          value={structuredCategories.length > 0 ? `${structuredCategories.length}` : 'None'}
        />
        <StatPill
          label="Purity overrides"
          value={purityOverrides.length > 0 ? `${purityOverrides.length}` : 'None'}
        />
      </div>

      <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
              Quick readiness check
            </div>
            <p className="mt-1 text-sm text-muted">
              A compact view of what is configured before saving.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {checklist.map((item) => (
              <ChecklistItem key={item.label} done={item.done} label={item.label} />
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
