import mongoose from 'mongoose'
import { Supplier } from '../models/Supplier.js'
import { QrIngestion } from '../models/QrIngestion.js'
import { detectSupplier, parseQR } from '../services/qrParser.service.js'
import { normalize } from '../services/qrNormalization.service.js'
import { validate } from '../services/qrValidation.service.js'
import { valuate } from '../services/qrValuation.service.js'
import { loadSettlementSettings } from '../services/settlementSettings.service.js'
import {
  applyCorrectionPatch,
  applyApprovalState,
  applyReviewState,
  buildFinalSnapshot,
  buildCurrentWorkflow,
  normalizeCorrectionNote,
  requiresCorrectionNote,
} from '../services/qrCorrection.service.js'
import {
  buildDefaultFinalFromParsed,
  buildParsedIngestionData,
  buildParsedWarnings,
  buildUnknownFinalFromParsed,
  buildUnknownLearningMetadata,
  buildUnknownParsedIngestionData,
  mergeFinalData,
} from '../services/qrIngestion.service.js'
import { config } from '../config/env.js'

const sendSuccess = (res, data, message, status = 200) => {
  const payload = { success: true, data }
  if (message) {
    payload.message = message
  }
  return res.status(status).json(payload)
}

const sendError = (res, status, error, code, extra = {}) => {
  return res.status(status).json({ success: false, error, code, ...extra })
}

