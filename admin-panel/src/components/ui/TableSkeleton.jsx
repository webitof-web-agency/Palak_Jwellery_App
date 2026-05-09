export default function TableSkeleton({ columns = 4, rows = 4 }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {[...Array(columns)].map((__, columnIndex) => {
            const widthVariants = ['w-5/6', 'w-4/5', 'w-2/3', 'w-3/4']

            return (
              <div key={columnIndex} className="flex items-center">
                <div
                  className={`skeleton-line ${widthVariants[columnIndex % widthVariants.length]}`}
                />
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
