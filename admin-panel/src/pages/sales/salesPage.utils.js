export const sortOptions = [
  { value: "saleDate:desc", label: "Date newest first" },
  { value: "saleDate:asc", label: "Date oldest first" },
  { value: "netWeight:desc", label: "Net weight high to low" },
  { value: "netWeight:asc", label: "Net weight low to high" },
];

export const buttonStyles = {
  primary:
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-[#f5f5f5] text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none bg-gold-600 shadow-lg shadow-gold-600/20 hover:bg-gold-500 hover:shadow-gold-600/30",
  secondary:
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none border border-white/10 bg-white/5 text-primary hover:bg-white/10 hover:border-gold-500/30",
  ghost:
    "inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-muted hover:text-primary hover:bg-white/5",
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
