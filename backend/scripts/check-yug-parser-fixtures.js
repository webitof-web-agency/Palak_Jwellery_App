import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'
import { detectSupplier, normalizeParsedQR, parseQR } from '../src/services/qrParser.service.js'
import { normalize } from '../src/services/qrNormalization.service.js'
import { validate } from '../src/services/qrValidation.service.js'
import { valuate } from '../src/services/qrValuation.service.js'
import { getPurityForKarat, getYugDefaultBusinessSettings } from '../src/services/supplierBusinessSettings.service.js'

const fixtures = [
  {
    raw: '2075778/86711/18K/3.75/0/3.553/322/SWMS - 691HG/WC/Y+W/2J0Y0/0/0/WHITE/0.197/0',
    expected: {
      itemCode: 'SWMS - 691HG',
      category: 'WHITE',
      grossWeight: 3.75,
      qrNetWeight: 3.553,
      stoneComponent1: 0,
      stoneComponent2: 0.197,
      otherWeight: 0,
      stoneWeight: 0.197,
      computedNetWeight: 3.553,
      selectedNetWeight: 3.553,
      stoneAmount: 322,
    },
  },
  {
    raw: '1964517/157229/18K/5.499/0/5.499/0/TGGR - 808/19/Y+W/L60T0/0/0/PURPAL/0/0',
    expected: {
      itemCode: 'TGGR - 808',
      category: 'PURPAL',
      grossWeight: 5.499,
      qrNetWeight: 5.499,
      stoneComponent1: 0,
      stoneComponent2: 0,
      otherWeight: 0,
      stoneWeight: 0,
      computedNetWeight: 5.499,
      selectedNetWeight: 5.499,
      stoneAmount: 0,
    },
  },
  {
    raw: '2362374/206225/18K/4.84/0/4.84/0/YNGR - 136 RF/22/Y+W/2V0T0/0/0/SKYBLUE/0/0',
    expected: {
      itemCode: 'YNGR - 136 RF',
      category: 'SKYBLUE',
      grossWeight: 4.84,
      qrNetWeight: 4.84,
      stoneComponent1: 0,
      stoneComponent2: 0,
      otherWeight: 0,
      stoneWeight: 0,
      computedNetWeight: 4.84,
      selectedNetWeight: 4.84,
      stoneAmount: 0,
    },
  },
  {
    raw: '2234229/121004/18K/6.1/0/6.057/58/TCCBJ - 167-SIZE23/23/Y+W/2J0Y0/0/0/WHITE/0.043/0',
    expected: {
      itemCode: 'TCCBJ - 167-SIZE23',
      category: 'WHITE',
      grossWeight: 6.1,
      qrNetWeight: 6.057,
      stoneComponent1: 0,
      stoneComponent2: 0.043,
      otherWeight: 0,
      stoneWeight: 0.043,
      computedNetWeight: 6.057,
      selectedNetWeight: 6.057,
      stoneAmount: 58,
    },
  },
  {
    raw: '2285877/25263/18K/7.18/0.174/7.006/68/SWJ - 289/18/Y+W/2T0Y0/0/0/GREEN/0/0',
    expected: {
      itemCode: 'SWJ - 289',
      category: 'GREEN',
      grossWeight: 7.18,
      qrNetWeight: 7.006,
      stoneComponent1: 0.174,
      stoneComponent2: 0,
      otherWeight: 0,
      stoneWeight: 0.174,
      computedNetWeight: 7.006,
      selectedNetWeight: 7.006,
      stoneAmount: 68,
    },
  },
  {
    raw: '2448724/100409/18K/1.59/0.299/1.205/290/SWPS - 8927RD/NA/Y+W/2J0Y0/0/0/WHITE/0.086/0/0/0/1/0/0',
    expected: {
      itemCode: 'SWPS - 8927RD',
      category: 'WHITE',
      grossWeight: 1.59,
      qrNetWeight: 1.205,
      stoneComponent1: 0.299,
      stoneComponent2: 0.086,
      otherWeight: 0,
      stoneWeight: 0.385,
      computedNetWeight: 1.205,
      selectedNetWeight: 1.205,
      stoneAmount: 290,
    },
  },
  {
    raw: '2334111/81703/18K/1.34/0.012/1.279/157/SWPS - 8590GN/NA/R+W/2J0Y0/0/0/WHITE/0.049/0',
    expected: {
      itemCode: 'SWPS - 8590GN',
      category: 'WHITE',
      grossWeight: 1.34,
      qrNetWeight: 1.279,
      stoneComponent1: 0.012,
      stoneComponent2: 0.049,
      otherWeight: 0,
      stoneWeight: 0.061,
      computedNetWeight: 1.279,
      selectedNetWeight: 1.279,
      stoneAmount: 157,
    },
  },
  {
    raw: '2342763/101478/18K/34.12/2.327/31.793/2304/HBN - 44-SIZE2.6/2.6/Y+W/2J0Y0/0/0/WHITE/0/0',
    expected: {
      itemCode: 'HBN - 44-SIZE2.6',
      category: 'WHITE',
      grossWeight: 34.12,
      qrNetWeight: 31.793,
      stoneComponent1: 2.327,
      stoneComponent2: 0,
      otherWeight: 0,
      stoneWeight: 2.327,
      computedNetWeight: 31.793,
      selectedNetWeight: 31.793,
      stoneAmount: 2304,
    },
  },
  {
    raw: '1832922/86251/18K/2.72/0/2.476/357/SWMS - 643HG/WC/R+W/2J0Y0/0/0/WHITE/0.244/0',
    expected: {
      itemCode: 'SWMS - 643HG',
      category: 'WHITE',
      grossWeight: 2.72,
      qrNetWeight: 2.476,
      stoneComponent1: 0,
      stoneComponent2: 0.244,
      otherWeight: 0,
      stoneWeight: 0.244,
      computedNetWeight: 2.476,
      selectedNetWeight: 2.476,
      stoneAmount: 357,
    },
  },
  {
    raw: '2196980/155004/18K/4.955/0/4.437/564/SWMS - 1913HG/WC/Y+W/2J0Y0/0/0/WHITE/0.518/0',
    expected: {
      itemCode: 'SWMS - 1913HG',
      category: 'WHITE',
      grossWeight: 4.955,
      qrNetWeight: 4.437,
      stoneComponent1: 0,
      stoneComponent2: 0.518,
      otherWeight: 0,
      stoneWeight: 0.518,
      computedNetWeight: 4.437,
      selectedNetWeight: 4.437,
      stoneAmount: 564,
    },
  },
  {
    raw: '1982995/123271/18K/25.887/0/24.65/2496/HBN - 72-SIZE2.6/2.6/Y+W/2J0Y0/0/0/WHITE/1.237/0',
    expected: {
      itemCode: 'HBN - 72-SIZE2.6',
      category: 'WHITE',
      grossWeight: 25.887,
      qrNetWeight: 24.65,
      stoneComponent1: 0,
      stoneComponent2: 1.237,
      otherWeight: 0,
      stoneWeight: 1.237,
      computedNetWeight: 24.65,
      selectedNetWeight: 24.65,
      stoneAmount: 2496,
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
    const yugSupplier = suppliers.find((supplier) => String(supplier?.name || supplier?.code || '').toLowerCase() === 'yug') || {
      _id: 'virtual-yug',
      name: 'Yug',
      code: 'YUG',
      qrMapping: {
        strategy: 'delimiter',
        delimiter: '/',
        fieldMap: {
          grossWeight: 3,
          stoneWeight: { sumIndices: [4, 14] },
          netWeight: 5,
          category: 7,
        },
      },
      businessSettings: getYugDefaultBusinessSettings(),
      detectionPattern: {
        type: 'regex',
        pattern: 'SWMS|SWNK|TGGR|YNGR|TCCBJ|SWJ|SWPS|HBN',
      },
    }
    const expectedPurityPercent = getPurityForKarat(yugSupplier, '18K', {
      '9K': 37.5,
      '14K': 58.5,
      '18K': 75,
      '20K': 83.3,
      '22K': 91.6,
      '24K': 99.9,
    })

    const testSuppliers = suppliers.some((supplier) => String(supplier?.name || supplier?.code || '').toLowerCase() === 'yug')
      ? suppliers
      : [yugSupplier, ...suppliers]

    for (const [index, fixture] of fixtures.entries()) {
      const detection = detectSupplier(fixture.raw, testSuppliers)
      assert.ok(detection?.supplier, `Fixture ${index + 1}: Yug supplier not detected`)

      const detectedName = String(detection.supplier.name || detection.supplier.code || '').toLowerCase()
      assert.ok(
        detectedName === 'yug',
        `Fixture ${index + 1}: expected Yug supplier, got ${detection.supplier.name || detection.supplier.code || 'none'}`
      )
      assert.ok(
        typeof detection.confidence === 'number' && detection.confidence >= 5,
        `Fixture ${index + 1}: expected structural confidence, got ${detection.confidence}`
      )

      const parseResult = parseQR(fixture.raw, detection.supplier)
      const normalizedParsed = normalizeParsedQR(parseResult, detection.supplier)
      const normalized = normalize(normalizedParsed, detection.supplier)
      const validated = validate(normalized)
      const valuated = valuate(validated)

      assert.ok(parseResult?.calculationBreakdown, `Fixture ${index + 1}: calculationBreakdown missing`)
      assert.ok(normalizedParsed?.calculationBreakdown, `Fixture ${index + 1}: normalizedParsed calculationBreakdown missing`)
      assert.ok(normalized?.display, `Fixture ${index + 1}: normalized display contract missing`)
      assert.ok(normalized?.display?.supplier, `Fixture ${index + 1}: display supplier missing`)
      assert.ok(normalized?.display?.item, `Fixture ${index + 1}: display item missing`)
      assert.ok(normalized?.display?.weights, `Fixture ${index + 1}: display weights missing`)
      assert.ok(normalized?.display?.amounts, `Fixture ${index + 1}: display amounts missing`)
      assert.ok(normalized?.display?.calculation, `Fixture ${index + 1}: display calculation missing`)
      assert.ok(Array.isArray(normalized?.display?.weights?.stoneComponents), `Fixture ${index + 1}: stoneComponents must be an array`)

      assertApprox(parseResult.calculationBreakdown.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} grossWeight`)
      assertApprox(parseResult.calculationBreakdown.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} qrNetWeight`)
      assertApprox(parseResult.calculationBreakdown.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} computedNetWeight`)
      assertApprox(parseResult.calculationBreakdown.selectedNetWeight, fixture.expected.selectedNetWeight, `Fixture ${index + 1} selectedNetWeight`)
      assertApprox(parseResult.calculationBreakdown.stoneComponents[0].value, fixture.expected.stoneComponent1, `Fixture ${index + 1} stoneComponent1`)
      assertApprox(parseResult.calculationBreakdown.stoneComponents[1].value, fixture.expected.stoneComponent2, `Fixture ${index + 1} stoneComponent2`)
      assertApprox(parseResult.calculationBreakdown.otherWeight.value, fixture.expected.otherWeight, `Fixture ${index + 1} otherWeight`)
      assertApprox(parseResult.calculationBreakdown.mismatch || 0, 0, `Fixture ${index + 1} mismatch`)

      assert.equal(normalizedParsed.supplier, 'Yug', `Fixture ${index + 1}: normalizedParsed supplier should be Yug`)
      assert.equal(normalizedParsed.design_code, fixture.expected.itemCode, `Fixture ${index + 1}: normalizedParsed design code mismatch`)
      assert.equal(normalizedParsed.category, fixture.expected.category, `Fixture ${index + 1}: normalizedParsed category mismatch`)
      assertApprox(normalizedParsed.gross_weight, fixture.expected.grossWeight, `Fixture ${index + 1} normalizedParsed grossWeight`)
      assertApprox(normalizedParsed.net_weight, fixture.expected.qrNetWeight, `Fixture ${index + 1} normalizedParsed qrNetWeight`)
      assertApprox(normalizedParsed.stone_weight, fixture.expected.stoneWeight, `Fixture ${index + 1} normalizedParsed stoneWeight`)
      assertApprox(normalizedParsed.other_weight || 0, fixture.expected.otherWeight, `Fixture ${index + 1} normalizedParsed otherWeight`)
      assertApprox(normalizedParsed.stone_amount, fixture.expected.stoneAmount, `Fixture ${index + 1} normalizedParsed stoneAmount`)
      assert.equal(normalizedParsed.calculationBreakdown.requiresReview, false, `Fixture ${index + 1}: normalizedParsed requiresReview should be false`)
      assert.equal(normalized.rawQr, fixture.raw, `Fixture ${index + 1}: rawQr mismatch`)
      assert.equal(normalized.requiresReview, false, `Fixture ${index + 1}: requiresReview should be false`)
      assert.equal(Array.isArray(normalized.warnings), true, `Fixture ${index + 1}: warnings should be an array`)
      assert.equal(normalized.display.supplier.name, 'Yug', `Fixture ${index + 1}: display supplier mismatch`)
      assert.equal(normalized.display.item.itemCode, fixture.expected.itemCode, `Fixture ${index + 1}: display itemCode mismatch`)
      assert.equal(normalized.display.item.designCode, fixture.expected.itemCode, `Fixture ${index + 1}: display designCode mismatch`)
      assert.equal(normalized.display.item.karat, '18K', `Fixture ${index + 1}: display karat mismatch`)
      assertApprox(normalized.display.item.purityPercent, expectedPurityPercent, `Fixture ${index + 1} display purityPercent`)
      assert.equal(normalized.display.item.category, fixture.expected.category, `Fixture ${index + 1}: display category mismatch`)
      assert.equal(normalized.display.item.colorCategory, fixture.expected.category, `Fixture ${index + 1}: display colorCategory mismatch`)
      assertApprox(normalized.display.weights.grossWeight, fixture.expected.grossWeight, `Fixture ${index + 1} display grossWeight`)
      assertApprox(normalized.display.weights.stoneWeight, fixture.expected.stoneWeight, `Fixture ${index + 1} display stoneWeight`)
      assertApprox(normalized.display.weights.otherWeight || 0, fixture.expected.otherWeight, `Fixture ${index + 1} display otherWeight`)
      assertApprox(normalized.display.weights.qrNetWeight, fixture.expected.qrNetWeight, `Fixture ${index + 1} display qrNetWeight`)
      assertApprox(normalized.display.weights.computedNetWeight, fixture.expected.computedNetWeight, `Fixture ${index + 1} display computedNetWeight`)
      assertApprox(normalized.display.weights.selectedNetWeight, fixture.expected.selectedNetWeight, `Fixture ${index + 1} display selectedNetWeight`)
      assert.ok(normalized.display.weights.stoneComponents.length >= 2, `Fixture ${index + 1}: display stoneComponents should include both components`)
      assertApprox(normalized.display.weights.stoneComponents[0].value, fixture.expected.stoneComponent1, `Fixture ${index + 1} display stoneComponent1`)
      assertApprox(normalized.display.weights.stoneComponents[1].value, fixture.expected.stoneComponent2, `Fixture ${index + 1} display stoneComponent2`)
      assertApprox(normalized.display.amounts.stoneAmount, fixture.expected.stoneAmount, `Fixture ${index + 1} display stoneAmount`)
      assertApprox(normalized.purityPercent, expectedPurityPercent, `Fixture ${index + 1}: flat purityPercent mismatch`)
      assertApprox(normalized.purity_percent, expectedPurityPercent, `Fixture ${index + 1}: flat purity_percent mismatch`)
      assert.equal(normalized.display.requiresReview, false, `Fixture ${index + 1}: display requiresReview should be false`)
      assert.ok(normalized.display.calculation.explanation, `Fixture ${index + 1}: display calculation explanation missing`)
      assert.equal(validated.status, 'approved', `Fixture ${index + 1}: validation should stay approved`)
      assert.equal(typeof valuated.valuation_status, 'string', `Fixture ${index + 1}: valuation status missing`)
    }

    console.log(`Yug parser fixture checks passed (${fixtures.length}/${fixtures.length})`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close()
    }
  }
}

main().catch((error) => {
  console.error('Yug parser fixture checks failed:', error)
  process.exit(1)
})
