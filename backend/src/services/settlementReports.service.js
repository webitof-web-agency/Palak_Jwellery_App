import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer'
import { CaptureSession } from '../models/CaptureSession.js'
import { Sale } from '../models/Sale.js'
import { ScanBatch } from '../models/ScanBatch.js'
import { QrIngestion } from '../models/QrIngestion.js'
import { Supplier } from '../models/Supplier.js'
import { User } from '../models/User.js'
import { buildUserSummary, buildSupplierSummary } from './batch.service.js'
import { buildSessionSummary } from './captureSessionLifecycle.service.js'
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

const ALLOWED_REPORT_SCOPES = ['item-ledger', 'session', 'supplier-section']

const normalizeText = (value) => toText(value) || ''

const normalizeReportScope = (value) => {
  const scope = normalizeText(value).toLowerCase()
  return ALLOWED_REPORT_SCOPES.includes(scope) ? scope : 'item-ledger'
}

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
  karat: normalizeText(input.karat || input.metalType || input.metal_type),
  startDate: parseDateValue(input.startDate || input.from || input.start),
  endDate: parseDateValue(input.endDate || input.to || input.end),
})

const normalizeSessionFilters = (input = {}) => ({
  search: normalizeText(input.search),
  customer: normalizeText(input.customer || input.q),
  assignedSalesman: normalizeText(input.assignedSalesman),
  status: normalizeText(input.status).toLowerCase(),
  startDate: parseDateValue(input.startDate || input.from || input.start),
  endDate: parseDateValue(input.endDate || input.to || input.end),
  sortBy: normalizeText(input.sortBy || input.sort).split(':')[0] || 'finalizedAt',
  sortOrder: normalizeText(input.sortOrder || input.sort).split(':')[1] || 'desc',
  page: Math.max(1, Number.parseInt(input.page, 10) || 1),
  limit: Math.max(1, Math.min(100, Number.parseInt(input.limit, 10) || 20)),
})

const normalizeSupplierSectionFilters = (input = {}) => ({
  search: normalizeText(input.search),
  supplier: normalizeText(input.supplier),
  session: normalizeText(input.session),
  assignedSalesman: normalizeText(input.assignedSalesman),
  status: normalizeText(input.status).toLowerCase(),
  startDate: parseDateValue(input.startDate || input.from || input.start),
  endDate: parseDateValue(input.endDate || input.to || input.end),
  sortBy: normalizeText(input.sortBy || input.sort).split(':')[0] || 'finalizedAt',
  sortOrder: normalizeText(input.sortOrder || input.sort).split(':')[1] || 'desc',
  page: Math.max(1, Number.parseInt(input.page, 10) || 1),
  limit: Math.max(1, Math.min(100, Number.parseInt(input.limit, 10) || 20)),
})

const normalizeItemLedgerFilters = (input = {}) => normalizeFilters(input)

const resolveIdValue = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') {
      return value.toHexString()
    }
    if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') {
      return value.toString()
    }
    if (value._id) {
      return resolveIdValue(value._id)
    }
    if (value.id && value.id !== value) {
      return resolveIdValue(value.id)
    }
  }
  return normalizeText(value) || null
}

const buildPagination = ({ page = 1, limit = 20, total = 0 } = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 20))
  const safeTotal = Math.max(0, Number.parseInt(total, 10) || 0)
  const pages = Math.max(1, Math.ceil(safeTotal / safeLimit))

  return {
    page: safePage,
    limit: safeLimit,
    total: safeTotal,
    pages,
  }
}

const resolveBatchRevisionTotals = (revision = {}, batch = {}) => {
  const totals = revision?.totals && typeof revision.totals === 'object'
    ? revision.totals
    : batch?.totals && typeof batch.totals === 'object'
      ? batch.totals
      : {}

  return {
    grossWeight: toNumber(totals.grossWeight ?? totals.gross_weight) ?? 0,
    stoneWeight: toNumber(totals.stoneWeight ?? totals.stone_weight) ?? 0,
    otherWeight: toNumber(totals.otherWeight ?? totals.other_weight) ?? 0,
    netWeight: toNumber(totals.netWeight ?? totals.net_weight) ?? 0,
    fineWeight: toNumber(totals.fineWeight ?? totals.fine_weight) ?? 0,
    stoneAmount: toNumber(totals.stoneAmount ?? totals.stone_amount) ?? 0,
  }
}

