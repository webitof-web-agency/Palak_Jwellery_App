export default function EmptyState({ title, description, className = '' }) {
  return (
    <div className={`py-16 text-center ${className}`.trim()}>
      <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted">
        •
      </div>
      <div className="text-lg font-semibold text-primary">{title}</div>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  )
}
