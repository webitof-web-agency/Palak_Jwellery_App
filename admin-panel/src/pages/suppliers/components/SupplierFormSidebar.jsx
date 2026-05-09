import SectionCard from '../../../components/ui/SectionCard'

export default function SupplierFormSidebar({ form }) {
  return (
    <aside className="space-y-6 xl:sticky xl:top-6">
      <SectionCard eyebrow="Snapshot" title="Supplier summary" className="!mb-0">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase text-muted font-bold mb-1">Mode</div>
            <div className="text-lg font-bold text-heading capitalize">{form.paymentMode || 'cash'}</div>
          </div>
          <div className="rounded-2xl surface-panel-soft panel-border p-4">
            <div className="text-[10px] uppercase text-muted font-bold mb-1">Active</div>
            <div className="text-lg font-bold text-primary">{form.isActive ? 'Yes' : 'No'}</div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
          <div className="text-[10px] uppercase text-muted font-bold mb-1">QR preset</div>
          <div className="text-lg font-bold text-primary capitalize">{form.strategy.replace('_', ' ')}</div>
        </div>
        <div className="mt-4 rounded-2xl surface-panel-faint panel-border p-4">
          <div className="text-[10px] uppercase text-muted font-bold mb-1">Category rule</div>
          <div className="text-sm text-muted">
            Keep category suggestions ready for the salesman, while still allowing manual category selection on the sale screen.
          </div>
        </div>
      </SectionCard>

      <SectionCard eyebrow="Checklist" title="Before saving" className="!mb-0">
        <ul className="space-y-3 text-sm text-muted leading-relaxed">
          <li>Use a short unique supplier code.</li>
          <li>Settlement mode can be cash or credit.</li>
          <li>Some suppliers provide only item/design code, not business category.</li>
          <li>Unknown or partial QR formats should still allow manual sale completion.</li>
        </ul>
      </SectionCard>
    </aside>
  )
}
