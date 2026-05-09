import { detectSupplier, parseQR } from '../services/qrParser.service.js'
import { normalize } from '../services/qrNormalization.service.js'
import { validate } from '../services/qrValidation.service.js'
import { valuate } from '../services/qrValuation.service.js'
import {
  SUPPLIER_FIXTURES,
  getSupplierFixture,
  loadSampleFixtures,
} from './qr-sample-loader.js'

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const hasNaNValue = (value, seen = new Set()) => {
  if (value === null || value === undefined) {
    return false
  }

  if (typeof value === 'number') {
    return Number.isNaN(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (seen.has(value)) {
    return false
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.some((item) => hasNaNValue(item, seen))
  }

  return Object.values(value).some((item) => hasNaNValue(item, seen))
}

const main = async () => {
  const fixtures = await loadSampleFixtures()

  if (fixtures.length === 0) {
    throw new Error('No QR sample fixtures found under qr-samples/samples')
  }

  const knownSuppliers = Object.values(SUPPLIER_FIXTURES)
  const failures = []
  const summary = {
    total: 0,
    valid: 0,
    partial: 0,
    malformed: 0,
    edgeCases: 0,
    zar: 0,
  }

  for (const fixture of fixtures) {
    const supplierFixture = getSupplierFixture(fixture.supplierKey)
    const detection = detectSupplier(fixture.raw, knownSuppliers)
    const supplier = detection?.supplier || supplierFixture || null

    summary.total += 1
    if (fixture.category === 'valid') summary.valid += 1
    if (fixture.category === 'partial') summary.partial += 1
    if (fixture.category === 'malformed') summary.malformed += 1
    if (fixture.category === 'edge-cases') summary.edgeCases += 1
    if (fixture.supplierKey === 'zar') summary.zar += 1

    try {
      const parseResult = parseQR(fixture.raw, supplier?.qrMapping || null)
      const normalizedResult = normalize(parseResult, supplier)
      const validatedResult = validate(normalizedResult)
      const valuatedResult = valuate(validatedResult)

      assert(parseResult && typeof parseResult === 'object', `${fixture.filePath}: parse result must be an object`)
      assert(Array.isArray(parseResult.errors), `${fixture.filePath}: parse errors must be an array`)
      assert(parseResult.pattern && typeof parseResult.pattern === 'object', `${fixture.filePath}: parse pattern missing`)
      assert(Array.isArray(validatedResult.warnings), `${fixture.filePath}: validation warnings must be an array`)
      assert(Array.isArray(valuatedResult.warnings), `${fixture.filePath}: valuation warnings must be an array`)
      assert(typeof validatedResult.status === 'string', `${fixture.filePath}: validation status missing`)
      assert(typeof valuatedResult.valuation_status === 'string', `${fixture.filePath}: valuation status missing`)
      assert(
        !hasNaNValue({ parseResult, normalizedResult, validatedResult, valuatedResult }),
        `${fixture.filePath}: NaN found in pipeline result`
      )

      const isZar = fixture.supplierKey === 'zar'
      const isValidFixture = fixture.category === 'valid'

      if (isValidFixture && !isZar) {
        assert(parseResult.success !== false, `${fixture.filePath}: valid sample should parse successfully`)
      }

      if (isZar) {
        assert(validatedResult.status === 'needs_review', `${fixture.filePath}: Zar should stay needs_review`)
        assert(validatedResult.confidence <= 50, `${fixture.filePath}: Zar confidence should stay capped`)
      }

      if (fixture.category === 'malformed') {
        assert(
          parseResult.success === false || parseResult.errors.length > 0 || validatedResult.status === 'needs_review',
          `${fixture.filePath}: malformed sample should degrade safely`
        )
      }
    } catch (error) {
      failures.push({
        file: fixture.filePath,
        error: error?.message || String(error),
      })
    }
  }

  if (failures.length > 0) {
    console.error('QR sample regression failed:')
    console.error(JSON.stringify(failures, null, 2))
    process.exitCode = 1
    return
  }

  console.log(
    `QR sample regression passed (${summary.total} samples: ${summary.valid} valid, ${summary.partial} partial, ${summary.malformed} malformed, ${summary.edgeCases} edge-cases, ${summary.zar} zar)`
  )
}

main().catch((error) => {
  console.error('QR sample regression harness failed:', error)
  process.exit(1)
})
