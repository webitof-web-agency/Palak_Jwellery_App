import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import {
  SalesSessionReportsError,
  listSalesSessionReportExportData,
} from './salesSessionReports.service.js'

const MODE_LABELS = {
  session: 'session',
  supplier: 'supplier',
  category: 'category',
  karat: 'karat',
  wastage: 'wastage',
}

const MODE_TITLES = {
  session: 'Session-wise',
  supplier: 'Supplier-wise',
  category: 'Category-wise',
  karat: 'Karat-wise',
  wastage: 'Wastage-wise',
}

const serviceDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(serviceDir, '../../..')
// brandLogoPath removed

const escapeCsv = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const escapeHtml = (value) => (
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
)

const escapePdfText = (value) => (
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
)

const formatWeight = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return numericValue.toFixed(3)
}

const formatAmount = (value) => {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return ''
  return numericValue.toFixed(2)
}

const formatDateIso = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
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

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

const formatStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (!normalized) return 'Active'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const formatSupplierBreakdown = (entries = []) => (
  Array.isArray(entries) && entries.length > 0
    ? entries.map((entry) => `${entry?.supplierName || 'Unknown'} - ${entry?.itemCount || 0}`).join(', ')
    : ''
)

const getSalesmanName = (salesman) => {
  if (!salesman || typeof salesman !== 'object') return ''
  return String(salesman.name || salesman.email || salesman.phone || '').trim()
}

const getSuppliersLabel = (entries = []) => (
  Array.isArray(entries) && entries.length > 0
    ? entries.map((entry) => `${entry?.supplierName || 'Unknown'} - ${entry?.itemCount || 0}`).join(', ')
    : ''
)

const sanitizeFileNameSegment = (value, fallback = 'report') => {
  const safeValue = String(value || fallback)
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return safeValue || fallback
}

const loadBrandLogoDataUrl = async () => {
  return null
}

const buildFallbackPdfBuffer = (title, lines = []) => {
  const pageWidth = 842
  const pageHeight = 595
  const leftMargin = 34
  const topMargin = 34
  const bottomMargin = 34
  const leading = 11
  const usableHeight = pageHeight - topMargin - bottomMargin
  const maxLinesPerPage = Math.max(1, Math.floor(usableHeight / leading) - 2)

  const pages = []
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage))
  }
  if (pages.length === 0) {
    pages.push([title, ''])
  }

  const contentStreams = pages.map((pageLines) => {
    const bodyStartY = 514
    const bodyCommands = pageLines
      .map((line, lineIndex) => {
        const escaped = escapePdfText(line)
        const y = bodyStartY - (lineIndex * leading)
        return `BT\n/F1 8 Tf\n1 0 0 1 ${leftMargin} ${y} Tm\n(${escaped}) Tj\nET`
      })
      .join('\n')

    const stream = [
      'q',
      'BT',
      '/F2 16 Tf',
      `1 0 0 1 ${leftMargin} ${pageHeight - 42} Tm`,
      `(${escapePdfText(title)}) Tj`,
      'ET',
      bodyCommands,
      'Q',
    ].join('\n')

    return `<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`
  })

  const fontRegularObjectNumber = 3
  const fontBoldObjectNumber = 4
  const objects = []
  const pagesKids = []
  let nextObjectNumber = 5

  for (const stream of contentStreams) {
    const contentObjectNumber = nextObjectNumber++
    objects[contentObjectNumber - 1] = stream
    const pageObjectNumber = nextObjectNumber++
    pagesKids.push(`${pageObjectNumber} 0 R`)
    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularObjectNumber} 0 R /F2 ${fontBoldObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[1] = `<< /Type /Pages /Count ${pagesKids.length} /Kids [${pagesKids.join(' ')}] >>`
  objects[2] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'

  const offsets = ['0000000000 65535 f \n']
  let pdf = '%PDF-1.4\n'

  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(String(pdf.length).padStart(10, '0') + ' 00000 n \n')
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`
  }

  const xrefStart = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += offsets.join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`

  return Buffer.from(pdf, 'utf8')
}

