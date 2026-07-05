export default function ActionToast({ message, tone = 'success' }) {
  if (!message) return null

  const toneClasses = {
    success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50',
    danger: 'border-red-400/30 bg-red-500/15 text-red-50',
    info: 'border-sky-400/30 bg-sky-500/15 text-sky-50',
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[260] max-w-sm">
      <div className={`pointer-events-auto rounded-2xl border px-4 py-3 text-sm shadow-[0_20px_50px_rgba(0,0,0,0.24)] backdrop-blur-xl ${toneClasses[tone] || toneClasses.success}`}>
        <div className="font-semibold">{message}</div>
      </div>
    </div>
  )
}
