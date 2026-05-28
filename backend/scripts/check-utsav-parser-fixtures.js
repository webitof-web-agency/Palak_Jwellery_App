import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'
import { detectSupplier, normalizeParsedQR, parseQR } from '../src/services/qrParser.service.js'
import { normalize } from '../src/services/qrNormalization.service.js'
import { validate } from '../src/services/qrValidation.service.js'
import { valuate } from '../src/services/qrValuation.service.js'

const fixtures = [
  {
    raw: 'TM-868/GWT-6.600/NWT-5.120/SWT-0.840/CL-0.640/XIMQZQ/75//USV',
    expected: {
      itemCode: 'TM-868',
      grossWeight: 6.6,
      stoneWeight: 1.48,
      stoneComponent1: 0.84,
      stoneComponent2: 0.64,
      qrNetWeight: 5.12,
      computedNetWeight: 5.12,
    },
  },
  {
    raw: 'TM-862/GWT-4.210/NWT-3.760/SWT-0.450//T9E93N//75/USV',
    expected: {
      itemCode: 'TM-862',
      grossWeight: 4.21,
      stoneWeight: 0.45,
      stoneComponent1: 0.45,
      stoneComponent2: null,
      qrNetWeight: 3.76,
      computedNetWeight: 3.76,
    },
  },
  {
    raw: 'TM-887/GWT-5.220/NWT-3.690/SWT-0.470/CL-1.060/N74BXA/75//USV',
    expected: {
      itemCode: 'TM-887',
      grossWeight: 5.22,
      stoneWeight: 1.53,
      stoneComponent1: 0.47,
      stoneComponent2: 1.06,
      qrNetWeight: 3.69,
      computedNetWeight: 3.69,
    },
  },
  {
    raw: 'PST-3330/GWT-2.010/NWT-1.880/SWT-0.130/AYXUF3//75//USV',
    expected: {
      itemCode: 'PST-3330',
      grossWeight: 2.01,
      stoneWeight: 0.13,
      stoneComponent1: 0.13,
      stoneComponent2: null,
      qrNetWeight: 1.88,
      computedNetWeight: 1.88,
    },
  },
  {
    raw: 'PST-3205/GWT-1.830/NWT-1.690/SWT-0.140//WGZ381//75/USV',
    expected: {
      itemCode: 'PST-3205',
      grossWeight: 1.83,
      stoneWeight: 0.14,
      stoneComponent1: 0.14,
      stoneComponent2: null,
      qrNetWeight: 1.69,
      computedNetWeight: 1.69,
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

const main = async () => {
  await connectDB()

  try {
    const suppliers = await Supplier.find().lean()
    const utsavSupplier = suppliers.find((supplier) => String(supplier?.name || supplier?.code || '').toLowerCase() === 'utsav') || {
      _id: 'virtual-utsav',
      name: 'Utsav',
      code: 'UTSAV',
      qrMapping: {
        strategy: 'delimiter',
        delimiter: '/',
      },
    }

    const testSuppliers = suppliers.some((supplier) => String(supplier?.name || supplier?.code || '').toLowerCase() === 'utsav')
      ? suppliers
      : [utsavSupplier, ...suppliers]

    for (const [index, fixture] of fixtures.entries()) {
      const detection = detectSupplier(fixture.raw, testSuppliers)
      assert.ok(detection?.supplier, `Fixture ${index + 1}: Utsav supplier not detected`)

      const detectedName = String(detection.supplier.name || detection.supplier.code || '').toLowerCase()
      assert.equal(detectedName, 'utsav', `Fixture ${index + 1}: expected Utsav supplier`)

      const parseResult = parseQR(fixture.raw, detection.supplier)
      const normalizedParsed = normalizeParsedQR(parseResult, detection.supplier)
      const normalized = normalize(normalizedParsed, detection.supplier)
      const validated = validate(normalized)
      const valuated = valuate(validated)

      assert.ok(parseResult?.calculationBreakdown, `Fixture ${index + 1}: calculationBreakdown missing`)
      assert.ok(Array.isArray(parseResult.calculationBreakdown.stoneComponents), `Fixture ${index + 1}: stoneComponents missing`)
      assert.ok(normalized?.display, `Fixture ${index + 1}: display contract missing`)
      assert.ok(Array.isArray(normalized.display.weights.stoneComponents), `Fixture ${index + 1}: display stoneComponents missing`)
      assert.equal(normalizedParsed.supplier, 'Utsav', `Fixture ${index + 1}: normalizedParsed supplier mismatch`)
      assert.equal(normalizedParsed.design_code, fixture.expected.itemCode, `Fixture ${index + 1}: itemCode mismatch`)

      assertApprox(parseResult.calculationBreakdown.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} grossWeight`)
      assertApprox(parseResult.calculationBreakdown.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} qrNetWeight`)
      assertApprox(parseResult.calculationBreakdown.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} computedNetWeight`)
      assertApprox(parseResult.calculationBreakdown.selectedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} selectedNetWeight`)
      assertApprox(parseResult.calculationBreakdown.stoneWeight, fixture.expected.stoneWeight, `Fixture ${index + 1} stoneWeight`)

      assertApprox(parseResult.calculationBreakdown.stoneComponents[0].value, fixture.expected.stoneComponent1, `Fixture ${index + 1} stoneComponent1`)
      if (fixture.expected.stoneComponent2 === null) {
        assert.equal(parseResult.calculationBreakdown.stoneComponents.length, 1, `Fixture ${index + 1}: unexpected extra stone component`)
      } else {
        assert.equal(parseResult.calculationBreakdown.stoneComponents.length, 2, `Fixture ${index + 1}: missing second stone component`)
        assertApprox(parseResult.calculationBreakdown.stoneComponents[1].value, fixture.expected.stoneComponent2, `Fixture ${index + 1} stoneComponent2`)
      }

      assertApprox(normalizedParsed.gross_weight, fixture.expected.grossWeight, `Fixture ${index + 1} normalized grossWeight`)
      assertApprox(normalizedParsed.stone_weight, fixture.expected.stoneWeight, `Fixture ${index + 1} normalized stoneWeight`)
      assertApprox(normalizedParsed.net_weight, fixture.expected.qrNetWeight, `Fixture ${index + 1} normalized netWeight`)
      assert.equal(normalized.display.item.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: display itemCode mismatch`)
      assert.equal(normalized.display.weights.stoneComponents.length, fixture.expected.stoneComponent2 === null ? 1 : 2, `Fixture ${index + 1}: display stoneComponents count mismatch`)
      assert.equal(normalized.requiresReview, false, `Fixture ${index + 1}: requiresReview should be false`)
      assert.equal(normalized.display.requiresReview, false, `Fixture ${index + 1}: display requiresReview should be false`)
      assert.equal(validated.status, 'approved', `Fixture ${index + 1}: validation should be approved`)
      assert.equal(typeof valuated.valuation_status, 'string', `Fixture ${index + 1}: valuation status missing`)
    }

    console.log(`Utsav parser fixture checks passed (${fixtures.length}/${fixtures.length})`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

main().catch((error) => {
  console.error('Utsav parser fixture checks failed:', error)
  process.exit(1)
})
