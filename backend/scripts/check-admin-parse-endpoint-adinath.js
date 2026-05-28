import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'
import { parseSupplierQr } from '../src/controllers/suppliers.controller.js'

const fixtures = [
  {
    raw: '4.01/0.36/////3.65/TM-155',
    itemCode: 'TM-155',
    grossWeight: 4.01,
    stoneComponents: [0.36],
    stoneWeight: 0.36,
    qrNetWeight: 3.65,
    computedNetWeight: 3.65,
  },
  {
    raw: '3.12/0.24/////2.88/TM-292',
    itemCode: 'TM-292',
    grossWeight: 3.12,
    stoneComponents: [0.24],
    stoneWeight: 0.24,
    qrNetWeight: 2.88,
    computedNetWeight: 2.88,
  },
  {
    raw: '3.35/0.44/////2.91/TM-367',
    itemCode: 'TM-367',
    grossWeight: 3.35,
    stoneComponents: [0.44],
    stoneWeight: 0.44,
    qrNetWeight: 2.91,
    computedNetWeight: 2.91,
  },
  {
    raw: '3.75/0.37/0.23////3.15/PSER-998',
    itemCode: 'PSER-998',
    grossWeight: 3.75,
    stoneComponents: [0.37, 0.23],
    stoneWeight: 0.6,
    qrNetWeight: 3.15,
    computedNetWeight: 3.15,
  },
  {
    raw: '3.49/0.13/0.31////3.05/PT-03',
    itemCode: 'PT-03',
    grossWeight: 3.49,
    stoneComponents: [0.13, 0.31],
    stoneWeight: 0.44,
    qrNetWeight: 3.05,
    computedNetWeight: 3.05,
  },
  {
    raw: '6.15/0.36/0.63////5.16/PS-2062',
    itemCode: 'PS-2062',
    grossWeight: 6.15,
    stoneComponents: [0.36, 0.63],
    stoneWeight: 0.99,
    qrNetWeight: 5.16,
    computedNetWeight: 5.16,
  },
]

const approxEqual = (left, right, tolerance = 0.001) => Math.abs(Number(left) - Number(right)) <= tolerance
const assertApprox = (actual, expected, label) => {
  assert.ok(approxEqual(actual, expected), `${label} mismatch: expected ${expected}, got ${actual}`)
}

const createMockResponse = () => ({
  statusCode: 200,
  payload: null,
  status(code) {
    this.statusCode = code
    return this
  },
  json(payload) {
    this.payload = payload
    return this
  },
})

const runControllerParse = async (body, supplierMode = null) => {
  const originalFind = Supplier.find
  const originalFindById = Supplier.findById

  if (supplierMode?.type === 'virtual') {
    Supplier.find = () => ({
      lean: async () => [supplierMode.supplier],
    })
  }

  if (supplierMode?.type === 'id') {
    Supplier.findById = () => ({
      lean: async () => supplierMode.supplier,
    })
  }

  try {
    const req = { body }
    const res = createMockResponse()
    await parseSupplierQr(req, res)
    assert.equal(res.statusCode, 200, 'parseSupplierQr should return 200')
    assert.equal(res.payload?.success, true, 'parseSupplierQr should succeed')
    return res.payload?.data || null
  } finally {
    Supplier.find = originalFind
    Supplier.findById = originalFindById
  }
}

const describeDisplay = (response) => ({
  supplier: response?.normalizedResult?.display?.supplier || null,
  item: response?.normalizedResult?.display?.item || null,
  weights: response?.normalizedResult?.display?.weights || null,
  calculation: response?.normalizedResult?.display?.calculation || null,
})

