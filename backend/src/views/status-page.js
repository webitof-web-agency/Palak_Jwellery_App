const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createStatusFavicon = (mode) => {
  const isDark = mode === "dark";
  const background = isDark ? "#07111F" : "#FFFAF5";
  const accent = isDark ? "#D6A24F" : "#C87368";
  const accentSoft = isDark ? "#1A1720" : "#F7E7E2";
  const stroke = isDark ? "#F4E7C1" : "#8A5A54";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="18" fill="${background}" />
      <circle cx="32" cy="32" r="20" fill="${accentSoft}" stroke="${accent}" stroke-width="2" />
      <path d="M32 18C28.2 22.2 25.5 26.3 25.5 30.2C25.5 35 28.4 39 32 43.2C35.6 39 38.5 35 38.5 30.2C38.5 26.3 35.8 22.2 32 18Z" fill="${accent}" />
      <path d="M20 31.5C24 27.2 27.9 25 32 25C36.1 25 40 27.2 44 31.5C40 35.8 36.1 38 32 38C27.9 38 24 35.8 20 31.5Z" fill="${stroke}" opacity="0.9" />
      <circle cx="32" cy="32" r="4.2" fill="${background}" stroke="${accent}" stroke-width="2" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const renderStatusPage = ({
  appName,
  status,
  apiPath,
  uptime,
  timestamp,
  environment,
}) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <link rel="icon" href="${createStatusFavicon("light")}" type="image/svg+xml" media="(prefers-color-scheme: light)" />
    <link rel="icon" href="${createStatusFavicon("dark")}" type="image/svg+xml" media="(prefers-color-scheme: dark)" />
    <link rel="icon" href="${createStatusFavicon("light")}" type="image/svg+xml" />
    <title>${escapeHtml(appName)} · API Status</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
    <style>
      /* ─── Design tokens ─────────────────────────────────────────────── */
      :root {
        --bg:            #FBF6F0;
        --surface:       #FFFAF5;
        --surface-alt:   #F5EBDD;
        --surface-strong:#E9D6C4;
        --border:        rgba(123, 98, 84, 0.16);
        --border-strong: rgba(123, 98, 84, 0.24);
        --text-primary:  #261C18;
        --text-secondary:#5A463D;
        --text-muted:    #806A5F;
        --text-faint:    #A18E84;
        --accent:        #C87368;
        --accent-soft:   rgba(200, 115, 104, 0.12);
        --success:       #2F8A64;
        --success-soft:  #DCF0E6;
        --warning:       #B97A3A;
        --warning-soft:  #F8E5C8;
        --shadow:        0 24px 56px rgba(76, 53, 43, 0.10);
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg:            #030811;
          --surface:       #07111F;
          --surface-alt:   #0B1524;
          --surface-strong:#0E1828;
          --border:        rgba(255, 255, 255, 0.10);
          --border-strong: rgba(255, 255, 255, 0.18);
          --text-primary:  #F4F0EA;
          --text-secondary:#D8D1C7;
          --text-muted:    #B9B1A7;
          --text-faint:    #958B81;
          --accent:        #D6A24F;
          --accent-soft:   rgba(214, 162, 79, 0.12);
          --success:       #27AE60;
          --success-soft:  #0E2A1A;
          --warning:       #E57C1A;
          --warning-soft:  rgba(229, 124, 26, 0.12);
          --shadow:        0 24px 56px rgba(0, 0, 0, 0.36);
        }
      }

      /* ─── Reset ─────────────────────────────────────────────────────── */
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      /* ─── Layout ─────────────────────────────────────────────────────── */
      body {
        min-height: 100vh;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        font-size: 15px;
        background:
          radial-gradient(ellipse at 0% 0%,   rgba(200, 115, 104, 0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 100% 100%, rgba(185,  92,  88, 0.07) 0%, transparent 50%),
          var(--bg);
        color: var(--text-primary);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 28px 20px;
        gap: 0;
      }

      /* ─── Main card ──────────────────────────────────────────────────── */
      .panel {
        width: min(660px, 100%);
        background: var(--surface);
        border: 1px solid var(--border-strong);
        border-radius: 28px;
        padding: 36px 32px 30px;
        box-shadow: var(--shadow);
      }

      /* ─── Eyebrow pill ───────────────────────────────────────────────── */
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 12px;
        border-radius: 999px;
        background: var(--accent-soft);
        border: 1px solid var(--border-strong);
        color: var(--accent);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      /* ─── Heading ────────────────────────────────────────────────────── */
      h1 {
        margin-top: 16px;
        font-size: clamp(28px, 5vw, 42px);
        font-weight: 800;
        line-height: 1.08;
        color: var(--text-primary);
        letter-spacing: -0.02em;
      }

      h1 span {
        color: var(--accent);
      }

      .subtitle {
        margin-top: 10px;
        color: var(--text-muted);
        font-size: 14px;
        line-height: 1.65;
      }

      /* ─── Divider ────────────────────────────────────────────────────── */
      hr {
        border: none;
        border-top: 1px solid var(--border);
        margin: 24px 0;
      }

      /* ─── Status grid ────────────────────────────────────────────────── */
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 12px;
      }

      .card {
        padding: 16px 18px;
        border-radius: 18px;
        background: var(--surface-alt);
        border: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .card-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--text-faint);
      }

      .card-value {
        font-size: 17px;
        font-weight: 700;
        color: var(--text-primary);
        word-break: break-word;
        line-height: 1.2;
      }

      .card-value--healthy {
        color: var(--success);
      }

      .card-value--warn {
        color: var(--warning);
      }

      /* Env badge inside card */
      .env-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 600;
        background: var(--accent-soft);
        color: var(--accent);
        border: 1px solid var(--border-strong);
      }

      /* Smaller value variant for dense text like timestamps */
      .card-value--sm {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary);
      }

      /* ─── Footer ─────────────────────────────────────────────────────── */
      .footer {
        margin-top: 22px;
        padding-top: 18px;
        border-top: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .footer p {
        font-size: 13px;
        color: var(--text-muted);
        line-height: 1.5;
      }

      a {
        color: var(--accent);
        font-weight: 600;
        text-decoration: none;
      }

      a:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--success);
        box-shadow: 0 0 0 3px rgba(47, 138, 100, 0.20);
        flex-shrink: 0;
        vertical-align: middle;
        margin-right: 6px;
      }
    </style>
  </head>
  <body>
    <main class="panel">

      <span class="eyebrow">✦ API Status</span>

      <h1><span>${escapeHtml(appName.split(" ")[0])}</span> ${escapeHtml(appName.split(" ").slice(1).join(" "))}</h1>
      <p class="subtitle">
        REST API — serving the admin panel and salesman mobile app.
        All protected routes require a valid Bearer token.
      </p>

      <hr />

      <div class="grid">
        <div class="card">
          <span class="card-label">Status</span>
          <span class="card-value card-value--healthy">
            <span class="dot"></span>${escapeHtml(status)}
          </span>
        </div>

        <div class="card">
          <span class="card-label">Uptime</span>
          <span class="card-value">${escapeHtml(uptime)}</span>
        </div>

        <div class="card">
          <span class="card-label">Environment</span>
          <span class="card-value">
            <span class="env-badge">${escapeHtml(environment ?? "development")}</span>
          </span>
        </div>

        <div class="card">
          <span class="card-label">Timestamp</span>
          <span class="card-value card-value--sm">${escapeHtml(timestamp)}</span>
        </div>
      </div>

      <div class="footer">
        <p>Health endpoint: <a href="${escapeHtml(apiPath)}">${escapeHtml(apiPath)}</a></p>
        <p style="color:var(--text-faint);font-size:12px;">Palak Jewellers &copy; ${new Date().getFullYear()} | Developed by: <a href="https://webitoft.com">Webitoft ❤️</a></p>
      </div>

    </main>
  </body>
</html>`;
