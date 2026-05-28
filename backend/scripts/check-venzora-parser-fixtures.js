import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'
import { parseSupplierQr } from '../src/controllers/suppliers.controller.js'

const fixtures = [
  {
    raw: '307285/18KT/G16.970/L0.316/N16.654/Rs.379/CH-435A',
    expected: {
      internalId: '307285',
      itemCode: 'CH-435A',
      karat: '18KT',
      grossWeight: 16.97,
      stoneWeight: 0.316,
      qrNetWeight: 16.654,
      computedNetWeight: 16.654,
      stoneAmount: 379,
    },
  },
  {
    raw: '5046cb/18KT/G19.630/L0.0/N19.630/Rs0.0/CH-465A',
    expected: {
      internalId: '5046cb',
      itemCode: 'CH-465A',
      karat: '18KT',
      grossWeight: 19.63,
      stoneWeight: 0,
      qrNetWeight: 19.63,
      computedNetWeight: 19.63,
      stoneAmount: 0,
    },
  },
  {
    raw: '38987c/18KT/G14.190/L0.0/N14.190/Rs0.0/CH-363',
    expected: {
      internalId: '38987c',
      itemCode: 'CH-363',
      karat: '18KT',
      grossWeight: 14.19,
      stoneWeight: 0,
      qrNetWeight: 14.19,
      computedNetWeight: 14.19,
      stoneAmount: 0,
    },
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

const main = async () => {
  await connectDB()

  try {
    const suppliers = await Supplier.find({}, { name: 1, code: 1, qrMapping: 1 }).lean()
    const realSupplier = suppliers.find((supplier) => {
      const key = String(supplier?.name || supplier?.code || '').toLowerCase()
      return key === 'venzora'
    }) || null

    const virtualSupplier = {
      _id: 'virtual-venzora',
      name: 'Venzora',
      code: 'VENZORA',
      qrMapping: {
        strategy: 'venzora',
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

      const supplierName = String(
        response?.normalizedResult?.display?.supplier?.name ||
        response?.normalizedResult?.display?.supplier?.code ||
        response?.supplier?.name ||
        response?.supplier?.code ||
        ''
      ).trim()

      assert.ok(supplierName, `Fixture ${index + 1}: supplier display missing`)
      assert.ok(
        supplierName.toLowerCase().includes('venzora'),
        `Fixture ${index + 1}: expected Venzora supplier display, got ${supplierName}`
      )

      const normalized = response.normalizedResult
      const display = normalized?.display
      assert.ok(display, `Fixture ${index + 1}: display contract missing`)
      assert.ok(display.supplier, `Fixture ${index + 1}: display supplier missing`)
      assert.ok(display.item, `Fixture ${index + 1}: display item missing`)
      assert.ok(display.weights, `Fixture ${index + 1}: display weights missing`)
      assert.ok(display.amounts, `Fixture ${index + 1}: display amounts missing`)
      assert.ok(display.calculation, `Fixture ${index + 1}: display calculation missing`)
      assert.ok(Array.isArray(display.warnings), `Fixture ${index + 1}: display warnings missing`)

      assert.equal(display.item.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: display itemCode mismatch`)
      assert.equal(display.item.designCode, fixture.expected.itemCode, `Fixture ${index + 1}: display designCode mismatch`)
      assert.equal(display.item.karat, fixture.expected.karat, `Fixture ${index + 1}: display karat mismatch`)
      assert.equal(display.item.supplierInternalId, fixture.expected.internalId, `Fixture ${index + 1}: display supplierInternalId mismatch`)
      assertApprox(display.weights.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} grossWeight`)
      assertApprox(display.weights.stoneWeight, fixture.expected.stoneWeight, `Fixture ${index + 1} stoneWeight`)
      assertApprox(display.weights.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} qrNetWeight`)
      assertApprox(display.weights.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} computedNetWeight`)
      assertApprox(display.weights.selectedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} selectedNetWeight`)
      assert.equal(display.weights.otherWeight, 0, `Fixture ${index + 1}: display otherWeight should be zero`)
      assert.equal(display.weights.stoneComponents.length, 1, `Fixture ${index + 1}: display stoneComponents count mismatch`)
      assert.equal(display.weights.stoneComponents[0].label, 'Less / Stone Weight', `Fixture ${index + 1}: stone component label mismatch`)
      assertApprox(display.weights.stoneComponents[0].value, fixture.expected.stoneWeight, `Fixture ${index + 1} display stoneComponent`)
      assertApprox(display.amounts.stoneAmount, fixture.expected.stoneAmount, `Fixture ${index + 1} stoneAmount`)
      assert.equal(display.requiresReview, false, `Fixture ${index + 1}: display requiresReview should be false`)
      assert.equal(display.warnings.length, 0, `Fixture ${index + 1}: display warnings should be empty`)
      assert.ok(display.calculation.explanation, `Fixture ${index + 1}: display calculation explanation missing`)

      assert.equal(normalized.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: normalized itemCode mismatch`)
      assert.equal(normalized.design_code, fixture.expected.itemCode, `Fixture ${index + 1}: normalized design_code mismatch`)
      assert.equal(normalized.supplier, 'Venzora', `Fixture ${index + 1}: normalized supplier mismatch`)
      assertApprox(normalized.gross_weight, fixture.expected.grossWeight, `Fixture ${index + 1} normalized grossWeight`)
      assertApprox(normalized.stone_weight, fixture.expected.stoneWeight, `Fixture ${index + 1} normalized stoneWeight`)
      assertApprox(normalized.net_weight, fixture.expected.qrNetWeight, `Fixture ${index + 1} normalized netWeight`)
      assertApprox(normalized.stone_amount, fixture.expected.stoneAmount, `Fixture ${index + 1} normalized stoneAmount`)
      assert.equal(normalized.requiresReview, false, `Fixture ${index + 1}: normalized requiresReview should be false`)
      assert.equal(Array.isArray(normalized.warnings), true, `Fixture ${index + 1}: normalized warnings should be array`)
      assert.equal(normalized.warnings.length, 0, `Fixture ${index + 1}: normalized warnings should be empty`)
      assert.ok(response.parseResult?.calculationBreakdown, `Fixture ${index + 1}: parse calculationBreakdown missing`)
      assertApprox(response.parseResult.calculationBreakdown.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} parse qrNetWeight`)
      assertApprox(response.parseResult.calculationBreakdown.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} parse computedNetWeight`)
      assertApprox(response.parseResult.calculationBreakdown.selectedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} parse selectedNetWeight`)
      assert.equal(response.parseResult.calculationBreakdown.requiresReview, false, `Fixture ${index + 1}: parse requiresReview should be false`)
      assert.equal(response.validatedResult?.status, 'approved', `Fixture ${index + 1}: validation should be approved`)
      assert.equal(typeof response.valuation?.valuation_status, 'string', `Fixture ${index + 1}: valuation status missing`)
    }

    console.log(`Venzora parser fixture checks passed (${fixtures.length}/${fixtures.length})`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

main().catch((error) => {
  console.error('Venzora parser fixture checks failed:', error)
  process.exit(1)
})
