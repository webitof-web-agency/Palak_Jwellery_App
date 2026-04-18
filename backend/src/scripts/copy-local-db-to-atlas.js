import dotenv from 'dotenv'
import mongoose from 'mongoose'

dotenv.config()

const sourceUri = process.env.SOURCE_MONGODB_URI || 'mongodb://127.0.0.1:27017/jwellery'
const targetUri = process.env.MONGODB_URI

if (!targetUri) {
  console.error('MONGODB_URI is required')
  process.exit(1)
}

const connect = async (uri, label) => {
  const conn = await mongoose.createConnection(uri).asPromise()
  console.log(`${label} connected`)
  return conn
}

const copyCollection = async (sourceDb, targetDb, name) => {
  const sourceCollection = sourceDb.collection(name)
  const targetCollection = targetDb.collection(name)

  const docs = await sourceCollection.find({}).toArray()
  await targetCollection.deleteMany({})

  if (docs.length > 0) {
    await targetCollection.insertMany(docs, { ordered: true })
  }

  const indexes = await sourceCollection.indexes()
  for (const index of indexes) {
    if (index.name === '_id_') continue

    const { key, v, ns, background, ...options } = index
    try {
      await targetCollection.createIndex(key, options)
    } catch (err) {
      if (!String(err.message).includes('already exists')) {
        throw err
      }
    }
  }

  console.log(`Copied ${name}: ${docs.length} docs`)
}

const main = async () => {
  const sourceConn = await connect(sourceUri, 'Source DB')
  const targetConn = await connect(targetUri, 'Target DB')

  try {
    const sourceCollections = await sourceConn.db.listCollections().toArray()

    for (const collection of sourceCollections) {
      if (collection.name.startsWith('system.')) continue
      await copyCollection(sourceConn.db, targetConn.db, collection.name)
    }

    console.log('Local database copied to Atlas successfully')
  } finally {
    await sourceConn.close()
    await targetConn.close()
  }
}

main().catch((err) => {
  console.error('Copy failed:', err)
  process.exit(1)
})
