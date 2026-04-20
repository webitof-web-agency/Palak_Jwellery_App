export default function TableSkeleton({ columns = 4, rows = 4 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid gap-3 ${columns === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}
        >
          {[...Array(columns)].map((__, columnIndex) => (
            <div key={columnIndex} className="h-4 rounded bg-white/10 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}

