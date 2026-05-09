import { toNumber, toText } from './qrNormalization.shared.js'
import {
  normalizeConfidence,
  formatCurrency,
  formatWeight,
  formatPercentage,
  preserveNumericPrecision,
} from './precision.service.js'

const normalizeText = (value) => {
  const text = toText(value)
  return text || ''
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const parseDateValue = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeReportFilters = (input = {}) => {
  const startDate = parseDateValue(input.startDate || input.from || input.start)
  const endDate = parseDateValue(input.endDate || input.to || input.end)
  const confidenceThreshold = toNumber(input.confidenceThreshold ?? input.confidence_threshold ?? input.minConfidence)
  const workflowScope = normalizeText(input.workflowScope || input.workflow_scope)

  return {
    search: normalizeText(input.search),
    supplier: normalizeText(input.supplier),
    status: normalizeText(input.status),
    valuationStatus: normalizeText(input.valuation_status || input.valuationStatus),
    startDate,
    endDate,
    confidenceThreshold,
    workflowScope,
  }
}

const buildReportQuery = (filters = {}) => {
  const normalized = normalizeReportFilters(filters)
  const query = {}

  if (normalized.workflowScope === 'exceptions') {
    query.status = { $in: ['parsed', 'needs_review'] }
  }

  const searchPattern = normalized.search ? escapeRegex(normalized.search) : ''
  const searchConditions = normalized.search
    ? [
        { 'parsed.supplier': { $regex: searchPattern, $options: 'i' } },
        { 'final.design_code': { $regex: searchPattern, $options: 'i' } },
        { 'final.designCode': { $regex: searchPattern, $options: 'i' } },
        { 'parsed.designCode': { $regex: searchPattern, $options: 'i' } },
        { 'parsed.itemCode': { $regex: searchPattern, $options: 'i' } },
        { status: { $regex: searchPattern, $options: 'i' } },
        { 'valuation.valuation_status': { $regex: searchPattern, $options: 'i' } },
      ]
    : []

  if (normalized.supplier) {
    query['parsed.supplier'] = { $regex: escapeRegex(normalized.supplier), $options: 'i' }
  }

  if (normalized.status && normalized.workflowScope !== 'settlement') {
    query.status = normalized.status
  }

  if (normalized.valuationStatus && normalized.workflowScope !== 'settlement') {
    query['valuation.valuation_status'] = normalized.valuationStatus
  }

  if (normalized.confidenceThreshold !== null && normalized.workflowScope !== 'settlement') {
    query.confidence = { $gte: normalized.confidenceThreshold }
  }

  if (normalized.startDate || normalized.endDate) {
    query.createdAt = {}
    if (normalized.startDate) {
      query.createdAt.$gte = normalized.startDate
    }
    if (normalized.endDate) {
      const end = new Date(normalized.endDate)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  if (searchConditions.length > 0) {
    query.$or = searchConditions
  }

  return query
}

const extractValidationWarnings = (record) => {
  if (Array.isArray(record?.validation?.warnings)) {
    return [...record.validation.warnings]
  }
  if (Array.isArray(record?.validationWarnings)) {
    return [...record.validationWarnings]
  }
  return []
}

const extractValuationWarnings = (record) => {
  if (Array.isArray(record?.valuation?.warnings)) {
    return [...record.valuation.warnings]
  }
  return []
}

const getPersistedTotals = (record) => {
  const totals = record?.valuation?.totals || {}
  return {
    gross_weight: toNumber(totals.gross_weight) ?? 0,
    stone_weight: toNumber(totals.stone_weight) ?? 0,
    other_weight: toNumber(totals.other_weight) ?? 0,
    net_weight: toNumber(totals.net_weight) ?? 0,
    fine_weight: toNumber(totals.fine_weight) ?? 0,
    stone_amount: toNumber(totals.stone_amount) ?? 0,
    other_amount: toNumber(totals.other_amount) ?? 0,
  }
}

const mapReportRow = (record = {}) => {
  const totals = getPersistedTotals(record)
  return {
    id: record._id ? String(record._id) : '',
    createdAt: record.createdAt || null,
    supplier: normalizeText(record?.parsed?.supplier),
    design_code:
      normalizeText(record?.final?.design_code) ||
      normalizeText(record?.final?.designCode) ||
      normalizeText(record?.parsed?.designCode) ||
      normalizeText(record?.parsed?.itemCode),
    gross_weight: totals.gross_weight,
    stone_weight: totals.stone_weight,
    other_weight: totals.other_weight,
    net_weight: totals.net_weight,
    fine_weight: totals.fine_weight,
    stone_amount: totals.stone_amount,
    other_amount: totals.other_amount,
    purity_percent: toNumber(record?.final?.purity_percent) ?? toNumber(record?.corrections?.purity_percent) ?? null,
    wastage_percent: toNumber(record?.final?.wastage_percent) ?? toNumber(record?.corrections?.wastage_percent) ?? null,
    status: normalizeText(record?.status),
    confidence: normalizeConfidence(record?.confidence),
    valuation_status: normalizeText(record?.valuation?.valuation_status) || 'partial',
    approved_at: record?.approvedAt || null,
    reviewed_at: record?.reviewedAt || null,
    corrected_at: record?.correctedAt || null,
    correction_note: normalizeText(record?.correction_note),
    workflow_state: record?.approvedAt
      ? 'approved'
      : record?.correctedAt
        ? 'corrected'
        : record?.reviewedAt
          ? 'reviewed'
          : normalizeText(record?.status) || 'needs_review',
    validation_warnings: extractValidationWarnings(record),
    valuation_warnings: extractValuationWarnings(record),
    warnings: [...extractValidationWarnings(record), ...extractValuationWarnings(record)],
  }
}

const filterReportRows = (records = [], filters = {}) => {
  const normalized = normalizeReportFilters(filters)
  return records
    .map((record) => mapReportRow(record))
    .filter((row) => {
      if (normalized.search) {
        const search = normalized.search.toLowerCase()
        const rowSupplier = normalizeText(row.supplier).toLowerCase()
        const rowDesign = normalizeText(row.design_code).toLowerCase()
        const rowStatus = normalizeText(row.status).toLowerCase()
        const rowValuation = normalizeText(row.valuation_status).toLowerCase()
        if (
          !rowSupplier.includes(search) &&
          !rowDesign.includes(search) &&
          !rowStatus.includes(search) &&
          !rowValuation.includes(search)
        ) {
          return false
        }
      }
      if (normalized.supplier && !row.supplier.toLowerCase().includes(normalized.supplier.toLowerCase())) {
        return false
      }
      if (normalized.status && row.status !== normalized.status) {
        return false
      }
      if (normalized.valuationStatus && row.valuation_status !== normalized.valuationStatus) {
        return false
      }
      if (normalized.confidenceThreshold !== null && row.confidence < normalized.confidenceThreshold) {
        return false
      }
      if (normalized.startDate || normalized.endDate) {
        const createdAt = row.createdAt ? new Date(row.createdAt) : null
        if (!createdAt || Number.isNaN(createdAt.getTime())) {
          return false
        }
        if (normalized.startDate && createdAt < normalized.startDate) {
          return false
        }
        if (normalized.endDate) {
          const end = new Date(normalized.endDate)
          end.setHours(23, 59, 59, 999)
          if (createdAt > end) {
            return false
          }
        }
      }
      return true
    })
}

const buildDashboardSummary = (records = []) => {
  const rows = records.map((record) => mapReportRow(record))

  return rows.reduce(
    (acc, row) => {
      acc.total_items += 1
      acc.total_gross_weight += row.gross_weight
      acc.total_stone_weight += row.stone_weight
      acc.total_other_weight += row.other_weight
      acc.total_net_weight += row.net_weight
      acc.total_fine_weight += row.fine_weight
      acc.total_stone_amount += row.stone_amount
      acc.total_other_amount += row.other_amount

      if (row.status === 'approved') {
        acc.approved_count += 1
      }
      if (row.status === 'needs_review') {
        acc.needs_review_count += 1
      }
      if (row.valuation_status === 'complete') {
        acc.complete_valuation_count += 1
      }
      if (row.valuation_status === 'partial') {
        acc.partial_valuation_count += 1
      }
      if (row.valuation_status === 'supplier_only') {
        acc.supplier_only_count += 1
      }

      return acc
    },
    {
      total_items: 0,
      total_gross_weight: 0,
      total_stone_weight: 0,
      total_other_weight: 0,
      total_net_weight: 0,
      total_fine_weight: 0,
      total_stone_amount: 0,
      total_other_amount: 0,
      approved_count: 0,
      needs_review_count: 0,
      complete_valuation_count: 0,
      partial_valuation_count: 0,
      supplier_only_count: 0,
    }
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

const buildCsvExport = (records = []) => {
  const rows = records.map((row) => [
    row.supplier,
    row.design_code,
    preserveNumericPrecision(row.gross_weight),
    preserveNumericPrecision(row.stone_weight),
    preserveNumericPrecision(row.other_weight),
    preserveNumericPrecision(row.net_weight),
    preserveNumericPrecision(row.purity_percent),
    preserveNumericPrecision(row.wastage_percent),
    preserveNumericPrecision(row.fine_weight),
    preserveNumericPrecision(row.stone_amount),
    preserveNumericPrecision(row.other_amount),
    row.status,
    row.confidence,
    row.valuation_status,
  ])

  const header = [
    'supplier',
    'design_code',
    'gross_weight',
    'stone_weight',
    'other_weight',
    'net_weight',
    'purity_percent',
    'wastage_percent',
    'fine_weight',
    'stone_amount',
    'other_amount',
    'status',
    'confidence',
    'valuation_status',
  ]

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(','))
    .join('\n')
}

const escapePdfText = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

const buildPdfLines = (records = [], summary = {}, meta = {}) => {
  const lines = []
  lines.push(`Supplier Report`)
  lines.push(`Supplier: ${meta.supplier || 'All'}`)
  lines.push(`Report date: ${meta.reportDate || new Date().toISOString().slice(0, 10)}`)
  lines.push(`Total items: ${summary.total_items || 0}`)
  lines.push(``)
  lines.push(`Design Code | Gross | Stone | Other | Net | Purity | Wastage | Fine | Stone Amt | Other Amt`)
  lines.push(`--------------------------------------------------------------------------------------------------`)

  for (const row of records) {
    lines.push([
      row.design_code || '',
      formatWeight(row.gross_weight),
      formatWeight(row.stone_weight),
      formatWeight(row.other_weight),
      formatWeight(row.net_weight),
      formatPercentage(row.purity_percent),
      formatPercentage(row.wastage_percent),
      formatWeight(row.fine_weight),
      formatCurrency(row.stone_amount),
      formatCurrency(row.other_amount),
    ].join(' | '))
  }

  lines.push(``)
  lines.push(`Totals`)
  lines.push(`Gross: ${formatWeight(summary.total_gross_weight)}`)
  lines.push(`Stone: ${formatWeight(summary.total_stone_weight)}`)
  lines.push(`Other: ${formatWeight(summary.total_other_weight)}`)
  lines.push(`Net: ${formatWeight(summary.total_net_weight)}`)
  lines.push(`Fine: ${formatWeight(summary.total_fine_weight)}`)
  lines.push(`Stone Amount: ${formatCurrency(summary.total_stone_amount)}`)
  lines.push(`Other Amount: ${formatCurrency(summary.total_other_amount)}`)

  return lines
}

const buildPdfBuffer = (records = [], summary = {}, meta = {}) => {
  const lines = buildPdfLines(records, summary, meta)
  const content = [
    'BT',
    '/F1 10 Tf',
    '50 780 Td',
    lines
      .map((line, index) => {
        const escaped = escapePdfText(line)
        return index === 0 ? `(${escaped}) Tj` : `T* (${escaped}) Tj`
      })
      .join('\n'),
    'ET',
  ].join('\n')

  const objects = []
  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>')
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  objects.push(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`)

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

const buildReportDetail = (record = {}) => {
  const row = mapReportRow(record)
  return {
    id: row.id,
    createdAt: row.createdAt,
    supplier: row.supplier,
    design_code: row.design_code,
    gross_weight: row.gross_weight,
    stone_weight: row.stone_weight,
    other_weight: row.other_weight,
    net_weight: row.net_weight,
    fine_weight: row.fine_weight,
    stone_amount: row.stone_amount,
    other_amount: row.other_amount,
    purity_percent: row.purity_percent,
    wastage_percent: row.wastage_percent,
    status: row.status,
    confidence: row.confidence,
    valuation_status: row.valuation_status,
    approved_at: row.approved_at,
    reviewed_at: row.reviewed_at,
    corrected_at: row.corrected_at,
    correction_note: row.correction_note,
    workflow_state: row.workflow_state,
    validation_warnings: row.validation_warnings,
    valuation_warnings: row.valuation_warnings,
    valuation_totals: record?.valuation?.totals || {},
    corrections: record?.corrections || {},
    final: record?.final || {},
    validation: record?.validation || {},
    valuation: record?.valuation || {},
  }
}

export {
  buildCsvExport,
  buildDashboardSummary,
  buildPdfBuffer,
  buildReportDetail,
  buildReportQuery,
  filterReportRows,
  mapReportRow,
  normalizeReportFilters,
}
