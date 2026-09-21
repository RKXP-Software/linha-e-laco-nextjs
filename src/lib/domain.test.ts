import { describe, expect, it } from 'vitest'
import { calculateMaterialCost, calculateOrderTotal, calculateOutstandingAmount, calculateSuggestedPrice, nextOrderStatus, usernameToAuthEmail } from './domain'

describe('order workflow', () => {
  it('advances only through the agreed commercial stages', () => { expect(nextOrderStatus('quoted')).toBe('approved'); expect(nextOrderStatus('approved')).toBe('in_production'); expect(nextOrderStatus('in_production')).toBe('delivered'); expect(nextOrderStatus('delivered')).toBeNull() })
  it('calculates item totals and never returns a negative total', () => { expect(calculateOrderTotal([{ quantity: 2, unitPrice: 80 }, { quantity: 1, unitPrice: 35 }])).toBe(195); expect(calculateOrderTotal([{ quantity: 1, unitPrice: 20 }], 30)).toBe(0) })
  it('suggests the actual outstanding amount when delivering an order', () => { expect(calculateOutstandingAmount(150, [{ amount: 45 }, { amount: 15 }])).toBe(90); expect(calculateOutstandingAmount(100, [{ amount: 150 }])).toBe(0) })
  it('maps a valid user name to the private Supabase email convention', () => { expect(usernameToAuthEmail(' Marli ')).toBe('marli@users.example.com'); expect(usernameToAuthEmail('ab')).toBeNull() })
  it('adds materials and applies a personal markup', () => { expect(calculateMaterialCost([{ quantity: 2, unitCost: 14.5 }, { quantity: 1.5, unitCost: 8 }])).toBe(41); expect(calculateSuggestedPrice(60, 80)).toBe(108); expect(calculateSuggestedPrice(15, -20)).toBe(15) })
})