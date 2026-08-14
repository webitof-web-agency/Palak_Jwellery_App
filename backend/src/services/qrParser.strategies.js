import {
  FIELD_KEYS,
  TEXT_FIELDS,
  createEmptyFields,
  createResult,
  normalizeRaw,
  toNumber,
  toText,
} from './qrParser.shared.js'
import {
  VENZORA_TOKEN_PATTERNS,
  YUG_LINE_PATTERN,
  isLikelyAdinathRaw,
  isLikelyUtsavRaw,
  normalizeYugRaw,
} from './qrParser.patterns.js'
import { calculateSettlementSnapshot, calculateYugWeightBreakdown } from './settlementCalculation.service.js'

const resolveFieldConfig = (value) => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return { indices: [value], stripPrefix: null }
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    if (Number.isInteger(n) && n >= 0) return { indices: [n], stripPrefix: null }
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const stripPrefix = typeof value.stripPrefix === 'string' ? value.stripPrefix : null

    if (Array.isArray(value.sumIndices)) {
      const indices = value.sumIndices.filter((i) => Number.isInteger(i) && i >= 0)
      if (indices.length > 0) return { indices, stripPrefix }
    }

    if (Number.isInteger(value.index) && value.index >= 0) {
      return { indices: [value.index], stripPrefix }
    }
  }

  return null
}

const applyStripPrefix = (str, prefix) => {
  if (!prefix) return str
  if (str.toUpperCase().startsWith(prefix.toUpperCase())) {
    return str.slice(prefix.length).trim()
  }
  return str
}