const normalizeText = (value) => {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

const toPublicIngestion = (ingestion) => {
  if (!ingestion) return null
  const plain = typeof ingestion.toObject === 'function' ? ingestion.toObject() : { ...ingestion }
  if (plain.parsed && Array.isArray(plain.parsed.parseErrors) && !Array.isArray(plain.parsed.errors)) {
    plain.parsed.errors = [...plain.parsed.parseErrors]
  }
  delete plain.__v
  return plain
}

const getIngestionId = (req) => req.params.id || req.params.qrId

const getSupplierDetection = async (rawString) => {
  const suppliers = await Supplier.find().lean()
  return detectSupplier(rawString, suppliers)
}

const buildUnknownValuationInput = (parsed) => ({
  supplier: 'Unknown',
  design_code: normalizeText(parsed?.itemCode),
  gross_weight: parsed?.grossWeight ?? null,
  stone_weight: parsed?.diamondWeight ?? null,
  other_weight: null,
  net_weight: parsed?.netWeight ?? null,
  purity_percent: null,
  wastage_percent: null,
  fine_weight: null,
  stone_amount: null,
  confidence: 0,
  status: 'needs_review',
})

const toPlainObject = (value) => {
  if (!value) return {}
  if (typeof value.toObject === 'function') {
    return value.toObject()
  }
  return { ...value }
}

const buildLegacyParsedToResolved = (parsed = {}) => ({
  supplier: normalizeText(parsed?.supplier) || 'Unknown',
  design_code: normalizeText(parsed?.designCode) || normalizeText(parsed?.itemCode),
  gross_weight: parsed?.grossWeight ?? null,
  stone_weight: parsed?.stoneWeight ?? parsed?.diamondWeight ?? null,
  other_weight: parsed?.otherWeight ?? null,
  net_weight: parsed?.netWeight ?? null,
  purity_percent: parsed?.purity !== null && parsed?.purity !== undefined ? Number.parseFloat(String(parsed.purity).replace(/[^0-9.]/g, '')) || null : null,
  wastage_percent: null,
  fine_weight: null,
  stone_amount: null,
  other_amount: null,
  confidence: parsed?.confidence === 'high' ? 90 : parsed?.confidence === 'low' ? 40 : 0,
  status: 'pending',
})

const buildIngestionValidationSnapshot = (validatedResult = {}, warnings = [], evaluatedAt = null) => ({
  input: { ...validatedResult },
  status: validatedResult.status || 'pending',
  confidence: validatedResult.confidence ?? null,
  warnings: Array.isArray(warnings) ? [...warnings] : [],
  evaluatedAt: evaluatedAt || new Date(),
})

const isApprovedRecord = (ingestion = {}) => ingestion?.status === 'approved' || Boolean(ingestion?.approvedAt)

const hydrateIngestionForResponse = (ingestion, options = {}) => {
  if (!ingestion) return null

  const plain = toPlainObject(ingestion)
  const parsed = plain.parsed || {}
  const corrections = plain.corrections || {}
  if (Array.isArray(parsed.parseErrors) && !Array.isArray(parsed.errors)) {
    parsed.errors = [...parsed.parseErrors]
  }
  delete plain.__v
  const workflowSource = {
    ...parsed,
    confidence:
      plain?.validation?.confidence ??
      plain?.confidence ??
      parsed?.confidence,
  }
  const currentWorkflow = buildCurrentWorkflow(workflowSource, corrections, plain.status || 'needs_review', options)
  const originalWorkflow = buildCurrentWorkflow(workflowSource, {}, plain.status || 'needs_review', options)
  const finalSnapshot = {
    ...currentWorkflow.final,
    ...(plain.final || {}),
  }
  const validationSnapshot = {
    ...(plain.validation || {}),
    ...buildIngestionValidationSnapshot(currentWorkflow.validated, currentWorkflow.validationWarnings, plain.validation?.evaluatedAt || plain.updatedAt || plain.createdAt),
  }
  const valuationSnapshot = {
    ...(plain.valuation || {}),
    ...currentWorkflow.valuation,
    warnings: Array.isArray(currentWorkflow.valuationWarnings) && currentWorkflow.valuationWarnings.length > 0
      ? [...currentWorkflow.valuationWarnings]
      : Array.isArray(plain.valuation?.warnings)
        ? [...plain.valuation.warnings]
        : [],
  }

  return {
    ...plain,
    parsed,
    corrections,
    final: finalSnapshot,
    validation: validationSnapshot,
    valuation: valuationSnapshot,
    validationWarnings: [...currentWorkflow.validationWarnings],
    valuationWarnings: [...valuationSnapshot.warnings],
    originalValidationWarnings: [...originalWorkflow.validationWarnings],
    originalValuationWarnings: [...originalWorkflow.valuationWarnings],
    currentValidationWarnings: [...currentWorkflow.validationWarnings],
    currentValuationWarnings: [...valuationSnapshot.warnings],
  }
}

export const ingestQr = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const raw = req.body.raw ?? req.body.rawQR ?? req.body.qrRaw ?? req.body.qr ?? req.body.string
    const rawString = typeof raw === 'string' ? raw : ''

    if (!rawString.trim()) {
      return sendError(res, 400, 'Raw QR string is required', 'MISSING_FIELDS')
    }

    const detection = await getSupplierDetection(rawString)
    const supplier = detection?.supplier || null
    let parsed = {}
    let final = {}
    let valuation = null
    let warnings = []
    let validationWarnings = []
    let fallback = null
    let learning = null
    let status = 'needs_review'
    let validatedResult = null
    let validationSnapshot = null

    if (supplier) {
      const parseResult = parseQR(rawString, supplier?.qrMapping)
      const normalizedResult = normalize(parseResult, supplier)
      validatedResult = validate(normalizedResult, settlementSettings)
      valuation = valuate(validatedResult, settlementSettings)
      validationWarnings = Array.isArray(validatedResult?.warnings) ? [...validatedResult.warnings] : []
      console.info(
        JSON.stringify({
          scope: 'qr-validation',
          raw_qr: rawString,
          supplier: validatedResult.supplier || supplier?.name || supplier?.code || 'Unknown',
          status: validatedResult.status,
          confidence: validatedResult.confidence,
          warnings: Array.isArray(validatedResult.warnings) ? validatedResult.warnings.length : 0,
        })
      )
      parsed = buildParsedIngestionData(validatedResult, supplier)
      const parsedWarnings = buildParsedWarnings(parsed)
      parsed.warnings = [...new Set([...(validationWarnings || []), ...parsedWarnings])]
      final = buildFinalSnapshot(validatedResult)
      warnings = [...new Set([...parsed.warnings])]
      status = validatedResult.status
      if (status === 'approved' && config.qrWarningsRequireReview && warnings.length > 0) {
        status = 'needs_review'
      }
      validatedResult = { ...validatedResult, status }
      valuation = valuate(validatedResult, settlementSettings)
      validationWarnings = Array.isArray(validatedResult?.warnings) ? [...validatedResult.warnings] : []
      parsed.warnings = [...new Set([...(validationWarnings || []), ...parsedWarnings])]
      final = buildFinalSnapshot(validatedResult)
      validationSnapshot = buildIngestionValidationSnapshot(validatedResult, validationWarnings)
    } else {
      const unknownParsed = buildUnknownParsedIngestionData(rawString)
      fallback = unknownParsed.fallback
      warnings = [...new Set([...(unknownParsed.warnings || []), 'Unknown supplier format'])]
      parsed = {}
      validatedResult = validate(buildUnknownValuationInput(unknownParsed), settlementSettings)
      valuation = valuate(validatedResult, settlementSettings)
      validationWarnings = Array.isArray(validatedResult?.warnings) ? [...validatedResult.warnings] : []
      final = buildFinalSnapshot({
        supplier: 'Unknown',
        design_code: normalizeText(unknownParsed?.itemCode),
        gross_weight: unknownParsed?.grossWeight ?? null,
        stone_weight: unknownParsed?.diamondWeight ?? null,
        other_weight: null,
        net_weight: unknownParsed?.netWeight ?? null,
        purity_percent: null,
        wastage_percent: null,
        fine_weight: null,
        stone_amount: null,
        other_amount: null,
        confidence: validatedResult?.confidence ?? 0,
        status: validatedResult?.status || 'needs_review',
      })
      status = validatedResult?.status || 'needs_review'
      learning = buildUnknownLearningMetadata(rawString, unknownParsed)
      validationWarnings = Array.isArray(validatedResult?.warnings) ? [...validatedResult.warnings] : []
      validationSnapshot = buildIngestionValidationSnapshot(validatedResult, validationWarnings)
    }

    const parsedForStorage = {
      ...parsed,
      parseErrors: Array.isArray(parsed?.errors) ? [...parsed.errors] : [],
    }
    delete parsedForStorage.errors

    const ingestion = await QrIngestion.create({
      raw: rawString,
      raw_qr: rawString,
      parsed: parsedForStorage,
      fallback,
      corrections: {},
      warnings,
      validationWarnings,
      validation: validationSnapshot,
      final,
      valuation,
      status,
      confidence: validatedResult?.confidence ?? null,
      learning,
    })

    return sendSuccess(res, toPublicIngestion(ingestion), status === 'approved' ? 'QR ingested successfully' : 'QR ingested and marked for review', 201)
  } catch (error) {
    return sendError(res, 500, 'Failed to ingest QR', 'SERVER_ERROR')
  }
}