const selectLatestFinalizedBatchRevision = (batch = {}) => {
  const revisions = Array.isArray(batch?.revisions) ? batch.revisions : []
  const finalizedRevisions = revisions
    .filter((revision) => {
      const status = normalizeText(revision?.status).toLowerCase()
      return status === 'finalized' || revision?.finalizedAt
    })
    .sort((left, right) => (toNumber(right?.revision) ?? 0) - (toNumber(left?.revision) ?? 0))

  if (finalizedRevisions.length > 0) {
    return finalizedRevisions[0]
  }

  if (normalizeText(batch?.status).toLowerCase() === 'finalized') {
    return {
      revision: toNumber(batch?.revision) ?? 1,
      status: 'finalized',
      totals: batch?.totals || null,
      itemCount: toNumber(batch?.itemCount) ?? 0,
      warningsCount: toNumber(batch?.warningsCount) ?? 0,
      reviewCount: toNumber(batch?.reviewCount) ?? 0,
      duplicateCount: toNumber(batch?.duplicateCount) ?? 0,
      manualOverrideCount: toNumber(batch?.manualOverrideCount) ?? 0,
      finalizedAt: batch?.finalizedAt || null,
      finalizedBy: batch?.finalizedBy || null,
      reopenReason: batch?.reopenReason || null,
      reopenedAt: batch?.reopenedAt || null,
      reopenedBy: batch?.reopenedBy || null,
      exports: Array.isArray(batch?.revisions) ? [] : [],
    }
  }

  return null
}

const isBatchFinalForOfficialReporting = (batch = {}) => {
  return normalizeText(batch?.status).toLowerCase() === 'finalized' && Boolean(selectLatestFinalizedBatchRevision(batch))
}

