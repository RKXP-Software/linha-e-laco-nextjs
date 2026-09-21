export function formatBrazilianCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(value) ? value : 0)
}

export function parseBrazilianCurrency(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const digits = String(value ?? '').replace(/\D/g, '')
  return digits ? Number(digits) / 100 : 0
}