export const getQrIngestion = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId).lean()
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings))
  } catch (error) {
    return sendError(res, 500, 'Failed to load QR ingestion', 'SERVER_ERROR')
  }
}

export const saveQrCorrections = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    if (req.user?.permissions?.canCorrectQRFields === false) {
      return sendError(res, 403, 'Insufficient permissions', 'FORBIDDEN')
    }

    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId)
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    if (isApprovedRecord(ingestion)) {
      return sendError(res, 409, 'Approved QR records are locked', 'LOCKED')
    }

    const currentCorrections = toPlainObject(ingestion.corrections)
    const workflowSource = {
      ...(ingestion.parsed || {}),
      confidence:
        ingestion?.validation?.confidence ??
        ingestion?.confidence ??
        ingestion?.parsed?.confidence,
    }
    const currentWorkflow = buildCurrentWorkflow(workflowSource, currentCorrections, ingestion.status || 'needs_review', settlementSettings)
    const patchSource =
      req.body?.corrections && typeof req.body.corrections === 'object'
        ? req.body.corrections
        : req.body
    const noteSource =
      req.body?.correction_note ??
      req.body?.correctionNote ??
      req.body?.note ??
      patchSource?.correction_note ??
      patchSource?.correctionNote ??
      patchSource?.note
    const { corrections, changedFields } = applyCorrectionPatch(
      currentCorrections,
      patchSource,
      currentWorkflow.resolved,
    )
    const correctionNote = normalizeCorrectionNote(noteSource)
    const noteChanged = correctionNote !== (ingestion.correction_note || null)

    if (changedFields.length === 0 && !noteChanged) {
      return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'No correction changes applied')
    }

    if (requiresCorrectionNote(currentWorkflow.baseResolved, corrections) && !correctionNote) {
      return sendError(
        res,
        422,
        'Correction note is required for major numeric overrides',
        'CORRECTION_NOTE_REQUIRED',
      )
    }

    const now = new Date()
    const nextWorkflow = buildCurrentWorkflow(workflowSource, corrections, 'needs_review', settlementSettings)

    ingestion.corrections = {
      ...corrections,
      correctedBy: req.user?.id || null,
      correctedAt: now,
    }
    ingestion.correction_note = correctionNote
    ingestion.validation = buildIngestionValidationSnapshot(nextWorkflow.validated, nextWorkflow.validationWarnings, now)
    ingestion.validationWarnings = [...nextWorkflow.validationWarnings]
    ingestion.valuation = {
      ...nextWorkflow.valuation,
      warnings: [...nextWorkflow.valuationWarnings],
    }
    ingestion.final = nextWorkflow.final
    ingestion.warnings = [...new Set([...(nextWorkflow.validationWarnings || []), ...(nextWorkflow.valuationWarnings || [])])]
    ingestion.status = 'needs_review'
    ingestion.confidence = nextWorkflow.validated?.confidence ?? null
    ingestion.correctedBy = req.user?.id || null
    ingestion.correctedAt = now
    ingestion.approvedBy = null
    ingestion.approvedAt = null

    await ingestion.save()

    return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'QR corrections saved')
  } catch (error) {
    return sendError(res, 500, 'Failed to save QR corrections', 'SERVER_ERROR')
  }
}