const buildPdfBufferFromHtml = async (html, fallbackTitle, fallbackLines = []) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 })
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] })
      const buffer = await page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '12mm',
          left: '10mm',
        },
      })
      await browser.close()
      return buffer
    } catch (error) {
      await browser.close().catch(() => {})
      throw error
    }
  } catch (error) {
    console.error(`[${fallbackTitle}] Puppeteer PDF generation failed:`, error)
    return buildFallbackPdfBuffer(fallbackTitle, fallbackLines)
  }
}

const getCsvHeader = (mode) => {
  switch (mode) {
    case 'session':
      return [
        'session_ref',
        'date',
        'customer_name',
        'customer_phone',
        'customer_area',
        'salesman',
        'suppliers',
        'items',
        'gross_weight',
        'stone_weight',
        'other_weight',
        'net_weight',
        'fine_weight',
        'warnings_count',
        'status',
      ]
    case 'supplier':
    case 'category':
      return [
        'supplier_or_company',
        'sessions',
        'items',
        'gross_weight',
        'stone_weight',
        'other_weight',
        'net_weight',
        'fine_weight',
        'stone_amount',
        'other_amount',
        'warnings_count',
        'last_activity_at',
      ]
    case 'karat':
      return [
        'karat',
        'sessions',
        'items',
        'gross_weight',
        'stone_weight',
        'other_weight',
        'net_weight',
        'fine_weight',
        'stone_amount',
        'other_amount',
        'supplier_breakdown',
        'warnings_count',
        'last_activity_at',
      ]
    case 'wastage':
      return [
        'wastage',
        'sessions',
        'items',
        'gross_weight',
        'stone_weight',
        'other_weight',
        'net_weight',
        'fine_weight',
        'stone_amount',
        'other_amount',
        'supplier_breakdown',
        'warnings_count',
        'last_activity_at',
      ]
    default:
      throw new SalesSessionReportsError('Invalid sales session export mode', 'INVALID_FILTER', 400)
  }
}

const buildCsvRows = ({ mode, rows = [] }) => {
  switch (mode) {
    case 'session':
      return rows.map((row) => ([
        row.sessionRef || '',
        formatDateIso(row.date),
        row.customerName || '',
        row.customerPhone || '',
        row.customerArea || '',
        getSalesmanName(row.salesman),
        getSuppliersLabel(row.suppliersSummary),
        row.itemCount ?? '',
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        row.warningsCount ?? '',
        row.status || '',
      ]))
    case 'supplier':
    case 'category':
      return rows.map((row) => ([
        row.groupLabel || '',
        row.sessionCount ?? '',
        row.itemCount ?? '',
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        formatAmount(row.stoneAmount),
        formatAmount(row.otherAmount),
        row.warningsCount ?? '',
        formatDateIso(row.lastActivityAt),
      ]))
    case 'karat':
    case 'wastage':
      return rows.map((row) => ([
        row.groupLabel || '',
        row.sessionCount ?? '',
        row.itemCount ?? '',
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        formatAmount(row.stoneAmount),
        formatAmount(row.otherAmount),
        formatSupplierBreakdown(row.supplierBreakdown),
        row.warningsCount ?? '',
        formatDateIso(row.lastActivityAt),
      ]))
    default:
      throw new SalesSessionReportsError('Invalid sales session export mode', 'INVALID_FILTER', 400)
  }
}

