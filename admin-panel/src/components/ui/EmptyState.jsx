export default function EmptyState({ title, description, className = '' }) {
  return (
    <div className={`py-16 text-center ${className}`.trim()}>
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-muted">
        *
      </div>
      <div className="text-lg font-semibold text-primary">{title}</div>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  )
}
