import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { Sale } from '../models/Sale.js'
import { QrIngestion } from '../models/QrIngestion.js'
import { Supplier } from '../models/Supplier.js'
import { loadSettlementSettings } from './settlementSettings.service.js'
import { formatCurrency, formatPercentage, formatWeight, preserveNumericPrecision } from './precision.service.js'
import { parsePurity, toNumber, toText } from './qrNormalization.shared.js'

const serviceDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(serviceDir, '../../..')
const brandLogoPath = path.resolve(repoRoot, 'admin-panel/public/logo-light-rose-notext-clean.png')
const brandColors = {
  bg: '#fbf6f0',
  surface: '#fffaf5',
  surfaceAlt: '#f7efe7',
  border: 'rgba(92, 70, 56, 0.14)',
  borderStrong: 'rgba(92, 70, 56, 0.2)',
  text: '#4f4039',
  textMuted: 'rgba(79, 64, 57, 0.66)',
  heading: '#b95c58',
  gold: '#c87368',
  goldDark: '#9f4a49',
  goldSoft: 'rgba(185, 92, 88, 0.08)',
}

const normalizeText = (value) => toText(value) || ''

const buildDisplayReference = (index, row = {}) => {
  void row
  return `#${String(index).padStart(3, '0')}`
}

const parseDateValue = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeFilters = (input = {}) => ({
  search: normalizeText(input.search),
  supplier: normalizeText(input.supplier),
  category: normalizeText(input.category),
  metalType: normalizeText(input.metalType || input.metal_type),
  startDate: parseDateValue(input.startDate || input.from || input.start),
  endDate: parseDateValue(input.endDate || input.to || input.end),
})

const buildSettlementQuery = async (filters = {}) => {
  const normalized = normalizeFilters(filters)
  const query = {}

  if (normalized.supplier) {
    if (normalized.supplier.match(/^[a-f\d]{24}$/i)) {
      query.supplier = normalized.supplier
    } else {
      const suppliers = await Supplier.find({
        $or: [
          { name: { $regex: escapeRegex(normalized.supplier), $options: 'i' } },
          { code: { $regex: escapeRegex(normalized.supplier), $options: 'i' } },
        ],
      }, { _id: 1 }).lean()
      query.supplier = { $in: suppliers.map((supplier) => supplier._id) }
    }
  }

  if (normalized.category) {
    query.category = { $regex: escapeRegex(normalized.category), $options: 'i' }
  }

  if (normalized.metalType) {
    query.metalType = { $regex: escapeRegex(normalized.metalType), $options: 'i' }
  }

  if (normalized.startDate || normalized.endDate) {
    query.saleDate = {}
    if (normalized.startDate) {
      query.saleDate.$gte = normalized.startDate
    }
    if (normalized.endDate) {
      const end = new Date(normalized.endDate)
      end.setHours(23, 59, 59, 999)
      query.saleDate.$lte = end
    }
  }

  if (normalized.search) {
    const search = escapeRegex(normalized.search)
    const supplierMatches = await Supplier.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    }, { _id: 1 }).lean()

    const orConditions = [
      { category: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } },
      { metalType: { $regex: search, $options: 'i' } },
      { purity: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
    ]

    if (supplierMatches.length > 0) {
      orConditions.push({ supplier: { $in: supplierMatches.map((supplier) => supplier._id) } })
    }

    query.$or = orConditions
  }

  return { normalized, query }
}