const getPdfHeader = (mode) => {
  switch (mode) {
    case 'session':
      return [
        'Session Ref',
        'Date',
        'Customer',
        'Salesman',
        'Suppliers',
        'Items',
        'Gross',
        'Stone',
        'Other',
        'Net',
        'Fine',
        'Warnings',
        'Status',
      ]
    case 'supplier':
    case 'category':
      return [
        'Supplier / Company',
        'Sessions',
        'Items',
        'Gross',
        'Stone',
        'Other',
        'Net',
        'Fine',
        'Stone Amount',
        'Other Amount',
        'Warnings',
        'Last Activity',
      ]
    case 'karat':
      return [
        'Karat',
        'Sessions',
        'Items',
        'Gross',
        'Stone',
        'Other',
        'Net',
        'Fine',
        'Stone Amount',
        'Other Amount',
        'Supplier / Company',
        'Warnings',
        'Last Activity',
      ]
    case 'wastage':
      return [
        'Wastage',
        'Sessions',
        'Items',
        'Gross',
        'Stone',
        'Other',
        'Net',
        'Fine',
        'Stone Amount',
        'Other Amount',
        'Supplier / Company',
        'Warnings',
        'Last Activity',
      ]
    default:
      throw new SalesSessionReportsError('Invalid sales session export mode', 'INVALID_FILTER', 400)
  }
}

const buildPdfRows = ({ mode, rows = [] }) => {
  switch (mode) {
    case 'session':
      return rows.map((row) => ([
        row.sessionRef || '-',
        formatDateTime(row.date),
        [row.customerName || '-', row.customerPhone || '', row.customerArea || ''].filter(Boolean).join(' | '),
        getSalesmanName(row.salesman) || '-',
        getSuppliersLabel(row.suppliersSummary) || '-',
        String(row.itemCount ?? 0),
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        String(row.warningsCount ?? 0),
        formatStatusLabel(row.status),
      ]))
    case 'supplier':
    case 'category':
      return rows.map((row) => ([
        row.groupLabel || '-',
        String(row.sessionCount ?? 0),
        String(row.itemCount ?? 0),
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        formatAmount(row.stoneAmount),
        formatAmount(row.otherAmount),
        String(row.warningsCount ?? 0),
        formatDateTime(row.lastActivityAt),
      ]))
    case 'karat':
    case 'wastage':
      return rows.map((row) => ([
        row.groupLabel || '-',
        String(row.sessionCount ?? 0),
        String(row.itemCount ?? 0),
        formatWeight(row.grossWeight),
        formatWeight(row.stoneWeight),
        formatWeight(row.otherWeight),
        formatWeight(row.netWeight),
        formatWeight(row.fineWeight),
        formatAmount(row.stoneAmount),
        formatAmount(row.otherAmount),
        formatSupplierBreakdown(row.supplierBreakdown) || '-',
        String(row.warningsCount ?? 0),
        formatDateTime(row.lastActivityAt),
      ]))
    default:
      throw new SalesSessionReportsError('Invalid sales session export mode', 'INVALID_FILTER', 400)
  }
}

const buildPdfTotalsRow = ({ mode, summary = {} }) => {
  switch (mode) {
    case 'session':
      return [
        'Total',
        '',
        '',
        '',
        '',
        String(summary.totalItems ?? 0),
        formatWeight(summary.grossWeight),
        formatWeight(summary.stoneWeight),
        formatWeight(summary.otherWeight),
        formatWeight(summary.netWeight),
        formatWeight(summary.fineWeight),
        String(summary.warningsCount ?? 0),
        '',
      ]
    case 'supplier':
    case 'category':
      return [
        'Total',
        String(summary.totalSessions ?? 0),
        String(summary.totalItems ?? 0),
        formatWeight(summary.grossWeight),
        formatWeight(summary.stoneWeight),
        formatWeight(summary.otherWeight),
        formatWeight(summary.netWeight),
        formatWeight(summary.fineWeight),
        formatAmount(summary.stoneAmount),
        formatAmount(summary.otherAmount),
        String(summary.warningsCount ?? 0),
        '',
      ]
    case 'karat':
    case 'wastage':
      return [
        'Total',
        String(summary.totalSessions ?? 0),
        String(summary.totalItems ?? 0),
        formatWeight(summary.grossWeight),
        formatWeight(summary.stoneWeight),
        formatWeight(summary.otherWeight),
        formatWeight(summary.netWeight),
        formatWeight(summary.fineWeight),
        formatAmount(summary.stoneAmount),
        formatAmount(summary.otherAmount),
        '',
        String(summary.warningsCount ?? 0),
        '',
      ]
    default:
      throw new SalesSessionReportsError('Invalid sales session export mode', 'INVALID_FILTER', 400)
  }
}