export const approveQrIngestion = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId)
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    if (isApprovedRecord(ingestion)) {
      return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'QR already approved')
    }

    const now = new Date()
    const updated = applyApprovalState(ingestion.toObject(), req.user?.id || null, now)
    ingestion.status = updated.status
    ingestion.approvedBy = updated.approvedBy
    ingestion.approvedAt = updated.approvedAt
    if (!ingestion.reviewedBy) {
      ingestion.reviewedBy = req.user?.id || null
    }
    if (!ingestion.reviewedAt) {
      ingestion.reviewedAt = now
    }

    await ingestion.save()

    return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'QR approved')
  } catch (error) {
    return sendError(res, 500, 'Failed to approve QR ingestion', 'SERVER_ERROR')
  }
}

export const markReviewedQrIngestion = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId)
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    if (isApprovedRecord(ingestion)) {
      return sendError(res, 409, 'Approved QR records are locked', 'LOCKED')
    }

    const updated = applyReviewState(ingestion.toObject(), req.user?.id || null, new Date())
    ingestion.reviewedBy = updated.reviewedBy
    ingestion.reviewedAt = updated.reviewedAt
    await ingestion.save()

    return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'QR marked as reviewed')
  } catch (error) {
    return sendError(res, 500, 'Failed to mark QR ingestion reviewed', 'SERVER_ERROR')
  }
}

export const finalizeQrIngestion = async (req, res) => {
  try {
    const settlementSettings = await loadSettlementSettings()
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId)
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    if (isApprovedRecord(ingestion)) {
      return sendError(res, 409, 'Approved QR records are locked', 'LOCKED')
    }

    const patchSource = req.body.final && typeof req.body.final === 'object' ? req.body.final : req.body
    const mergedFinal = mergeFinalData(ingestion.parsed, ingestion.final, patchSource)

    ingestion.final = mergedFinal
    ingestion.status = 'approved'
    ingestion.reviewedBy = req.user?.id || null
    ingestion.reviewedAt = new Date()
    if ((!ingestion.parsed || !ingestion.parsed.supplier) && ingestion.fallback) {
      ingestion.learning = {
        delimiter: ingestion.fallback.delimiter || null,
        prefixPatterns: Array.isArray(ingestion.fallback.prefixPatterns) ? ingestion.fallback.prefixPatterns : [],
        sampleTokens: Array.isArray(ingestion.fallback.sampleTokens) ? ingestion.fallback.sampleTokens : [],
        confidence: ingestion.fallback.confidence || 'low',
      }
    }

    await ingestion.save()

    return sendSuccess(res, hydrateIngestionForResponse(ingestion, settlementSettings), 'QR finalized')
  } catch (error) {
    return sendError(res, 500, 'Failed to finalize QR ingestion', 'SERVER_ERROR')
  }
}
