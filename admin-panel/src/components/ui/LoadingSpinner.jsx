export default function LoadingSpinner({ className = '' }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin ${className}`.trim()}
      aria-hidden="true"
    />
  )
}