const buildDetailsEntries = (filters = {}, generatedAt = new Date()) => {
  const entries = [
    { label: 'Generated At', value: formatDateTime(generatedAt) },
    { label: 'Status', value: formatStatusLabel(filters.status || 'active') },
  ]

  const dateRange = [filters.startDate ? formatDateOnly(filters.startDate) : '', filters.endDate ? formatDateOnly(filters.endDate) : '']
    .filter(Boolean)
    .join(' to ')
  if (dateRange) entries.push({ label: 'Date Range', value: dateRange })
  if (filters.salesman) entries.push({ label: 'Salesman', value: String(filters.salesman) })
  if (filters.customer) entries.push({ label: 'Customer', value: String(filters.customer) })
  if (filters.supplier) entries.push({ label: 'Supplier / Company', value: String(filters.supplier) })
  if (filters.category) entries.push({ label: 'Category', value: String(filters.category) })
  if (filters.karat) entries.push({ label: 'Karat', value: String(filters.karat) })
  if (filters.wastage !== null && filters.wastage !== undefined && filters.wastage !== '') entries.push({ label: 'Wastage', value: String(filters.wastage) })
  if (filters.warningsOnly) entries.push({ label: 'Warnings Only', value: 'Yes' })

  return entries
}

const buildTableColgroup = (mode) => {
  const widthsByMode = {
    session: ['10%', '10%', '16%', '10%', '12%', '5%', '7%', '7%', '7%', '7%', '7%', '6%', '6%'],
    supplier: ['18%', '6%', '6%', '7%', '7%', '7%', '7%', '7%', '8%', '8%', '6%', '13%'],
    category: ['18%', '6%', '6%', '7%', '7%', '7%', '7%', '7%', '8%', '8%', '6%', '13%'],
    karat: ['10%', '6%', '6%', '7%', '7%', '7%', '7%', '7%', '8%', '8%', '14%', '6%', '10%'],
    wastage: ['10%', '6%', '6%', '7%', '7%', '7%', '7%', '7%', '8%', '8%', '14%', '6%', '10%'],
  }

  const widths = widthsByMode[mode] || widthsByMode.session
  return widths.map((width) => `<col style="width:${width}" />`).join('')
}

const buildTableHtml = ({ mode, rows = [], summary = {} }) => {
  const header = getPdfHeader(mode)
  const bodyRows = buildPdfRows({ mode, rows })
  const totalsRow = buildPdfTotalsRow({ mode, summary })

  const thead = `<thead><tr>${header.map((label, index) => `<th class="${index >= 5 || (mode !== 'session' && index >= 1) ? 'tr' : ''}">${escapeHtml(label)}</th>`).join('')}</tr></thead>`
  const tbodyRows = bodyRows.map((row) => `<tr>${row.map((value, index) => `<td class="cell ${index >= 5 || (mode !== 'session' && index >= 1 && !(mode === 'karat' || mode === 'wastage' ? index === 10 : false) && !(mode === 'supplier' || mode === 'category' ? index === 0 : false)) ? 'tr' : ''}">${escapeHtml(value)}</td>`).join('')}</tr>`).join('')
  const tfoot = `<tfoot><tr class="totals-row">${totalsRow.map((value, index) => `<td class="cell ${index >= 5 || (mode !== 'session' && index >= 1 && !(mode === 'karat' || mode === 'wastage' ? index === 10 : false)) ? 'tr' : ''}">${escapeHtml(value)}</td>`).join('')}</tr></tfoot>`

  return `
    <table class="report-table ${mode !== 'supplier' && mode !== 'category' ? 'compact' : ''}">
      <colgroup>${buildTableColgroup(mode)}</colgroup>
      ${thead}
      <tbody>${tbodyRows}</tbody>
      ${tfoot}
    </table>
  `
}

