import assert from 'node:assert/strict'
import {
  buildSaleCalculationSnapshot,
  buildSaleSettlementInputs,
} from '../src/services/saleCalculationSnapshot.service.js'

const supplier = {
  _id: 'supplier-yug',
  code: 'YUG',
  name: 'Yug',
  businessSettings: {
    categories: [
      {
        name: 'White',
        code: 'WHITE',
        wastagePercent: 9,
        isActive: true,
      },
    ],
    purityOverrides: [
      {
        karat: '18K',
        purityPercent: 75.15,
        isActive: true,
      },
    ],
    defaultWastagePercent: 7,
    qrNetTolerance: 0.005,
  },
}

const assertApprox = (actual, expected, label, tolerance = 0.001) => {
  assert.ok(
    Math.abs(Number(actual) - Number(expected)) <= tolerance,
    `${label}: expected ${expected}, got ${actual}`
  )
}

const run = () => {
  const supplierOverride = buildSaleSettlementInputs({
    source: {
      karat: '18K',
      category: 'WHITE',
      grossWeight: 10,
      stoneWeight: 1,
      qrNetWeight: 9,
    },
    supplier,
    parsedSnapshot: null,
    settlementSettings: {},
  })

  assert.equal(supplierOverride.purityPercent, 75.15)
  assert.equal(supplierOverride.originalPurityPercent, 75.15)
  assert.equal(supplierOverride.puritySource, 'supplier_override')
  assert.equal(supplierOverride.purityOverridden, false)

  const manualPurity = buildSaleSettlementInputs({
    source: {
      karat: '18K',
      category: 'WHITE',
      purityPercent: 76,
      grossWeight: 10,
      stoneWeight: 1,
      qrNetWeight: 9,
    },
    supplier,
    parsedSnapshot: null,
    settlementSettings: {},
  })

  assert.equal(manualPurity.purityPercent, 76)
  assert.equal(manualPurity.originalPurityPercent, 75.15)
  assert.equal(manualPurity.purityOverridden, true)
  assert.equal(manualPurity.puritySource, 'manual_override')

  const categoryWastage = buildSaleSettlementInputs({
    source: {
      karat: '18K',
      category: 'WHITE',
      grossWeight: 10,
      stoneWeight: 1,
      qrNetWeight: 9,
    },
    supplier,
    parsedSnapshot: null,
    settlementSettings: {},
  })

  assert.equal(categoryWastage.wastagePercent, 9)
  assert.equal(categoryWastage.originalWastagePercent, 9)
  assert.equal(categoryWastage.wastageSource, 'supplier_category')
  assert.equal(categoryWastage.wastageOverridden, false)

  const manualWastage = buildSaleSettlementInputs({
    source: {
      karat: '18K',
      category: 'WHITE',
      wastagePercent: 10,
      grossWeight: 10,
      stoneWeight: 1,
      qrNetWeight: 9,
    },
    supplier,
    parsedSnapshot: null,
    settlementSettings: {},
  })

  assert.equal(manualWastage.wastagePercent, 10)
  assert.equal(manualWastage.originalWastagePercent, 9)
  assert.equal(manualWastage.wastageOverridden, true)
  assert.equal(manualWastage.wastageSource, 'manual_override')

  const manualSale = buildSaleCalculationSnapshot({
    source: {
      grossWeight: 10,
      stoneWeight: 1,
      netWeight: 9,
      qrRaw: 'manual-entry',
    },
    supplier,
    parsedSnapshot: null,
    settlementSettings: {},
    settlementInputs: buildSaleSettlementInputs({
      source: {
        grossWeight: 10,
        stoneWeight: 1,
        netWeight: 9,
        qrRaw: 'manual-entry',
      },
      supplier,
      parsedSnapshot: null,
      settlementSettings: {},
    }),
  })

  assert.ok(manualSale)
  assert.ok(manualSale.settlementInputs)
  assert.equal(manualSale.settlementInputs.karat, null)
  assert.equal(manualSale.settlementInputs.purityPercent, null)
  assert.equal(manualSale.settlementInputs.wastagePercent, 7)
  assert.equal(typeof manualSale.requiresReview, 'boolean')
  assert.ok(Array.isArray(manualSale.warnings))
  assert.ok(manualSale.warnings.length > 0)
  assert.equal(manualSale.settlementInputs.puritySource, 'unknown')
  assert.equal(manualSale.settlementInputs.wastageSource, 'supplier_default')
  assertApprox(manualSale.computedNetWeight, 9, 'manual sale computed net')

  console.log('Sale settlement input checks passed (5/5)')
}

run()
