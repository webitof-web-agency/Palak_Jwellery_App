import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'
import { parseSupplierQr } from '../src/controllers/suppliers.controller.js'

const fixtures = [
  {
    raw: '4.01/0.36/////3.65/TM-155',
    expected: {
      itemCode: 'TM-155',
      grossWeight: 4.01,
      stoneComponents: [0.36],
      stoneWeight: 0.36,
      qrNetWeight: 3.65,
      computedNetWeight: 3.65,
    },
  },
  {
    raw: '3.12/0.24/////2.88/TM-292',
    expected: {
      itemCode: 'TM-292',
      grossWeight: 3.12,
      stoneComponents: [0.24],
      stoneWeight: 0.24,
      qrNetWeight: 2.88,
      computedNetWeight: 2.88,
    },
  },
  {
    raw: '3.35/0.44/////2.91/TM-367',
    expected: {
      itemCode: 'TM-367',
      grossWeight: 3.35,
      stoneComponents: [0.44],
      stoneWeight: 0.44,
      qrNetWeight: 2.91,
      computedNetWeight: 2.91,
    },
  },
  {
    raw: '3.75/0.37/0.23////3.15/PSER-998',
    expected: {
      itemCode: 'PSER-998',
      grossWeight: 3.75,
      stoneComponents: [0.37, 0.23],
      stoneWeight: 0.6,
      qrNetWeight: 3.15,
      computedNetWeight: 3.15,
    },
  },
  {
    raw: '3.49/0.13/0.31////3.05/PT-03',
    expected: {
      itemCode: 'PT-03',
      grossWeight: 3.49,
      stoneComponents: [0.13, 0.31],
      stoneWeight: 0.44,
      qrNetWeight: 3.05,
      computedNetWeight: 3.05,
    },
  },
  {
    raw: '6.15/0.36/0.63////5.16/PS-2062',
    expected: {
      itemCode: 'PS-2062',
      grossWeight: 6.15,
      stoneComponents: [0.36, 0.63],
      stoneWeight: 0.99,
      qrNetWeight: 5.16,
      computedNetWeight: 5.16,
    },
  },
]

const approxEqual = (left, right, tolerance = 0.001) => Math.abs(Number(left) - Number(right)) <= tolerance

const assertApprox = (actual, expected, label) => {
  assert.ok(
    approxEqual(actual, expected),
    `${label} mismatch: expected ${expected}, got ${actual}`
  )
}

const createMockResponse = () => {
  const response = {
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
  }

  return response
}

