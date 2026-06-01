import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import { Supplier } from '../src/models/Supplier.js'

const makePayload = (codeSuffix) => ({
  name: `Business Settings Check ${codeSuffix}`,
  code: `BIZCHK_${codeSuffix}`,
  gst: '27ABCDE1234F1Z5',
  address: 'Test address',
  paymentMode: 'cash',
  categories: ['White', 'Green'],
  businessSettings: {
    categories: [
      {
        name: 'White',
        code: 'WHITE',
        colorLabel: 'white',
        wastagePercent: null,
        isActive: true,
        sortOrder: 100,
      },
      {
        name: 'Green',
        code: 'GREEN',
        colorLabel: 'green',
        wastagePercent: 9,
        isActive: true,
        sortOrder: 110,
      },
      {
        name: 'Purple / Orange',
        code: 'PURPLE_ORANGE',
        colorLabel: 'purple-orange',
        wastagePercent: null,
        isActive: false,
        sortOrder: 120,
      },
      {
        name: 'Skyblue',
        code: 'SKYBLUE',
        colorLabel: 'skyblue',
        wastagePercent: 0,
        isActive: true,
        sortOrder: 130,
      },
    ],
    purityOverrides: [
      {
        karat: '18K',
        purityPercent: null,
        isActive: true,
      },
      {
        karat: '22K',
        purityPercent: 91.6,
        isActive: false,
      },
    ],
    defaultWastagePercent: null,
    defaultStoneRate: null,
    netWeightRule: 'computed',
    stoneWeightRule: 'component_sum',
    otherWeightRule: {
      deductOtherWeight: false,
      defaultOtherWeight: null,
    },
    qrNetTolerance: 0.005,
  },
  qrProfile: {
    profileKey: 'test-profile',
    version: '1.0',
    description: 'Business settings save check',
  },
  qrMapping: {
    strategy: 'delimiter',
    delimiter: '/',
    fieldMap: {
      supplierCode: 0,
      category: 1,
      grossWeight: 2,
      stoneWeight: 3,
      netWeight: 4,
    },
  },
  detectionPattern: null,
  isActive: true,
})

const assertPayloadRoundTrip = async () => {
  const suffix = Date.now().toString(36)
  const payload = makePayload(suffix)
  const created = await Supplier.create(payload)

  try {
    assert.equal(created.name, payload.name)
    assert.equal(created.code, payload.code)
    assert.equal(created.paymentMode, 'cash')
    assert.equal(created.categories.length, 2)
    assert.equal(created.businessSettings.categories.length, 4)
    assert.equal(created.businessSettings.purityOverrides.length, 2)
    assert.equal(created.businessSettings.categories[0].wastagePercent, null)
    assert.equal(created.businessSettings.categories[1].wastagePercent, 9)
    assert.equal(created.businessSettings.purityOverrides[0].purityPercent, null)
    assert.equal(created.businessSettings.qrNetTolerance, 0.005)
    assert.equal(created.qrProfile.profileKey, 'test-profile')
    assert.equal(created.qrMapping.fieldMap.grossWeight, 2)

    const reloaded = await Supplier.findById(created._id)
    assert.ok(reloaded)

    reloaded.businessSettings.defaultWastagePercent = 8.5
    reloaded.businessSettings.purityOverrides[0].purityPercent = 75.15
    reloaded.businessSettings.otherWeightRule.defaultOtherWeight = 0
    reloaded.qrProfile.version = '1.1'
    await reloaded.save()

    const updated = await Supplier.findById(created._id).lean()
    assert.ok(updated)
    assert.equal(updated.businessSettings.defaultWastagePercent, 8.5)
    assert.equal(updated.businessSettings.purityOverrides[0].purityPercent, 75.15)
    assert.equal(updated.qrProfile.version, '1.1')
    assert.equal(updated.businessSettings.otherWeightRule.defaultOtherWeight, 0)

    console.log('Supplier business settings save check passed.')
  } finally {
    await Supplier.findByIdAndDelete(created._id)
  }
}

try {
  await connectDB()
  await assertPayloadRoundTrip()
} catch (error) {
  console.error('Supplier business settings save check failed:', error?.message || error)
  process.exitCode = 1
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}
