import SectionCard from '../../../components/ui/SectionCard'

export default function ExceptionRawPanel({ rawQr }) {
  return (
    <SectionCard title="Raw QR">
      <pre className="whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted">
        {rawQr || '-'}
      </pre>
    </SectionCard>
  )
}
