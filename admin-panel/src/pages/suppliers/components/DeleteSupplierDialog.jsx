import { createPortal } from "react-dom";

export default function DeleteSupplierDialog({
  open,
  supplierName,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-[rgba(38,28,24,0.48)] backdrop-blur-sm">
      <div className="glass-panel w-full max-w-sm p-8 premium-shadow animate-[zoom-in_120ms_ease-out] will-change-transform transform-gpu text-primary">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mb-6 mx-auto">
          <span className="text-red-500 text-2xl font-bold">!</span>
        </div>

        <h3 className="text-xl font-bold text-center mb-2 text-heading">
          Delete supplier?
        </h3>
        <p className="text-muted text-center mb-8 text-sm">
          {supplierName
            ? `Are you sure you want to delete ${supplierName}? This action cannot be undone.`
            : "Are you sure you want to delete this supplier? This action cannot be undone."}
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-on-accent font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-70"
            aria-label="Confirm delete supplier"
          >
            {isDeleting ? "Deleting..." : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-white/5 hover:bg-white/10 text-primary font-bold rounded-xl transition-all border border-white/10"
            aria-label="Cancel delete supplier"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