const mapSettlementRow = (sale = {}, settings = {}) => {
  const purityPercent = parsePurity(sale?.purity)
  const defaultWastage = toNumber(settings.default_wastage_percent)
  const wastagePercent = defaultWastage === null ? null : defaultWastage
  const netWeight = toNumber(sale?.netWeight)
  const stoneWeight = toNumber(sale?.stoneWeight)
  const grossWeight = toNumber(sale?.grossWeight)
  const defaultStoneRate = toNumber(settings.default_stone_rate) ?? 0
  const finePrecision = Math.max(0, Math.min(6, Number.isFinite(Number(settings.fine_precision)) ? Number(settings.fine_precision) : 3))
  const calculationMode = String(settings.settlement_calculation_mode || 'strict').trim().toLowerCase()

  let fineWeight = null
  if (netWeight !== null && purityPercent !== null) {
    if (wastagePercent !== null || calculationMode === 'default_wastage') {
      const effectiveWastage = wastagePercent ?? 0
      const rawFine = netWeight * ((purityPercent + effectiveWastage) / 100)
      fineWeight = Number(rawFine.toFixed(finePrecision))
    }
  }

  const stoneAmount = stoneWeight === null ? 0 : Number((stoneWeight * defaultStoneRate).toFixed(2))

  return {
    id: sale._id ? String(sale._id) : '',
    sale_date: sale.saleDate || sale.createdAt || null,
    createdAt: sale.saleDate || sale.createdAt || null,
    supplier: normalizeText(sale?.supplier?.name) || normalizeText(sale?.supplier?.code) || 'Unknown',
    supplier_code: normalizeText(sale?.supplier?.code),
    category: normalizeText(sale?.category),
    item_code: normalizeText(sale?.itemCode),
    design_code: normalizeText(sale?.itemCode),
    metal_type: normalizeText(sale?.metalType),
    purity: normalizeText(sale?.purity),
    gross_weight: grossWeight ?? 0,
    stone_weight: stoneWeight ?? 0,
    net_weight: netWeight ?? 0,
    purity_percent: purityPercent,
    wastage_percent: wastagePercent,
    fine_weight: fineWeight,
    stone_amount: stoneAmount,
    status: 'finalized',
    settlement_state: 'finalized',
    workflow_state: 'finalized',
    approved_at: sale.saleDate || sale.createdAt || null,
    exported_at: null,
    notes: normalizeText(sale?.notes),
    is_duplicate: sale?.isDuplicate === true,
    rate_per_gram: toNumber(sale?.ratePerGram) ?? 0,
    total_value: toNumber(sale?.totalValue) ?? 0,
  }
}

const mapLegacySettlementRow = (record = {}, settings = {}) => {
  const final = record?.final || {}
  const valuationTotals = record?.valuation?.totals || {}
  const sourceSupplier = normalizeText(final?.supplier) || normalizeText(record?.parsed?.supplier) || 'Unknown'
  const grossWeight = toNumber(final?.gross_weight) ?? toNumber(valuationTotals.gross_weight) ?? 0
  const stoneWeight = toNumber(final?.stone_weight) ?? toNumber(valuationTotals.stone_weight) ?? 0
  const netWeight = toNumber(final?.net_weight) ?? toNumber(valuationTotals.net_weight) ?? 0
  const purityPercent = toNumber(final?.purity_percent)
  const wastagePercent = toNumber(final?.wastage_percent)
  const stoneAmount = toNumber(final?.stone_amount) ?? toNumber(valuationTotals.stone_amount) ?? 0
  const rawFine = toNumber(final?.fine_weight) ?? toNumber(valuationTotals.fine_weight)
  const finePrecision = Math.max(0, Math.min(6, Number.isFinite(Number(settings.fine_precision)) ? Number(settings.fine_precision) : 3))
  const fineWeight = rawFine === null ? null : Number(rawFine.toFixed(finePrecision))

  return {
    id: record._id ? String(record._id) : '',
    sale_date: record.approvedAt || record.reviewedAt || record.createdAt || null,
    createdAt: record.approvedAt || record.reviewedAt || record.createdAt || null,
    supplier: sourceSupplier,
    supplier_code: '',
    category: normalizeText(final?.category) || '',
    item_code: normalizeText(final?.itemCode) || normalizeText(final?.design_code) || '',
    design_code: normalizeText(final?.design_code) || normalizeText(final?.itemCode) || '',
    metal_type: normalizeText(final?.metalType) || '',
    purity: normalizeText(final?.purity) || '',
    gross_weight: grossWeight,
    stone_weight: stoneWeight,
    net_weight: netWeight,
    purity_percent: purityPercent,
    wastage_percent: wastagePercent,
    fine_weight: fineWeight,
    stone_amount: stoneAmount,
    status: 'finalized',
    settlement_state: 'finalized',
    workflow_state: 'finalized',
    approved_at: record.approvedAt || record.reviewedAt || null,
    exported_at: null,
    notes: normalizeText(record?.correction_note),
    is_duplicate: false,
    rate_per_gram: 0,
    total_value: 0,
    source_type: 'legacy_qr',
  }
}

