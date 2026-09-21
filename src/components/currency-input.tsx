'use client'

import { InputHTMLAttributes } from 'react'
import { formatBrazilianCurrency, parseBrazilianCurrency } from '@/lib/currency'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & { value?: number; onValueChange?: (value: number) => void }

export function CurrencyInput({ value = 0, onValueChange, ...props }: Props) {
  return <input {...props} inputMode="numeric" value={formatBrazilianCurrency(value)} onChange={(event) => onValueChange?.(parseBrazilianCurrency(event.target.value))}/>
}