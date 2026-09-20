import { describe, expect, it } from 'vitest'
import { areCompatibleUnits, convertQuantity, materialUsageCost } from './units'

describe('measurement units', () => {
  it('converts compatible units using their canonical factor', () => {
    expect(convertQuantity(30, 'cm', 'm')).toBeCloseTo(0.3)
    expect(convertQuantity(1.5, 'kg', 'g')).toBe(1500)
    expect(materialUsageCost(30, 'cm', 10, 'm')).toBeCloseTo(3)
  })

  it('rejects incompatible unit families', () => {
    expect(areCompatibleUnits('m', 'g')).toBe(false)
    expect(convertQuantity(1, 'm', 'g')).toBeNull()
    expect(materialUsageCost(1, 'm', 10, 'g')).toBeNull()
  })
})