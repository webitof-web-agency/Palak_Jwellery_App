const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export const renderStatusPage = ({
  appName,
  status,
  apiPath,
  uptime,
  timestamp,
}) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(appName)} Status</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #fbf6f0;
        --surface: rgba(255, 250, 245, 0.92);
        --surface-strong: #f3e8da;
        --border: rgba(92, 70, 56, 0.16);
        --text: #261c18;
        --muted: rgba(38, 28, 24, 0.66);
        --heading: #b95c58;
        --accent: #c87368;
        --success: #2f8a64;
        --shadow: 0 22px 54px rgba(76, 53, 43, 0.12);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        background:
          radial-gradient(circle at 0% 0%, rgba(200, 115, 104, 0.12) 0%, transparent 46%),
          radial-gradient(circle at 100% 0%, rgba(185, 92, 88, 0.08) 0%, transparent 42%),
          var(--bg);
        color: var(--text);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }

      .panel {
        width: min(680px, 100%);
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 28px;
        padding: 32px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(16px);
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(200, 115, 104, 0.1);
        color: var(--heading);
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 12px;
        font-weight: 800;
      }

      h1 {
        margin: 18px 0 10px;
        font-size: clamp(32px, 5vw, 46px);
        line-height: 1.05;
        color: var(--heading);
      }

      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }

      .status-row {
        margin-top: 24px;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 14px;
      }

      .card {
        padding: 18px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.6);
        border: 1px solid var(--border);
      }

      .label {
        display: block;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .value {
        font-size: 18px;
        font-weight: 800;
        color: var(--text);
        word-break: break-word;
      }

      .value--healthy {
        color: var(--success);
      }

      .footer {
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px solid var(--border);
      }

      a {
        color: var(--accent);
        font-weight: 700;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <span class="eyebrow">Backend Status</span>
      <h1>${escapeHtml(appName)}</h1>
      <p>The API is running and ready to accept requests from the admin panel and mobile app.</p>

      <section class="status-row">
        <article class="card">
          <span class="label">Status</span>
          <span class="value value--healthy">${escapeHtml(status)}</span>
        </article>
        <article class="card">
          <span class="label">API Health</span>
          <span class="value">${escapeHtml(apiPath)}</span>
        </article>
        <article class="card">
          <span class="label">Uptime</span>
          <span class="value">${escapeHtml(uptime)}</span>
        </article>
        <article class="card">
          <span class="label">Timestamp</span>
          <span class="value">${escapeHtml(timestamp)}</span>
        </article>
      </section>

      <div class="footer">
        <p>For automated checks, use <a href="${escapeHtml(apiPath)}">${escapeHtml(apiPath)}</a>.</p>
      </div>
    </main>
  </body>
</html>`
