export const statusText = (isActive) => (isActive ? 'Active' : 'Inactive')

export const formatFieldValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Not parsed'
  }

  if (typeof value === 'object' && 'parsed' in value) {
    return value.parsed ? String(value.value) : 'Not parsed'
  }

  return String(value)
}

export const getCombinedQrErrors = (result) => [
  ...((Array.isArray(result?.errors) ? result.errors : []) || []),
  ...((Array.isArray(result?.meta?.parseErrors) ? result.meta.parseErrors : []) || []),
]

export const getQrDebugField = (result, key) => {
  if (!result) {
    return { value: null, parsed: false }
  }

  if (result.fields?.[key]) {
    return result.fields[key]
  }

  if (key === 'supplier') {
    const value = result.supplier || result.supplierCode || result.supplierName
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'itemCode') {
    const value =
      result.itemCode ??
      result.category ??
      result.meta?.itemCode?.value ??
      null
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'grossWeight' || key === 'stoneWeight' || key === 'netWeight') {
    const value = result[key]
    return value === null || value === undefined
      ? { value: null, parsed: false }
      : { value, parsed: true }
  }

  if (key === 'karat') {
    const value = result.karat
    return value ? { value, parsed: true } : { value: null, parsed: false }
  }

  return { value: null, parsed: false }
}

export const formatMappingValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.sumIndices)) {
      return `Combine fields ${value.sumIndices.join(' + ')}`
    }

    if (Array.isArray(value.indices)) {
      return `Fields ${value.indices.join(', ')}`
    }

    if (typeof value.index === 'number' && value.stripPrefix) {
      return `Field ${value.index}, remove prefix ${value.stripPrefix}`
    }

    if (typeof value.index === 'number' && value.stripSuffix) {
      return `Field ${value.index}, remove suffix ${value.stripSuffix}`
    }

    if (typeof value.index === 'number' && value.prefix) {
      return `Field ${value.index}, remove prefix ${value.prefix}`
    }

    if (typeof value.index === 'number') {
      return `Field ${value.index}`
    }

    if ('value' in value) {
      return String(value.value)
    }

    return JSON.stringify(value)
  }

  return String(value)
}
