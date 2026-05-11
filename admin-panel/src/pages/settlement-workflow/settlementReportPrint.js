import { formatCurrency, formatPercentage, formatWeight } from '../../utils/formatters'

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const sanitizeFileNamePart = (value = 'all') =>
  String(value || 'all')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'all'

export const buildSettlementDocumentName = (supplier = 'all') => {
  const safeSupplier = sanitizeFileNamePart(supplier)
  const date = new Date().toISOString().slice(0, 10)
  return `settlement-report-${safeSupplier}-${date}`
}

const formatDateOnly = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Failed to read asset blob.'))
    reader.readAsDataURL(blob)
  })

export const loadImageAsDataUrl = async (src) => {
  try {
    const response = await fetch(src, { cache: 'force-cache' })
    if (!response.ok) return ''
    const blob = await response.blob()
    return await blobToDataUrl(blob)
  } catch {
    return ''
  }
}

export const buildSettlementPrintHtml = ({
  rows = [],
  summary = {},
  meta = {},
  logoDataUrl = '',
  documentName = 'settlement-report',
}) => {
  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())

  const tableRows = rows
    .map(
      (row, i) => `
      <tr>
        <td class="cell tc">${i + 1}</td>
        <td class="cell tc">${escapeHtml(row.display_ref || row.sequence || '-')}</td>
        <td class="cell">${escapeHtml(formatDateOnly(row.sale_date || row.createdAt))}</td>
        <td class="cell">${escapeHtml(row.supplier || 'Unknown')}</td>
        <td class="cell">${escapeHtml(row.item_code || row.design_code || '-')}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.gross_weight ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.stone_weight ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.other_weight ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.net_weight ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatPercentage(row.wastage_percent ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatPercentage(row.purity_percent ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.fine_weight ?? 0))}</td>
        <td class="cell tr">${escapeHtml(formatCurrency(row.stone_amount ?? 0))}</td>
      </tr>
    `,
    )
    .join('')

  const title = escapeHtml(`${documentName}.pdf`)
  const supplierLabel = escapeHtml(meta.supplier || 'All Suppliers')
  const reportDate = escapeHtml(meta.reportDate || new Date().toISOString().slice(0, 10))

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 14mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          background: #fff;
          color: #000;
          font-family: "Inter", Arial, Helvetica, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ── Toolbar (screen only) ── */
        .toolbar {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 20;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(251, 246, 240, 0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(92, 70, 56, 0.18);
          padding: 10px 24px;
          gap: 12px;
          box-shadow: 0 2px 16px rgba(76, 53, 43, 0.08);
        }
        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .toolbar-logo {
          width: 34px;
          height: 34px;
          object-fit: contain;
          border-radius: 50%;
          border: 1px solid rgba(185, 92, 88, 0.22);
          background: rgba(185, 92, 88, 0.06);
          padding: 3px;
          flex: 0 0 auto;
        }
        .toolbar-logo-placeholder {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(185, 92, 88, 0.22);
          background: rgba(185, 92, 88, 0.06);
          flex: 0 0 auto;
        }
        .toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .toolbar-title strong {
          font-size: 12px;
          font-weight: 700;
          color: #4f4039;
          letter-spacing: 0.04em;
          font-family: "Outfit", "Inter", Arial, sans-serif;
        }
        .toolbar-title span {
          font-size: 10px;
          color: rgba(79, 64, 57, 0.6);
        }
        .toolbar-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        .toolbar-btn {
          appearance: none;
          border: 1px solid rgba(92, 70, 56, 0.22);
          background: rgba(255, 250, 245, 0.9);
          color: #4f4039;
          padding: 8px 18px;
          font-size: 11.5px;
          font-weight: 600;
          cursor: pointer;
          border-radius: 999px;
          font-family: "Inter", Arial, sans-serif;
          letter-spacing: 0.02em;
          transition: all 0.15s ease;
          box-shadow: 0 1px 4px rgba(76, 53, 43, 0.06);
        }
        .toolbar-btn:hover {
          background: rgba(255, 250, 245, 1);
          border-color: rgba(92, 70, 56, 0.35);
        }
        .toolbar-btn.primary {
          background: linear-gradient(135deg, #c87368, #b95c58);
          color: #fffaf5;
          border-color: rgba(185, 92, 88, 0.3);
          box-shadow: 0 4px 14px rgba(185, 92, 88, 0.28);
        }
        .toolbar-btn.primary:hover {
          background: linear-gradient(135deg, #d4806e, #c87368);
          box-shadow: 0 6px 18px rgba(185, 92, 88, 0.36);
        }

        /* ── Page shell ── */
        .preview-shell {
          padding: 54px 16px 24px;
          background: #e8e8e8;
        }
        .page {
          width: min(700px, 100%);
          margin: 0 auto;
          border: 2px solid #000;
          background: #fff;
        }

        /* ── Company header ── */
        .company-header {
          border-bottom: 2px solid #000;
          text-align: center;
          padding: 14px 16px 10px;
        }
        .company-logo-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-bottom: 4px;
        }
        .logo {
          width: 52px;
          height: 52px;
          object-fit: contain;
          border-radius: 50%;
          border: 1.5px solid #000;
          padding: 3px;
          flex: 0 0 auto;
        }
        .logo-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1.5px solid #000;
          flex: 0 0 auto;
        }
        .company-name {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }
        .company-subtitle {
          font-size: 11px;
          color: #333;
          margin-top: 2px;
        }

        /* ── Document title bar ── */
        .doc-title-bar {
          border-bottom: 2px solid #000;
          text-align: center;
          padding: 6px 16px;
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* ── Info grid (M/s, Date, Supplier, etc.) ── */
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border-bottom: 2px solid #000;
        }
        .info-cell {
          padding: 7px 12px;
          font-size: 11px;
          display: flex;
          gap: 6px;
          align-items: baseline;
        }
        .info-cell:nth-child(odd) {
          border-right: 1px solid #000;
        }
        .info-cell strong {
          font-weight: 700;
          white-space: nowrap;
        }

        /* ── Summary strip ── */
        .summary-strip {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          border-bottom: 2px solid #000;
        }
        .summary-cell {
          padding: 7px 10px;
          text-align: center;
          border-right: 1px solid #000;
        }
        .summary-cell:last-child { border-right: none; }
        .summary-cell .s-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #444;
          margin-bottom: 3px;
        }
        .summary-cell .s-value {
          font-size: 13px;
          font-weight: 700;
        }

        /* ── Data table ── */
        .table-wrap {
          overflow: hidden;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 8.5px;
        }
        thead { display: table-header-group; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        th, td {
          border: 1px solid #000;
          padding: 7px 5px;
          vertical-align: middle;
          overflow-wrap: anywhere;
          line-height: 1.3;
          text-align: center;
        }
        th {
          background: #f0f0f0;
          font-weight: 700;
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        tbody tr:nth-child(even) td {
          background: #fafafa;
        }
        .cell { }
        .tc { text-align: center; }
        .tr { text-align: right; font-variant-numeric: tabular-nums; }

        /* ── Footer ── */
        .doc-footer {
          border-top: 2px solid #000;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #333;
        }

        /* ── Print overrides ── */
        @media print {
          .preview-shell { padding: 0; background: #fff; }
          .toolbar { display: none; }
          .page {
            width: 100%;
            margin: 0;
            border: none;
          }
          .company-header { border-bottom: 2px solid #000; }
        }
      </style>
    </head>
    <body>
      <!-- Toolbar (screen only) -->
      <div class="toolbar">
        <div class="toolbar-left">
          ${logoDataUrl
            ? `<img class="toolbar-logo" src="${logoDataUrl}" alt="Logo" />`
            : `<div class="toolbar-logo-placeholder"></div>`}
          <div class="toolbar-title">
            <strong>Settlement Report Preview</strong>
            <span>${escapeHtml(documentName)}.pdf</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <button class="toolbar-btn" type="button" onclick="window.close()">Close</button>
          <button class="toolbar-btn primary" type="button" onclick="window.print()">&#8595;&nbsp; Download PDF</button>
        </div>
      </div>

      <div class="preview-shell">
        <div class="page">

          <!-- Company Header -->
          <div class="company-header">
            <div class="company-logo-row">
              ${logoDataUrl
                ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />`
                : `<div class="logo-placeholder"></div>`}
              <div>
                <div class="company-name">Palak Jewellery</div>
                <div class="company-subtitle">Settlement Ledger &mdash; Printable Supplier Settlement Sheet</div>
              </div>
            </div>
          </div>

          <!-- Document Title -->
          <div class="doc-title-bar">Settlement Report</div>

          <!-- Info Grid -->
          <div class="info-grid">
            <div class="info-cell"><strong>Supplier:</strong> ${supplierLabel}</div>
            <div class="info-cell"><strong>Report Date:</strong> ${reportDate}</div>
            <div class="info-cell"><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
            <div class="info-cell"><strong>Document:</strong> ${escapeHtml(documentName)}.pdf</div>
          </div>

          <!-- Summary Strip -->
          <div class="summary-strip">
            <div class="summary-cell">
              <div class="s-label">Total Items</div>
              <div class="s-value">${escapeHtml(String(summary.total_items || 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Gross Weight</div>
              <div class="s-value">${escapeHtml(formatWeight(summary.total_gross_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Stone Weight</div>
              <div class="s-value">${escapeHtml(formatWeight(summary.total_stone_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Net Weight</div>
              <div class="s-value">${escapeHtml(formatWeight(summary.total_net_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Fine Weight</div>
              <div class="s-value">${escapeHtml(formatWeight(summary.total_fine_weight ?? 0))}</div>
            </div>
          </div>

          <!-- Data Table -->
          <div class="table-wrap">
            <table>
              <colgroup>
                <col style="width: 5%;" />
                <col style="width: 6%;" />
                <col style="width: 9%;" />
                <col style="width: 11%;" />
                <col style="width: 13%;" />
                <col style="width: 8%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 6%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Ref</th>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Design / Item Code</th>
                  <th>Gross Wt.</th>
                  <th>Stone Wt.</th>
                  <th>Other Wt.</th>
                  <th>Net Wt.</th>
                  <th>Wastage</th>
                  <th>Purity</th>
                  <th>Fine Wt.</th>
                  <th>Stone Amt.</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>



        </div>
      </div>
    </body>
  </html>`
}
