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

export default function ExceptionDiffTable({ rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-[0.18em] text-muted">
            <th className="px-4 py-3">Field</th>
            <th className="px-4 py-3">Original</th>
            <th className="px-4 py-3">Corrected</th>
            <th className="px-4 py-3">Final</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((field) => (
            <tr key={field.key}>
              <td className="px-4 py-3 text-muted uppercase tracking-[0.12em] text-[11px] font-bold">
                {field.label}
              </td>
              <td className="px-4 py-3 text-primary">{toDisplayValue(field.original, field.format)}</td>
              <td className="px-4 py-3 text-primary">{toDisplayValue(field.corrected, field.format)}</td>
              <td className="px-4 py-3 text-primary">{toDisplayValue(field.final, field.format)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