const filterSettlementRows = (rows = [], filters = {}) => {
  const normalized = normalizeFilters(filters)

  return rows.filter((row) => {
    if (normalized.search) {
      const search = normalized.search.toLowerCase()
      const supplier = normalizeText(row.supplier).toLowerCase()
      const category = normalizeText(row.category).toLowerCase()
      const itemCode = normalizeText(row.item_code).toLowerCase()
      const metalType = normalizeText(row.metal_type).toLowerCase()
      const purity = normalizeText(row.purity).toLowerCase()
      if (
        !supplier.includes(search) &&
        !category.includes(search) &&
        !itemCode.includes(search) &&
        !metalType.includes(search) &&
        !purity.includes(search)
      ) {
        return false
      }
    }

    if (normalized.supplier && !normalizeText(row.supplier).toLowerCase().includes(normalized.supplier.toLowerCase())) {
      return false
    }

    if (normalized.category && !normalizeText(row.category).toLowerCase().includes(normalized.category.toLowerCase())) {
      return false
    }

    if (normalized.metalType && !normalizeText(row.metal_type).toLowerCase().includes(normalized.metalType.toLowerCase())) {
      return false
    }

    if (normalized.startDate || normalized.endDate) {
      const date = row.sale_date ? new Date(row.sale_date) : null
      if (!date || Number.isNaN(date.getTime())) {
        return false
      }
      if (normalized.startDate && date < normalized.startDate) {
        return false
      }
      if (normalized.endDate) {
        const end = new Date(normalized.endDate)
        end.setHours(23, 59, 59, 999)
        if (date > end) {
          return false
        }
      }
    }

    return true
  })
}

const buildSettlementSummary = (rows = []) => {
  return rows.reduce(
    (acc, row) => {
      acc.total_items += 1
      acc.total_gross_weight += toNumber(row.gross_weight) ?? 0
      acc.total_stone_weight += toNumber(row.stone_weight) ?? 0
      acc.total_net_weight += toNumber(row.net_weight) ?? 0
      acc.total_fine_weight += toNumber(row.fine_weight) ?? 0
      acc.total_stone_amount += toNumber(row.stone_amount) ?? 0
      return acc
    },
    {
      total_items: 0,
      total_gross_weight: 0,
      total_stone_weight: 0,
      total_net_weight: 0,
      total_fine_weight: 0,
      total_stone_amount: 0,
    },
  )
}