const runParseSupplierQr = async (raw, supplier) => {
  const originalFind = Supplier.find
  const originalFindById = Supplier.findById

  Supplier.find = () => ({
    lean: async () => [supplier],
  })
  Supplier.findById = () => ({
    lean: async () => supplier,
  })

  try {
    const req = { body: { raw } }
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
    const adinathSupplier = {
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

    for (const [index, fixture] of fixtures.entries()) {
      const response = await runParseSupplierQr(fixture.raw, adinathSupplier)
      assert.ok(response, `Fixture ${index + 1}: response missing`)
      assert.ok(response.supplier, `Fixture ${index + 1}: supplier missing`)
      const supplierName = String(response.supplier.name || response.supplier.code || '').toLowerCase()
      assert.ok(
        supplierName === 'adinath' || supplierName === 'aadinath',
        `Fixture ${index + 1}: expected Adinath/Aadinath supplier, got ${response.supplier.name || response.supplier.code || 'none'}`
      )
      assert.ok(
        ['contains', 'structural', 'regex', 'prefix', 'manual'].includes(response.matchType),
        `Fixture ${index + 1}: unexpected matchType ${response.matchType}`
      )

      const parseResult = response.parseResult
      const normalized = response.normalizedResult
      const display = normalized?.display

      assert.ok(parseResult?.calculationBreakdown, `Fixture ${index + 1}: calculationBreakdown missing`)
      assert.ok(Array.isArray(parseResult.calculationBreakdown.stoneComponents), `Fixture ${index + 1}: stoneComponents missing`)
      assert.equal(parseResult.calculationBreakdown.requiresReview, false, `Fixture ${index + 1}: requiresReview should be false`)

      assertApprox(parseResult.calculationBreakdown.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} grossWeight`)
      assertApprox(parseResult.calculationBreakdown.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} qrNetWeight`)
      assertApprox(parseResult.calculationBreakdown.stoneWeight, fixture.expected.stoneWeight, `Fixture ${index + 1} stoneWeight`)
      assertApprox(parseResult.calculationBreakdown.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} computedNetWeight`)
      assertApprox(parseResult.calculationBreakdown.selectedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} selectedNetWeight`)
      assert.equal(parseResult.calculationBreakdown.stoneComponents.length, fixture.expected.stoneComponents.length, `Fixture ${index + 1}: stone component count mismatch`)
      fixture.expected.stoneComponents.forEach((value, stoneIndex) => {
        assertApprox(parseResult.calculationBreakdown.stoneComponents[stoneIndex].value, value, `Fixture ${index + 1} stoneComponent${stoneIndex + 1}`)
      })

      assert.equal(normalized.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: normalized itemCode mismatch`)
      assert.equal(normalized.design_code, fixture.expected.itemCode, `Fixture ${index + 1}: design code mismatch`)
      assertApprox(normalized.gross_weight, fixture.expected.grossWeight, `Fixture ${index + 1} normalized grossWeight`)
      assertApprox(normalized.stone_weight, fixture.expected.stoneWeight, `Fixture ${index + 1} normalized stoneWeight`)
      assertApprox(normalized.net_weight, fixture.expected.qrNetWeight, `Fixture ${index + 1} normalized netWeight`)

      assert.ok(display, `Fixture ${index + 1}: display contract missing`)
      assert.ok(display.supplier, `Fixture ${index + 1}: display supplier missing`)
      assert.ok(display.item, `Fixture ${index + 1}: display item missing`)
      assert.ok(display.weights, `Fixture ${index + 1}: display weights missing`)
      assert.equal(display.supplier.name || display.supplier.code, 'Aadinath', `Fixture ${index + 1}: display supplier mismatch`)
      assert.equal(display.item.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: display itemCode mismatch`)
      assert.equal(display.item.designCode, fixture.expected.itemCode, `Fixture ${index + 1}: display designCode mismatch`)
      assert.equal(display.item.category, null, `Fixture ${index + 1}: display category should be null`)
      assert.equal(display.item.metalType, null, `Fixture ${index + 1}: display metalType should be null`)
      assert.equal(display.item.karat, null, `Fixture ${index + 1}: display karat should be null`)
      assertApprox(display.weights.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} display grossWeight`)
      assertApprox(display.weights.stoneWeight, fixture.expected.stoneWeight, `Fixture ${index + 1} display stoneWeight`)
      assert.equal(display.weights.stoneComponents.length, fixture.expected.stoneComponents.length, `Fixture ${index + 1}: display stoneComponents count mismatch`)
      fixture.expected.stoneComponents.forEach((value, stoneIndex) => {
        assertApprox(display.weights.stoneComponents[stoneIndex].value, value, `Fixture ${index + 1} display stoneComponent${stoneIndex + 1}`)
        assert.equal(display.weights.stoneComponents[stoneIndex].label, `Stone Component ${stoneIndex + 1}`, `Fixture ${index + 1}: display stone component label mismatch`)
      })
      assertApprox(display.weights.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} display qrNetWeight`)
      assertApprox(display.weights.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} display computedNetWeight`)
      assertApprox(display.weights.selectedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} display selectedNetWeight`)
      assert.equal(display.weights.otherWeight, 0, `Fixture ${index + 1}: display otherWeight should be zero`)
      assert.equal(display.requiresReview, false, `Fixture ${index + 1}: display requiresReview should be false`)
      assert.ok(display.calculation, `Fixture ${index + 1}: display calculation missing`)
      assert.ok(display.calculation.explanation, `Fixture ${index + 1}: display calculation explanation missing`)
      assert.equal(normalized.requiresReview, false, `Fixture ${index + 1}: normalized requiresReview should be false`)
      assert.equal(Array.isArray(normalized.warnings), true, `Fixture ${index + 1}: warnings should be an array`)
      assert.equal(response.validatedResult?.status, 'approved', `Fixture ${index + 1}: validation should be approved`)
      assert.equal(typeof response.valuation?.valuation_status, 'string', `Fixture ${index + 1}: valuation status missing`)
    }

    console.log(`Adinath parser fixture checks passed (${fixtures.length}/${fixtures.length})`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

main().catch((error) => {
  console.error('Adinath parser fixture checks failed:', error)
  process.exit(1)
})
