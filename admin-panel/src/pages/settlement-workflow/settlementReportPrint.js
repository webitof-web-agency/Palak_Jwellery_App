import { formatCurrency, formatPercentage, formatWeight } from '../../utils/formatters'

const BRAND_COLORS = {
  bg: '#faf7f2',
  surface: '#fffdf9',
  surfaceAlt: '#f8f2ea',
  border: 'rgba(92, 70, 56, 0.14)',
  borderStrong: 'rgba(92, 70, 56, 0.2)',
  text: '#443730',
  textMuted: 'rgba(68, 55, 48, 0.68)',
  heading: '#ad5754',
  gold: '#c87768',
  goldSoft: 'rgba(185, 92, 88, 0.08)',
}

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
    .map((row) => `
      <tr>
        <td class="cell cell-ref">${escapeHtml(row.display_ref || row.sequence || '-')}</td>
        <td class="cell cell-date">${escapeHtml(formatDateOnly(row.sale_date || row.createdAt))}</td>
        <td class="cell cell-supplier">${escapeHtml(row.supplier || 'Unknown')}</td>
        <td class="cell cell-design">${escapeHtml(row.item_code || row.design_code || '-')}</td>
        <td class="cell cell-num cell-gross">${escapeHtml(formatWeight(row.gross_weight ?? 0))}</td>
        <td class="cell cell-num cell-stone">${escapeHtml(formatWeight(row.stone_weight ?? 0))}</td>
        <td class="cell cell-num cell-wastage">${escapeHtml(formatPercentage(row.wastage_percent ?? 0))}</td>
        <td class="cell cell-num cell-net">${escapeHtml(formatWeight(row.net_weight ?? 0))}</td>
        <td class="cell cell-num cell-purity">${escapeHtml(formatPercentage(row.purity_percent ?? 0))}</td>
        <td class="cell cell-num cell-fine">${escapeHtml(formatWeight(row.fine_weight ?? 0))}</td>
        <td class="cell cell-num cell-amount">${escapeHtml(formatCurrency(row.stone_amount ?? 0))}</td>
      </tr>
    `)
    .join('')

  const title = escapeHtml(`${documentName}.pdf`)

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${title}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm 12mm 14mm 12mm;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          background: ${BRAND_COLORS.bg};
          color: ${BRAND_COLORS.text};
          font-family: "Inter", Arial, Helvetica, sans-serif;
          line-height: 1.38;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          padding: 0;
        }
        .preview-shell {
          position: relative;
          min-height: 100vh;
          padding: 64px 22px 24px;
        }
        .toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 20;
          display: flex;
          justify-content: center;
          background: rgba(250, 247, 242, 0.92);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(92, 70, 56, 0.12);
          padding: 10px 16px;
        }
        .toolbar-inner {
          width: min(980px, 100%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .toolbar-title {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .toolbar-title strong {
          font-size: 12px;
          color: ${BRAND_COLORS.text};
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .toolbar-title span {
          font-size: 10px;
          color: ${BRAND_COLORS.textMuted};
        }
        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .toolbar-button {
          appearance: none;
          border: 1px solid ${BRAND_COLORS.borderStrong};
          background: linear-gradient(180deg, ${BRAND_COLORS.surface}, ${BRAND_COLORS.surfaceAlt});
          color: ${BRAND_COLORS.text};
          border-radius: 999px;
          padding: 10px 16px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 8px 18px rgba(76, 53, 43, 0.06);
        }
        .toolbar-button.primary {
          background: linear-gradient(180deg, ${BRAND_COLORS.gold}, ${BRAND_COLORS.heading});
          color: #fff;
          border-color: rgba(173, 87, 84, 0.2);
        }
        .page {
          width: min(980px, 100%);
          margin: 0 auto;
          padding: 18px 22px 24px;
          background: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(92, 70, 56, 0.10);
          border-radius: 18px;
          box-shadow: 0 16px 30px rgba(76, 53, 43, 0.06);
          backdrop-filter: blur(2px);
        }
        .page-body {
          background:
            radial-gradient(circle at 0% 0%, rgba(200, 115, 104, 0.08) 0%, transparent 30%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.32), rgba(255, 250, 245, 0.02));
          min-height: 100vh;
          padding: 0;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 0 0 14px;
          margin-bottom: 14px;
          border-bottom: 1px solid ${BRAND_COLORS.border};
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .logo {
          width: 62px;
          height: 62px;
          object-fit: contain;
          border-radius: 999px;
          padding: 6px;
          background: ${BRAND_COLORS.goldSoft};
          border: 1px solid rgba(185, 92, 88, 0.12);
          box-shadow: 0 0 0 1px rgba(185, 92, 88, 0.05), 0 10px 22px rgba(185, 92, 88, 0.10);
          flex: 0 0 auto;
        }
        .eyebrow {
          font-size: 10px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: ${BRAND_COLORS.heading};
          font-weight: 700;
          margin-bottom: 5px;
        }
        h1 {
          margin: 0;
          font-size: 21px;
          line-height: 1.16;
          color: ${BRAND_COLORS.heading};
        }
        .subtle {
          margin-top: 4px;
          color: ${BRAND_COLORS.textMuted};
          font-size: 11px;
        }
        .page-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 10px;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(200, 115, 104, 0.08);
          color: ${BRAND_COLORS.heading};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .meta {
          min-width: 250px;
          display: grid;
          gap: 8px;
          justify-items: end;
        }
        .meta-row {
          font-size: 10.5px;
          color: ${BRAND_COLORS.textMuted};
        }
        .meta-row strong {
          color: ${BRAND_COLORS.text};
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          margin: 10px 0 14px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .summary-card {
          border: 1px solid ${BRAND_COLORS.border};
          border-radius: 14px;
          padding: 10px 12px;
          background: linear-gradient(180deg, rgba(255, 253, 249, 0.98), rgba(248, 242, 234, 0.96));
          box-shadow: 0 10px 24px rgba(76, 53, 43, 0.05);
        }
        .summary-label {
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: ${BRAND_COLORS.textMuted};
          margin-bottom: 6px;
          font-weight: 700;
        }
        .summary-value {
          font-size: 14px;
          font-weight: 800;
          color: ${BRAND_COLORS.text};
        }
        .table-wrap {
          border: 1px solid ${BRAND_COLORS.border};
          border-radius: 16px;
          overflow: hidden;
          background: ${BRAND_COLORS.surface};
          box-shadow: 0 12px 28px rgba(76, 53, 43, 0.06);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 8.4px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        th, td {
          padding: 5px 6px;
          border-bottom: 1px solid rgba(92, 70, 56, 0.10);
          vertical-align: top;
          overflow-wrap: anywhere;
          line-height: 1.18;
        }
        th {
          text-align: left;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: ${BRAND_COLORS.textMuted};
          background: linear-gradient(180deg, ${BRAND_COLORS.surfaceAlt}, rgba(255, 250, 245, 0.94));
        }
        tbody tr:nth-child(even) td {
          background: rgba(255, 250, 245, 0.74);
        }
        .cell {
          padding-top: 6px;
          padding-bottom: 6px;
        }
        .cell-num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
          font-feature-settings: 'tnum' 1;
          letter-spacing: 0.01em;
        }
        .cell-ref {
          font-weight: 700;
        }
        .cell-date,
        .cell-supplier {
          white-space: nowrap;
        }
        .cell-design {
          word-break: break-word;
        }
        .cell-stone,
        .cell-wastage,
        .cell-purity,
        .cell-fine,
        .cell-gross,
        .cell-net,
        .cell-amount {
          min-width: 0;
        }
        .table-head-note {
          padding: 8px 12px 7px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          border-bottom: 1px solid ${BRAND_COLORS.border};
          background: linear-gradient(180deg, rgba(255, 253, 249, 0.96), rgba(248, 242, 234, 0.86));
        }
        .table-head-note strong {
          font-size: 11px;
          color: ${BRAND_COLORS.text};
        }
        .table-head-note span {
          font-size: 9.5px;
          color: ${BRAND_COLORS.textMuted};
        }
        .table-head-note .meta-line {
          text-align: right;
          white-space: nowrap;
        }
        .footer {
          margin-top: 10px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 10px;
          color: ${BRAND_COLORS.textMuted};
          border-top: 1px solid ${BRAND_COLORS.border};
          padding-top: 10px;
        }
        .page-break {
          break-before: page;
          page-break-before: always;
        }
        @media print {
          .preview-shell {
            padding: 0;
          }
          .toolbar {
            display: none;
          }
          .page {
            width: 100%;
            margin: 0;
            padding: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            backdrop-filter: none;
            background: transparent;
          }
        }
      </style>
    </head>
    <body>
      <div class="toolbar">
        <div class="toolbar-inner">
          <div class="toolbar-title">
            <strong>Settlement Report Preview</strong>
            <span>${escapeHtml(documentName)}.pdf</span>
          </div>
          <div class="toolbar-actions">
            <button class="toolbar-button" type="button" onclick="window.close()">Close</button>
            <button class="toolbar-button primary" type="button" onclick="window.print()">Download PDF</button>
          </div>
        </div>
      </div>
      <div class="preview-shell">
        <div class="page">
          <div class="page-body">
            <div class="header">
              <div class="brand">
                ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />` : '<div class="logo"></div>'}
                <div>
                  <div class="eyebrow">Settlement Reports</div>
                  <h1>Settlement Ledger</h1>
                  <div class="subtle">Printable supplier settlement sheet with gross, stone, net, purity, wastage, and fine.</div>
                  <div class="page-badge">Settlement Ready</div>
                </div>
              </div>
              <div class="meta">
                <div class="meta-row"><strong>Supplier:</strong> ${escapeHtml(meta.supplier || 'All')}</div>
                <div class="meta-row"><strong>Report date:</strong> ${escapeHtml(meta.reportDate || new Date().toISOString().slice(0, 10))}</div>
                <div class="meta-row"><strong>Generated:</strong> ${escapeHtml(generatedAt)}</div>
              </div>
            </div>

            <div class="summary">
              <div class="summary-card"><div class="summary-label">Total items</div><div class="summary-value">${escapeHtml(summary.total_items || 0)}</div></div>
              <div class="summary-card"><div class="summary-label">Gross weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_gross_weight ?? 0))}</div></div>
              <div class="summary-card"><div class="summary-label">Stone weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_stone_weight ?? 0))}</div></div>
              <div class="summary-card"><div class="summary-label">Net weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_net_weight ?? 0))}</div></div>
              <div class="summary-card"><div class="summary-label">Fine weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_fine_weight ?? 0))}</div></div>
            </div>

            <div class="table-wrap">
              <div class="table-head-note">
                <div>
                  <strong>Settlement Details</strong>
                  <span>Aligned for print and browser PDF preview</span>
                </div>
                <span class="meta-line">${escapeHtml(meta.supplier || 'All suppliers')} &middot; ${escapeHtml(meta.reportDate || new Date().toISOString().slice(0, 10))}</span>
              </div>
              <table>
                <colgroup>
                  <col style="width: 4.5%;" />
                  <col style="width: 7.5%;" />
                  <col style="width: 13%;" />
                  <col style="width: 14.5%;" />
                  <col style="width: 9.5%;" />
                  <col style="width: 9.5%;" />
                  <col style="width: 8.5%;" />
                  <col style="width: 9.5%;" />
                  <col style="width: 7%;" />
                  <col style="width: 8.5%;" />
                  <col style="width: 8.5%;" />
                </colgroup>
                <thead>
                  <tr>
                    <th style="width: 4.5%;">Ref</th>
                    <th style="width: 7.5%;">Date</th>
                    <th style="width: 13%;">Supplier</th>
                    <th style="width: 14.5%;">Design</th>
                    <th style="width: 9.5%;">Gross</th>
                    <th style="width: 9.5%;">Stone</th>
                    <th style="width: 8.5%;">Wastage</th>
                    <th style="width: 9.5%;">Net</th>
                    <th style="width: 7%;">Purity</th>
                    <th style="width: 8.5%;">Fine</th>
                    <th style="width: 8.5%;">Stone Amt</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRows}
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div>Generated from finalized settlement records.</div>
              <div>Use the top Download PDF button or browser print save.</div>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>`
}

