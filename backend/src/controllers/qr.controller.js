import mongoose from 'mongoose'
import { Supplier } from '../models/Supplier.js'
import { QrIngestion } from '../models/QrIngestion.js'
import { detectSupplier, normalizeParsedQR, parseQR } from '../services/qrParser.service.js'
import {
  buildDefaultFinalFromParsed,
  buildParsedIngestionData,
  buildParsedWarnings,
  buildUnknownFinalFromParsed,
  buildUnknownLearningMetadata,
  buildUnknownParsedIngestionData,
  evaluateParsedStatus,
  mergeFinalData,
  validateFinalData,
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

export const ingestQr = async (req, res) => {
  try {
    const raw = req.body.raw ?? req.body.rawQR ?? req.body.qrRaw ?? req.body.qr ?? req.body.string
    const rawString = typeof raw === 'string' ? raw : ''

    if (!rawString.trim()) {
      return sendError(res, 400, 'Raw QR string is required', 'MISSING_FIELDS')
    }

    const detection = await getSupplierDetection(rawString)
    const supplier = detection?.supplier || null
    let parsed = {}
    let final = {}
    let warnings = []
    let fallback = null
    let learning = null
    let status = 'needs_review'

    if (supplier) {
      const parseResult = parseQR(rawString, supplier?.qrMapping)
      const normalizedResult = normalizeParsedQR(parseResult, supplier)
      parsed = buildParsedIngestionData(normalizedResult, supplier)
      parsed.warnings = buildParsedWarnings(parsed)
      const parsedStatus = evaluateParsedStatus(parsed, {
        warningsRequireReview: config.qrWarningsRequireReview,
      })
      final = buildDefaultFinalFromParsed(parsed)
      warnings = [...new Set([...parsed.warnings])]
      status = parsedStatus.status
    } else {
      const unknownParsed = buildUnknownParsedIngestionData(rawString)
      fallback = unknownParsed.fallback
      warnings = [...new Set([...(unknownParsed.warnings || []), 'Unknown supplier format'])]
      parsed = {}
      final = buildUnknownFinalFromParsed(unknownParsed)
      status = 'needs_review'
      learning = buildUnknownLearningMetadata(rawString, unknownParsed)
    }

    const parsedForStorage = {
      ...parsed,
      parseErrors: Array.isArray(parsed?.errors) ? [...parsed.errors] : [],
    }
    delete parsedForStorage.errors

    const ingestion = await QrIngestion.create({
      raw: rawString,
      parsed: parsedForStorage,
      fallback,
      warnings,
      final,
      status,
      learning,
    })

    return sendSuccess(res, toPublicIngestion(ingestion), status === 'approved' ? 'QR ingested successfully' : 'QR ingested and marked for review', 201)
  } catch (error) {
    return sendError(res, 500, 'Failed to ingest QR', 'SERVER_ERROR')
  }
}

export const getQrIngestion = async (req, res) => {
  try {
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId).lean()
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    if (ingestion.parsed && Array.isArray(ingestion.parsed.parseErrors) && !Array.isArray(ingestion.parsed.errors)) {
      ingestion.parsed.errors = [...ingestion.parsed.parseErrors]
    }
    delete ingestion.__v
    return sendSuccess(res, ingestion)
  } catch (error) {
    return sendError(res, 500, 'Failed to load QR ingestion', 'SERVER_ERROR')
  }
}

export const finalizeQrIngestion = async (req, res) => {
  try {
    const ingestionId = getIngestionId(req)
    if (!mongoose.isValidObjectId(ingestionId)) {
      return sendError(res, 400, 'Invalid QR ingestion id', 'INVALID_ID')
    }

    const ingestion = await QrIngestion.findById(ingestionId)
    if (!ingestion) {
      return sendError(res, 404, 'QR ingestion not found', 'NOT_FOUND')
    }

    const patchSource = req.body.final && typeof req.body.final === 'object' ? req.body.final : req.body
    const mergedFinal = mergeFinalData(ingestion.parsed, ingestion.final, patchSource)
    const validationErrors = validateFinalData(mergedFinal)

    if (validationErrors.length > 0) {
      return sendError(res, 400, 'Final data is invalid', 'VALIDATION_ERROR', {
        validationErrors,
      })
    }

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

    return sendSuccess(res, toPublicIngestion(ingestion), 'QR finalized')
  } catch (error) {
    return sendError(res, 500, 'Failed to finalize QR ingestion', 'SERVER_ERROR')
  }
}
