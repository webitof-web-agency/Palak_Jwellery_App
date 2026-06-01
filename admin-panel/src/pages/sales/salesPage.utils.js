export const sortOptions = [
  { value: "saleDate:desc", label: "Date newest first" },
  { value: "saleDate:asc", label: "Date oldest first" },
  { value: "netWeight:desc", label: "Net weight high to low" },
  { value: "netWeight:asc", label: "Net weight low to high" },
];

export const batchStatusOptions = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "submitted", label: "Submitted" },
  { value: "finalized", label: "Finalized" },
  { value: "reopened", label: "Reopened" },
  { value: "cancelled", label: "Cancelled" },
];

export const batchEntryModeOptions = [
  { value: "", label: "All" },
  { value: "qr_scan", label: "QR scanned" },
  { value: "manual", label: "Manual" },
  { value: "mixed", label: "Mixed" },
];

export const batchSortOptions = [
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "updatedAt:asc", label: "Oldest updated" },
  { value: "createdAt:desc", label: "Newest created" },
  { value: "createdAt:asc", label: "Oldest created" },
  { value: "batchRef:asc", label: "Batch ref A-Z" },
  { value: "batchRef:desc", label: "Batch ref Z-A" },
  { value: "status:asc", label: "Status A-Z" },
  { value: "revision:desc", label: "Highest revision" },
  { value: "itemCount:desc", label: "Most items" },
];

export const formatBatchStatusLabel = (value) => {
  const status = String(value || "").toLowerCase();
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Open";
    case "submitted":
      return "Submitted";
    case "finalized":
      return "Finalized";
    case "reopened":
      return "Reopened";
    case "cancelled":
      return "Cancelled";
    default:
      return "—";
  }
};

export const formatBatchEntryModeLabel = (value) => {
  const mode = String(value || "").toLowerCase();
  switch (mode) {
    case "qr_scan":
      return "QR scanned";
    case "manual":
      return "Manual";
    case "mixed":
      return "Mixed";
    case "qr_scan_with_manual_override":
      return "QR scanned + edit";
    default:
      return "—";
  }
};

export const buttonStyles = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-[#f5f5f5] text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-gold-600 shadow-lg shadow-gold-600/20 hover:bg-gold-500 hover:shadow-gold-600/30",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none surface-panel-soft panel-border text-primary hover:bg-gold-500/10 hover:border-gold-500/30",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-muted hover:text-primary hover:bg-gold-500/10",
};

export const getName = (value) => {
  if (!value) return "Unknown";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.name || value.title || "Unknown";
  return String(value);
};

export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
