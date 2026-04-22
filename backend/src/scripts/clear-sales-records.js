import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const localUri =
  process.env.SOURCE_MONGODB_URI ||
  process.env.LOCAL_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/jwellery'
const targetUri = process.env.MONGODB_URI

if (!targetUri) {
  console.error('MONGODB_URI is required')
  process.exit(1)
}

const uniqueUris = Array.from(new Set([localUri, targetUri].filter(Boolean)))

const wipeSales = async (uri, label) => {
  const conn = await mongoose.createConnection(uri).asPromise()
  try {
    const result = await conn.db.collection('sales').deleteMany({})
    console.log(`${label}: deleted ${result.deletedCount || 0} sales records`)
  } finally {
    await conn.close()
  }
}

const main = async () => {
  const failures = []

  for (const uri of uniqueUris) {
    const label = uri === targetUri ? 'Atlas DB' : 'Local DB'
    try {
      await wipeSales(uri, label)
    } catch (error) {
      failures.push(`${label}: ${error.message}`)
      console.error(`${label}: failed to wipe sales records`, error)
    }
  }

  if (failures.length > 0) {
    console.error('Completed with some failures:', failures.join(' | '))
    process.exitCode = 1
    return
  }

  console.log('Sales records wiped from all configured databases')
}

main().catch((error) => {
  console.error('Failed to wipe sales records:', error)
  process.exit(1)
})