const escapeCsv = (value) => {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

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

const loadBrandLogoDataUrl = async () => {
  try {
    const buffer = await readFile(brandLogoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

const buildSettlementPdfHtml = async (rows = [], summary = {}, meta = {}) => {
  const logoDataUrl = await loadBrandLogoDataUrl()
  const generatedAt = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date())

  const tableRows = rows.map((row) => `
    <tr>
      <td class="cell ref">${escapeHtml(row.display_ref || row.sequence || '-')}</td>
      <td class="cell date">${escapeHtml(formatDateOnly(row.sale_date || row.createdAt))}</td>
      <td class="cell supplier">${escapeHtml(row.supplier || 'Unknown')}</td>
      <td class="cell item">${escapeHtml(row.item_code || row.design_code || '-')}</td>
      <td class="cell num">${escapeHtml(formatWeight(row.gross_weight))}</td>
      <td class="cell num">${escapeHtml(formatWeight(row.stone_weight))}</td>
      <td class="cell num">${escapeHtml(formatPercentage(row.wastage_percent))}</td>
      <td class="cell num">${escapeHtml(formatWeight(row.net_weight))}</td>
      <td class="cell num">${escapeHtml(formatPercentage(row.purity_percent))}</td>
      <td class="cell num">${escapeHtml(formatWeight(row.fine_weight))}</td>
      <td class="cell num">${escapeHtml(formatCurrency(row.stone_amount))}</td>
    </tr>
  `).join('')

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page {
          size: A4 landscape;
          margin: 14mm 12mm 16mm 12mm;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, Helvetica, sans-serif;
          color: ${brandColors.text};
          background: ${brandColors.bg};
          line-height: 1.4;
        }
        .page {
          width: 100%;
          background: radial-gradient(circle at 0% 0%, rgba(200, 115, 104, 0.06) 0%, transparent 34%), linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 250, 245, 0.04));
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid ${brandColors.border};
          margin-bottom: 14px;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo {
          width: 64px;
          height: 64px;
          object-fit: contain;
          border-radius: 50%;
          background: ${brandColors.goldSoft};
          padding: 8px;
          border: 1px solid ${brandColors.borderStrong};
        }
        .eyebrow {
          font-size: 11px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: ${brandColors.heading};
          font-weight: 700;
          margin-bottom: 6px;
        }
        h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.15;
          color: ${brandColors.heading};
        }
        .subtle {
          margin-top: 6px;
          color: ${brandColors.textMuted};
          font-size: 12px;
        }
        .meta {
          min-width: 260px;
          display: grid;
          gap: 8px;
          justify-items: end;
        }
        .meta-row {
          font-size: 11px;
          color: ${brandColors.textMuted};
        }
        .meta-row strong {
          color: ${brandColors.text};
        }
        .summary {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
          margin: 16px 0 20px;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .summary-card {
          border: 1px solid ${brandColors.borderStrong};
          border-radius: 16px;
          padding: 16px 20px;
          background: linear-gradient(180deg, rgba(255, 250, 245, 0.98), rgba(247, 239, 231, 0.94));
          box-shadow: 0 4px 12px rgba(76, 53, 43, 0.04);
        }
        .summary-label {
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: ${brandColors.textMuted};
          margin-bottom: 8px;
          font-weight: 700;
        }
        .summary-value {
          font-size: 20px;
          font-weight: 700;
          color: ${brandColors.text};
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 11px;
          background: ${brandColors.surface};
          border: 1px solid ${brandColors.borderStrong};
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(76, 53, 43, 0.03);
        }
        thead {
          display: table-header-group;
        }
        tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        th, td {
          padding: 12px 8px;
          border-bottom: 1px solid rgba(92, 70, 56, 0.10);
          vertical-align: top;
          overflow-wrap: anywhere;
          line-height: 1.3;
        }
        th {
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          color: ${brandColors.goldDark};
          font-weight: 700;
          background: ${brandColors.goldSoft};
        }
        tbody tr:nth-child(even) td {
          background: rgba(255, 250, 245, 0.74);
        }
        .num {
          text-align: right;
          white-space: nowrap;
        }
        .cell.ref {
          font-weight: 700;
        }
        .supplier,
        .item,
        .date {
          word-break: break-word;
        }
        .footer {
          margin-top: 14px;
          display: flex;
          justify-content: space-between;
          gap: 16px;
          font-size: 10px;
          color: ${brandColors.textMuted};
          border-top: 1px solid ${brandColors.border};
          padding-top: 10px;
        }
        .page-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(200, 115, 104, 0.08);
          color: ${brandColors.heading};
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-top: 10px;
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="brand">
            ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />` : '<div class="logo"></div>'}
            <div>
              <div class="eyebrow">Settlement Reports</div>
              <h1>Settlement Ledger</h1>
              <div class="subtle">Printable weight, purity, fine, and stone settlement sheet.</div>
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
          <div class="summary-card"><div class="summary-label">Gross weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_gross_weight || 0))}</div></div>
          <div class="summary-card"><div class="summary-label">Stone weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_stone_weight || 0))}</div></div>
          <div class="summary-card"><div class="summary-label">Net weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_net_weight || 0))}</div></div>
          <div class="summary-card"><div class="summary-label">Fine weight</div><div class="summary-value">${escapeHtml(formatWeight(summary.total_fine_weight || 0))}</div></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">Ref</th>
              <th style="width: 8%;">Date</th>
              <th style="width: 14%;">Supplier</th>
              <th style="width: 16%;">Design</th>
              <th style="width: 8%;">Gross</th>
              <th style="width: 8%;">Stone</th>
              <th style="width: 8%;">Wastage</th>
              <th style="width: 8%;">Net</th>
              <th style="width: 7%;">Purity</th>
              <th style="width: 8%;">Fine</th>
              <th style="width: 8%;">Stone Amt</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div class="footer">
          <div>Generated from finalized settlement records.</div>
          <div>Page printed for operational settlement use.</div>
        </div>
      </div>
    </body>
  </html>`
}

const buildSettlementCsv = (rows = []) => {
  const header = [
    'sale_date',
    'supplier',
    'category',
    'item_code',
    'metal_type',
    'gross_weight',
    'stone_weight',
    'net_weight',
    'purity_percent',
    'wastage_percent',
    'fine_weight',
    'stone_amount',
    'status',
  ]

  const lines = rows.map((row) => [
    row.sale_date instanceof Date ? row.sale_date.toISOString() : row.sale_date,
    row.supplier,
    row.category,
    row.item_code,
    row.metal_type,
    preserveNumericPrecision(row.gross_weight),
    preserveNumericPrecision(row.stone_weight),
    preserveNumericPrecision(row.net_weight),
    preserveNumericPrecision(row.purity_percent),
    preserveNumericPrecision(row.wastage_percent),
    preserveNumericPrecision(row.fine_weight),
    preserveNumericPrecision(row.stone_amount),
    row.status,
  ])

  return [header, ...lines]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

const escapePdfText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const buildSettlementPdfFallbackBuffer = (rows = [], summary = {}, meta = {}) => {
  const pageWidth = 842
  const pageHeight = 595
  const leftMargin = 34
  const topMargin = 34
  const rightMargin = 34
  const bottomMargin = 34
  const fontSize = 8
  const leading = 11
  const usableHeight = pageHeight - topMargin - bottomMargin
  const maxLinesPerPage = Math.max(1, Math.floor(usableHeight / leading) - 2)

  const lines = []
  lines.push('Settlement Report')
  lines.push(`Supplier: ${meta.supplier || 'All'}`)
  lines.push(`Report date: ${meta.reportDate || new Date().toISOString().slice(0, 10)}`)
  lines.push(`Generated: ${new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date())}`)
  lines.push(`Total items: ${summary.total_items || 0}`)
  lines.push(`Gross: ${formatWeight(summary.total_gross_weight)}`)
  lines.push(`Stone: ${formatWeight(summary.total_stone_weight)}`)
  lines.push(`Net: ${formatWeight(summary.total_net_weight)}`)
  lines.push(`Fine: ${formatWeight(summary.total_fine_weight)}`)
  lines.push(`Stone Amount: ${formatCurrency(summary.total_stone_amount)}`)
  lines.push('')
  lines.push('Ref | Date | Supplier | Design')
  lines.push('Gross | Stone | Wastage | Net')
  lines.push('Purity | Fine | Stone Amt')
  lines.push('-----------------------------------------------------------')

  for (const row of rows) {
    lines.push(`${row.display_ref || row.sequence || '-'} | ${formatDateOnly(row.sale_date || row.createdAt)} | ${row.supplier || 'Unknown'} | ${row.item_code || row.design_code || '-'}`)
    lines.push(`Gross ${formatWeight(row.gross_weight)} | Stone ${formatWeight(row.stone_weight)} | Wastage ${formatPercentage(row.wastage_percent)} | Net ${formatWeight(row.net_weight)}`)
    lines.push(`Purity ${formatPercentage(row.purity_percent)} | Fine ${formatWeight(row.fine_weight)} | Stone Amt ${formatCurrency(row.stone_amount)}`)
    lines.push('')
  }

  const pages = []
  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage))
  }

  const contentStreams = pages.map((pageLines, pageIndex) => {
    const titleY = 548
    const footerY = 24
    const bodyStartY = 514
    const bodyLeading = 11
    const bodyCommands = pageLines
      .map((line, lineIndex) => {
        const escaped = escapePdfText(line)
        const y = bodyStartY - (lineIndex * bodyLeading)
        return `BT\n/F1 8 Tf\n1 0 0 1 ${leftMargin} ${y} Tm\n(${escaped}) Tj\nET`
      })
      .join('\n')

    const pageHeader = [
      'BT',
      '/F1 10 Tf',
      `1 0 0 1 ${leftMargin} ${titleY} Tm`,
      '(Settlement Report) Tj',
      'ET',
      bodyCommands,
      `BT\n/F1 7 Tf\n1 0 0 1 ${leftMargin} ${footerY} Tm\n(Page ${pageIndex + 1} of ${pages.length}) Tj\nET`,
    ].join('\n')

    return `<< /Length ${Buffer.byteLength(pageHeader, 'utf8')} >>\nstream\n${pageHeader}\nendstream`
  })

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${4 + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ...pages.flatMap((_, index) => [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`,
      contentStreams[index],
    ]),
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = ['0000000000 65535 f \n']
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

const buildSettlementPdfBuffer = async (rows = [], summary = {}, meta = {}) => {
  try {
    const html = await buildSettlementPdfHtml(rows, summary, meta)
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 })
    await page.setContent(html, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] })
    const buffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: '14mm',
        right: '12mm',
        bottom: '16mm',
        left: '12mm',
      },
    })
    await browser.close()
    return buffer
  } catch (error) {
    console.error('[SettlementPdf] Puppeteer PDF generation failed:', error)
    return buildSettlementPdfFallbackBuffer(rows, summary, meta)
  }
}

const buildSettlementDetail = (row = {}) => ({
  ...row,
  gross_weight: toNumber(row.gross_weight) ?? 0,
  stone_weight: toNumber(row.stone_weight) ?? 0,
  net_weight: toNumber(row.net_weight) ?? 0,
  purity_percent: toNumber(row.purity_percent),
  wastage_percent: toNumber(row.wastage_percent),
  fine_weight: toNumber(row.fine_weight),
  stone_amount: toNumber(row.stone_amount) ?? 0,
})

const annotateSettlementRows = (rows = []) =>
  rows.map((row, index) => ({
    ...row,
    sequence: index + 1,
    display_ref: buildDisplayReference(index + 1, row),
  }))

const listSettlementRows = async (filters = {}) => {
  const settings = await loadSettlementSettings()
  const { query } = await buildSettlementQuery(filters)
  const sales = await Sale.find(query)
    .sort({ saleDate: -1, createdAt: -1 })
    .populate('supplier', 'name code')
    .lean()

  let rows = sales.map((sale) => mapSettlementRow(sale, settings))
  if (rows.length === 0) {
    const legacyRecords = await QrIngestion.find({
      $or: [
        { status: 'approved' },
        { approvedAt: { $ne: null } },
      ],
    })
      .sort({ approvedAt: -1, reviewedAt: -1, createdAt: -1, _id: -1 })
      .lean()

    rows = legacyRecords.map((record) => mapLegacySettlementRow(record, settings))
  }
  return {
    rows: annotateSettlementRows(rows),
    summary: buildSettlementSummary(rows),
    settings,
  }
}

export {
  buildSettlementCsv,
  buildSettlementDetail,
  buildSettlementPdfBuffer,
  buildSettlementSummary,
  buildSettlementQuery,
  filterSettlementRows,
  listSettlementRows,
  mapSettlementRow,
  normalizeFilters as normalizeSettlementFilters,
}
