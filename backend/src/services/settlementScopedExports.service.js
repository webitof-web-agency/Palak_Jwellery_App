import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import puppeteer from 'puppeteer'
import { CaptureSession } from '../models/CaptureSession.js'
import { Sale } from '../models/Sale.js'
import { ScanBatch } from '../models/ScanBatch.js'
import { buildSaleSummary, buildSupplierSummary, buildUserSummary } from './batch.service.js'
import { buildSessionReportRow, selectLatestFinalizedBatchRevision } from './settlementReports.service.js'
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

class SettlementScopedExportError extends Error {
  constructor(message, code = 'EXPORT_FAILED', statusCode = 400) {
    super(message)
    this.name = 'SettlementScopedExportError'
    this.code = code
    this.statusCode = statusCode
  }
}

const normalizeText = (value) => toText(value) || ''

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

const isValidObjectId = (value) => Boolean(value) && mongoose.isValidObjectId(String(value))

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

const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

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

const sanitizeFileNameSegment = (value, fallback = 'report') => {
  const sanitized = String(value || fallback)
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

  return sanitized || fallback
}

const toSaleRef = (id) => {
  if (!id) return null
  return `#${String(id).slice(-6).toUpperCase()}`
}

const hasExplicitRevision = (revision) => revision !== null && revision !== undefined && String(revision).trim() !== ''

