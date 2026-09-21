import { toNumber } from './qrParser.shared.js'

// Small, bounded window of nearby columns to try when the configured
// stone/other-weight indices don't reconcile with the QR's own declared net
// weight. Zero is tried first so an already-correct extraction never changes.
const SEARCH_OFFSETS = [0, -1, 1, -2, 2]

const numericAt = (parts, index) => {
  if (!Number.isInteger(index) || index < 0 || index >= parts.length) {
    return null
  }
  return toNumber(parts[index])
}

/**
 * Yug's structural QR format identifies gross/net weight by column position
 * (validated elsewhere via karat/metal/color pattern anchors), but the
 * stone/other-weight columns can shift by one or two positions between item
 * sub-types that carry a different number of optional fields, silently
 * producing a wrong stone/other split with no error.
 *
 * This checks whether the *configured* indices already satisfy the identity
 * `gross - stone1 - stone2 - other ≈ net` within tolerance. If they do,
 * nothing changes. If they don't, it searches a small window of nearby
 * columns for stone1/stone2/other (never gross/net, which are already
 * position-validated) for a combination that DOES satisfy the identity, and
 * returns that instead — never a blind guess, always checked against the
 * QR's own declared net weight.
 *
 * Returns `{ stoneComponent1, stoneComponent2, otherWeight, adjusted, offsets }`
 * where `adjusted` is false when the configured indices already worked.
 */
const resolveYugWeightsByCalculation = ({
  parts,
  grossWeight,
  netWeight,
  stoneComponent1Index,
  stoneComponent2Index,
  otherWeightIndex,
  tolerance = 0.02,
}) => {
  const baseline = {
    stoneComponent1: numericAt(parts, stoneComponent1Index),
    stoneComponent2: numericAt(parts, stoneComponent2Index),
    otherWeight: numericAt(parts, otherWeightIndex),
  }

  const mismatchFor = (candidate) => {
    if (grossWeight === null || netWeight === null) {
      return null
    }
    const stone1 = candidate.stoneComponent1 ?? 0
    const stone2 = candidate.stoneComponent2 ?? 0
    const other = candidate.otherWeight ?? 0
    const computed = grossWeight - stone1 - stone2 - other
    return Math.abs(Number((computed - netWeight).toFixed(3)))
  }

  const baselineMismatch = mismatchFor(baseline)
  if (baselineMismatch === null || baselineMismatch <= tolerance) {
    return { ...baseline, adjusted: false, offsets: { stoneComponent1: 0, stoneComponent2: 0, otherWeight: 0 } }
  }

  let best = null
  for (const stone1Offset of SEARCH_OFFSETS) {
    for (const stone2Offset of SEARCH_OFFSETS) {
      for (const otherOffset of SEARCH_OFFSETS) {
        if (stone1Offset === 0 && stone2Offset === 0 && otherOffset === 0) {
          continue // already tried as the baseline above
        }

        const candidate = {
          stoneComponent1: numericAt(parts, stoneComponent1Index + stone1Offset),
          stoneComponent2: numericAt(parts, stoneComponent2Index + stone2Offset),
          otherWeight: numericAt(parts, otherWeightIndex + otherOffset),
        }

        const mismatch = mismatchFor(candidate)
        if (mismatch === null || mismatch > tolerance) {
          continue
        }

        // All three columns must have actually resolved to a plausible
        // (non-negative) number — an "empty slot reads as 0" match is a
        // false positive, not a real shift.
        if (
          (candidate.stoneComponent1 !== null && candidate.stoneComponent1 < 0) ||
          (candidate.stoneComponent2 !== null && candidate.stoneComponent2 < 0) ||
          (candidate.otherWeight !== null && candidate.otherWeight < 0)
        ) {
          continue
        }

        const totalOffset = Math.abs(stone1Offset) + Math.abs(stone2Offset) + Math.abs(otherOffset)
        if (!best || totalOffset < best.totalOffset) {
          best = {
            ...candidate,
            adjusted: true,
            offsets: { stoneComponent1: stone1Offset, stoneComponent2: stone2Offset, otherWeight: otherOffset },
            totalOffset,
          }
        }
      }
    }
  }

  if (!best) {
    // No nearby shift reconciles either — keep the originally configured
    // values and let the existing tolerance/requiresReview handling flag it.
    return { ...baseline, adjusted: false, offsets: { stoneComponent1: 0, stoneComponent2: 0, otherWeight: 0 } }
  }

  const { totalOffset, ...result } = best
  return result
}

export { resolveYugWeightsByCalculation }