const parseDelimiterStrategy = (raw, supplierQRMappingConfig) => {
  const strategy = 'delimiter'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  if (!supplierQRMappingConfig || supplierQRMappingConfig.strategy !== 'delimiter') {
    errors.push({ field: 'qrMapping', reason: 'No delimiter mapping config for supplier' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const delimiter = toText(supplierQRMappingConfig.delimiter) || '|'
  const parts = raw.split(delimiter)
  const fieldMap = supplierQRMappingConfig.fieldMap || {}
  let parsedCount = 0

  if (delimiter === '/' && isLikelyAdinathRaw(raw)) {
    const tokens = parts.map((part) => String(part).trim())
    const meaningfulTokens = tokens.filter((part) => part.length > 0)
    const stoneTokens = meaningfulTokens.slice(1, -2)
    const stoneValues = []
    const stoneComponentFields = {}

    const parseNumericToken = (value) => {
      const parsed = toNumber(value)
      return parsed === null ? null : Math.round(parsed * 1000) / 1000
    }

    const grossWeight = parseNumericToken(meaningfulTokens[0])
    const qrNetWeight = parseNumericToken(meaningfulTokens[meaningfulTokens.length - 2])
    const itemCode = toText(meaningfulTokens[meaningfulTokens.length - 1])

    if (grossWeight === null) {
      errors.push({ field: 'grossWeight', reason: 'Gross weight is missing or invalid' })
    } else {
      fields.grossWeight = { value: grossWeight, parsed: true }
    }

    if (!itemCode) {
      errors.push({ field: 'itemCode', reason: 'Item/design code is missing' })
    } else {
      fields.designCode = { value: itemCode, parsed: true }
      fields.meta.itemCode = { value: itemCode, parsed: true }
      fields.meta.designCode = { value: itemCode, parsed: true }
    }

    if (qrNetWeight === null) {
      errors.push({ field: 'netWeight', reason: 'QR net weight is missing or invalid' })
    } else {
      fields.netWeight = { value: qrNetWeight, parsed: true }
    }

    stoneTokens.forEach((token, index) => {
      const parsed = parseNumericToken(token)
      if (parsed === null) {
        if (token) {
          errors.push({ field: `stoneComponent${index + 1}`, reason: `Expected number, got '${token}'` })
        }
        return
      }

      stoneValues.push(parsed)
      stoneComponentFields[`stoneComponent${index + 1}`] = { value: parsed, parsed: true }
      stoneComponentFields[`stoneComponent${index + 1}Source`] = { value: token, parsed: true }
    })

    const stoneWeight = stoneValues.length > 0
      ? Math.round(stoneValues.reduce((sum, value) => sum + value, 0) * 1000) / 1000
      : 0

    fields.stoneWeight = { value: stoneWeight, parsed: true }
    fields.otherWeight = { value: 0, parsed: true }
    fields.meta = {
      ...(fields.meta || {}),
      stoneComponents: { value: stoneValues, parsed: true },
      stoneComponentCount: { value: stoneValues.length, parsed: true },
      ...stoneComponentFields,
    }

    const tolerance = 0.02
    const calculationSnapshot = calculateSettlementSnapshot({
      grossWeight,
      stoneWeight,
      otherWeight: 0,
      qrNetWeight,
      purityPercent: 0,
      wastagePercent: 0,
      tolerance,
    })
    fields.otherWeight = { value: calculationSnapshot.otherWeight ?? 0, parsed: calculationSnapshot.otherWeight !== null }
    const mismatch =
      calculationSnapshot.computedNetWeight !== null && calculationSnapshot.qrNetWeight !== null
        ? Math.abs(Number((calculationSnapshot.computedNetWeight - calculationSnapshot.qrNetWeight).toFixed(3)))
        : null

    const calculationBreakdown = {
      rawQr: raw,
      grossWeight,
      stoneWeight,
      stoneComponents: stoneValues.map((value, index) => ({
        sourceField: `stoneComponent${index + 1}`,
        label: `Stone Component ${index + 1}`,
        value,
      })),
      otherWeight: {
        sourceField: null,
        value: 0,
      },
      qrNetWeight: calculationSnapshot.qrNetWeight,
      computedNetWeight: calculationSnapshot.computedNetWeight,
      selectedNetWeight: calculationSnapshot.selectedNetWeight,
      netFormula: calculationSnapshot.calculationExplanation?.netFormula || 'computedNetWeight = grossWeight - stone components',
      fineFormula: calculationSnapshot.calculationExplanation?.fineFormula || 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
      mismatch,
      tolerance,
      warnings: calculationSnapshot.warnings,
      requiresReview: calculationSnapshot.requiresReview,
      calculationExplanation: calculationSnapshot.calculationExplanation,
    }

    const parsedCountAdinath = ['grossWeight', 'stoneWeight', 'netWeight', 'designCode'].reduce(
      (count, field) => count + (fields[field].parsed ? 1 : 0),
      0
    )

    const data = createResult({
      success: parsedCountAdinath > 0 && errors.length === 0,
      strategy,
      fields,
      errors,
      raw,
      confidence: calculationBreakdown.requiresReview ? 62 : 88,
    })
    data.calculationBreakdown = calculationBreakdown
    return data
  }

  if (delimiter === '/' && isLikelyUtsavRaw(raw)) {
    const tokens = parts.map((part) => String(part).trim()).filter((part) => part)
    const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const buildPrefixMatcher = (prefix) => {
      const normalizedPrefix = escapeRegExp(prefix).replace(/-/g, '\\s*-\\s*')
      return new RegExp(`^${normalizedPrefix}\\s*([+-]?\\d+(?:\\.\\d+)?)$`, 'i')
    }
    const getPrefixedWeight = (prefix) => {
      const matcher = buildPrefixMatcher(prefix)
      const token = tokens.find((part) => matcher.test(part))
      if (!token) return null
      const match = token.match(matcher)
      if (!match) return null
      const parsed = toNumber(match[1])
      return parsed === null ? null : Math.abs(parsed)
    }

    const grossRaw = getPrefixedWeight('GWT-')
    const netRaw = getPrefixedWeight('NWT-')
    const stoneRaw = getPrefixedWeight('SWT-')
    const colourStoneRaw = getPrefixedWeight('CL-')
    const otherDeductionRaw = getPrefixedWeight('MZ-')
    const itemCodeRaw = tokens[0] || null
    const supplierCodeRaw = tokens.find((part) => part.toUpperCase() === 'USV') || null
    const stoneComponent1 = stoneRaw
    const stoneComponent2 = colourStoneRaw
    const otherComponent1 = otherDeductionRaw
    const tolerance = 0.02

    if (grossRaw === null) {
      errors.push({ field: 'grossWeight', reason: 'GWT is missing' })
    } else {
      fields.grossWeight = { value: grossRaw, parsed: true }
    }

    if (itemCodeRaw) {
      fields.designCode = { value: itemCodeRaw, parsed: true }
      fields.meta.itemCode = { value: itemCodeRaw, parsed: true }
      fields.meta.designCode = { value: itemCodeRaw, parsed: true }
    } else {
      errors.push({ field: 'itemCode', reason: 'Item code is missing' })
    }

    if (supplierCodeRaw) {
      fields.supplierCode = { value: supplierCodeRaw, parsed: true }
    }

    if (stoneComponent1 !== null) {
      fields.meta.stoneComponent1 = { value: stoneComponent1, parsed: true }
    }
    if (stoneComponent2 !== null) {
      fields.meta.colorStoneWeight = { value: stoneComponent2, parsed: true }
    }
    if (otherComponent1 !== null) {
      fields.meta.otherWeightComponent = { value: otherComponent1, parsed: true }
    }

    const knownPrefixMatchers = [
      buildPrefixMatcher('GWT-'),
      buildPrefixMatcher('NWT-'),
      buildPrefixMatcher('SWT-'),
      buildPrefixMatcher('CL-'),
      buildPrefixMatcher('MZ-'),
    ]
    const isKnownPrefixedToken = (token) => knownPrefixMatchers.some((matcher) => matcher.test(token))
    const unknownWeightCandidates = tokens
      .filter((token, index) => index !== 0 && token.toUpperCase() !== 'USV' && !isKnownPrefixedToken(token))
      .map((token) => {
        const match =
          token.match(/^([A-Z]{2,16})\s*-\s*([+-]?\d+(?:\.\d+)?)$/i) ||
          token.match(/^([A-Z]{2,16})\s+([+-]?\d+(?:\.\d+)?)$/i)
        if (!match) return null
        const parsed = toNumber(match[2])
        if (parsed === null) return null
        const value = Math.abs(parsed)
        if (grossRaw !== null && value > grossRaw + tolerance) return null
        return {
          token,
          label: match[1].toUpperCase(),
          value,
        }
      })
      .filter((value) => value !== null)

    const explicitOtherWeight = Math.round(((stoneComponent2 ?? 0) + (otherComponent1 ?? 0)) * 1000) / 1000
    const snapshot = calculateSettlementSnapshot({
      grossWeight: grossRaw,
      stoneWeight: stoneComponent1 ?? 0,
      otherWeight: explicitOtherWeight,
      qrNetWeight: netRaw,
      purityPercent: 0,
      wastagePercent: 0,
      tolerance,
      unmatchedValues: unknownWeightCandidates.map((candidate) => candidate.value),
    })

    fields.stoneWeight = {
      value: snapshot.stoneWeight ?? 0,
      parsed: snapshot.stoneWeight !== null,
    }
    fields.otherWeight = {
      value: snapshot.otherWeight ?? 0,
      parsed: snapshot.otherWeight !== null,
    }
    fields.netWeight = {
      value: snapshot.qrNetWeight ?? snapshot.selectedNetWeight ?? snapshot.computedNetWeight,
      parsed:
        snapshot.qrNetWeight !== null ||
        snapshot.selectedNetWeight !== null ||
        snapshot.computedNetWeight !== null,
    }

    if (unknownWeightCandidates.length > 0) {
      fields.meta.unmatchedWeightCandidates = { value: unknownWeightCandidates, parsed: true }
    }
    fields.meta.reconciliationStatus = { value: snapshot.reconciliationStatus, parsed: true }
    fields.meta.reconciliationProof = { value: snapshot.reconciliationProof, parsed: true }

    const mismatch =
      snapshot.computedNetWeight !== null && snapshot.qrNetWeight !== null
        ? Math.abs(Number((snapshot.computedNetWeight - snapshot.qrNetWeight).toFixed(3)))
        : null

    const calculationBreakdown = {
      rawQr: raw,
      grossWeight: snapshot.grossWeight,
      stoneWeight: snapshot.stoneWeight,
      stoneComponents: [
        {
          sourceField: 'SWT-',
          label: 'Stone Weight',
          value: stoneComponent1,
        },
      ].filter((component) => component.value !== null),
      otherWeight: {
        sourceField:
          snapshot.reconciliationStatus === 'reconciled_unmatched' ||
          snapshot.reconciliationStatus === 'inferred_remaining'
            ? 'reconciled'
            : stoneComponent2 !== null || otherComponent1 !== null
              ? 'CL-/MZ-'
              : null,
        value: snapshot.otherWeight,
      },
      otherComponents: [
        {
          sourceField: 'CL-',
          label: 'Colour Stone Weight',
          value: stoneComponent2,
        },
        {
          sourceField: 'MZ-',
          label: 'Other Deduction',
          value: otherComponent1,
        },
        ...unknownWeightCandidates.map((candidate) => ({
          sourceField: candidate.label,
          label: `${candidate.label} deduction candidate`,
          value: candidate.value,
        })),
      ].filter((component) => component.value !== null),
      qrNetWeight: snapshot.qrNetWeight,
      computedNetWeight: snapshot.computedNetWeight,
      selectedNetWeight: snapshot.selectedNetWeight,
      netFormula: 'netWeight = grossWeight - stoneWeight - otherWeight',
      mismatch,
      tolerance,
      warnings: snapshot.warnings,
      requiresReview: snapshot.requiresReview,
      reconciliationStatus: snapshot.reconciliationStatus,
      reconciliationProof: snapshot.reconciliationProof,
      calculationExplanation: {
        netFormula: 'netWeight = grossWeight - stoneWeight - otherWeight',
        fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
        reconciliationStatus: snapshot.reconciliationStatus,
      },
    }

    const parsedCountUtsav = ['grossWeight', 'stoneWeight', 'netWeight', 'designCode'].reduce(
      (count, field) => count + (fields[field].parsed ? 1 : 0),
      0
    )

    const data = createResult({
      success: parsedCountUtsav > 0,
      strategy,
      fields,
      errors,
      raw,
    })

    data.calculationBreakdown = calculationBreakdown
    return data
  }

  for (const field of FIELD_KEYS) {
    const config = resolveFieldConfig(fieldMap[field])

    if (config === null) {
      if (field === 'supplierCode') {
        continue
      }
      errors.push({ field, reason: 'Invalid or missing field mapping' })
      continue
    }

    const { indices, stripPrefix } = config
    const isText = TEXT_FIELDS.has(field)

    if (indices.length === 1) {
      const rawVal = parts[indices[0]]

      if (rawVal === undefined || String(rawVal).trim() === '') {
        errors.push({ field, reason: `Missing value at index ${indices[0]}` })
        continue
      }

      const val = applyStripPrefix(String(rawVal).trim(), stripPrefix)

      if (isText) {
        const parsed = toText(val)
        if (parsed === null) {
          errors.push({ field, reason: `Expected text at index ${indices[0]}` })
          continue
        }
        fields[field] = { value: parsed, parsed: true }
      } else {
        const parsed = toNumber(val)
        if (parsed === null) {
          errors.push({ field, reason: `Expected number at index ${indices[0]}, got '${val}'` })
          continue
        }
        fields[field] = { value: parsed, parsed: true }
      }
    } else {
      if (isText) {
        errors.push({ field, reason: 'sumIndices is not valid for text fields' })
        continue
      }

      let total = 0
      let broken = false

      for (const idx of indices) {
        const rawVal = parts[idx]
        if (rawVal === undefined || String(rawVal).trim() === '') continue

        const val = applyStripPrefix(String(rawVal).trim(), stripPrefix)
        const n = toNumber(val)

        if (n === null) {
          errors.push({ field, reason: `Expected number at index ${idx}, got '${val}'` })
          broken = true
          break
        }

        total += n
      }

      if (!broken) {
        fields[field] = {
          value: Math.round(total * 1000) / 1000,
          parsed: true,
        }
      }
    }

    if (fields[field].parsed) parsedCount += 1
  }

  return createResult({
    success: parsedCount > 0,
    strategy,
    fields,
    errors,
    raw,
  })
}

const parseVenzoraStrategy = (raw) => {
  const strategy = 'venzora'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push('Empty QR')
    return { data: createResult({ success: false, strategy, fields, errors: [{ field: 'raw', reason: 'Empty QR' }], raw }), errors }
  }

  const tokens = raw
    .split('/')
    .map((part) => String(part).trim())
    .filter(Boolean)

  if (tokens.length === 0) {
    errors.push('Empty QR')
    return { data: createResult({ success: false, strategy, fields, errors: [{ field: 'raw', reason: 'Empty QR' }], raw }), errors }
  }

  const internalId = tokens[0] ? toText(tokens[0]) : null
  if (internalId) {
    fields.meta.internalId = { value: internalId, parsed: true }
  } else {
    errors.push('Internal item id is missing')
  }

  let purity = null
  let grossWeight = null
  let netWeight = null
  let diamondWeight = null
  let designCode = null
  let stoneAmount = null
  const parseErrors = []

  const addTokenError = (field, token, reason) => {
    const message = `${field}: ${reason}`
    errors.push(message)
    parseErrors.push({ field, reason: `${reason} (${token})` })
  }

  const parseStrictNumber = (token, field, pattern) => {
    if (!pattern.test(token)) {
      addTokenError(field, token, `Invalid ${field === 'diamondWeight' ? 'L' : field === 'netWeight' ? 'N' : 'G'} token`)
      return null
    }

    const numericPart = token.slice(1)
    const parsed = Number.parseFloat(numericPart)
    if (!Number.isFinite(parsed)) {
      addTokenError(field, token, `Invalid ${field} numeric value`)
      return null
    }

    return parsed
  }

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]
    const normalizedToken = token.toUpperCase()

    if (normalizedToken === '18KT') {
      purity = '18KT'
      continue
    }

    if (normalizedToken.startsWith('RS')) {
      const rawAmount = token.slice(2).trim().replace(/^\./, '')
      const parsedAmount = rawAmount === '' ? null : Number.parseFloat(rawAmount)
      if (Number.isFinite(parsedAmount)) {
        stoneAmount = parsedAmount
      } else {
        addTokenError('stoneAmount', token, 'Invalid Rs token')
      }
      continue
    }

    if (normalizedToken.startsWith('CH-')) {
      if (!VENZORA_TOKEN_PATTERNS.designCode.test(normalizedToken)) {
        addTokenError('designCode', token, 'Invalid CH token')
      } else {
        designCode = normalizedToken
      }
      continue
    }

    if (normalizedToken.startsWith('G')) {
      const parsed = parseStrictNumber(normalizedToken, 'grossWeight', VENZORA_TOKEN_PATTERNS.grossWeight)
      if (parsed !== null) {
        grossWeight = parsed
      }
      continue
    }

    if (normalizedToken.startsWith('N')) {
      const parsed = parseStrictNumber(normalizedToken, 'netWeight', VENZORA_TOKEN_PATTERNS.netWeight)
      if (parsed !== null) {
        netWeight = parsed
      }
      continue
    }

    if (normalizedToken.startsWith('L')) {
      const parsed = parseStrictNumber(normalizedToken, 'diamondWeight', VENZORA_TOKEN_PATTERNS.diamondWeight)
      if (parsed !== null) {
        diamondWeight = parsed
      }
      continue
    }
  }

  if (grossWeight !== null) {
    fields.grossWeight = { value: grossWeight, parsed: true }
  }
  if (netWeight !== null) {
    fields.netWeight = { value: netWeight, parsed: true }
  }
  if (diamondWeight !== null) {
    fields.diamondWeight = { value: diamondWeight, parsed: true }
    fields.stoneWeight = { value: diamondWeight, parsed: true }
  }
  fields.otherWeight = { value: 0, parsed: true }
  if (stoneAmount !== null) {
    fields.stoneAmount = { value: stoneAmount, parsed: true }
  }
  if (purity !== null) {
    fields.purity = { value: purity, parsed: true }
    fields.karat = { value: purity, parsed: true }
  }
  if (designCode !== null) {
    fields.designCode = { value: designCode, parsed: true }
    fields.meta.itemCode = { value: designCode, parsed: true }
    fields.meta.designCode = { value: designCode, parsed: true }
  }

  if (grossWeight === null) {
    errors.push('Gross weight is missing')
    parseErrors.push({ field: 'grossWeight', reason: 'G is missing' })
  }

  if (!designCode) {
    errors.push('Design code is missing')
    parseErrors.push({ field: 'designCode', reason: 'CH is missing' })
  }

  const tolerance = 0.02
  const computedNetWeight =
    grossWeight !== null && diamondWeight !== null
      ? Math.round((grossWeight - diamondWeight) * 1000) / 1000
      : null
  const mismatch =
    computedNetWeight !== null && netWeight !== null
      ? Math.abs(Number((computedNetWeight - netWeight).toFixed(3)))
      : null
  const requiresReview = mismatch !== null && mismatch > tolerance
  const warnings = []

  if (requiresReview) {
    warnings.push('Net weight mismatch beyond tolerance')
  }

  const calculationBreakdown = {
    rawQr: raw,
    grossWeight,
    stoneComponents: [
      {
        sourceField: 'L',
        label: 'Less / Stone Weight',
        value: diamondWeight,
      },
    ].filter((component) => component.value !== null),
    stoneWeight: diamondWeight,
    otherWeight: {
      sourceField: null,
      value: 0,
    },
    qrNetWeight: netWeight,
    computedNetWeight,
    selectedNetWeight: computedNetWeight ?? netWeight,
    stoneAmount,
    netFormula: 'computedNetWeight = grossWeight - stoneWeight',
    fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
    mismatch,
    tolerance,
    warnings,
      requiresReview,
    calculationExplanation: {
      netFormula: 'computedNetWeight = grossWeight - stoneWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
      explanation: 'Venzora net is validated from gross minus less/stone weight.',
    },
  }

  const data = createResult({
    success:
      Boolean(internalId) &&
      grossWeight !== null &&
      netWeight !== null &&
      diamondWeight !== null &&
      designCode !== null,
    strategy,
    fields,
    errors: parseErrors,
    raw,
  })

  data.calculationBreakdown = calculationBreakdown

  return { data, errors }
}

