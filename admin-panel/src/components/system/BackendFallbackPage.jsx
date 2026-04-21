import LogoBadge from "../ui/LogoBadge";
import { APP_BRAND_NAME } from "../../theme/theme";

export default function BackendFallbackPage({
  error,
  onRetry,
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
    <main className="min-h-screen w-full bg-[var(--jsm-bg)] text-primary flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-2xl rounded-[32px] border border-[var(--jsm-border)] bg-[var(--jsm-panel-bg)] p-8 shadow-premium backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <span className="eyebrow text-heading">System Fallback</span>
            <h1 className="text-4xl font-display font-bold text-heading leading-tight">
              {APP_BRAND_NAME} cannot reach the backend.
            </h1>
            <p className="text-muted max-w-xl leading-relaxed">
              The admin panel needs the API server to load authentication, suppliers, sales,
              and reports. Until the backend responds, the app stays in safe fallback mode.
            </p>
          </div>

          <LogoBadge
            src={logoSrc}
            alt={APP_BRAND_NAME}
            wrapperClassName="brand-mark brand-mark--lg shrink-0"
          />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="surface-card rounded-3xl p-5">
            <div className="field-label">Expected Health Endpoint</div>
            <div className="mt-2 text-sm font-semibold text-heading">/api/v1/health</div>
          </div>
          <div className="surface-card rounded-3xl p-5">
            <div className="field-label">Current Problem</div>
            <div className="mt-2 text-sm text-muted">{error}</div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="primary-luxury-button px-6 py-3"
            onClick={onRetry}
          >
            Retry Connection
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--jsm-border)] px-6 py-3 text-sm font-semibold text-primary transition hover:bg-[var(--jsm-control-bg-hover)]"
          >
            Reload App Shell
          </a>
        </div>
      </div>
    </main>
  );
}
