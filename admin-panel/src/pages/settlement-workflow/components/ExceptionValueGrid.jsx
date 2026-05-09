import SectionCard from '../../../components/ui/SectionCard'

const toDisplayValue = (value, formatter) => {
  if (value === null || value === undefined || value === '') return '-'
  if (typeof formatter === 'function' && typeof value === 'number') {
    return formatter(value)
  }
  if (typeof value === 'number') {
    return String(value)
  }
  return String(value)
}

export default function ExceptionValueGrid({ title, fields, data }) {
  return (
    <SectionCard title={title} className="!mb-0">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {fields.map((field) => {
          const value = data?.[field.key]
          const displayValue = field.multiline ? value || '-' : toDisplayValue(value, field.format)

          return (
            <div key={field.key} className="rounded-2xl surface-panel-soft panel-border p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted font-bold">
                {field.label}
              </div>
              {field.multiline ? (
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-primary max-h-48 overflow-auto">
                  {displayValue}
                </pre>
              ) : (
                <div className="mt-2 text-primary font-medium">{displayValue}</div>
              )}
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