const parseKeyValueStrategy = (raw) => {
  const strategy = 'key_value'
  const errors = []
  const fields = createEmptyFields()

  if (!raw) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const normalized = normalizeYugRaw(raw)
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const itemCodeLine = lines.find((line) => !YUG_LINE_PATTERN.test(line))
  const itemCode = itemCodeLine ? toText(itemCodeLine.replace(/[\s:\-]+$/, '')) : null

  if (itemCode) {
    fields.meta.itemCode = { value: itemCode, parsed: true }
  } else {
    errors.push({ field: 'meta.itemCode', reason: 'Item code is missing' })
  }

  const extractValue = (key) => {
    for (const line of lines) {
      const pattern = new RegExp(
        `\\b${key}\\b\\s*(?:[:\\-]?\\s*)?(\\d+(?:\\.\\d+)?)`,
        'i'
      )
      const match = line.match(pattern)
      if (match) {
        return toText(match[1])
      }
    }

    return null
  }

  const parseRequiredNumber = (key, fieldName) => {
    const rawValue = extractValue(key)

    if (rawValue === null) {
      errors.push({ field: fieldName, reason: `${key} is missing` })
      return null
    }

    const parsed = toNumber(rawValue)
    if (parsed === null) {
      errors.push({ field: fieldName, reason: `${key} is not a valid number` })
      return null
    }

    return parsed
  }

  const parseOptionalNumber = (key, fieldName) => {
    const rawValue = extractValue(key)

    if (rawValue === null) {
      return null
    }

    const parsed = toNumber(rawValue)
    if (parsed === null) {
      errors.push({ field: fieldName, reason: `${key} is not a valid number` })
      return null
    }

    return parsed
  }

  const grossWeight = parseRequiredNumber('GW', 'grossWeight')
  const smallStoneWeight = parseOptionalNumber('SS', 'SS')
  const mainStoneWeight = parseOptionalNumber('MS', 'MS')
  const otherWeight = parseOptionalNumber('OW', 'OW')

  if (grossWeight !== null) {
    fields.grossWeight = { value: grossWeight, parsed: true }
  }

  const stoneParts = [smallStoneWeight, mainStoneWeight].filter((value) => typeof value === 'number')
  if (stoneParts.length > 0) {
    fields.stoneWeight = {
      value: Math.round(stoneParts.reduce((sum, value) => sum + value, 0) * 1000) / 1000,
      parsed: true,
    }
  }

  if (otherWeight !== null) {
    fields.otherWeight = { value: otherWeight, parsed: true }
  }

  const nwRaw = extractValue('NW')
  if (nwRaw !== null) {
    const parsed = toNumber(nwRaw)
    if (parsed === null) {
      errors.push({ field: 'netWeight', reason: 'NW is not a valid number' })
    } else {
      fields.netWeight = { value: parsed, parsed: true }
    }
  } else if (
    grossWeight !== null &&
    (smallStoneWeight !== null || mainStoneWeight !== null || otherWeight !== null)
  ) {
    const computedNetWeight =
      grossWeight -
      (smallStoneWeight ?? 0) -
      (mainStoneWeight ?? 0) -
      (otherWeight ?? 0)

    fields.netWeight = {
      value: Math.round(computedNetWeight * 1000) / 1000,
      parsed: true,
    }
  } else {
    errors.push({
      field: 'netWeight',
      reason: 'NW is missing and cannot be calculated from GW, SS, MS, OW',
    })
  }

  const ktRaw = extractValue('KT')
  if (ktRaw !== null) {
    const parsed = toText(ktRaw)
    if (parsed === null) {
      errors.push({ field: 'karat', reason: 'KT is missing' })
    }
  } else {
    errors.push({ field: 'karat', reason: 'KT is missing' })
  }

  const parsedCount = FIELD_KEYS.reduce(
    (count, field) => count + (fields[field].parsed ? 1 : 0),
    0
  )

  return createResult({
    success: parsedCount > 0,
    strategy,
    fields,
    errors,
    raw,
  })
}

