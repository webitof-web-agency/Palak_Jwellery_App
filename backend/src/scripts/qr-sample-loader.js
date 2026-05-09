import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { YUG_FALLBACK_MAPPING } from '../services/qrParser.patterns.js'

const SAMPLE_ROOT = fileURLToPath(new URL('../../../qr-samples/samples/', import.meta.url))

const SUPPLIER_FIXTURES = {
  yug: {
    name: 'YUG',
    code: 'YUG',
    detectionPattern: {
      type: 'regex',
      pattern: 'SWMS|SWNK',
    },
    qrMapping: YUG_FALLBACK_MAPPING,
  },
  adinath: {
    name: 'Adinath',
    code: 'Adinath',
    detectionPattern: {
      type: 'regex',
      pattern: '(?:TM|BG|LR)-\\d+',
    },
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
  },
  utsav: {
    name: 'Utsav',
    code: 'USV',
    detectionPattern: {
      type: 'contains',
      pattern: 'USV',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        grossWeight: { index: 1, stripPrefix: 'GWT-' },
        netWeight: { index: 2, stripPrefix: 'NWT-' },
        stoneWeight: { index: 3, stripPrefix: 'SWT-' },
        category: 0,
        supplierCode: { index: 8, stripPrefix: '' },
      },
    },
  },
  venzora: {
    name: 'Venzora',
    code: 'VENZORA',
    detectionPattern: {
      type: 'contains',
      pattern: 'VENZORA',
    },
    qrMapping: {
      strategy: 'venzora',
    },
  },
  zar: {
    name: 'Zar',
    code: 'ZAR',
    detectionPattern: {
      type: 'regex',
      pattern: '^JFC\\d+',
    },
    qrMapping: {
      strategy: 'delimiter',
      delimiter: '/',
      fieldMap: {
        supplierCode: 0,
      },
    },
  },
}

const listSampleFiles = async (root = SAMPLE_ROOT) => {
  const files = []

  const walk = async (dir) => {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const absolutePath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) {
        files.push(absolutePath)
      }
    }
  }

  await walk(root)
  return files.sort((a, b) => a.localeCompare(b))
}

const loadSampleFixtures = async (root = SAMPLE_ROOT) => {
  const files = await listSampleFiles(root)
  const fixtures = []

  for (const filePath of files) {
    const relativePath = path.relative(root, filePath)
    const parts = relativePath.split(path.sep)

    if (parts.length < 3) {
      continue
    }

    const [supplierKey, category, fileName] = parts
    const raw = await fs.readFile(filePath, 'utf8')
    const samples = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))

    for (const [index, sample] of samples.entries()) {
      fixtures.push({
        supplierKey,
        category,
        fileName,
        filePath,
        sampleIndex: index,
        raw: sample,
      })
    }
  }

  return fixtures
}

const getSupplierFixture = (supplierKey) => {
  if (!supplierKey) {
    return null
  }

  return SUPPLIER_FIXTURES[String(supplierKey).toLowerCase()] || null
}

export {
  SAMPLE_ROOT,
  SUPPLIER_FIXTURES,
  getSupplierFixture,
  listSampleFiles,
  loadSampleFixtures,
}