const normalizeRevisionNumber = (revision) => {
  if (revision === null || revision === undefined || revision === '') {
    return null
  }

  const parsed = Number.parseInt(String(revision), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

const isFinalizedRevision = (revision = {}) => {
  return normalizeText(revision?.status).toLowerCase() === 'finalized' || Boolean(revision?.finalizedAt)
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

const resolveBatchRevisionCounts = (revision = {}, batch = {}) => ({
  itemCount: toNumber(revision?.itemCount) ?? toNumber(batch?.itemCount) ?? 0,
  warningsCount: toNumber(revision?.warningsCount) ?? toNumber(batch?.warningsCount) ?? 0,
  reviewCount: toNumber(revision?.reviewCount) ?? toNumber(batch?.reviewCount) ?? 0,
  duplicateCount: toNumber(revision?.duplicateCount) ?? toNumber(batch?.duplicateCount) ?? 0,
  manualOverrideCount: toNumber(revision?.manualOverrideCount) ?? toNumber(batch?.manualOverrideCount) ?? 0,
})

const loadBrandLogoDataUrl = async () => {
  try {
    const buffer = await readFile(brandLogoPath)
    return `data:image/png;base64,${buffer.toString('base64')}`
  } catch {
    return ''
  }
}

const buildPdfBufferFromHtml = async (html, fallbackTitle, fallbackLines = []) => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
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
      await browser.close().catch(() => {})
      throw error
    }
  } catch (error) {
    console.error(`[${fallbackTitle}] Puppeteer PDF generation failed:`, error)
    return buildFallbackPdfBuffer(fallbackTitle, fallbackLines)
  }
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

  const contentStreams = pages.map((pageLines, pageIndex) => {
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
      `1 0 0 1 ${leftMargin} 548 Tm`,
      `(${escapePdfText(title)}) Tj`,
      'ET',
      bodyCommands,
      `BT\n/F1 7 Tf\n1 0 0 1 ${leftMargin} 24 Tm\n(Page ${pageIndex + 1} of ${pages.length}) Tj\nET`,
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

const resolveBatchDocument = async (batchId) => {
  const resolvedId = resolveIdValue(batchId)
  if (!resolvedId) {
    throw new SettlementScopedExportError('Invalid batch id', 'INVALID_ID', 400)
  }

  let batch = null
  if (isValidObjectId(resolvedId)) {
    batch = await ScanBatch.findById(resolvedId)
      .populate('supplierId', 'name code isActive')
      .populate('sessionId', 'sessionRef customerName customerPhone referenceNote assignedSalesmanId status finalizedAt')
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean()
  }

  if (!batch) {
    batch = await ScanBatch.findOne({ batchRef: resolvedId })
      .populate('supplierId', 'name code isActive')
      .populate('sessionId', 'sessionRef customerName customerPhone referenceNote assignedSalesmanId status finalizedAt')
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean()
  }

  if (!batch) {
    throw new SettlementScopedExportError('Batch not found', 'NOT_FOUND', 404)
  }

  return batch
}

const resolveSessionDocument = async (sessionId) => {
  const resolvedId = resolveIdValue(sessionId)
  if (!resolvedId) {
    throw new SettlementScopedExportError('Invalid session id', 'INVALID_ID', 400)
  }

  let session = null
  if (isValidObjectId(resolvedId)) {
    session = await CaptureSession.findById(resolvedId)
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean()
  }

  if (!session) {
    session = await CaptureSession.findOne({ sessionRef: resolvedId })
      .populate('assignedSalesmanId', 'name email phone role isActive')
      .lean()
  }

  if (!session) {
    throw new SettlementScopedExportError('Session not found', 'NOT_FOUND', 404)
  }

  return session
}

const resolveSupplierSectionRevision = (batch, revisionInput = null) => {
  const explicitRevision = hasExplicitRevision(revisionInput)
  const revisions = Array.isArray(batch?.revisions) ? batch.revisions : []

  if (explicitRevision) {
    const normalizedRevision = normalizeRevisionNumber(revisionInput)
    const selectedRevision = revisions.find((entry) => toNumber(entry?.revision) === normalizedRevision) || null

    if (!selectedRevision) {
      throw new SettlementScopedExportError('Revision not found', 'REVISION_NOT_FOUND', 404)
    }

    if (!isFinalizedRevision(selectedRevision)) {
      throw new SettlementScopedExportError('Selected revision is not finalized', 'REVISION_NOT_FINALIZED', 409)
    }

    return {
      selectedRevision,
      revisionNumber: toNumber(selectedRevision?.revision) ?? normalizedRevision,
      sourceOfTruth: 'revision.saleIds',
    }
  }

  if (normalizeText(batch?.status).toLowerCase() !== 'finalized') {
    throw new SettlementScopedExportError('Batch is not finalized', 'BATCH_NOT_FINALIZED', 409)
  }

  const selectedRevision = selectLatestFinalizedBatchRevision(batch)
  if (!selectedRevision) {
    throw new SettlementScopedExportError('Batch is not finalized', 'BATCH_NOT_FINALIZED', 409)
  }

  return {
    selectedRevision,
    revisionNumber: toNumber(selectedRevision?.revision) ?? toNumber(batch?.revision) ?? 1,
    sourceOfTruth: Array.isArray(selectedRevision?.saleIds) && selectedRevision.saleIds.length > 0
      ? 'revision.saleIds'
      : 'sale.batchId+revisionAdded',
  }
}

const resolveBatchRevisionSales = async (batch, selectedRevision = {}, revisionNumber = 1) => {
  const saleIds = Array.isArray(selectedRevision?.saleIds)
    ? selectedRevision.saleIds.map((saleId) => resolveIdValue(saleId)).filter(Boolean)
    : []

  const query = saleIds.length > 0
    ? { _id: { $in: saleIds } }
    : { batchId: batch._id, revisionAdded: revisionNumber }

  const sales = await Sale.find(query)
    .sort({ addedAt: 1, saleDate: 1, createdAt: 1, _id: 1 })
    .populate('supplier', 'name code isActive')
    .lean()

  if (saleIds.length > 0) {
    const salesById = new Map(sales.map((sale) => [resolveIdValue(sale._id), sale]))
    return saleIds.map((saleId) => salesById.get(saleId)).filter(Boolean)
  }

  return sales
}

const resolveCalculationNumbers = (sale = {}, settings = {}) => {
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

  const grossWeight = toNumber(sale?.grossWeight) ?? toNumber(calculationSnapshot?.grossWeight) ?? 0
  const stoneWeight = toNumber(sale?.stoneWeight) ?? toNumber(calculationSnapshot?.stoneWeight) ?? 0
  const otherWeight = toNumber(calculationSnapshot?.otherWeight) ?? 0
  const netWeight =
    toNumber(sale?.netWeight) ??
    toNumber(calculationSnapshot?.selectedNetWeight) ??
    toNumber(calculationSnapshot?.computedNetWeight) ??
    0

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

  const defaultStoneRate = toNumber(settings.default_stone_rate) ?? 0
  const stoneAmount = stoneWeight === null ? 0 : Number((stoneWeight * defaultStoneRate).toFixed(2))

  return {
    purityPercent,
    wastagePercent,
    grossWeight,
    stoneWeight,
    otherWeight,
    netWeight,
    fineWeight,
    stoneAmount,
    karat: normalizeText(settlementInputs?.karat) || normalizeText(sale?.purity) || '',
  }
}

const buildExportSaleRow = (sale = {}, context = {}) => {
  const { settings = {}, session = null, batch = null, revisionNumber = null, sourceOfTruth = 'sale.batchId+revisionAdded' } = context
  const saleSummary = buildSaleSummary(sale)
  const calculations = resolveCalculationNumbers(saleSummary, settings)
  const calculationSnapshot = saleSummary.calculationSnapshot && typeof saleSummary.calculationSnapshot === 'object' ? saleSummary.calculationSnapshot : {}
  const parsedSnapshot = saleSummary.parsedSnapshot && typeof saleSummary.parsedSnapshot === 'object' ? saleSummary.parsedSnapshot : {}
  const parsedDisplay = parsedSnapshot?.display && typeof parsedSnapshot.display === 'object' ? parsedSnapshot.display : {}

  return {
    saleId: saleSummary._id ? String(saleSummary._id) : null,
    sale_ref: saleSummary.ref || toSaleRef(saleSummary._id),
    session_ref: normalizeText(session?.sessionRef || batch?.sessionId?.sessionRef) || '',
    session_customer: normalizeText(session?.customerName) || '',
    customer_reference: [normalizeText(session?.customerName), normalizeText(session?.customerPhone), normalizeText(session?.referenceNote)]
      .filter(Boolean)
      .join(' | '),
    batch_ref: normalizeText(batch?.batchRef) || '',
    batch_id: resolveIdValue(batch?._id) || resolveIdValue(saleSummary.batchId) || null,
    supplier: normalizeText(saleSummary.supplier?.name) || normalizeText(saleSummary.supplier?.code) || 'Unknown',
    supplier_code: normalizeText(saleSummary.supplier?.code) || '',
    supplier_id: resolveIdValue(saleSummary.supplier?._id) || resolveIdValue(saleSummary.supplier?.id) || null,
    revision: revisionNumber ?? toNumber(saleSummary.revisionAdded) ?? 1,
    finalized_at: batch?.finalizedAt || null,
    item_code: normalizeText(saleSummary.itemCode) || '',
    design_code: normalizeText(saleSummary.itemCode) || '',
    category: normalizeText(saleSummary.category) || '',
    metal: normalizeText(saleSummary.metalType) || '',
    karat: calculations.karat || '',
    purity: calculations.purityPercent,
    wastage: calculations.wastagePercent,
    gross: calculations.grossWeight,
    stone: calculations.stoneWeight,
    other: calculations.otherWeight,
    net: calculations.netWeight,
    fine: calculations.fineWeight,
    stone_amount: calculations.stoneAmount,
    duplicate_flag: saleSummary.isDuplicate === true,
    review_flag: Boolean(calculationSnapshot?.requiresReview === true || parsedDisplay?.requiresReview === true),
    manual_override_flag: Boolean(
      saleSummary.wasManuallyEdited === true ||
      saleSummary.settlementInputs?.purityOverridden === true ||
      saleSummary.settlementInputs?.wastageOverridden === true
    ),
    source_of_truth: sourceOfTruth,
    saleDate: saleSummary.saleDate || saleSummary.createdAt || null,
    addedAt: saleSummary.addedAt || null,
  }
}

const summarizeExportRows = (rows = []) => {
  const summary = {
    total_rows: rows.length,
    total_items: 0,
    supplier_count: 0,
    total_gross_weight: 0,
    total_stone_weight: 0,
    total_other_weight: 0,
    total_net_weight: 0,
    total_fine_weight: 0,
    total_stone_amount: 0,
  }
  const supplierIds = new Set()

  for (const row of rows) {
    summary.total_items += 1
    summary.total_gross_weight += toNumber(row.gross) ?? 0
    summary.total_stone_weight += toNumber(row.stone) ?? 0
    summary.total_other_weight += toNumber(row.other) ?? 0
    summary.total_net_weight += toNumber(row.net) ?? 0
    summary.total_fine_weight += toNumber(row.fine) ?? 0
    summary.total_stone_amount += toNumber(row.stone_amount) ?? 0
    if (row?.supplier_id || row?.supplier_code || row?.supplier) {
      supplierIds.add(row.supplier_id || row.supplier_code || row.supplier)
    }
  }

  summary.supplier_count = supplierIds.size

  return {
    total_rows: summary.total_rows,
    total_items: summary.total_items,
    supplier_count: summary.supplier_count,
    total_gross_weight: Number(summary.total_gross_weight.toFixed(6)),
    total_stone_weight: Number(summary.total_stone_weight.toFixed(6)),
    total_other_weight: Number(summary.total_other_weight.toFixed(6)),
    total_net_weight: Number(summary.total_net_weight.toFixed(6)),
    total_fine_weight: Number(summary.total_fine_weight.toFixed(6)),
    total_stone_amount: Number(summary.total_stone_amount.toFixed(2)),
  }
}

const buildSupplierSectionExportData = async (batchId, revision = null, options = {}) => {
  const batch = options.batch || await resolveBatchDocument(batchId)
  const { selectedRevision, revisionNumber, sourceOfTruth } = resolveSupplierSectionRevision(batch, revision)
  const settings = options.settings || await loadSettlementSettings()
  const session = batch?.sessionId && typeof batch.sessionId === 'object' ? batch.sessionId : null
  const sales = options.sales || await resolveBatchRevisionSales(batch, selectedRevision, revisionNumber)
  const rows = sales.map((sale) =>
    buildExportSaleRow(sale, {
      settings,
      session,
      batch,
      revisionNumber,
      sourceOfTruth,
    })
  )

  const totals = resolveBatchRevisionTotals(selectedRevision, batch)
  const counts = resolveBatchRevisionCounts(selectedRevision, batch)

  return {
    scope: 'supplier-section',
    sourceOfTruth,
    batch: {
      batchId: resolveIdValue(batch?._id) || null,
      batchRef: normalizeText(batch?.batchRef) || null,
      sessionId: session?._id ? resolveIdValue(session._id) : resolveIdValue(batch?.sessionId) || null,
      sessionRef: normalizeText(session?.sessionRef) || null,
      sessionLabel: normalizeText(session?.sessionRef) || 'Standalone',
      supplier: buildSupplierSummary(batch?.supplierId),
      assignedSalesman: buildUserSummary(batch?.assignedSalesmanId),
      status: 'finalized',
      revision: revisionNumber,
      itemCount: counts.itemCount,
      totals,
      warningsCount: counts.warningsCount,
      reviewCount: counts.reviewCount,
      duplicateCount: counts.duplicateCount,
      manualOverrideCount: counts.manualOverrideCount,
      finalizedAt: selectedRevision?.finalizedAt || batch?.finalizedAt || null,
      createdAt: batch?.createdAt || null,
      updatedAt: batch?.updatedAt || null,
    },
    revision: {
      revision: revisionNumber,
      finalizedAt: selectedRevision?.finalizedAt || null,
      finalizedBy: resolveIdValue(selectedRevision?.finalizedBy) || null,
      saleIds: Array.isArray(selectedRevision?.saleIds)
        ? selectedRevision.saleIds.map((saleId) => resolveIdValue(saleId)).filter(Boolean)
        : [],
    },
    session: session
      ? {
          sessionId: resolveIdValue(session?._id) || null,
          sessionRef: normalizeText(session?.sessionRef) || null,
          customerName: normalizeText(session?.customerName) || '',
          customerPhone: normalizeText(session?.customerPhone) || '',
          referenceNote: normalizeText(session?.referenceNote) || '',
        }
      : null,
    rows,
    summary: summarizeExportRows(rows),
    flags: {
      warningsCount: counts.warningsCount,
      reviewCount: counts.reviewCount,
      duplicateCount: counts.duplicateCount,
      manualOverrideCount: counts.manualOverrideCount,
    },
  }
}

const buildSessionExportData = async (sessionId, options = {}) => {
  const session = options.session || await resolveSessionDocument(sessionId)
  const childBatches = options.childBatches || await ScanBatch.find({ sessionId: session._id })
    .sort({ createdAt: 1, _id: 1 })
    .populate('supplierId', 'name code isActive')
    .populate('assignedSalesmanId', 'name email phone role isActive')
    .populate('sessionId', 'sessionRef customerName customerPhone referenceNote assignedSalesmanId status finalizedAt')
    .lean()

  const pendingChildren = childBatches.filter((batch) => {
    const status = normalizeText(batch?.status).toLowerCase()
    return ['draft', 'open', 'reopened', 'submitted'].includes(status)
  })

  if (pendingChildren.length > 0) {
    throw new SettlementScopedExportError('Session has pending changes', 'SESSION_HAS_PENDING_CHANGES', 409)
  }

  const normalizedStatus = normalizeText(session?.status).toLowerCase()
  if (normalizedStatus !== 'finalized') {
    throw new SettlementScopedExportError('Session is not finalized', 'SESSION_NOT_FINALIZED', 409)
  }

  const finalizedChildren = childBatches.filter((batch) => normalizeText(batch?.status).toLowerCase() !== 'cancelled')
  if (finalizedChildren.length === 0) {
    throw new SettlementScopedExportError('Session has pending changes', 'SESSION_HAS_PENDING_CHANGES', 409)
  }

  const settings = options.settings || await loadSettlementSettings()
  const sections = []

  for (const batch of finalizedChildren) {
    const sectionData = await buildSupplierSectionExportData(resolveIdValue(batch._id), null, {
      batch,
      settings,
    })
    sections.push(sectionData)
  }

  const sectionRows = sections.map((section) => section.batch)
  const overallRows = sections.flatMap((section) => section.rows)
  const overallSummary = summarizeExportRows(overallRows)
  const sessionReport = buildSessionReportRow(session, finalizedChildren)

  return {
    scope: 'session',
    session: {
      sessionId: resolveIdValue(session?._id) || null,
      sessionRef: normalizeText(session?.sessionRef) || null,
      customerName: normalizeText(session?.customerName) || '',
      customerPhone: normalizeText(session?.customerPhone) || '',
      referenceNote: normalizeText(session?.referenceNote) || '',
      assignedSalesman: buildUserSummary(session?.assignedSalesmanId),
      finalizedAt: session?.finalizedAt || null,
    },
    summary: {
      ...overallSummary,
      total_sections: sections.length,
    },
    sessionSummary: sessionReport,
    supplierSections: sectionRows,
    sections,
    rows: overallRows,
  }
}

const renderSupplierSectionCsv = (data = {}) => {
  const header = [
    'session_ref',
    'session_customer',
    'batch_ref',
    'supplier',
    'revision',
    'finalized_at',
    'sale_ref',
    'item_code',
    'design_code',
    'category',
    'metal',
    'karat',
    'purity',
    'wastage',
    'gross',
    'stone',
    'other',
    'net',
    'fine',
    'stone_amount',
    'duplicate_flag',
    'review_flag',
    'manual_override_flag',
  ]

  const rowsSource = Array.isArray(data.sections) && data.sections.length > 0
    ? data.sections.flatMap((section) => Array.isArray(section.rows) ? section.rows : [])
    : Array.isArray(data.rows)
      ? data.rows
      : []

  const rows = rowsSource.map((row) => [
    row.session_ref,
    row.session_customer,
    row.batch_ref,
    row.supplier,
    row.revision,
    row.finalized_at ? new Date(row.finalized_at).toISOString() : '',
    row.sale_ref,
    row.item_code,
    row.design_code,
    row.category,
    row.metal,
    row.karat,
    preserveNumericPrecision(row.purity),
    preserveNumericPrecision(row.wastage),
    preserveNumericPrecision(row.gross),
    preserveNumericPrecision(row.stone),
    preserveNumericPrecision(row.other),
    preserveNumericPrecision(row.net),
    preserveNumericPrecision(row.fine),
    preserveNumericPrecision(row.stone_amount),
    row.duplicate_flag ? 'true' : 'false',
    row.review_flag ? 'true' : 'false',
    row.manual_override_flag ? 'true' : 'false',
  ])

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

const renderSessionCsv = (data = {}) => {
  const header = [
    'session_ref',
    'customer_reference',
    'supplier',
    'batch_ref',
    'revision',
    'sale_ref',
    'item_code',
    'design_code',
    'category',
    'metal',
    'karat',
    'purity',
    'wastage',
    'gross',
    'stone',
    'other',
    'net',
    'fine',
    'stone_amount',
    'duplicate_flag',
    'review_flag',
    'manual_override_flag',
  ]

  const rows = []
  for (const section of data.sections || []) {
    for (const row of section.rows || []) {
      rows.push([
        row.session_ref,
        row.customer_reference,
        row.supplier,
        row.batch_ref,
        row.revision,
        row.sale_ref,
        row.item_code,
        row.design_code,
        row.category,
        row.metal,
        row.karat,
        preserveNumericPrecision(row.purity),
        preserveNumericPrecision(row.wastage),
        preserveNumericPrecision(row.gross),
        preserveNumericPrecision(row.stone),
        preserveNumericPrecision(row.other),
        preserveNumericPrecision(row.net),
        preserveNumericPrecision(row.fine),
        preserveNumericPrecision(row.stone_amount),
        row.duplicate_flag ? 'true' : 'false',
        row.review_flag ? 'true' : 'false',
        row.manual_override_flag ? 'true' : 'false',
      ])
    }
  }

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

const buildSupplierSectionPdfHtml = async (data = {}) => {
  const logoDataUrl = await loadBrandLogoDataUrl()
  const batch = data.batch || {}
  const session = data.session || null
  const rows = Array.isArray(data.rows) ? data.rows : []
  const generatedAt = formatDateTime(new Date())
  const totals = data.summary || summarizeExportRows(rows)

  const tableRows = rows
    .map((row, i) => `
      <tr>
        <td class="cell tc">${i + 1}</td>
        <td class="cell tc">${escapeHtml(row.sale_ref || '-')}</td>
        <td class="cell">${escapeHtml(row.item_code || '-')}</td>
        <td class="cell">${escapeHtml(row.category || '-')}</td>
        <td class="cell tc">${escapeHtml(row.karat || '-')}</td>
        <td class="cell tr">${escapeHtml(formatPercentage(row.purity))}</td>
        <td class="cell tr">${escapeHtml(formatPercentage(row.wastage))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.gross))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.stone))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.other))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.net))}</td>
        <td class="cell tr">${escapeHtml(formatWeight(row.fine))}</td>
        <td class="cell tr">${escapeHtml(formatCurrency(row.stone_amount))}</td>
      </tr>
    `)
    .join('')

  const customerLine = [
    normalizeText(session?.customerName),
    normalizeText(session?.customerPhone),
    normalizeText(session?.referenceNote),
  ].filter(Boolean).join(' | ')

  const documentName = `settlement-section-${batch?.batchRef || 'section'}-${new Date().toISOString().slice(0, 10)}`

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
          grid-template-columns: repeat(6, 1fr);
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
          letter-spacing: 0.08em;
          color: #b95c58;
          margin-bottom: 3px;
        }
        .summary-cell .s-value {
          font-size: 13px;
          font-weight: 700;
          color: #4f4039;
        }

        /* ── Table wrapper ── */
        .table-wrap {
          overflow: hidden;
          flex: 1;
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

        .section-header {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          background: #fffaf5;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #b95c58;
          font-family: "Outfit", sans-serif;
        }

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
            <strong>Supplier Section Preview</strong>
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
              ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />` : `<div class="logo-placeholder"></div>`}
              <div>
                <div class="company-name">Palak Jewellery</div>
                <div class="company-subtitle">Supplier Section Export &mdash; Printable Weight & Metal Settlement Sheet</div>
              </div>
            </div>
          </div>

          <!-- Document Title -->
          <div class="doc-title-bar">${escapeHtml(batch?.supplier?.name || batch?.supplier?.code || 'Supplier Section')}</div>

          <!-- Info Grid -->
          <div class="info-grid">
            <div class="info-cell"><strong>Batch Ref:</strong> ${escapeHtml(batch?.batchRef || '-')}</div>
            <div class="info-cell"><strong>Session Ref:</strong> ${escapeHtml(session?.sessionRef || 'Standalone')}</div>
            <div class="info-cell"><strong>Customer:</strong> ${escapeHtml(customerLine || '-')}</div>
            <div class="info-cell"><strong>Revision / Date:</strong> Rev ${escapeHtml(batch?.revision || '-')}${batch?.finalizedAt ? ` • ${escapeHtml(formatDateTime(batch.finalizedAt))}` : ''}</div>
          </div>

          <!-- Summary Strip -->
          <div class="summary-strip">
            <div class="summary-cell">
              <div class="s-label">Total Items</div>
              <div class="s-value">${escapeHtml(String(totals.total_items || 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Gross Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_gross_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Stone Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_stone_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Net Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_net_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Fine Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_fine_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Stone Amt.</div>
              <div class="s-value">${escapeHtml(formatCurrency(totals.total_stone_amount ?? 0))}</div>
            </div>
          </div>

          <div class="section-header">Item Rows</div>

          <!-- Data Table -->
          <div class="table-wrap">
            <table>
              <colgroup>
                <col style="width: 5%;" />
                <col style="width: 7%;" />
                <col style="width: 15%;" />
                <col style="width: 12%;" />
                <col style="width: 6%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Sale</th>
                  <th>Item Code</th>
                  <th>Category</th>
                  <th>Karat</th>
                  <th class="tr">Purity</th>
                  <th class="tr">Wastage</th>
                  <th class="tr">Gross</th>
                  <th class="tr">Stone</th>
                  <th class="tr">Other</th>
                  <th class="tr">Net</th>
                  <th class="tr">Fine</th>
                  <th class="tr">Stone Amt</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>

          <div class="section-header">Audit Logs & Exceptions</div>
          <div class="info-grid" style="border-bottom: none;">
            <div class="info-cell"><strong>Warnings:</strong> ${escapeHtml(batch?.warningsCount || 0)}</div>
            <div class="info-cell"><strong>Requires Review:</strong> ${escapeHtml(batch?.reviewCount || 0)}</div>
            <div class="info-cell"><strong>Duplicates:</strong> ${escapeHtml(batch?.duplicateCount || 0)}</div>
            <div class="info-cell"><strong>Manual Overrides:</strong> ${escapeHtml(batch?.manualOverrideCount || 0)}</div>
          </div>

          <!-- Footer -->
          <div class="doc-footer">
            <div>Generated from finalized supplier-section records.</div>
            <div>Revision: ${escapeHtml(String(batch?.revision || '-'))}</div>
          </div>
        </div>
      </div>
    </body>
  </html>`
}

const buildSessionPdfHtml = async (data = {}) => {
  const logoDataUrl = await loadBrandLogoDataUrl()
  const session = data.session || {}
  const sections = Array.isArray(data.sections) ? data.sections : []
  const generatedAt = formatDateTime(new Date())
  const totals = data.summary || summarizeExportRows((data.rows || []))
  const customerLine = [
    normalizeText(session?.customerName),
    normalizeText(session?.customerPhone),
    normalizeText(session?.referenceNote),
  ].filter(Boolean).join(' | ')

  const supplierSummaryRows = sections
    .map((section, idx) => {
      const batch = section.batch || {}
      const summary = section.summary || summarizeExportRows(section.rows || [])
      return `
        <tr>
          <td class="cell tc">${idx + 1}</td>
          <td class="cell font-medium">${escapeHtml(batch?.supplier?.name || batch?.supplier?.code || 'Unknown')}</td>
          <td class="cell tc font-mono">${escapeHtml(batch?.batchRef || '-')}</td>
          <td class="cell tc">${escapeHtml(batch?.revision || '-')}</td>
          <td class="cell tr font-bold">${escapeHtml(summary.total_items || 0)}</td>
          <td class="cell tr">${escapeHtml(formatWeight(summary.total_gross_weight || 0))}</td>
          <td class="cell tr">${escapeHtml(formatWeight(summary.total_stone_weight || 0))}</td>
          <td class="cell tr">${escapeHtml(formatWeight(summary.total_net_weight || 0))}</td>
          <td class="cell tr font-bold">${escapeHtml(formatWeight(summary.total_fine_weight || 0))}</td>
        </tr>
      `
    })
    .join('')

  const supplierSectionsHtml = sections
    .map((section) => {
      const batch = section.batch || {}
      const rows = Array.isArray(section.rows) ? section.rows : []
      const summary = section.summary || summarizeExportRows(rows)
      const rowHtml = rows
        .map((row, i) => `
          <tr>
            <td class="cell tc">${i + 1}</td>
            <td class="cell tc">${escapeHtml(row.sale_ref || '-')}</td>
            <td class="cell">${escapeHtml(row.item_code || '-')}</td>
            <td class="cell">${escapeHtml(row.category || '-')}</td>
            <td class="cell tc">${escapeHtml(row.karat || '-')}</td>
            <td class="cell tr">${escapeHtml(formatPercentage(row.purity))}</td>
            <td class="cell tr">${escapeHtml(formatPercentage(row.wastage))}</td>
            <td class="cell tr">${escapeHtml(formatWeight(row.gross))}</td>
            <td class="cell tr">${escapeHtml(formatWeight(row.stone))}</td>
            <td class="cell tr">${escapeHtml(formatWeight(row.other))}</td>
            <td class="cell tr">${escapeHtml(formatWeight(row.net))}</td>
            <td class="cell tr">${escapeHtml(formatWeight(row.fine))}</td>
            <td class="cell tr">${escapeHtml(formatCurrency(row.stone_amount))}</td>
          </tr>
        `)
        .join('')

      return `
        <div style="page-break-before: always; break-before: always; border: 2px solid #000; margin-top: 20px; background: #fff;">
          <div class="section-header" style="border-top: none;">
            Supplier Section: ${escapeHtml(batch?.supplier?.name || batch?.supplier?.code || 'Supplier')}
          </div>
          <div class="info-grid">
            <div class="info-cell"><strong>Batch Ref:</strong> ${escapeHtml(batch?.batchRef || '-')}</div>
            <div class="info-cell"><strong>Revision:</strong> Rev ${escapeHtml(batch?.revision || '-')}</div>
            <div class="info-cell"><strong>Items:</strong> ${escapeHtml(summary.total_items || 0)}</div>
            <div class="info-cell"><strong>Finalized:</strong> ${escapeHtml(formatDateTime(batch?.finalizedAt || null))}</div>
          </div>
          <div class="table-wrap">
            <table>
              <colgroup>
                <col style="width: 5%;" />
                <col style="width: 7%;" />
                <col style="width: 15%;" />
                <col style="width: 12%;" />
                <col style="width: 6%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
                <col style="width: 7%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Sale</th>
                  <th>Item Code</th>
                  <th>Category</th>
                  <th>Karat</th>
                  <th class="tr">Purity</th>
                  <th class="tr">Wastage</th>
                  <th class="tr">Gross</th>
                  <th class="tr">Stone</th>
                  <th class="tr">Other</th>
                  <th class="tr">Net</th>
                  <th class="tr">Fine</th>
                  <th class="tr">Stone Amt</th>
                </tr>
              </thead>
              <tbody>
                ${rowHtml}
              </tbody>
            </table>
          </div>
        </div>
      `
    })
    .join('')

  const documentName = `settlement-session-${session?.sessionRef || 'session'}-${new Date().toISOString().slice(0, 10)}`

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
          grid-template-columns: repeat(6, 1fr);
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
          letter-spacing: 0.08em;
          color: #b95c58;
          margin-bottom: 3px;
        }
        .summary-cell .s-value {
          font-size: 13px;
          font-weight: 700;
          color: #4f4039;
        }

        /* ── Table wrapper ── */
        .table-wrap {
          overflow: hidden;
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

        .section-header {
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
          background: #fffaf5;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #b95c58;
          font-family: "Outfit", sans-serif;
        }

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
            <strong>Session Combined Preview</strong>
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
              ${logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Brand logo" />` : `<div class="logo-placeholder"></div>`}
              <div>
                <div class="company-name">Palak Jewellery</div>
                <div class="company-subtitle">Session Combined Export &mdash; Grouped Supplier Settlement Ledger</div>
              </div>
            </div>
          </div>

          <!-- Document Title -->
          <div class="doc-title-bar">${escapeHtml(session?.sessionRef || 'Session Combined Report')}</div>

          <!-- Info Grid -->
          <div class="info-grid">
            <div class="info-cell"><strong>Customer Details:</strong> ${escapeHtml(customerLine || '-')}</div>
            <div class="info-cell"><strong>Assigned Salesman:</strong> ${escapeHtml(session?.assignedSalesman?.name || session?.assignedSalesman?.code || '-')}</div>
            <div class="info-cell"><strong>Finalized At:</strong> ${escapeHtml(formatDateTime(session?.finalizedAt))}</div>
            <div class="info-cell"><strong>Report Date:</strong> ${escapeHtml(generatedAt)}</div>
          </div>

          <!-- Summary Strip -->
          <div class="summary-strip">
            <div class="summary-cell">
              <div class="s-label">Suppliers</div>
              <div class="s-value">${escapeHtml(String(totals.supplier_count || 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Total Items</div>
              <div class="s-value">${escapeHtml(String(totals.total_items || 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Gross Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_gross_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Stone Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_stone_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Net Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_net_weight ?? 0))}</div>
            </div>
            <div class="summary-cell">
              <div class="s-label">Fine Wt.</div>
              <div class="s-value">${escapeHtml(formatWeight(totals.total_fine_weight ?? 0))}</div>
            </div>
          </div>

          <div class="section-header">Supplier Section Summary</div>
          <div class="table-wrap">
            <table>
              <colgroup>
                <col style="width: 6%;" />
                <col style="width: 24%;" />
                <col style="width: 16%;" />
                <col style="width: 10%;" />
                <col style="width: 10%;" />
                <col style="width: 11%;" />
                <col style="width: 11%;" />
                <col style="width: 11%;" />
                <col style="width: 11%;" />
              </colgroup>
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Supplier</th>
                  <th>Batch Ref</th>
                  <th>Revision</th>
                  <th class="tr">Items</th>
                  <th class="tr">Gross Wt.</th>
                  <th class="tr">Stone Wt.</th>
                  <th class="tr">Net Wt.</th>
                  <th class="tr">Fine Wt.</th>
                </tr>
              </thead>
              <tbody>
                ${supplierSummaryRows}
              </tbody>
            </table>
          </div>

          ${supplierSectionsHtml}

          <!-- Footer -->
          <div class="doc-footer" style="margin-top: 20px;">
            <div>Generated from finalized session supplier sections.</div>
            <div>On-demand session export.</div>
          </div>
        </div>
      </div>
    </body>
  </html>`
}

const renderSupplierSectionPdf = async (data = {}) => {
  const html = await buildSupplierSectionPdfHtml(data)
  const lines = [
    'Supplier Section Export',
    `Supplier: ${data.batch?.supplier?.name || data.batch?.supplier?.code || 'Unknown'}`,
    `Batch: ${data.batch?.batchRef || '-'}`,
    `Session: ${data.session?.sessionRef || 'Standalone'}`,
    `Revision: ${data.batch?.revision || '-'}`,
    `Finalized: ${formatDateTime(data.batch?.finalizedAt || null)}`,
    `Items: ${data.summary?.total_items || 0}`,
    `Gross: ${formatWeight(data.summary?.total_gross_weight || 0)}`,
    `Stone: ${formatWeight(data.summary?.total_stone_weight || 0)}`,
    `Other: ${formatWeight(data.summary?.total_other_weight || 0)}`,
    `Net: ${formatWeight(data.summary?.total_net_weight || 0)}`,
    `Fine: ${formatWeight(data.summary?.total_fine_weight || 0)}`,
    `Stone Amount: ${formatCurrency(data.summary?.total_stone_amount || 0)}`,
    `Warnings: ${data.batch?.warningsCount || 0} | Review: ${data.batch?.reviewCount || 0} | Duplicates: ${data.batch?.duplicateCount || 0} | Manual Overrides: ${data.batch?.manualOverrideCount || 0}`,
    '',
  ]

  for (const row of data.rows || []) {
    lines.push(
      `${row.sale_ref || '-'} | ${row.item_code || '-'} | ${row.category || '-'} | ${row.karat || '-'}`,
      `Purity ${formatPercentage(row.purity)} | Wastage ${formatPercentage(row.wastage)} | Gross ${formatWeight(row.gross)} | Stone ${formatWeight(row.stone)} | Other ${formatWeight(row.other)}`,
      `Net ${formatWeight(row.net)} | Fine ${formatWeight(row.fine)} | Stone Amt ${formatCurrency(row.stone_amount)}`,
      ''
    )
  }

  return buildPdfBufferFromHtml(html, 'SupplierSectionExport', lines)
}

const renderSessionPdf = async (data = {}) => {
  const html = await buildSessionPdfHtml(data)
  const lines = [
    'Session Combined Export',
    `Session: ${data.session?.sessionRef || '-'}`,
    `Customer: ${data.session?.customerName || '-'}${data.session?.customerPhone ? ` | ${data.session.customerPhone}` : ''}${data.session?.referenceNote ? ` | ${data.session.referenceNote}` : ''}`,
    `Assigned salesman: ${data.session?.assignedSalesman?.name || data.session?.assignedSalesman?.code || '-'}`,
    `Finalized: ${formatDateTime(data.session?.finalizedAt || null)}`,
    `Suppliers: ${data.summary?.supplier_count || 0}`,
    `Items: ${data.summary?.total_items || 0}`,
    `Gross: ${formatWeight(data.summary?.total_gross_weight || 0)}`,
    `Stone: ${formatWeight(data.summary?.total_stone_weight || 0)}`,
    `Other: ${formatWeight(data.summary?.total_other_weight || 0)}`,
    `Net: ${formatWeight(data.summary?.total_net_weight || 0)}`,
    `Fine: ${formatWeight(data.summary?.total_fine_weight || 0)}`,
    `Stone Amount: ${formatCurrency(data.summary?.total_stone_amount || 0)}`,
    '',
  ]

  for (const section of data.sections || []) {
    const batch = section.batch || {}
    const sectionSummary = section.summary || summarizeExportRows(section.rows || [])
    lines.push(
      `Supplier: ${batch?.supplier?.name || batch?.supplier?.code || 'Unknown'} | Batch: ${batch?.batchRef || '-'} | Revision: ${batch?.revision || '-'}`,
      `Items ${sectionSummary.total_items || 0} | Gross ${formatWeight(sectionSummary.total_gross_weight || 0)} | Stone ${formatWeight(sectionSummary.total_stone_weight || 0)} | Other ${formatWeight(sectionSummary.total_other_weight || 0)} | Net ${formatWeight(sectionSummary.total_net_weight || 0)} | Fine ${formatWeight(sectionSummary.total_fine_weight || 0)}`,
    )
    for (const row of section.rows || []) {
      lines.push(
        `${row.sale_ref || '-'} | ${row.item_code || '-'} | ${row.category || '-'} | ${row.karat || '-'}`,
        `Purity ${formatPercentage(row.purity)} | Wastage ${formatPercentage(row.wastage)} | Gross ${formatWeight(row.gross)} | Stone ${formatWeight(row.stone)} | Other ${formatWeight(row.other)}`,
        `Net ${formatWeight(row.net)} | Fine ${formatWeight(row.fine)} | Stone Amt ${formatCurrency(row.stone_amount)}`,
        ''
      )
    }
    lines.push('')
  }

  return buildPdfBufferFromHtml(html, 'SessionCombinedExport', lines)
}

const buildSupplierSectionExportFileName = (batch, revision, extension = 'pdf') => {
  const batchRef = sanitizeFileNameSegment(batch?.batchRef || batch?.batch_ref || 'section', 'section')
  const revisionNumber = normalizeRevisionNumber(revision?.revision ?? revision) ?? toNumber(batch?.revision) ?? 1
  const finalizedAt = revision?.finalizedAt || batch?.finalizedAt || new Date()
  const datePart = formatDateOnly(finalizedAt).replace(/\s+/g, '-')
  return `settlement-section-${batchRef}-rev${revisionNumber}-${sanitizeFileNameSegment(datePart, 'date')}.${extension === 'csv' ? 'csv' : 'pdf'}`
}

const buildSessionExportFileName = (session, extension = 'pdf') => {
  const sessionRef = sanitizeFileNameSegment(session?.sessionRef || session?.session_ref || 'session', 'session')
  const datePart = formatDateOnly(session?.finalizedAt || new Date()).replace(/\s+/g, '-')
  return `settlement-session-${sessionRef}-${sanitizeFileNameSegment(datePart, 'date')}.${extension === 'csv' ? 'csv' : 'pdf'}`
}

export const settlementScopedExportsService = {
  buildSessionExportData,
  buildSessionExportFileName,
  buildSupplierSectionExportData,
  buildSupplierSectionExportFileName,
  renderSessionCsv,
  renderSessionPdf,
  renderSupplierSectionCsv,
  renderSupplierSectionPdf,
  buildSupplierSectionPdfHtml,
  buildSessionPdfHtml,
}

export {
  SettlementScopedExportError,
  buildSessionExportData,
  buildSessionExportFileName,
  buildSupplierSectionExportData,
  buildSupplierSectionExportFileName,
  renderSessionCsv,
  renderSessionPdf,
  renderSupplierSectionCsv,
  renderSupplierSectionPdf,
  buildSupplierSectionPdfHtml,
  buildSessionPdfHtml,
}