/**
 * Aayra QR parser — handles both slash-token and tab-separated formats.
 *
 * Slash format (positional, 5 tokens):
 *   <itemCode>/<grossToken>/<stoneToken>/<netToken>/<optionalRef>
 *   e.g. N66162/G 4.168/L 0.52/N 3.648/LR-M271
 *
 * Tab format (positional, =5 fields):
 *   <code>\t<itemText>\t<gross>\t<stone>\t<net>
 *   e.g. 00002416\tNMLR18 B0019\t2.586\t0.000\t2.586
 *
 * Key rules:
 * - Parser never throws — errors accumulate, partial result always returned.
 * - Token/field 4 (slash) or field 0 (tab) stored in meta only, not validated.
 * - computedNetWeight = grossWeight - stoneWeight; mismatch > 0.02g ? requiresReview.
 * - otherAmount is a separate amount bucket, not making charge.
 */
const parseAayraStrategy = (raw) => {
  const strategy = 'aayra'
  const errors = []
  const fields = createEmptyFields()
  const tolerance = 0.02

  if (!raw) {
    errors.push({ field: 'raw', reason: 'Empty QR' })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const parseWeightToken = (token) => {
    if (!token) return null
    const numeric = String(token).replace(/^[A-Za-z]+\s*/, '').trim()
    if (numeric === '') return null
    return toNumber(numeric)
  }

  const buildBreakdown = ({ format, grossWeight, stoneWeight, qrNetWeight, stoneComponents, referenceText = null }) => {
    const snapshot = calculateSettlementSnapshot({
      grossWeight,
      stoneWeight,
      otherWeight: 0,
      qrNetWeight,
      purityPercent: 0,
      wastagePercent: 0,
      tolerance,
    })

    fields.otherWeight = { value: snapshot.otherWeight ?? 0, parsed: snapshot.otherWeight !== null }

    const mismatch =
      snapshot.computedNetWeight !== null && snapshot.qrNetWeight !== null
        ? Math.abs(Number((snapshot.computedNetWeight - snapshot.qrNetWeight).toFixed(3)))
        : null

    return {
      rawQr: raw,
      format,
      grossWeight: snapshot.grossWeight,
      stoneWeight: snapshot.stoneWeight,
      stoneComponents,
      otherWeight: {
        sourceField: snapshot.reconciliationStatus === 'inferred_remaining' ? 'reconciled' : null,
        value: snapshot.otherWeight,
      },
      qrNetWeight: snapshot.qrNetWeight,
      computedNetWeight: snapshot.computedNetWeight,
      selectedNetWeight: snapshot.selectedNetWeight,
      netFormula: 'computedNetWeight = grossWeight - stoneWeight - otherWeight',
      fineFormula: 'fineWeight = netWeight × (purityPercent + wastagePercent) / 100',
      mismatch,
      tolerance,
      warnings: snapshot.warnings,
      requiresReview: snapshot.requiresReview,
      reconciliationStatus: snapshot.reconciliationStatus,
      reconciliationProof: snapshot.reconciliationProof,
      referenceText,
    }
  }

  const cleanedRaw = raw.replace(/(?:->|\t)+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  const spaceFormatRegex = /^(\S+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/i
  const match = spaceFormatRegex.exec(cleanedRaw)

  if (match) {
    const parts = [match[1], match[2], match[3], match[4], match[5]]

    const serialCode = toText(parts[0] ?? '')
    if (serialCode) {
      fields.meta.serialCode = { value: serialCode, parsed: true }
    } else {
      errors.push({ field: 'serialCode', reason: 'Field 0 (serial/code) is missing' })
    }

    const itemText = toText(parts[1] ?? '')
    if (itemText) {
      fields.meta.itemCode = { value: itemText, parsed: true }
      fields.designCode = { value: itemText, parsed: true }
    } else {
      errors.push({ field: 'itemCode', reason: 'Field 1 (item/category text) is missing' })
    }

    const grossWeight = toNumber(parts[2] ?? '')
    if (grossWeight === null) {
      errors.push({ field: 'grossWeight', reason: `Field 2 (gross weight) is missing or invalid: '${parts[2] ?? ''}'` })
    } else {
      fields.grossWeight = { value: grossWeight, parsed: true }
    }

    const stoneWeight = toNumber(parts[3] ?? '') ?? 0
    fields.stoneWeight = { value: stoneWeight, parsed: true }

    const qrNetWeight = toNumber(parts[4] ?? '')
    if (qrNetWeight === null) {
      errors.push({ field: 'netWeight', reason: `Field 4 (net weight) is missing or invalid: '${parts[4] ?? ''}'` })
    } else {
      fields.netWeight = { value: qrNetWeight, parsed: true }
    }

    const calculationBreakdown = buildBreakdown({
      format: 'tab',
      grossWeight,
      stoneWeight,
      qrNetWeight,
      stoneComponents: [{ sourceField: 'field[3]', label: 'Stone Weight', value: stoneWeight }],
    })

    const parsedCount = ['grossWeight', 'stoneWeight', 'netWeight'].reduce(
      (count, field) => count + (fields[field].parsed ? 1 : 0),
      0
    )

    const data = createResult({
      success: grossWeight !== null && qrNetWeight !== null && errors.length === 0,
      strategy,
      fields,
      errors,
      raw,
      confidence: calculationBreakdown.requiresReview ? 58 : 80,
    })
    data.calculationBreakdown = calculationBreakdown
    return data
  }

  const parts = raw.split('/').map((p) => p.trim())

  if (parts.length !== 5) {
    errors.push({ field: 'raw', reason: `Expected 5 slash-separated tokens, got ${parts.length}` })
    return createResult({ success: false, strategy, fields, errors, raw })
  }

  const itemCode = toText(parts[0])
  if (!itemCode) {
    errors.push({ field: 'itemCode', reason: 'Token 0 (item/design code) is missing' })
  } else {
    fields.meta.itemCode = { value: itemCode, parsed: true }
    fields.designCode = { value: itemCode, parsed: true }
  }

  const grossWeight = parseWeightToken(parts[1])
  if (grossWeight === null) {
    errors.push({ field: 'grossWeight', reason: `Token 1 (gross weight) is missing or invalid: '${parts[1]}'` })
  } else {
    fields.grossWeight = { value: grossWeight, parsed: true }
  }

  const stoneWeight = parseWeightToken(parts[2]) ?? 0
  fields.stoneWeight = { value: stoneWeight, parsed: true }

  const qrNetWeight = parseWeightToken(parts[3])
  if (qrNetWeight === null) {
    errors.push({ field: 'netWeight', reason: `Token 3 (net weight) is missing or invalid: '${parts[3]}'` })
  } else {
    fields.netWeight = { value: qrNetWeight, parsed: true }
  }

  const referenceText = toText(parts[4])
  if (referenceText) {
    fields.meta.referenceText = { value: referenceText, parsed: true }
  }

  const calculationBreakdown = buildBreakdown({
    format: 'slash',
    grossWeight,
    stoneWeight,
    qrNetWeight,
    stoneComponents: [{ sourceField: 'token[2]', label: 'Stone/Less Weight', value: stoneWeight }],
    referenceText,
  })

  const parsedCount = ['grossWeight', 'stoneWeight', 'netWeight'].reduce(
    (count, field) => count + (fields[field].parsed ? 1 : 0),
    0
  )

  const data = createResult({
    success: parsedCount >= 2 && errors.length === 0,
    strategy,
    fields,
    errors,
    raw,
    confidence: calculationBreakdown.requiresReview ? 65 : 88,
  })
  data.calculationBreakdown = calculationBreakdown
  return data
}
const runParserByStrategy = (strategy, raw, parserConfig) => {
  if (strategy === 'key_value') {
    return parseKeyValueStrategy(raw)
  }

  if (strategy === 'venzora') {
    return parseVenzoraStrategy(raw).data
  }

  if (strategy === 'aayra') {
    return parseAayraStrategy(raw)
  }

  return parseDelimiterStrategy(raw, parserConfig)
}

export {
  applyStripPrefix,
  parseAayraStrategy,
  parseDelimiterStrategy,
  parseKeyValueStrategy,
  parseVenzoraStrategy,
  resolveFieldConfig,
  runParserByStrategy,
}






