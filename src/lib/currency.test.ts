import { describe, expect, it } from 'vitest'
import { formatBrazilianCurrency, parseBrazilianCurrency } from './currency'

describe('Brazilian currency fields', () => {
  it('formats and parses cents without losing the zero value', () => {
    expect(formatBrazilianCurrency(1234.56)).toBe('R$ 1.234,56')
    expect(parseBrazilianCurrency('R$ 1.234,56')).toBe(1234.56)
    expect(parseBrazilianCurrency('R$ 0,00')).toBe(0)
  })
})