const main = async () => {
  await connectDB()

  try {
    const suppliers = await Supplier.find({}, { name: 1, code: 1, qrMapping: 1 }).lean()
    const realSupplier = suppliers.find((supplier) => {
      const key = String(supplier?.name || supplier?.code || '').toLowerCase()
      return key === 'adinath' || key === 'aadinath'
    }) || null

    const virtualSupplier = {
      _id: 'virtual-adinath',
      name: 'Aadinath',
      code: 'AADINATH',
      qrMapping: {
        strategy: 'delimiter',
        delimiter: '/',
        fieldMap: {
          grossWeight: 0,
          stoneWeight: 1,
          netWeight: 6,
          category: 7,
        },
      },
    }

    const supplierMode = realSupplier
      ? { type: 'id', supplier: realSupplier }
      : { type: 'virtual', supplier: virtualSupplier }

    console.log(`admin-parse-mode=${realSupplier ? 'real-db-supplier' : 'virtual-supplier-fallback'}`)

    for (const [index, fixture] of fixtures.entries()) {
      const body = realSupplier
        ? { raw: fixture.raw, supplierId: realSupplier._id }
        : { raw: fixture.raw }

      const response = await runControllerParse(body, supplierMode)
      assert.ok(response, `Fixture ${index + 1}: empty response`)

      const display = describeDisplay(response)
      const supplierName = String(
        display.supplier?.name ||
        display.supplier?.code ||
        response?.supplier?.name ||
        response?.supplier?.code ||
        ''
      ).trim()

      assert.ok(supplierName, `Fixture ${index + 1}: supplier display missing`)
      assert.ok(
        supplierName.toLowerCase().includes('adinath'),
        `Fixture ${index + 1}: expected Adinath/Aadinath supplier display, got ${supplierName}`
      )

      assert.ok(display.item, `Fixture ${index + 1}: display.item missing`)
      assert.ok(display.weights, `Fixture ${index + 1}: display.weights missing`)
      assert.equal(display.item.itemCode, fixture.itemCode, `Fixture ${index + 1}: display itemCode mismatch`)
      assert.equal(display.item.designCode, fixture.itemCode, `Fixture ${index + 1}: display designCode mismatch`)
      assertApprox(display.weights.grossWeight, fixture.grossWeight, `Fixture ${index + 1} grossWeight`)
      assertApprox(display.weights.stoneWeight, fixture.stoneWeight, `Fixture ${index + 1} stoneWeight`)
      assert.equal(display.weights.stoneComponents.length, fixture.stoneComponents.length, `Fixture ${index + 1}: stone component count mismatch`)
      fixture.stoneComponents.forEach((value, stoneIndex) => {
        assertApprox(display.weights.stoneComponents[stoneIndex].value, value, `Fixture ${index + 1} stoneComponent${stoneIndex + 1}`)
      })
      assertApprox(display.weights.qrNetWeight, fixture.qrNetWeight, `Fixture ${index + 1} qrNetWeight`)
      assertApprox(display.weights.computedNetWeight, fixture.computedNetWeight, `Fixture ${index + 1} computedNetWeight`)
      assertApprox(display.weights.selectedNetWeight, fixture.computedNetWeight, `Fixture ${index + 1} selectedNetWeight`)
      const displayRequiresReview = display.requiresReview ?? response.normalizedResult?.requiresReview ?? false
      const displayWarnings = Array.isArray(display.warnings)
        ? display.warnings
        : (Array.isArray(response.normalizedResult?.warnings) ? response.normalizedResult.warnings : [])

      assert.equal(displayRequiresReview, false, `Fixture ${index + 1}: display requiresReview should be false`)
      assert.equal(Array.isArray(displayWarnings), true, `Fixture ${index + 1}: display warnings should be array`)
      assert.equal(displayWarnings.length, 0, `Fixture ${index + 1}: display warnings should be empty`)
      assert.ok(display.calculation?.explanation, `Fixture ${index + 1}: display calculation explanation missing`)

      assert.equal(response.normalizedResult?.itemCode, fixture.itemCode, `Fixture ${index + 1}: flat itemCode mismatch`)
      assert.equal(response.normalizedResult?.design_code, fixture.itemCode, `Fixture ${index + 1}: flat design_code mismatch`)
      assert.equal(response.normalizedResult?.requiresReview, false, `Fixture ${index + 1}: normalized requiresReview should be false`)
      assert.equal(Array.isArray(response.normalizedResult?.warnings), true, `Fixture ${index + 1}: normalized warnings should be array`)
      assert.equal(response.normalizedResult?.warnings.length, 0, `Fixture ${index + 1}: normalized warnings should be empty`)
      assert.equal(response.parseResult?.calculationBreakdown?.requiresReview, false, `Fixture ${index + 1}: parse calculation should not require review`)
      assertApprox(response.parseResult?.calculationBreakdown?.computedNetWeight, fixture.computedNetWeight, `Fixture ${index + 1} parse computedNetWeight`)
      assertApprox(response.parseResult?.calculationBreakdown?.selectedNetWeight, fixture.computedNetWeight, `Fixture ${index + 1} parse selectedNetWeight`)

      const itemSummary = {
        supplier: supplierName,
        itemCode: display.item.itemCode,
        grossWeight: display.weights.grossWeight,
        stoneWeight: display.weights.stoneWeight,
        netWeight: display.weights.selectedNetWeight,
        requiresReview: display.requiresReview,
      }

      console.log(`fixture ${index + 1}:`, JSON.stringify(itemSummary))
    }

    console.log(`Admin parse endpoint Adinath checks passed (${fixtures.length}/${fixtures.length})`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

main().catch((error) => {
  console.error('Admin parse endpoint Adinath checks failed:', error)
  process.exit(1)
})
