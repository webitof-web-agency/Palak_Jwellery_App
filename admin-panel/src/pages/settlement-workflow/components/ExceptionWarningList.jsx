import EmptyState from '../../../components/ui/EmptyState'
import SectionCard from '../../../components/ui/SectionCard'

export default function ExceptionWarningList({ title, items, emptyDescription }) {
  return (
    <SectionCard title={title} className="!mb-0">
      {Array.isArray(items) && items.length > 0 ? (
        <ul className="space-y-2 text-sm text-muted">
          {items.map((item, index) => (
            <li key={`${title}-${index}`} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No warnings"
          description={emptyDescription || 'This section is empty for the selected record.'}
        />
      )}
    </SectionCard>
  )
}
