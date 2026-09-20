import { describe, expect, it } from 'vitest'
import { calculateMaterialCost, calculateOrderTotal, calculateSuggestedPrice, nextOrderStatus } from './domain'

describe('order workflow', () => {
  it('advances only through the agreed commercial stages', () => {
    expect(nextOrderStatus('quoted')).toBe('approved')
    expect(nextOrderStatus('approved')).toBe('in_production')
    expect(nextOrderStatus('in_production')).toBe('delivered')
    expect(nextOrderStatus('delivered')).toBeNull()
    expect(nextOrderStatus('cancelled')).toBeNull()
  })

  it('calculates item totals and never returns a negative total', () => {
    expect(calculateOrderTotal([{ quantity: 2, unitPrice: 80 }, { quantity: 1, unitPrice: 35 }])).toBe(195)
    expect(calculateOrderTotal([{ quantity: 1, unitPrice: 20 }], 30)).toBe(0)
  })

  it('adds materials and applies the configured price-table markup', () => {
    const materialCost = calculateMaterialCost([{ quantity: 2, unitCost: 14.5 }, { quantity: 1.5, unitCost: 8 }])
    expect(materialCost).toBe(41)
    expect(calculateSuggestedPrice(materialCost + 19, 80)).toBe(108)
    expect(calculateSuggestedPrice(15, -20)).toBe(15)
  })
})