const isSessionFinalForOfficialReporting = (session = {}, childBatches = []) => {
  if (normalizeText(session?.status).toLowerCase() !== 'finalized') {
    return false
  }

  const relevantBatches = Array.isArray(childBatches)
    ? childBatches.filter((batch) => normalizeText(batch?.status).toLowerCase() !== 'cancelled')
    : []

  if (relevantBatches.length === 0) {
    return false
  }

  return relevantBatches.every((batch) => normalizeText(batch?.status).toLowerCase() === 'finalized' && isBatchFinalForOfficialReporting(batch))
}

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

  if (normalized.karat) {
    query.metalType = { $regex: escapeRegex(normalized.karat), $options: 'i' }
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

const mapSettlementRow = (sale = {}, settings = {}, lineage = {}) => {
  const settlementInputs = sale?.settlementInputs && typeof sale.settlementInputs === 'object' ? sale.settlementInputs : {}
  const calculationSnapshot = sale?.calculationSnapshot && typeof sale.calculationSnapshot === 'object' ? sale.calculationSnapshot : {}
  const purityPercent =
    parsePurity(sale?.purity) ??
    toNumber(settlementInputs?.purityPercent) ??
    toNumber(calculationSnapshot?.purityPercent)
  const defaultWastage = toNumber(settings.default_wastage_percent)
  const wastagePercent =
    toNumber(settlementInputs?.wastagePercent) ??
    toNumber(calculationSnapshot?.wastagePercent) ??
    (defaultWastage === null ? null : defaultWastage)
  const netWeight = toNumber(sale?.netWeight)
  const stoneWeight = toNumber(sale?.stoneWeight)
  const grossWeight = toNumber(sale?.grossWeight)
  const defaultStoneRate = toNumber(settings.default_stone_rate) ?? 0
  const finePrecision = Math.max(0, Math.min(6, Number.isFinite(Number(settings.fine_precision)) ? Number(settings.fine_precision) : 3))
  const calculationMode = String(settings.settlement_calculation_mode || 'strict').trim().toLowerCase()

  let fineWeight = toNumber(calculationSnapshot?.fineWeight)
  if (fineWeight === null && netWeight !== null && purityPercent !== null) {
    if (wastagePercent !== null || calculationMode === 'default_wastage') {
      const effectiveWastage = wastagePercent ?? 0
      const rawFine = netWeight * ((purityPercent + effectiveWastage) / 100)
      fineWeight = Number(rawFine.toFixed(finePrecision))
    }
  }

  const stoneAmount = stoneWeight === null ? 0 : Number((stoneWeight * defaultStoneRate).toFixed(2))

  return {
    id: sale._id ? String(sale._id) : '',
    saleId: sale._id ? String(sale._id) : '',
    batchId: lineage.batchId || resolveIdValue(sale?.batchId) || null,
    batchRef: lineage.batchRef || null,
    sessionId: lineage.sessionId || null,
    sessionRef: lineage.sessionRef || null,
    sale_date: sale.saleDate || sale.createdAt || null,
    createdAt: sale.saleDate || sale.createdAt || null,
    supplier: normalizeText(sale?.supplier?.name) || normalizeText(sale?.supplier?.code) || 'Unknown',
    supplier_code: normalizeText(sale?.supplier?.code),
    category: normalizeText(sale?.category),
    item_code: normalizeText(sale?.itemCode),
    design_code: normalizeText(sale?.itemCode),
    karat: normalizeText(sale?.metalType),
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
  const purityPercent = toNumber(final?.purity_percent) ?? toNumber(record?.final?.purityPercent) ?? toNumber(record?.parsed?.purityPercent)
  const wastagePercent = toNumber(final?.wastage_percent) ?? toNumber(record?.final?.wastagePercent) ?? toNumber(record?.parsed?.wastagePercent)
  const stoneAmount = toNumber(final?.stone_amount) ?? toNumber(valuationTotals.stone_amount) ?? 0
  const rawFine = toNumber(final?.fine_weight) ?? toNumber(valuationTotals.fine_weight)
  const finePrecision = Math.max(0, Math.min(6, Number.isFinite(Number(settings.fine_precision)) ? Number(settings.fine_precision) : 3))
  const fineWeight = rawFine === null ? null : Number(rawFine.toFixed(finePrecision))

  return {
    id: record._id ? String(record._id) : '',
    saleId: record._id ? String(record._id) : '',
    batchId: null,
    batchRef: null,
    sessionId: null,
    sessionRef: null,
    sale_date: record.approvedAt || record.reviewedAt || record.createdAt || null,
    createdAt: record.approvedAt || record.reviewedAt || record.createdAt || null,
    supplier: sourceSupplier,
    supplier_code: '',
    category: normalizeText(final?.category) || '',
    item_code: normalizeText(final?.itemCode) || normalizeText(final?.design_code) || '',
    design_code: normalizeText(final?.design_code) || normalizeText(final?.itemCode) || '',
    karat: normalizeText(final?.metalType) || '',
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
      const karat = normalizeText(row.karat).toLowerCase()
      const purity = normalizeText(row.purity).toLowerCase()
      if (
        !supplier.includes(search) &&
        !category.includes(search) &&
        !itemCode.includes(search) &&
        !karat.includes(search) &&
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

    if (normalized.karat && !normalizeText(row.karat).toLowerCase().includes(normalized.karat.toLowerCase())) {
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

  const tableRows = rows.map((row, i) => `
    <tr>
      <td class="cell tc">${i + 1}</td>
      <td class="cell tc">${escapeHtml(row.display_ref || row.sequence || '-')}</td>
      <td class="cell">${escapeHtml(formatDateOnly(row.sale_date || row.createdAt))}</td>
      <td class="cell">${escapeHtml(row.supplier || 'Unknown')}</td>
      <td class="cell">${escapeHtml(row.item_code || row.design_code || '-')}</td>
      <td class="cell tr">${escapeHtml(formatWeight(row.gross_weight))}</td>
      <td class="cell tr">${escapeHtml(formatWeight(row.stone_weight))}</td>
      <td class="cell tr">${escapeHtml(formatWeight(row.other_weight ?? 0))}</td>
      <td class="cell tr">${escapeHtml(formatWeight(row.net_weight))}</td>
      <td class="cell tr">${escapeHtml(formatPercentage(row.wastage_percent))}</td>
      <td class="cell tr">${escapeHtml(formatPercentage(row.purity_percent))}</td>
      <td class="cell tr">${escapeHtml(formatWeight(row.fine_weight))}</td>
      <td class="cell tr">${escapeHtml(formatCurrency(row.stone_amount))}</td>
    </tr>
  `).join('')

  const documentName = `settlement-ledger-${meta.supplier || 'All'}-${new Date().toISOString().slice(0, 10)}`

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>${escapeHtml(documentName)}.pdf</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;700&display=swap');
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 14mm 12mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          height: 100%;
          background: #fff;
          color: #000;
          font-family: 'Inter', Arial, Helvetica, sans-serif;
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
          background: rgba(72, 39, 192, 0.06);
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
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
          text-decoration: none;
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
          min-height: 100vh;
          padding: 70px 16px 24px;
          background: #e8e8e8;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .page {
          width: min(700px, 100%);
          min-height: calc(100vh - 94px);
          margin: 0 auto;
          border: 2px solid #000;
          background: #fff;
          display: flex;
          flex-direction: column;
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
          border: 1.5px solid #c87368;
          padding: 0.5px;
          flex: 0 0 auto;
        }
        .logo-placeholder {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1.5px solid #c87368;
          flex: 0 0 auto;
        }
        .company-name {
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.03em;
          color: #b95c58;
          font-family: "Outfit", "Inter", Arial, sans-serif;
        }
        .company-subtitle {
          font-size: 11px;
          color: #4f4039;
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
          background: #fffaf5;
          color: #b95c58;
          font-family: "Outfit", "Inter", Arial, sans-serif;
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
          color: #4f4039;
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
          color: #b95c58;
          margin-bottom: 3px;
        }
        .summary-cell .s-value {
          font-size: 13px;
          font-weight: 700;
          color: #4f4039;
        }

        /* ── Data table ── */
        .table-wrap {
          overflow: hidden;
          flex: 1;
          border-left: none;
          border-right: none;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 9.2px;
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
          color: #4f4039;
        }
        th {
          background: #fbf6f0;
          font-weight: 700;
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #b95c58;
        }
        tbody tr:nth-child(even) td {
          background: #fffaf5;
        }
        .tc { text-align: center; }
        .tr { text-align: right; font-variant-numeric: tabular-nums; }

        /* ── Footer ── */
        .doc-footer {
          border-top: 2px solid #000;
          padding: 8px 14px;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: rgba(79, 64, 57, 0.7);
        }

        /* ── Print overrides ── */
        @media print {
          .preview-shell {
            min-height: 0;
            padding: 0;
            background: #fff;
            display: block;
          }
          .toolbar { display: none; }
          .page {
            width: 100%;
            min-height: 0;
            margin: 0;
            border: none;
            display: block;
          }
          .company-header { border-bottom: 2px solid #000; }
          .table-wrap { flex: none; }
        }
      </style>
    </head>
    <body>
      <!-- Toolbar (screen only) -->
      <div class="toolbar">
        <div class="toolbar-left">
          ${logoDataUrl ? `<img class="toolbar-logo" src="${logoDataUrl}" alt="Logo" />` : `<div class="toolbar-logo-placeholder"></div>`}
          <div class="toolbar-title">
            <strong>Settlement Ledger Preview</strong>
            <span>${escapeHtml(documentName)}.pdf</span>
          </div>
        </div>
        <div class="toolbar-actions">
          <button class="toolbar-btn" type="button" onclick="window.close()">Close</button>
          <button class="toolbar-btn primary" type="button" onclick="window.print()">Print / Save PDF</button>
        </div>
      </div>

      <div class="preview-shell">
        <div class="page">
          <!-- Company Header -->
          <div class="company-header">
            <div class="company-logo-row">
              ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />` : `<div class="logo-placeholder"></div>`}
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
            <div class="info-cell"><strong>Supplier:</strong> ${escapeHtml(meta.supplier || 'All')}</div>
            <div class="info-cell"><strong>Report Date:</strong> ${escapeHtml(meta.reportDate || new Date().toISOString().slice(0, 10))}</div>
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
                <col style="width: 8%;" />
                <col style="width: 14%;" />
                <col style="width: 15%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 6%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 6%;" />
                <col style="width: 6%;" />
                <col style="width: 6%;" />
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

          <!-- Footer -->
          <div class="doc-footer">
            <div>Generated from finalized settlement records.</div>
            <div>Page printed for operational settlement use.</div>
          </div>
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
    'karat',
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
    row.karat,
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
      landscape: false,
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
  saleId: row.saleId || row.id || null,
  batchId: row.batchId || null,
  batchRef: row.batchRef || null,
  sessionId: row.sessionId || null,
  sessionRef: row.sessionRef || null,
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

const loadItemLedgerRows = async (filters = {}) => {
  const settings = await loadSettlementSettings()
  const { query } = await buildSettlementQuery(filters)
  const hasAnySaleRows = Boolean(await Sale.exists({}))
  const sales = await Sale.find(query)
    .sort({ saleDate: -1, createdAt: -1 })
    .populate('supplier', 'name code')
    .populate({
      path: 'batchId',
      select: 'batchRef sessionId',
      populate: {
        path: 'sessionId',
        select: 'sessionRef',
      },
    })
    .lean()

  const rows = sales.map((sale) => {
    const batch = sale?.batchId && typeof sale.batchId === 'object' ? sale.batchId : null
    const session = batch?.sessionId && typeof batch.sessionId === 'object' ? batch.sessionId : null
    const lineage = {
      saleId: sale._id ? String(sale._id) : null,
      batchId: batch?._id ? String(batch._id) : resolveIdValue(sale?.batchId) || null,
      batchRef: normalizeText(batch?.batchRef) || null,
      sessionId: session?._id ? String(session._id) : resolveIdValue(batch?.sessionId) || null,
      sessionRef: normalizeText(session?.sessionRef) || null,
    }

    return mapSettlementRow(sale, settings, lineage)
  })

  return { rows, settings, hasAnySaleRows }
}

const listSettlementRows = async (filters = {}) => {
  const { rows, settings, hasAnySaleRows } = await loadItemLedgerRows(filters)

  let scopedRows = rows
  if (rows.length === 0 && !hasAnySaleRows) {
    const legacyRecords = await QrIngestion.find({
      $or: [
        { status: 'approved' },
        { approvedAt: { $ne: null } },
      ],
      })
      .sort({ approvedAt: -1, reviewedAt: -1, createdAt: -1, _id: -1 })
      .lean()

    scopedRows = filterSettlementRows(
      legacyRecords.map((record) => mapLegacySettlementRow(record, settings)),
      filters,
    )
  }
  return {
    rows: annotateSettlementRows(scopedRows),
    summary: buildSettlementSummary(scopedRows),
    settings,
  }
}

const buildSessionReportRow = (session = {}, childBatches = []) => {
  const summary = buildSessionSummary(session, childBatches)
  const sessionId = summary._id || null

  return {
    id: sessionId,
    _id: sessionId,
    sessionId,
    sessionRef: summary.sessionRef,
    customerName: summary.customerName,
    customerPhone: summary.customerPhone,
    referenceNote: summary.referenceNote,
    assignedSalesman: buildUserSummary(session?.assignedSalesmanId),
    supplierCount: summary.supplierCount,
    itemCount: summary.itemCount,
    totals: summary.totals,
    warningsCount: summary.warningsCount,
    reviewCount: summary.reviewCount,
    duplicateCount: summary.duplicateCount,
    manualOverrideCount: summary.manualOverrideCount,
    status: summary.status,
    finalizedAt: normalizeText(session?.status).toLowerCase() === 'finalized' ? session?.finalizedAt || null : null,
    createdAt: session?.createdAt || null,
    updatedAt: session?.updatedAt || null,
  }
}

const buildSupplierSectionReportRow = (batch = {}) => {
  const revision = selectLatestFinalizedBatchRevision(batch)
  if (!revision) {
    return null
  }

  const session = batch?.sessionId && typeof batch.sessionId === 'object' ? batch.sessionId : null
  const sessionId = session?._id ? String(session._id) : resolveIdValue(batch?.sessionId) || null
  const sessionRef = normalizeText(session?.sessionRef) || null
  const totals = resolveBatchRevisionTotals(revision, batch)
  const batchId = resolveIdValue(batch?._id) || null

  return {
    id: batchId,
    _id: batchId,
    batchId,
    batchRef: normalizeText(batch?.batchRef) || null,
    sessionId,
    sessionRef,
    sessionLabel: sessionRef || 'Standalone',
    supplier: buildSupplierSummary(batch?.supplierId),
    assignedSalesman: buildUserSummary(batch?.assignedSalesmanId),
    revision: toNumber(revision?.revision) ?? toNumber(batch?.revision) ?? 1,
    itemCount: toNumber(revision?.itemCount) ?? toNumber(batch?.itemCount) ?? 0,
    totals,
    warningsCount: toNumber(revision?.warningsCount) ?? toNumber(batch?.warningsCount) ?? 0,
    reviewCount: toNumber(revision?.reviewCount) ?? toNumber(batch?.reviewCount) ?? 0,
    duplicateCount: toNumber(revision?.duplicateCount) ?? toNumber(batch?.duplicateCount) ?? 0,
    manualOverrideCount: toNumber(revision?.manualOverrideCount) ?? toNumber(batch?.manualOverrideCount) ?? 0,
    status: normalizeText(batch?.status) || 'finalized',
    finalizedAt: revision?.finalizedAt || batch?.finalizedAt || null,
    createdAt: batch?.createdAt || null,
    updatedAt: batch?.updatedAt || null,
  }
}

const buildScopedSummary = (scope, rows = []) => {
  const normalizedScope = normalizeReportScope(scope)
  if (normalizedScope === 'item-ledger') {
    return buildSettlementSummary(rows)
  }

  const base = rows.reduce(
    (acc, row) => {
      const totals = row?.totals || {}
      acc.total_rows += 1
      acc.total_items += toNumber(row?.itemCount) ?? 0
      acc.total_gross_weight += toNumber(totals.grossWeight ?? totals.gross_weight) ?? 0
      acc.total_stone_weight += toNumber(totals.stoneWeight ?? totals.stone_weight) ?? 0
      acc.total_other_weight += toNumber(totals.otherWeight ?? totals.other_weight) ?? 0
      acc.total_net_weight += toNumber(totals.netWeight ?? totals.net_weight) ?? 0
      acc.total_fine_weight += toNumber(totals.fineWeight ?? totals.fine_weight) ?? 0
      acc.total_stone_amount += toNumber(totals.stoneAmount ?? totals.stone_amount) ?? 0

      if (normalizedScope === 'session') {
        acc.total_sections += toNumber(row?.supplierCount) ?? 0
      } else {
        const sessionId = resolveIdValue(row?.sessionId)
        if (sessionId) {
          acc.sessionIds.add(sessionId)
        } else if (row?.sessionLabel === 'Standalone') {
          acc.standalone_sections += 1
        }
      }

      return acc
    },
    {
      total_rows: 0,
      total_items: 0,
      total_sections: 0,
      standalone_sections: 0,
      total_gross_weight: 0,
      total_stone_weight: 0,
      total_other_weight: 0,
      total_net_weight: 0,
      total_fine_weight: 0,
      total_stone_amount: 0,
      sessionIds: new Set(),
    }
  )

  if (normalizedScope === 'session') {
    return {
      total_sessions: base.total_rows,
      total_sections: base.total_sections,
      total_items: base.total_items,
      total_gross_weight: Number(base.total_gross_weight.toFixed(6)),
      total_stone_weight: Number(base.total_stone_weight.toFixed(6)),
      total_other_weight: Number(base.total_other_weight.toFixed(6)),
      total_net_weight: Number(base.total_net_weight.toFixed(6)),
      total_fine_weight: Number(base.total_fine_weight.toFixed(6)),
      total_stone_amount: Number(base.total_stone_amount.toFixed(2)),
    }
  }

  return {
    total_sections: base.total_rows,
    total_sessions: base.sessionIds.size,
    total_standalone_sections: base.standalone_sections,
    total_items: base.total_items,
    total_gross_weight: Number(base.total_gross_weight.toFixed(6)),
    total_stone_weight: Number(base.total_stone_weight.toFixed(6)),
    total_other_weight: Number(base.total_other_weight.toFixed(6)),
    total_net_weight: Number(base.total_net_weight.toFixed(6)),
    total_fine_weight: Number(base.total_fine_weight.toFixed(6)),
    total_stone_amount: Number(base.total_stone_amount.toFixed(2)),
  }
}

const listSessionReportRows = async (filters = {}) => {
  const normalized = normalizeSessionFilters(filters)
  const andConditions = []

  if (normalized.status) {
    if (!['draft', 'open', 'submitted', 'finalized', 'cancelled'].includes(normalized.status)) {
      throw new Error('Invalid session status filter')
    }
    andConditions.push({ status: normalized.status })
  } else {
    andConditions.push({ status: 'finalized' })
  }

  if (normalized.assignedSalesman) {
    if (normalized.assignedSalesman.match(/^[a-f\d]{24}$/i)) {
      andConditions.push({ assignedSalesmanId: normalized.assignedSalesman })
    } else {
      const salesmanMatches = await User.find({
        $or: [
          { name: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
          { email: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
          { phone: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
        ],
      }, { _id: 1 }).lean()
      andConditions.push({ assignedSalesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
    }
  }

  if (normalized.customer) {
    const customerSearch = escapeRegex(normalized.customer)
    andConditions.push({
      $or: [
        { sessionRef: { $regex: customerSearch, $options: 'i' } },
        { customerName: { $regex: customerSearch, $options: 'i' } },
        { customerPhone: { $regex: customerSearch, $options: 'i' } },
        { referenceNote: { $regex: customerSearch, $options: 'i' } },
      ],
    })
  }

  if (normalized.search) {
    const search = escapeRegex(normalized.search)
    const salesmanMatches = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ],
    }, { _id: 1 }).lean()

    const orConditions = [
      { sessionRef: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
      { referenceNote: { $regex: search, $options: 'i' } },
    ]

    if (salesmanMatches.length > 0) {
      orConditions.push({ assignedSalesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
    }

    andConditions.push({ $or: orConditions })
  }

  if (normalized.startDate || normalized.endDate) {
    const range = {}
    if (normalized.startDate) {
      range.$gte = normalized.startDate
    }
    if (normalized.endDate) {
      const end = new Date(normalized.endDate)
      end.setHours(23, 59, 59, 999)
      range.$lte = end
    }
    andConditions.push({
      $or: [
        { finalizedAt: range },
        { createdAt: range },
      ],
    })
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {}
  const page = normalized.page
  const limit = normalized.limit
  const sortOrder = String(normalized.sortOrder).toLowerCase() === 'asc' ? 1 : -1
  const sortBy = ['sessionRef', 'customerName', 'customerPhone', 'status', 'finalizedAt', 'updatedAt', 'createdAt'].includes(normalized.sortBy)
    ? normalized.sortBy
    : 'finalizedAt'

  const total = await CaptureSession.countDocuments(query)
  const sessions = await CaptureSession.find(query)
    .sort({ [sortBy]: sortOrder, updatedAt: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .lean()

  const sessionIds = sessions.map((session) => resolveIdValue(session._id)).filter(Boolean)
  const batches = sessionIds.length > 0
    ? await ScanBatch.find({ sessionId: { $in: sessionIds } })
      .sort({ createdAt: 1, _id: 1 })
      .populate('supplierId', 'name code isActive')
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .populate('salesmanId', 'name email phone role isActive')
      .lean()
    : []

  const batchesBySession = new Map()
  for (const batch of batches) {
    const sessionId = resolveIdValue(batch.sessionId)
    if (!sessionId) continue
    const list = batchesBySession.get(sessionId) || []
    list.push(batch)
    batchesBySession.set(sessionId, list)
  }

  const rows = sessions
    .map((session) => {
      const childBatches = batchesBySession.get(resolveIdValue(session._id)) || []
      if (!isSessionFinalForOfficialReporting(session, childBatches)) {
        return null
      }

      return buildSessionReportRow(session, childBatches)
    })
    .filter(Boolean)

  return {
    scope: 'session',
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  }
}

const listSupplierSectionReportRows = async (filters = {}) => {
  const normalized = normalizeSupplierSectionFilters(filters)
  const andConditions = []

  if (normalized.status) {
    if (!['draft', 'open', 'submitted', 'finalized', 'reopened', 'cancelled'].includes(normalized.status)) {
      throw new Error('Invalid batch status filter')
    }
    andConditions.push({ status: normalized.status })
  } else {
    andConditions.push({ status: 'finalized' })
  }

  if (normalized.supplier) {
    if (normalized.supplier.match(/^[a-f\d]{24}$/i)) {
      andConditions.push({ supplierId: normalized.supplier })
    } else {
      const supplierMatches = await Supplier.find({
        $or: [
          { name: { $regex: escapeRegex(normalized.supplier), $options: 'i' } },
          { code: { $regex: escapeRegex(normalized.supplier), $options: 'i' } },
        ],
      }, { _id: 1 }).lean()
      andConditions.push({ supplierId: { $in: supplierMatches.map((entry) => entry._id) } })
    }
  }

  if (normalized.session) {
    if (normalized.session.match(/^[a-f\d]{24}$/i)) {
      andConditions.push({ sessionId: normalized.session })
    } else {
      const sessionMatches = await CaptureSession.find({
        $or: [
          { sessionRef: { $regex: escapeRegex(normalized.session), $options: 'i' } },
          { customerName: { $regex: escapeRegex(normalized.session), $options: 'i' } },
          { customerPhone: { $regex: escapeRegex(normalized.session), $options: 'i' } },
          { referenceNote: { $regex: escapeRegex(normalized.session), $options: 'i' } },
        ],
      }, { _id: 1 }).lean()
      andConditions.push({ sessionId: { $in: sessionMatches.map((entry) => entry._id) } })
    }
  }

  if (normalized.assignedSalesman) {
    if (normalized.assignedSalesman.match(/^[a-f\d]{24}$/i)) {
      andConditions.push({ assignedSalesmanId: normalized.assignedSalesman })
    } else {
      const salesmanMatches = await User.find({
        $or: [
          { name: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
          { email: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
          { phone: { $regex: escapeRegex(normalized.assignedSalesman), $options: 'i' } },
        ],
      }, { _id: 1 }).lean()
      andConditions.push({ assignedSalesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
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
    const sessionMatches = await CaptureSession.find({
      $or: [
        { sessionRef: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { referenceNote: { $regex: search, $options: 'i' } },
      ],
    }, { _id: 1 }).lean()
    const salesmanMatches = await User.find({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ],
    }, { _id: 1 }).lean()

    const orConditions = [
      { batchRef: { $regex: search, $options: 'i' } },
      { customerName: { $regex: search, $options: 'i' } },
      { customerPhone: { $regex: search, $options: 'i' } },
      { referenceNote: { $regex: search, $options: 'i' } },
    ]

    if (supplierMatches.length > 0) {
      orConditions.push({ supplierId: { $in: supplierMatches.map((entry) => entry._id) } })
    }
    if (sessionMatches.length > 0) {
      orConditions.push({ sessionId: { $in: sessionMatches.map((entry) => entry._id) } })
    }
    if (salesmanMatches.length > 0) {
      orConditions.push({ assignedSalesmanId: { $in: salesmanMatches.map((entry) => entry._id) } })
    }

    andConditions.push({ $or: orConditions })
  }

  if (normalized.startDate || normalized.endDate) {
    const range = {}
    if (normalized.startDate) {
      range.$gte = normalized.startDate
    }
    if (normalized.endDate) {
      const end = new Date(normalized.endDate)
      end.setHours(23, 59, 59, 999)
      range.$lte = end
    }
    andConditions.push({
      $or: [
        { finalizedAt: range },
        { createdAt: range },
      ],
    })
  }

  const query = andConditions.length > 0 ? { $and: andConditions } : {}
  const page = normalized.page
  const limit = normalized.limit
  const sortOrder = String(normalized.sortOrder).toLowerCase() === 'asc' ? 1 : -1
  const sortBy = ['batchRef', 'status', 'finalizedAt', 'updatedAt', 'createdAt', 'revision', 'itemCount'].includes(normalized.sortBy)
    ? normalized.sortBy
    : 'finalizedAt'

  const total = await ScanBatch.countDocuments(query)
  const batches = await ScanBatch.find(query)
    .sort({ [sortBy]: sortOrder, updatedAt: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('supplierId', 'name code isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('salesmanId', 'name email phone role isActive')
    .populate('sessionId', 'sessionRef customerName customerPhone referenceNote assignedSalesmanId status')
    .lean()

  const rows = batches
    .map((batch) => buildSupplierSectionReportRow(batch))
    .filter(Boolean)

  return {
    scope: 'supplier-section',
    rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  }
}

const getScopeRows = async (scope = 'item-ledger', filters = {}) => {
  const normalizedScope = normalizeReportScope(scope)
  if (normalizedScope === 'session') {
    return listSessionReportRows(filters)
  }
  if (normalizedScope === 'supplier-section') {
    return listSupplierSectionReportRows(filters)
  }

  return listSettlementRows(filters)
}

export {
   buildSettlementCsv,
   buildSettlementDetail,
   buildSettlementPdfBuffer,
   buildSettlementPdfHtml,
   buildSettlementSummary,
   buildSettlementQuery,
   buildScopedSummary,
   buildSessionReportRow,
   buildSupplierSectionReportRow,
   filterSettlementRows,
   getScopeRows,
   listSettlementRows,
   listSessionReportRows,
   listSupplierSectionReportRows,
   loadItemLedgerRows,
   mapSettlementRow,
   normalizeReportScope,
   normalizeFilters as normalizeSettlementFilters,
   selectLatestFinalizedBatchRevision,
   isBatchFinalForOfficialReporting,
   isSessionFinalForOfficialReporting,
}
