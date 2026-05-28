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

  const normalizedResult = result.normalizedResult || result
  const parseResult = result.parseResult || result
  const display = normalizedResult.display || result.display || parseResult.display || null

  const pickDefined = (...values) => {
    for (const value of values) {
      if (value !== null && value !== undefined && value !== '') {
        return value
      }
    }

    return null
  }

  if (display) {
    if (key === 'supplier') {
      const supplier = display.supplier || {}
      const value = pickDefined(supplier.name, supplier.code)
      return value !== null ? { value, parsed: true } : { value: null, parsed: false }
    }

    if (key === 'itemCode') {
      const item = display.item || {}
      const value = pickDefined(item.itemCode, item.designCode)
      return value !== null ? { value, parsed: true } : { value: null, parsed: false }
    }

    if (key === 'grossWeight' || key === 'stoneWeight' || key === 'netWeight') {
      const weights = display.weights || {}
      if (key === 'netWeight') {
        const value = pickDefined(
          weights.selectedNetWeight,
          weights.qrNetWeight,
          weights.computedNetWeight,
          normalizedResult.selectedNetWeight,
          normalizedResult.qrNetWeight,
          normalizedResult.computedNetWeight,
          normalizedResult.netWeight,
          normalizedResult.net_weight,
          parseResult.display?.weights?.selectedNetWeight,
          parseResult.display?.weights?.qrNetWeight,
          parseResult.display?.weights?.computedNetWeight,
          parseResult.netWeight,
          parseResult.net_weight,
        )
        return value !== null ? { value, parsed: true } : { value: null, parsed: false }
      }

      const value = pickDefined(weights[key], normalizedResult[key], normalizedResult[`${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`], parseResult[key], parseResult[`${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`])
      return value !== null ? { value, parsed: true } : { value: null, parsed: false }
    }

    if (key === 'karat') {
      const item = display.item || {}
      const value = item.karat
      return value !== null && value !== undefined && value !== ''
        ? { value, parsed: true }
        : { value: null, parsed: false }
    }
  }

  if (result.fields?.[key]) {
    return result.fields[key]
  }

  if (key === 'supplier') {
    const value = pickDefined(
      normalizedResult.supplier?.name,
      normalizedResult.supplier?.code,
      normalizedResult.supplier,
      result.supplier,
      result.supplierCode,
      result.supplierName,
      parseResult.supplier?.name,
      parseResult.supplier?.code,
      parseResult.supplier,
    )
    return value !== null ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'itemCode') {
    const value = pickDefined(
      normalizedResult.itemCode,
      normalizedResult.designCode,
      normalizedResult.design_code,
      result.itemCode,
      result.designCode,
      result.design_code,
      result.category,
      result.meta?.itemCode?.value,
      parseResult.itemCode,
      parseResult.designCode,
      parseResult.design_code,
    )
    return value !== null ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'grossWeight' || key === 'stoneWeight' || key === 'netWeight') {
    if (key === 'netWeight') {
      const value = pickDefined(
        normalizedResult.selectedNetWeight,
        normalizedResult.qrNetWeight,
        normalizedResult.computedNetWeight,
        normalizedResult.netWeight,
        normalizedResult.net_weight,
        result.selectedNetWeight,
        result.qrNetWeight,
        result.computedNetWeight,
        result.netWeight,
        result.net_weight,
        parseResult.display?.weights?.selectedNetWeight,
        parseResult.display?.weights?.qrNetWeight,
        parseResult.display?.weights?.computedNetWeight,
        parseResult.selectedNetWeight,
        parseResult.qrNetWeight,
        parseResult.computedNetWeight,
        parseResult.netWeight,
        parseResult.net_weight,
      )
      return value !== null ? { value, parsed: true } : { value: null, parsed: false }
    }

    const value = pickDefined(
      normalizedResult[key],
      normalizedResult[`${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`],
      result[key],
      result[`${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`],
      parseResult[key],
      parseResult[`${key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)}`],
    )
    return value !== null ? { value, parsed: true } : { value: null, parsed: false }
  }

  if (key === 'karat') {
    const value = pickDefined(normalizedResult.karat, result.karat, parseResult.karat)
    return value !== null ? { value, parsed: true } : { value: null, parsed: false }
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
