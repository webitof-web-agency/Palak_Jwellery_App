import LogoBadge from "./LogoBadge";
import { APP_BRAND_NAME } from "../../theme/theme";

export default function FullScreenLoader({
  label = `Loading ${APP_BRAND_NAME}`,
}) {
  const themeName =
    typeof document !== "undefined"
      ? document.documentElement.dataset.theme
      : "roseLight";
  const logoSrc =
    themeName === "midnightRose"
      ? "/logo-dark.png"
      : "/logo-light-rose-notext-clean.png";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[var(--jsm-bg)] text-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border border-gold-600/15 bg-[var(--jsm-panel-bg)]" />
          <div className="absolute inset-2 rounded-full border-2 border-t-gold-600 border-r-gold-500/30 border-b-gold-500/10 border-l-gold-500/10 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <LogoBadge
              src={logoSrc}
              alt={APP_BRAND_NAME}
              wrapperClassName="h-16 w-16 rounded-full border-gold-600/20 "
              className="rounded-full"
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-xs uppercase tracking-[0.35em] text-muted font-bold">
            Please wait
          </div>
          <div className="text-sm font-bold text-heading">{label}</div>
        </div>
      </div>
    </div>
  );
}