const buildSalesSessionReportPdfHtml = async ({ mode, rows = [], summary = {}, filters = {} } = {}) => {
  const logoDataUrl = await loadBrandLogoDataUrl()
  const generatedAt = new Date()
  const detailsEntries = buildDetailsEntries(filters, generatedAt)
  const detailCells = detailsEntries
    .map((entry) => `<div class="detail-cell"><span class="detail-label">${escapeHtml(entry.label)}</span><span class="detail-value">${escapeHtml(entry.value)}</span></div>`)
    .join('')

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(buildSalesSessionReportPdfFileName(mode, generatedAt))}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;700&display=swap');
        @page {
          size: A4 landscape;
          margin: 10mm;
        }
        * { box-sizing: border-box; }
        html, body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', Arial, sans-serif;
          color: #3f342d;
          background: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body {
          font-size: 11px;
          line-height: 1.35;
        }
        .page {
          width: 100%;
        }
        .header-card {
          border: 1px solid rgba(92, 70, 56, 0.18);
          border-radius: 14px;
          padding: 18px 22px 16px;
          margin-bottom: 12px;
        }
        .header-stack {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
        }
        .logo-shell {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid rgba(92, 70, 56, 0.18);
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .logo-shell img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .logo-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 1px solid rgba(92, 70, 56, 0.18);
          background: #f4efe8;
        }
        .title {
          font-family: 'Outfit', 'Inter', sans-serif;
          font-size: 24px;
          font-weight: 700;
          color: #3f342d;
          margin: 0;
        }
        .subtitle {
          font-size: 12px;
          font-weight: 700;
          color: #7b675a;
          margin: 0;
        }
        .details-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 14px;
        }
        .detail-cell {
          border: 1px solid rgba(92, 70, 56, 0.14);
          border-radius: 10px;
          padding: 8px 10px;
          min-height: 56px;
          background: #fbf6f0;
        }
        .detail-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #8c7668;
          margin-bottom: 4px;
        }
        .detail-value {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #3f342d;
          word-break: break-word;
        }
        .table-wrap {
          border: 1px solid rgba(92, 70, 56, 0.18);
          border-radius: 14px;
          overflow: hidden;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }
        thead { display: table-header-group; }
        tfoot { display: table-row-group; }
        th, td {
          border: 1px solid rgba(92, 70, 56, 0.16);
          padding: 6px 7px;
          vertical-align: top;
          word-break: break-word;
        }
        th {
          background: #f3ebe1;
          color: #5a4a41;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: left;
        }
        .report-table.compact th,
        .report-table.compact td {
          font-size: 9px;
          padding: 5px 6px;
        }
        .cell {
          color: #3f342d;
          font-size: 10px;
        }
        .tr {
          text-align: right;
        }
        .totals-row td {
          background: #f7efe7;
          font-weight: 700;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 12px;
        }
        .footer-card {
          border: 1px solid rgba(92, 70, 56, 0.18);
          border-radius: 14px;
          padding: 12px 14px;
        }
        .footer-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #7b675a;
          margin-bottom: 4px;
        }
        .footer-copy {
          font-size: 10px;
          color: #5a4a41;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header-card">
          <div class="header-stack">
            ${logoDataUrl ? `<div class="logo-shell"><img src="${logoDataUrl}" alt="Brand logo" /></div>` : '<div class="logo-placeholder"></div>'}
            <h1 class="title">Packing List</h1>
            <p class="subtitle">${escapeHtml(MODE_TITLES[mode] || 'Session-wise')}</p>
          </div>
          <div class="details-grid">${detailCells}</div>
        </div>

        <div class="table-wrap">
          ${buildTableHtml({ mode, rows, summary })}
        </div>

      </div>
    </body>
  </html>`
}

const buildSalesSessionReportPdfLines = ({ mode, rows = [], summary = {}, filters = {} }) => {
  const lines = [
    'Packing List',
    MODE_TITLES[mode] || 'Session-wise',
    `Generated At: ${formatDateTime(new Date())}`,
    `Status: ${formatStatusLabel(filters.status || 'active')}`,
    filters.startDate || filters.endDate ? `Date Range: ${[filters.startDate ? formatDateOnly(filters.startDate) : '', filters.endDate ? formatDateOnly(filters.endDate) : ''].filter(Boolean).join(' to ')}` : '',
    filters.salesman ? `Salesman: ${filters.salesman}` : '',
    filters.customer ? `Customer: ${filters.customer}` : '',
    filters.supplier ? `Supplier / Company: ${filters.supplier}` : '',
    filters.category ? `Category: ${filters.category}` : '',
    filters.karat ? `Karat: ${filters.karat}` : '',
    filters.wastage !== null && filters.wastage !== undefined && filters.wastage !== '' ? `Wastage: ${filters.wastage}` : '',
    filters.warningsOnly ? 'Warnings Only: Yes' : '',
    '',
    `Total Sessions: ${summary.totalSessions ?? 0}`,
    `Total Items: ${summary.totalItems ?? 0}`,
    `Gross: ${formatWeight(summary.grossWeight)}`,
    `Stone: ${formatWeight(summary.stoneWeight)}`,
    `Other: ${formatWeight(summary.otherWeight)}`,
    `Net: ${formatWeight(summary.netWeight)}`,
    `Fine: ${formatWeight(summary.fineWeight)}`,
    `Stone Amount: ${formatAmount(summary.stoneAmount)}`,
    `Other Amount: ${formatAmount(summary.otherAmount)}`,
    `Warnings: ${summary.warningsCount ?? 0}`,
    '',
  ].filter(Boolean)

  for (const row of buildPdfRows({ mode, rows })) {
    lines.push(row.join(' | '))
  }

  return lines
}

export const buildSalesSessionReportCsv = ({ mode, rows = [] }) => {
  const header = getCsvHeader(mode)
  const bodyRows = buildCsvRows({ mode, rows })

  return [header, ...bodyRows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

export const buildSalesSessionReportCsvFileName = (mode, reportDate = new Date()) => {
  const date = new Date(reportDate)
  const safeDate = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
  const safeMode = MODE_LABELS[mode] || 'session'
  return `sales-session-report-${safeMode}-${safeDate}.csv`
}

export const buildSalesSessionReportPdfFileName = (mode, reportDate = new Date()) => {
  const date = new Date(reportDate)
  const safeDate = Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10)
  const safeMode = MODE_LABELS[mode] || 'session'
  return `sales-session-report-${safeMode}-${safeDate}.pdf`
}

export const buildSalesSessionReportPdfBuffer = async ({ mode, rows = [], summary = {}, filters = {} } = {}) => {
  const html = await buildSalesSessionReportPdfHtml({ mode, rows, summary, filters })
  const lines = buildSalesSessionReportPdfLines({ mode, rows, summary, filters })
  return buildPdfBufferFromHtml(html, 'SalesSessionReportExport', lines)
}

export const buildSalesSessionReportCsvExport = async (query = {}) => {
  const data = await listSalesSessionReportExportData(query)

  return {
    ...data,
    csv: buildSalesSessionReportCsv({ mode: data.mode, rows: data.rows }),
    fileName: buildSalesSessionReportCsvFileName(data.mode),
  }
}

export const buildSalesSessionReportPdfExport = async (query = {}) => {
  const data = await listSalesSessionReportExportData(query)
  const buffer = await buildSalesSessionReportPdfBuffer({
    mode: data.mode,
    rows: data.rows,
    summary: data.summary || {},
    filters: data.filters || {},
  })

  return {
    ...data,
    buffer,
    fileName: buildSalesSessionReportPdfFileName(data.mode),
  }
}

export const salesSessionReportExportsService = {
  buildSalesSessionReportCsv,
  buildSalesSessionReportCsvExport,
  buildSalesSessionReportCsvFileName,
  buildSalesSessionReportPdfBuffer,
  buildSalesSessionReportPdfExport,
  buildSalesSessionReportPdfFileName,
}
